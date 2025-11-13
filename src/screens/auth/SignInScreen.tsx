import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard, ScrollView, Animated, Modal } from 'react-native';
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
import { signInWithEmailAndPassword, signOut, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '../../config/firebaseConfig';
import EmailVerificationModal from '../../components/EmailVerificationModal';
// NEW: OAuth imports (POOP)
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { signInWithGoogle, handleGoogleCallback } from '../../services/oauth/googleProvider';

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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false); // NEW: Google OAuth loading state (POOP)
  const [keepLoggedIn, setKeepLoggedIn] = useState(true); // Default to true for better UX
  const [errors, setErrors] = useState({
    email: '',
    password: '',
  });
  const [authFieldErrors, setAuthFieldErrors] = useState({
    email: false,
    password: false,
  });
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [showRetryModal, setShowRetryModal] = useState(false);
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

  // Optimized password visibility toggle to prevent shaking
  const handleTogglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
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

  // NEW: Google OAuth handler (POOP)
  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    
    try {
      console.log('[SignIn] Starting Google OAuth...');
      
      // This will open the browser and return immediately
      // The actual sign-in completes via deep link callback
      await signInWithGoogle();
      
      // Note: signInWithGoogle throws 'pending_callback' error
      // Deep link listener will handle the actual sign-in
    } catch (error: any) {
      setIsGoogleLoading(false);
      
      // If it's a pending_callback error, that's expected
      if (error.code === 'pending_callback') {
        console.log('[SignIn] Waiting for OAuth callback...');
        return; // Deep link listener will handle completion
      }
      
      // Handle user cancellation
      if (error.code === 'user_cancelled') {
        console.log('[SignIn] User cancelled Google sign-in');
        toast.info('Cancelled', 'Google sign-in was cancelled');
        return;
      }
      
      // Handle other errors
      console.error('[SignIn] Google OAuth error:', error);
      toast.error('Sign In Failed', error.message || 'Failed to sign in with Google');
    }
  };

  // NEW: Deep link listener for OAuth callback (POOP)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = event.url;
      console.log('[SignIn] Deep link received:', url);
      
      // Check if it's an OAuth callback
      if (url.includes('oauth-callback')) {
        try {
          console.log('[SignIn] Processing OAuth callback...');
          
          // Handle OAuth callback - this completes the sign-in
          const oauthResult = await handleGoogleCallback(url);
          
          // Dismiss the browser window (it doesn't auto-close with custom URL schemes)
          WebBrowser.dismissBrowser();
          
          console.log('[SignIn] OAuth successful, fetching user data...');
          
          // REUSE CEMENT - Same flow as email/password
          const firebaseToken = oauthResult.token;
          const firebaseUser = oauthResult.user;
          
          // Fetch user data from backend (REUSES CEMENT - same as email/password)
          const response = await fetch(buildUrl(`/Users/${firebaseUser.uid}`), {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${firebaseToken}`,
            },
          });
          
          if (response.ok) {
            const userData = await response.json();
            
            // REUSE CEMENT - storeAuthData (same as email/password)
            await storeAuthData({
              userToken: `Bearer ${firebaseToken}`,
              userData: userData,
              userRole: userData.role || 'user',
              keepLoggedIn,
              lastLoginTime: Date.now(),
            });
            
            await updateLastLoginTime();
            
            console.log('[SignIn] OAuth sign-in complete, navigating to MainApp');
            
            // REUSE CEMENT - Same navigation as email/password
            navigation.getParent()?.navigate('MainApp');
            
            toast.success('Welcome!', `Signed in as ${userData.email}`);
          } else {
            // Backend user fetch failed - use Firebase user data
            console.warn('[SignIn] Backend user fetch failed, using Firebase data');
            
            const userData = {
              id: firebaseUser.uid,
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || '',
              email: firebaseUser.email || '',
              plan: 'free'
            };
            
            await storeAuthData({
              userToken: `Bearer ${firebaseToken}`,
              userData: userData,
              userRole: 'user',
              keepLoggedIn,
              lastLoginTime: Date.now(),
            });
            
            await updateLastLoginTime();
            
            navigation.getParent()?.navigate('MainApp');
            
            toast.success('Welcome!', `Signed in as ${userData.email}`);
          }
          
          setIsGoogleLoading(false);
        } catch (error: any) {
          // Silently ignore stale callbacks - they're from previous OAuth attempts
          if (error.code === 'stale_callback') {
            console.log('[SignIn] Ignoring stale OAuth callback from previous attempt');
            setIsGoogleLoading(false);
            return; // Don't show error toast
          }
          
          console.error('[SignIn] OAuth callback error:', error);
          setIsGoogleLoading(false);
          toast.error('Sign In Failed', error.message || 'Failed to complete Google sign-in');
        }
      }
    };
    
    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });
    
    // Cleanup
    return () => {
      subscription.remove();
    };
  }, [keepLoggedIn, navigation, toast]);

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

    // Trim email for validation
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    setErrors(newErrors);
    setAuthFieldErrors({
      email: false,
      password: false,
    });
    return isValid;
  };



  const handleSignIn = async () => {
    if (!validateForm()) {
      return;
    }

    const trimmedEmail = email.trim();
    if (trimmedEmail !== email) {
      setEmail(trimmedEmail);
    }

    setIsLoading(true);

    try {
      console.log('SignIn: Starting Firebase authentication...');

      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
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
        
        // iOS-specific verifications
        if (Platform.OS === 'ios') {
          const verification = await getStoredAuthData();
          console.log('iOS SignIn: Verification - stored keepLoggedIn:', verification?.keepLoggedIn);
        }
        console.log('SignIn: Firebase auth state listener will now handle automatic token refresh');
        
        // Navigate to root navigator's MainApp screen
        navigation.getParent()?.navigate('MainApp');
        setAuthFieldErrors({ email: false, password: false });
        if (failedAttempts !== 0) {
          setFailedAttempts(0);
        }
        if (showRetryModal) {
          setShowRetryModal(false);
        }
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
        setAuthFieldErrors({ email: false, password: false });
        if (failedAttempts !== 0) {
          setFailedAttempts(0);
        }
        if (showRetryModal) {
          setShowRetryModal(false);
        }
      }
    } catch (error: any) {
      console.error('SignIn: Authentication error:', error);
      
      // Handle Firebase authentication errors silently
      if (error.code) {
        console.error('SignIn: Authentication error:', error.code, error.message);

        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
          try {
            const signInMethods = await fetchSignInMethodsForEmail(auth, trimmedEmail);

            if (!signInMethods || signInMethods.length === 0) {
              setFailedAttempts(prev => {
                const next = prev + 1;
                if (next >= 3) {
                  setShowRetryModal(true);
                }
                return next;
              });
              const neutralMessage = 'We couldn\'t sign you in. Please check your email or password and try again.';
              setAuthFieldErrors({ email: true, password: true });
              setErrors(prev => ({ ...prev, email: '', password: '' }));
              toast.error('Sign In Failed', neutralMessage);
              return;
            }
          } catch (methodCheckError) {
            console.warn('SignIn: Failed to check sign-in methods:', methodCheckError);
          }
        }
        
        // Set field-specific errors and show toast notifications
        switch (error.code) {
          case 'auth/wrong-password': {
            const neutralMessage = 'We couldn\'t sign you in. Please check your email or password and try again.';
            setAuthFieldErrors({ email: true, password: true });
            setErrors(prev => ({ ...prev, email: '', password: '' }));
            toast.error('Sign In Failed', neutralMessage);
            setFailedAttempts(prev => {
              const next = prev + 1;
              if (next >= 3) {
                setShowRetryModal(true);
              }
              return next;
            });
            break;
          }
          case 'auth/invalid-credential': {
            const neutralMessage = 'We couldn\'t sign you in. Please check your email or password and try again.';
            setAuthFieldErrors({ email: true, password: true });
            setErrors(prev => ({ ...prev, email: '', password: '' }));
            toast.error('Sign In Failed', neutralMessage);
            setFailedAttempts(prev => {
              const next = prev + 1;
              if (next >= 3) {
                setShowRetryModal(true);
              }
              return next;
            });
            break;
          }
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
        style={[styles.input, (errors.email || authFieldErrors.email) ? styles.inputError : null]}
        placeholder="Email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          if (authFieldErrors.email) {
            setAuthFieldErrors(prev => ({ ...prev, email: false }));
          }
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#999"
      />
      {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}

      <View style={styles.passwordContainer}>
        <TextInput
          style={[styles.input, styles.passwordInput, (errors.password || authFieldErrors.password) ? styles.inputError : null]}
          placeholder="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (authFieldErrors.password) {
              setAuthFieldErrors(prev => ({ ...prev, password: false }));
            }
          }}
          secureTextEntry={!showPassword}
          placeholderTextColor="#999"
        />
        <TouchableOpacity 
          style={styles.eyeIcon}
          onPress={handleTogglePasswordVisibility}
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

      {/* NEW: OAuth divider (POOP) */}
      <View style={styles.oauthDivider}>
        <View style={styles.oauthDividerLine} />
        <Text style={styles.oauthDividerText}>OR</Text>
        <View style={styles.oauthDividerLine} />
      </View>

      {/* NEW: Google Sign-In Button (POOP - connected to handler) */}
      <TouchableOpacity 
        style={[styles.googleButton, isGoogleLoading && styles.disabledButton]}
        onPress={handleGoogleSignIn}
        disabled={isGoogleLoading || isLoading}
      >
        <MaterialIcons name="login" size={20} color="#4285F4" style={styles.googleIcon} />
        <Text style={styles.googleButtonText}>
          {isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}
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

      <Modal
        visible={showRetryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRetryModal(false)}
      >
        <View style={styles.retryOverlay}>
          <View style={styles.retryModal}>
            <View style={styles.retryIconContainer}>
              <MaterialIcons name="help-outline" size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.retryTitle}>Need a Hand?</Text>
            <Text style={styles.retryMessage}>
              We haven’t been able to sign you in after a few tries. You can reset your password or create a new account to keep going.
            </Text>
            <View style={styles.retryButtons}>
              <TouchableOpacity
                style={[styles.retryButton, styles.retryPrimaryButton]}
                onPress={() => {
                  setShowRetryModal(false);
                  setFailedAttempts(0);
                  setAuthFieldErrors({ email: false, password: false });
                  navigation.navigate('ForgotPassword');
                }}
              >
                <Text style={styles.retryPrimaryButtonText}>Reset Password</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retryButton, styles.retrySecondaryButton]}
                onPress={() => {
                  setShowRetryModal(false);
                  navigation.navigate('SignUp', { prefillEmail: email.trim() });
                  setFailedAttempts(0);
                  setAuthFieldErrors({ email: false, password: false });
                }}
              >
                <Text style={styles.retrySecondaryButtonText}>Create Account</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.retryLink}
              onPress={() => {
                  setShowRetryModal(false);
                  setFailedAttempts(0);
                setAuthFieldErrors({ email: false, password: false });
                }}
              >
              <Text style={styles.retryLinkText}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  retryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  retryModal: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  retryIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  retryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButtons: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
  },
  retryButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  retrySecondaryButton: {
    backgroundColor: '#F3F4F6',
  },
  retrySecondaryButtonText: {
    color: '#4B5563',
    fontSize: 16,
    fontWeight: '600',
  },
  retryPrimaryButton: {
    backgroundColor: COLORS.secondary,
  },
  retryPrimaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  retryLink: {
    marginTop: 16,
  },
  retryLinkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  // NEW: OAuth styles (POOP)
  oauthDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  oauthDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  oauthDividerText: {
    marginHorizontal: 15,
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  googleIcon: {
    marginRight: 10,
  },
  googleButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
});