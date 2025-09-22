import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView, Animated } from 'react-native';
import { COLORS } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { MaterialIcons } from '@expo/vector-icons';
import { API_BASE_URL, ENDPOINTS, buildUrl, useToast } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ErrorPopup import removed - no popups on signin page
import { setKeepLoggedInPreference, storeAuthData, updateLastLoginTime, clearAuthData, getStoredAuthData } from '../../utils/authStorage';
// Error handler imports removed - no popups on signin page
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import EmailVerificationModal from '../../components/EmailVerificationModal';

type SignInScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'SignIn'>;

// Add these admin credentials
const ADMIN_CREDENTIALS = {
  email: 'admin@xscard.com',
  password: 'admin123'
};

export default function SignInScreen() {
  const navigation = useNavigation<SignInScreenNavigationProp>();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true); // Default to true for better UX
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  // Error popup removed - no popups on signin page



  // Animated values for smooth toggle
  const toggleAnimation = useRef(new Animated.Value(1)).current; // Start at 1 (on position)
  const backgroundColorAnimation = useRef(new Animated.Value(1)).current; // Start at 1 (active color)

  useEffect(() => {
    // Animate toggle when keepLoggedIn changes
    Animated.parallel([
      Animated.spring(toggleAnimation, {
        toValue: keepLoggedIn ? 1 : 0,
        tension: 100,
        friction: 8,
        useNativeDriver: false,
      }),
      Animated.timing(backgroundColorAnimation, {
        toValue: keepLoggedIn ? 1 : 0,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [keepLoggedIn]);

  const handleTogglePress = () => {
    setKeepLoggedIn(!keepLoggedIn);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setShowVerificationModal(false);
      setUnverifiedEmail('');
      // Clear any stored auth data
      await clearAuthData();
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Error', 'Failed to sign out. Please try again.');
    }
  };


  // const validateEmail = (email: string) => {
  //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  //   return emailRegex.test(email);
  // };

  const validateForm = () => {
    const newErrors = {
      email: '',
      password: '',
    };

    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };



  const handleSignIn = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      console.log('SignIn: Starting Firebase authentication...');
      
      // Use Firebase client SDK for authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      console.log('SignIn: Firebase authentication successful:', firebaseUser.uid);
      
      // 🔥 CRITICAL: Check email verification
      if (!firebaseUser.emailVerified) {
        console.log('SignIn: Email not verified, showing verification modal');
        setUnverifiedEmail(firebaseUser.email || email);
        setShowVerificationModal(true);
        return;
      }
      
      console.log('SignIn: Email verified, proceeding with sign in');
      
      // Get Firebase ID token for backend calls
      const firebaseToken = await firebaseUser.getIdToken();
      console.log('SignIn: Firebase token obtained');
      
      // Now get user data from your backend using the Firebase token
      const response = await fetch(buildUrl(`${ENDPOINTS.GET_USER}/${firebaseUser.uid}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${firebaseToken}`,
        },
      });

      if (response.ok) {
        const backendUserData = await response.json();
        console.log('SignIn: User data retrieved from backend:', JSON.stringify(backendUserData, null, 2));
        
        // Store the token and user data using our enhanced storage system
        const token = `Bearer ${firebaseToken}`;
        
        // Backend returns user data directly (not wrapped in a user property)
        const userData = {
          // Spread backend data safely
          ...backendUserData,
          // Ensure we have essential fields with fallbacks
          id: backendUserData?.id || firebaseUser.uid,
          uid: backendUserData?.id || firebaseUser.uid, // Backend uses 'id', we need 'uid'
          name: backendUserData?.name || firebaseUser.displayName || '',
          email: backendUserData?.email || firebaseUser.email || '',
          plan: backendUserData?.plan || 'free' // Default plan
        };

        // Use our Phase 1 storage system to store all auth data
        console.log('SignIn: About to store auth data with keepLoggedIn:', keepLoggedIn);
        await storeAuthData({
          userToken: token,
          userData: userData,
          userRole: userData.plan === 'admin' ? 'admin' : 'user',
          keepLoggedIn,
          lastLoginTime: Date.now(),
        });

        // Update last login time
        await updateLastLoginTime();

        console.log('SignIn: Data stored successfully, keepLoggedIn:', keepLoggedIn);
        
        // iOS-specific verification
        if (Platform.OS === 'ios') {
          const verification = await getStoredAuthData();
          console.log('iOS SignIn: Verification - stored keepLoggedIn:', verification?.keepLoggedIn);
        }
        console.log('SignIn: Firebase auth state listener will now handle automatic token refresh');
        
        // Navigate to root navigator's MainApp screen
        navigation.getParent()?.navigate('MainApp');
      } else {
        // Handle backend data retrieval failures
        console.warn('SignIn: Backend user data retrieval failed, using Firebase user data');
        
        // Fallback to Firebase user data if backend fails
        const userData = {
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || '',
          email: firebaseUser.email || '',
          plan: 'free' // Default plan
        };

        const token = `Bearer ${firebaseToken}`;
        
        await storeAuthData({
          userToken: token,
          userData: userData,
          userRole: 'user',
          keepLoggedIn,
          lastLoginTime: Date.now(),
        });

        // Update last login time
        await updateLastLoginTime();

        console.log('SignIn: Data stored successfully with fallback data, keepLoggedIn:', keepLoggedIn);
        
        // Navigate to root navigator's MainApp screen
        navigation.getParent()?.navigate('MainApp');
      }
    } catch (error: any) {
      console.error('SignIn: Authentication error:', error);
      
      // Handle Firebase authentication errors silently
      if (error.code) {
        console.error('SignIn: Authentication error:', error.code, error.message);
        
        // Set field-specific errors and show toast notifications
        switch (error.code) {
          case 'auth/user-not-found':
            setErrors(prev => ({ ...prev, email: 'No account found with this email' }));
            toast.error('Sign In Failed', 'No account found with this email address');
            break;
          case 'auth/wrong-password':
            setErrors(prev => ({ ...prev, password: 'Invalid password' }));
            toast.error('Sign In Failed', 'Incorrect password. Please try again');
            break;
          case 'auth/invalid-credential':
            setErrors(prev => ({ ...prev, email: 'Invalid credentials' }));
            toast.error('Sign In Failed', 'Invalid email or password. Please check your credentials and try again');
            break;
          case 'auth/invalid-email':
            setErrors(prev => ({ ...prev, email: 'Invalid email format' }));
            toast.error('Invalid Email', 'Please enter a valid email address');
            break;
          case 'auth/user-disabled':
            setErrors(prev => ({ ...prev, email: 'Account disabled' }));
            toast.error('Account Disabled', 'This account has been disabled. Please contact support');
            break;
          case 'auth/too-many-requests':
            setErrors(prev => ({ ...prev, password: 'Too many attempts. Try later' }));
            toast.error('Too Many Attempts', 'Please wait a few minutes before trying again');
            break;
          case 'auth/network-request-failed':
            setErrors(prev => ({ ...prev, email: 'Network error' }));
            toast.error('Network Error', 'Please check your internet connection and try again');
            break;
          default:
            console.error('SignIn: Unknown authentication error:', error);
            toast.error('Sign In Failed', 'An unexpected error occurred. Please try again');
        }
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        // Handle network errors with toast
        console.error('SignIn: Network error:', error);
        setErrors(prev => ({ ...prev, email: 'Network error' }));
        toast.error('Network Error', 'Unable to connect to server. Please check your internet connection');
      } else {
        // Handle other errors with toast
        console.error('SignIn: Other error:', error);
        setErrors(prev => ({ ...prev, email: 'Authentication failed' }));
        toast.error('Sign In Failed', 'An unexpected error occurred. Please try again');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 50 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
      {/* ErrorPopup removed - no popups on signin page */}
      
      <Text style={styles.title}>Sign In</Text>

      <TextInput
        style={[styles.input, errors.email ? styles.inputError : null]}
        placeholder="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          // Only clear error if there's actually an error to clear
          if (errors.email) {
            setErrors(prev => ({ ...prev, email: '' }));
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#999"
      />
      {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.input, styles.passwordInput, errors.password ? styles.inputError : null]}
          placeholder="Password"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            // Only clear error if there's actually an error to clear
            if (errors.password) {
              setErrors(prev => ({ ...prev, password: '' }));
            }
          }}
          secureTextEntry={!showPassword}
          placeholderTextColor="#999"
        />
        <TouchableOpacity 
          style={styles.eyeIcon}
          onPress={() => setShowPassword(!showPassword)}
        >
          <MaterialIcons 
            name={showPassword ? "visibility" : "visibility-off"} 
            size={24} 
            color="#999" 
          />
        </TouchableOpacity>
      </View>
      {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
      
      <TouchableOpacity 
        style={styles.forgotPasswordLink}
        onPress={() => navigation.navigate('ForgotPassword')}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Keep me logged in toggle */}
      <View style={styles.keepLoggedInContainer}>
        <TouchableOpacity 
          style={styles.toggleTouchArea}
          onPress={handleTogglePress}
          activeOpacity={0.8}
        >
          <Animated.View 
            style={[
              styles.toggleSwitch,
              {
                backgroundColor: backgroundColorAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#FFFFFF', COLORS.primary],
                }),
                borderColor: backgroundColorAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#E0E0E0', COLORS.primary],
                }),
              }
            ]}
          >
            <Animated.View style={[
              styles.toggleThumb,
              {
                transform: [{
                  translateX: toggleAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 28], // More precise calculation: 60 - 24 - 8 (accounting for padding)
                  })
                }],
                backgroundColor: backgroundColorAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['#E0E0E0', '#FFFFFF'],
                }),
              }
            ]} />
          </Animated.View>
          <Text style={styles.keepLoggedInText}>Keep me logged in</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={[styles.signInButton, isLoading && styles.disabledButton]}
        onPress={handleSignIn}
        disabled={isLoading}
      >
        <Text style={styles.signInButtonText}>
          {isLoading ? 'Signing In...' : 'Sign In'}
        </Text>
      </TouchableOpacity>



      <View style={styles.signUpContainer}>
        <Text style={styles.signUpText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.signUpLink}>Sign Up</Text>
        </TouchableOpacity>
      </View>
        </ScrollView>
      </TouchableWithoutFeedback>
      
      <EmailVerificationModal
        visible={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        userEmail={unverifiedEmail}
        onSignOut={handleSignOut}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  signInButton: {
    backgroundColor: '#1E1B4B',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  signInButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },

  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signUpText: {
    color: '#666',
    fontSize: 16,
  },
  signUpLink: {
    color: COLORS.primary,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
    width: '100%',
    marginBottom: 15,
  },
  passwordInput: {
    marginBottom: 0,
    paddingRight: 50,
  },
  eyeIcon: {
    position: 'absolute',
    right: 15,
    top: 12,
    padding: 5,
  },
  disabledButton: {
    opacity: 0.7,
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 15,
  },
  forgotPasswordLink: {
    alignItems: 'flex-end',
    marginTop: -10,
  },
  forgotPasswordText: {
    color: COLORS.primary,
    fontSize: 12,
  },
  // New styles for Keep me logged in toggle
  keepLoggedInContainer: {
    marginTop: 10,
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  toggleTouchArea: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  toggleSwitch: {
    width: 60,
    height: 32,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 3,
    marginBottom: 8,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
    alignSelf: 'flex-start',
  },
  keepLoggedInText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});