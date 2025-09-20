import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { COLORS } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../utils/api';
import { MaterialIcons } from '@expo/vector-icons';

export default function EmailVerificationScreen() {
  const { resendVerificationEmail, user, logout } = useAuth();
  const toast = useToast();
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    if (!user?.email) {
      toast.error('Error', 'No email address found');
      return;
    }

    setIsResending(true);
    try {
      await resendVerificationEmail();
      toast.success('Verification Email Sent', 'Please check your inbox and spam folder for the verification link');
    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error('Failed to Send', 'Unable to send verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Error', 'Failed to sign out. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="email" size={80} color={COLORS.primary} />
        </View>
        
        <Text style={styles.title}>Verify Your Email</Text>
        
        <Text style={styles.message}>
          We've sent a verification link to:
        </Text>
        
        <Text style={styles.email}>
          {user?.email}
        </Text>
        
        <Text style={styles.instructions}>
          Please check your inbox and click the verification link to activate your account. 
          Don't forget to check your spam folder!
        </Text>
        
        <TouchableOpacity 
          style={[styles.resendButton, isResending && styles.disabledButton]}
          onPress={handleResendVerification}
          disabled={isResending}
        >
          <Text style={styles.resendButtonText}>
            {isResending ? 'Sending...' : 'Resend Verification Email'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  email: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 40,
  },
  resendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    minWidth: 250,
  },
  resendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  signOutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    minWidth: 250,
  },
  signOutButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
