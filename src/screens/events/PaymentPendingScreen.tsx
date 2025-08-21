import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, ScrollView, Alert } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types/navigation';
import { checkEventPaymentStatus, getEventStatus, checkRegistrationPaymentStatus, forceVerifyPayment } from '../../services/eventService';
import { COLORS } from '../../constants/colors';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useToast } from '../../hooks/useToast';

type PaymentPendingScreenRouteProp = RouteProp<RootStackParamList, 'PaymentPending'>;
type PaymentPendingScreenNavigationProp = StackNavigationProp<RootStackParamList>;

const PaymentPendingScreen = () => {
  const route = useRoute<PaymentPendingScreenRouteProp>();
  const navigation = useNavigation<PaymentPendingScreenNavigationProp>();
  const toast = useToast();

  // Extract params from route
  const { 
    eventId, 
    paymentUrl, 
    paymentReference, 
    paymentType = 'event_publishing',
    registrationId 
  } = route.params || {};

  // States
  const [status, setStatus] = useState<'pending' | 'success' | 'failed' | 'abandoned'>('pending');
  const [message, setMessage] = useState<string>('Verifying payment status...');
  const [pollingCount, setPollingCount] = useState<number>(0);
  const [pollingActive, setPollingActive] = useState<boolean>(true);
  const [pollingInterval, setPollingInterval] = useState<number>(5000); // Start with 5 seconds
  const [paymentUrlState, setPaymentUrlState] = useState<string | null>(paymentUrl || null);
  const [isOpeningUrl, setIsOpeningUrl] = useState<boolean>(false);
  const [isManuallyChecking, setIsManuallyChecking] = useState<boolean>(false);
  const [hasOpenedBrowser, setHasOpenedBrowser] = useState<boolean>(false);
  const [isForceVerifying, setIsForceVerifying] = useState<boolean>(false);
  
  // Function to force verify payment
  const handleForceVerify = async () => {
    try {
      if (!paymentReference) {
        toast.error('Missing Reference', 'No payment reference available to verify.');
        return;
      }
      
      setIsForceVerifying(true);
      setMessage('Force verifying payment with provider...');
      
      const result = await forceVerifyPayment(paymentReference);
      console.log('Force verify result:', result);
      
      if (result.verification?.success) {
        // Payment was successful
        setStatus('success');
        setMessage('Payment verification successful!');
        setPollingActive(false);
        toast.success('Payment Verified', 'Your payment has been verified successfully.');
        
        // Navigate back after short delay
        setTimeout(() => {
          if (paymentType === 'event_registration') {
                        navigation.navigate('EventDetails', {
              eventId
            });
          } else {
            navigation.navigate('EventDetails', { eventId });
          }
        }, 1500);
      } else if (result.verification?.pending) {
        toast.info('Still Processing', 'Your payment is still being processed by the payment provider. Please check back later.');
        setMessage('Payment is still being processed by the payment provider.');
      } else if (result.verification?.abandoned || result.verification?.failed) {
        const statusType = result.verification.abandoned ? 'abandoned' : 'failed';
        setStatus(statusType as 'abandoned' | 'failed');
        setMessage(`Payment ${statusType}. Please try again.`);
        setPollingActive(false);
        toast.warning(`Payment ${statusType}`, `Your payment was ${statusType}. You can try again.`);
      } else {
        toast.error('Verification Failed', 'Could not verify payment status. Please contact support.');
      }
    } catch (error) {
      console.error('Error force verifying payment:', error);
      toast.error('Verification Error', 'Could not verify payment with provider.');
    } finally {
      setIsForceVerifying(false);
    }
  };
  
  // Function to open payment URL
  const openPaymentUrl = useCallback(async () => {
    if (!paymentUrlState) {
      toast.error('Payment URL Missing', 'No payment URL available to open.');
      return;
    }
    
    try {
      setIsOpeningUrl(true);
      setHasOpenedBrowser(true);
      await WebBrowser.openBrowserAsync(paymentUrlState);
      
      // After browser is closed, immediately check payment status
      checkPaymentStatus(true);
    } catch (error) {
      console.error('Error opening payment URL:', error);
      toast.error('Browser Error', 'Could not open payment page. Please try again.');
    } finally {
      setIsOpeningUrl(false);
    }
  }, [paymentUrlState, toast]);
  
  // Function to check payment status
  const checkPaymentStatus = useCallback(async (isManualCheck = false) => {
    try {
      if (isManualCheck) {
        setIsManuallyChecking(true);
        setMessage('Manually checking payment status...');
        console.log('=== MANUAL PAYMENT CHECK STARTED ===');
      }
      
      console.log('Checking payment status:', {
        paymentType,
        eventId,
        registrationId,
        paymentReference,
        pollingCount
      });
      
      if (paymentType === 'event_registration' && registrationId) {
        // Check registration payment status
        console.log('Checking registration payment status...');
        const response = await checkRegistrationPaymentStatus(eventId, registrationId);
        console.log('Registration payment response:', response);
        
        if (response.paymentStatus === 'completed' || response.registration?.paymentStatus === 'completed') {
          setStatus('success');
          setMessage('Payment completed successfully!');
          setPollingActive(false);
          toast.success('Payment Successful', 'Your registration payment has been processed successfully.');
          
          // Navigate back to event details after short delay
          setTimeout(() => {
            // Pass a flag to indicate payment was completed
            navigation.navigate('EventDetails', { 
              eventId
            });
          }, 1500);
          return;
        } else if (response.paymentStatus === 'abandoned' || response.registration?.paymentStatus === 'abandoned') {
          setStatus('abandoned');
          setMessage('Payment was abandoned. Please try again.');
          setPollingActive(false);
          toast.warning('Payment Abandoned', 'Your payment was not completed. You can try again.');
          
          // Navigate back to event details after short delay
          setTimeout(() => {
            navigation.navigate('EventDetails', { eventId });
          }, 2000);
          return;
        } else if (response.paymentStatus === 'failed' || response.registration?.paymentStatus === 'failed') {
          setStatus('failed');
          setMessage('Payment failed. Please try again with a different payment method.');
          setPollingActive(false);
          toast.error('Payment Failed', 'Your payment could not be processed. Please try again.');
          
          // Navigate back to event details after short delay
          setTimeout(() => {
            navigation.navigate('EventDetails', { eventId });
          }, 2000);
          return;
        }
        
        // If we get here, payment is still pending
        // Use the server's message if available
        if (response.message) {
          setMessage(response.message);
          console.log('Using server message:', response.message);
        } else {
          setMessage(`Payment is still being processed. Attempt ${pollingCount + 1}`);
        }
      } else {
        // Check event publishing payment status
        console.log('Checking event publishing payment status...');
        const response = await checkEventPaymentStatus(eventId);
        console.log('Event payment response:', response);
        
        if (!response.success) {
          console.error('Payment status check failed:', response);
          setMessage(`Error checking payment: ${response.message || 'Unknown error'}`);
          return;
        }
        
        const event = response.event;
        
        if (event.status === 'published') {
          setStatus('success');
          setMessage('Payment completed successfully!');
          setPollingActive(false);
          toast.success('Payment Successful', 'Your event has been published successfully.');
          
          // Navigate back to event details after short delay
          setTimeout(() => {
            navigation.navigate('EventDetails', { eventId });
          }, 1500);
          return;
        } else if (response.paymentStatus === 'abandoned') {
          setStatus('abandoned');
          setMessage('Payment was abandoned. Please try again.');
          setPollingActive(false);
          toast.warning('Payment Abandoned', 'Your payment was not completed. You can try again.');
          return;
        } else if (response.paymentStatus === 'failed') {
          setStatus('failed');
          setMessage('Payment failed. Please try again with a different payment method.');
          setPollingActive(false);
          toast.error('Payment Failed', 'Your payment could not be processed. Please try again.');
          return;
        }
        
        // If we get here, payment is still pending
        // Use the server's message if available
        if (response.message) {
          setMessage(response.message);
          console.log('Using server message:', response.message);
        } else {
          setMessage(`Payment is still being processed. Attempt ${pollingCount + 1}`);
        }
      }
      
      // Increment polling count
      setPollingCount(prev => prev + 1);
      
      // Implement exponential backoff after 10 attempts
      if (pollingCount >= 10 && pollingCount < 20) {
        setPollingInterval(10000); // 10 seconds
      } else if (pollingCount >= 20) {
        setPollingInterval(15000); // 15 seconds
      }
      
      // Stop polling after 60 attempts (5 minutes max)
      if (pollingCount >= 60) {
        setPollingActive(false);
        setStatus('pending');
        setMessage('Payment verification timed out. Please check manually.');
        toast.warning('Verification Timeout', 'Payment verification is taking longer than expected. Please check manually.');
      }
    } catch (error) {
      console.error('Error checking payment status:', error);
      setMessage(`Error checking payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Stop polling after too many errors
      if (pollingCount >= 10) {
        setPollingActive(false);
        setStatus('pending');
        toast.error('Verification Error', 'Could not verify payment status. Please check manually.');
      }
    } finally {
      if (isManualCheck) {
        setIsManuallyChecking(false);
      }
    }
  }, [eventId, registrationId, pollingCount, toast, navigation, paymentType]);
  
  // Effect to fetch payment URL if not provided
  useEffect(() => {
    const fetchPaymentUrl = async () => {
      if (!paymentUrlState && paymentReference) {
        try {
          if (paymentType === 'event_registration' && registrationId) {
            const response = await checkRegistrationPaymentStatus(eventId, registrationId);
            if (response.registration && response.registration.paymentUrl) {
              setPaymentUrlState(response.registration.paymentUrl);
              // Auto-open payment URL when it becomes available
              setTimeout(() => {
      openPaymentUrl();
              }, 500);
            }
    } else {
            const response = await checkEventPaymentStatus(eventId);
            if (response.event && response.event.paymentUrl) {
              setPaymentUrlState(response.event.paymentUrl);
              // Auto-open payment URL when it becomes available
              setTimeout(() => {
                openPaymentUrl();
              }, 500);
            }
          }
        } catch (error) {
          console.error('Error fetching payment URL:', error);
        }
      } else if (paymentUrlState && !hasOpenedBrowser) {
        // Auto-open payment URL if provided and not opened yet
        setTimeout(() => {
          openPaymentUrl();
        }, 500);
      }
    };
    
    fetchPaymentUrl();
  }, [paymentUrlState, paymentReference, eventId, openPaymentUrl, paymentType, registrationId, hasOpenedBrowser]);
  
  // Effect to poll for payment status
  useEffect(() => {
    if (!pollingActive) return;
    
    // Check immediately on first render
    checkPaymentStatus();
    
    // Set up polling interval
    const intervalId = setInterval(checkPaymentStatus, pollingInterval);
    
    return () => clearInterval(intervalId);
  }, [checkPaymentStatus, pollingInterval, pollingActive]);
  
  // Function to handle retry
  const handleRetry = () => {
    setStatus('pending');
    setPollingCount(0);
    setPollingInterval(5000);
    setPollingActive(true);
    setMessage('Verifying payment status...');
    
    // Check immediately
    checkPaymentStatus();
  };

  // Function to handle manual check
  const handleManualCheck = () => {
    checkPaymentStatus(true);
    
    // Show toast to indicate manual check is happening
    toast.info('Checking Payment', 'Verifying your payment status with the payment provider...');
    
    // After a short delay, if still in pending state, show a helpful message
    setTimeout(() => {
      if (status === 'pending') {
        toast.info('Payment Processing', 'If you completed the payment, please allow a few moments for it to be processed by the payment provider.');
      }
    }, 3000);
  };

  // Function to handle cancel
  const handleCancel = () => {
    Alert.alert(
      'Cancel Payment?',
      'Are you sure you want to cancel this payment process?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Yes', 
          style: 'destructive',
          onPress: () => {
            if (paymentType === 'event_registration') {
              navigation.navigate('EventDetails', { eventId });
            } else {
              navigation.navigate('MyEvents');
            }
          }
        }
      ]
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
      <View style={styles.header}>
          <Text style={styles.title}>
            {paymentType === 'event_registration' ? 'Registration Payment' : 'Event Publishing Payment'}
          </Text>
          <Text style={styles.subtitle}>
            {paymentType === 'event_registration' ? 'Complete payment to register for this event' : 'Complete payment to publish your event'}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          {status === 'pending' && (
            <View style={styles.statusIconContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

          {status === 'success' && (
            <View style={[styles.statusIconContainer, styles.successContainer]}>
              <MaterialIcons name="check-circle" size={60} color={COLORS.success} />
          </View>
        )}

          {status === 'failed' && (
            <View style={[styles.statusIconContainer, styles.failedContainer]}>
              <MaterialIcons name="error" size={60} color={COLORS.error} />
            </View>
          )}
          
          {status === 'abandoned' && (
            <View style={[styles.statusIconContainer, styles.abandonedContainer]}>
              <MaterialIcons name="warning" size={60} color={COLORS.warning} />
            </View>
          )}
          
          <Text style={styles.statusText}>{message}</Text>
          
          {paymentReference && (
            <Text style={styles.referenceText}>Reference: {paymentReference}</Text>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {status === 'pending' && (
            <>
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]} 
                onPress={openPaymentUrl}
                disabled={isOpeningUrl || !paymentUrlState}
              >
                {isOpeningUrl ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="card-outline" size={20} color={COLORS.white} />
                    <Text style={styles.buttonText}>
                      {paymentUrlState ? 'Open Payment Page' : 'Loading Payment...'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              
              {hasOpenedBrowser && (
                <TouchableOpacity 
                  style={[styles.button, styles.secondaryButton, styles.checkButton]} 
                  onPress={handleManualCheck}
                  disabled={isManuallyChecking}
                >
                  {isManuallyChecking ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <>
                      <Ionicons name="refresh-circle" size={20} color={COLORS.primary} />
                      <Text style={[styles.buttonText, styles.checkButtonText]}>
                        I've Completed Payment
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={handleCancel}
              >
                <MaterialIcons name="cancel" size={20} color={COLORS.text} />
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
          
          {(status === 'failed' || status === 'abandoned') && (
            <>
              <TouchableOpacity 
                style={[styles.button, styles.primaryButton]} 
                onPress={openPaymentUrl}
                disabled={isOpeningUrl || !paymentUrlState}
              >
                {isOpeningUrl ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="refresh" size={20} color={COLORS.white} />
                    <Text style={styles.buttonText}>Try Again</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.button, styles.secondaryButton]} 
                onPress={handleCancel}
              >
                <MaterialIcons name="arrow-back" size={20} color={COLORS.text} />
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>Go Back</Text>
                </TouchableOpacity>
            </>
          )}
          
          {!pollingActive && status === 'pending' && (
            <TouchableOpacity 
              style={[styles.button, styles.primaryButton]} 
              onPress={handleRetry}
            >
              <Ionicons name="refresh" size={20} color={COLORS.white} />
              <Text style={styles.buttonText}>Check Now</Text>
            </TouchableOpacity>
          )}
          
          {/* Force verify button - appears after multiple attempts */}
          {pollingCount > 5 && status === 'pending' && (
            <TouchableOpacity 
              style={[styles.button, styles.warningButton]} 
              onPress={handleForceVerify}
              disabled={isForceVerifying}
            >
              {isForceVerifying ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="verified" size={20} color={COLORS.white} />
                  <Text style={styles.buttonText}>Force Verify with Provider</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Payment Information</Text>
          <Text style={styles.infoText}>
            • You will be redirected to a secure payment page
          </Text>
          <Text style={styles.infoText}>
            • Your payment is processed securely by Paystack
          </Text>
          <Text style={styles.infoText}>
            • After payment, you will be redirected back to the app
          </Text>
          <Text style={styles.infoText}>
            • If you close the payment page, you can reopen it here
          </Text>
          {hasOpenedBrowser && (
            <Text style={[styles.infoText, styles.importantText]}>
              • If you've completed payment, tap "I've Completed Payment"
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textLight,
    textAlign: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    marginVertical: 24,
  },
  statusIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successContainer: {
    backgroundColor: COLORS.successLight,
  },
  failedContainer: {
    backgroundColor: COLORS.errorLight,
  },
  abandonedContainer: {
    backgroundColor: COLORS.warningLight,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  referenceText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
  },
  actionsContainer: {
    marginVertical: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.lightGray,
  },
  warningButton: {
    backgroundColor: COLORS.warning,
  },
  checkButton: {
    backgroundColor: COLORS.successLight,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: COLORS.text,
  },
  checkButtonText: {
    color: COLORS.primary,
  },
  infoContainer: {
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.text,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textLight,
    marginBottom: 8,
  },
  importantText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
}); 

export default PaymentPendingScreen; 