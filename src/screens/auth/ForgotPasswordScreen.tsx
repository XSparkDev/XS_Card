import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform, 
  TouchableWithoutFeedback, 
  Keyboard, 
  ScrollView,
  Alert 
} from 'react-native';
import { COLORS } from '../../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { MaterialIcons } from '@expo/vector-icons';
import { ENDPOINTS, buildUrl } from '../../utils/api';
import ErrorPopup from '../../components/popups/ErrorPopup';

type ForgotPasswordScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordScreenNavigationProp>();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showError, setShowError] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage('Email is required');
      setShowError(true);
      return;
    }

    if (!validateEmail(email)) {
      setErrorMessage('Please enter a valid email address');
      setShowError(true);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(buildUrl(ENDPOINTS.FORGOT_PASSWORD), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setEmailSent(true);
      } else {
        setErrorMessage(data.message || 'Failed to send reset email');
        setShowError(true);
      }
    } catch (error) {
      setErrorMessage('Network error. Please check your connection.');
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.container}>
          <View style={styles.successIconContainer}>
            <MaterialIcons name="mark-email-read" size={80} color={COLORS.primary} />
          </View>
          
          <Text style={styles.title}>Check Your Email</Text>
          <Text style={styles.successMessage}>
            We've sent password reset instructions to:
          </Text>
          <Text style={styles.emailDisplay}>{email}</Text>
          <Text style={styles.subMessage}>
            Check your email and follow the link to reset your password. The link will expire in 1 hour.
          </Text>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.navigate('SignIn')}
          >
            <MaterialIcons name="arrow-back" size={20} color={COLORS.white} />
            <Text style={styles.buttonText}>Back to Sign In</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.secondaryButton]}
            onPress={() => setEmailSent(false)}
          >
            <MaterialIcons name="email" size={20} color="#1E1B4B" />
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>Try Different Email</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

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
          <ErrorPopup
            visible={showError}
            message={errorMessage}
            onClose={() => setShowError(false)}
          />
          
          <View style={styles.iconContainer}>
            <MaterialIcons name="lock-outline" size={80} color={COLORS.primary} />
          </View>
          
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we'll send you a link to reset your password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Email Address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#999"
          />

          <TouchableOpacity 
            style={[styles.button, isLoading && styles.disabledButton]}
            onPress={handleForgotPassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <MaterialIcons name="hourglass-empty" size={20} color={COLORS.white} />
                <Text style={styles.buttonText}>Sending...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="send" size={20} color={COLORS.white} />
                <Text style={styles.buttonText}>Send Reset Link</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.navigate('SignIn')}
          >
            <MaterialIcons name="arrow-back" size={20} color={COLORS.primary} />
            <Text style={styles.backButtonText}>Back to Sign In</Text>
          </TouchableOpacity>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.white,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 30,
  },
  successIconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#1E1B4B',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  successMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  emailDisplay: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: COLORS.primary,
    fontWeight: '600',
  },
  subMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    marginBottom: 20,
    fontSize: 16,
    width: '100%',
  },
  button: {
    backgroundColor: '#1E1B4B',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1E1B4B',
  },
  secondaryButtonText: {
    color: '#1E1B4B',
  },
  disabledButton: {
    opacity: 0.7,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 5,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
}); 