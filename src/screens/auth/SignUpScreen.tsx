import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../../constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { API_BASE_URL, ENDPOINTS, buildUrl } from '../../utils/api';
// ErrorPopup import removed - no popups on signup page
import AsyncStorage from '@react-native-async-storage/async-storage';
// Error handler imports removed - no popups on signup page

type SignUpScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  // Error popup removed - no popups on signup page

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    return passwordRegex.test(password);
  };

  const validateForm = () => {
    const newErrors = {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    };

    let isValid = true;

    if (!firstName.trim()) {
      setErrorMessage('First name is required');
      setShowError(true);
      newErrors.firstName = 'First name is required';
      isValid = false;
    }

    if (!lastName.trim()) {
      setErrorMessage('Last name is required');
      setShowError(true);
      newErrors.lastName = 'Last name is required';
      isValid = false;
    }

    if (!email.trim()) {
      setErrorMessage('Email is required');
      setShowError(true);
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      setShowError(true);
      newErrors.email = 'Please enter a valid email address';
      isValid = false;
    }

    if (!password) {
      setErrorMessage('Password is required');
      setShowError(true);
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (!validatePassword(password)) {
      setErrorMessage('Password must be at least 8 characters and contain uppercase, lowercase, and numbers');
      setShowError(true);
      newErrors.password = 'Password must be at least 8 characters and contain uppercase, lowercase, and numbers';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignUp = async () => {
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      // Create basic user account with minimal info
      const userData = {
        name: firstName,
        surname: lastName,
        email,
        password,
        status: 'active',
      };

      const response = await fetch(buildUrl(ENDPOINTS.ADD_USER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        // Handle specific signup errors
        if (response.status === 409) {
          // User already exists
          const error = createAppError(ERROR_CODES.VALIDATION_ERROR, new Error(errorData.message || 'Email already exists'));
          await ErrorHandler.handleError(error);
          setErrorMessage(error.userMessage);
        } else if (response.status >= 500) {
          // Server error with retry
          const error = createAppError(ERROR_CODES.SERVER_ERROR, new Error(errorData.message || 'Server error'));
          await ErrorHandler.handleError(error, {
            retryAction: async () => {
              await handleSignUp();
            },
            maxRetries: 2
          });
          setErrorMessage(error.userMessage);
        } else {
          // Other API errors
          const error = createAppError(ERROR_CODES.API_ERROR, new Error(errorData.message || 'Failed to create account'));
          await ErrorHandler.handleError(error);
          setErrorMessage(error.userMessage);
        }
        setShowError(true);
        return;
      }

      const data = await response.json();
      const userId = data.userId;

      // Store temporary auth state with error handling
      try {
        await AsyncStorage.setItem('tempUserId', userId);
        await AsyncStorage.setItem('tempUserEmail', email);
      } catch (storageError) {
        await handleStorageError(storageError);
        // Continue anyway - user can still proceed
      }
      
      // Navigate to complete profile
      navigation.navigate('CompleteProfile', { userId });
      
    } catch (error) {
      console.error('SignUp: Error during signup:', error);
      
      // Handle network errors silently
      if (error instanceof TypeError && error.message.includes('fetch')) {
        console.error('SignUp: Network error:', error);
        setErrors(prev => ({ ...prev, email: 'Network error' }));
      } else {
        // Handle other errors silently
        console.error('SignUp: Other error:', error);
        setErrors(prev => ({ ...prev, email: 'Signup failed' }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* ErrorPopup removed - no popups on signup page */}
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.stepIndicator}>
            <View style={styles.stepActive}>
              <Text style={styles.stepActiveText}>1</Text>
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepInactive}>
              <Text style={styles.stepInactiveText}>2</Text>
            </View>
          </View>
          
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Basic Information</Text>
          
          <TextInput
            style={[styles.input, errors.firstName ? styles.inputError : null]}
            placeholder="First name"
            value={firstName}
            onChangeText={(text) => {
              setFirstName(text);
              setErrors(prev => ({ ...prev, firstName: '' }));
            }}
            placeholderTextColor="#999"
          />
          {errors.firstName ? <Text style={styles.errorText}>{errors.firstName}</Text> : null}

          <TextInput
            style={[styles.input, errors.lastName ? styles.inputError : null]}
            placeholder="Last name"
            value={lastName}
            onChangeText={(text) => {
              setLastName(text);
              setErrors(prev => ({ ...prev, lastName: '' }));
            }}
            placeholderTextColor="#999"
          />
          {errors.lastName ? <Text style={styles.errorText}>{errors.lastName}</Text> : null}

          <TextInput
            style={[styles.input, errors.email ? styles.inputError : null]}
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrors(prev => ({ ...prev, email: '' }));
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
                setErrors(prev => ({ ...prev, password: '' }));
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
            style={[styles.signUpButton, isLoading && styles.disabledButton]}
            onPress={handleSignUp}
            disabled={isLoading}
          >
            <Text style={styles.signUpButtonText}>
              {isLoading ? 'Creating Account...' : 'Continue to Step 2'}
            </Text>
          </TouchableOpacity>

          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomPadding} />
        </ScrollView>

        {Platform.OS === 'android' && (
          <LinearGradient
            colors={['transparent', COLORS.white]}
            style={styles.fadeEffect}
            pointerEvents="none"
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  stepActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActiveText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepInactive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInactiveText: {
    color: '#999',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 10,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  uploadSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  uploadLabel: {
    flex: 1,
    fontSize: 16,
    color: '#666',
  },
  uploadButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signUpButton: {
    backgroundColor: '#1E1B4B',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  signUpButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signInText: {
    color: '#666',
    fontSize: 16,
  },
  signInLink: {
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
  keyboardView: {
    flex: 1,
  },
  bottomPadding: {
    height: 50,
  },
  fadeEffect: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    zIndex: 1,
  },
  profilePreview: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  disabledButton: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  imageSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#777',
    marginBottom: 15,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  imageButton: {
    width: 130,
    height: 130,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
});