import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator 
} from 'react-native';
import { COLORS } from '../constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast, buildUrl, ENDPOINTS } from '../utils/api';

interface EmailVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  userEmail: string;
  onSignOut: () => void;
}

export default function EmailVerificationModal({ 
  visible, 
  onClose, 
  userEmail, 
  onSignOut 
}: EmailVerificationModalProps) {
  const toast = useToast();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleResendVerification = async () => {
    if (resendCooldown > 0) {
      toast.error('Please Wait', `Please wait ${resendCooldown} seconds before requesting another verification email.`);
      return;
    }

    setIsResending(true);
    try {
      // Call public resend verification endpoint (no token required)
      const response = await fetch(buildUrl(ENDPOINTS.RESEND_VERIFICATION_PUBLIC), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Verification Email Sent', 'Please check your inbox and spam folder for the verification link.');
        
        // Set cooldown timer
        setResendCooldown(60);
        const timer = setInterval(() => {
          setResendCooldown(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        throw new Error(data.message || 'Failed to send verification email');
      }

    } catch (error) {
      console.error('Resend verification error:', error);
      toast.error('Failed to Send', 'Unable to send verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleSignOut = () => {
    onSignOut();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <MaterialIcons name="email" size={40} color={COLORS.primary} />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleSignOut}>
              <MaterialIcons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.title}>Verify Your Email</Text>
          
          <Text style={styles.message}>
            Please check your inbox for the verification email we sent to:
          </Text>
          
          <Text style={styles.email}>
            {userEmail}
          </Text>
          
          <Text style={styles.instructions}>
            Click the verification link in your email to activate your account. 
            Don't forget to check your spam folder!
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[
                styles.resendButton, 
                (isResending || resendCooldown > 0) && styles.disabledButton
              ]}
              onPress={handleResendVerification}
              disabled={isResending || resendCooldown > 0}
            >
              {isResending ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.resendButtonText}>
                  {resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : 'Resend Verification Email'
                  }
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.helpSection}>
            <Text style={styles.helpTitle}>Need Help?</Text>
            <Text style={styles.helpText}>
              • Check your spam/junk folder{'\n'}
              • Make sure you entered the correct email address{'\n'}
              • Wait a few minutes for the email to arrive{'\n'}
              • Contact support if you continue having issues
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
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
    marginBottom: 24,
  },
  buttonContainer: {
    gap: 8,
  },
  resendButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  resendButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  helpSection: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 6,
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
});
