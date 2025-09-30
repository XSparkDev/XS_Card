import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, ENDPOINTS, getUserId, performServerLogout, authenticatedFetchWithRefresh } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
// RevenueCat imports - iOS payment integration
import { shouldUseRevenueCat, getPlatformConfig } from '../../utils/paymentPlatform';
import revenueCatService, { SubscriptionPackage, SubscriptionStatus } from '../../services/revenueCatService';

type UnlockPremiumStackParamList = {
  UnlockPremium: undefined;
  SignIn: undefined;
};

const UnlockPremium = ({ navigation }: NativeStackScreenProps<UnlockPremiumStackParamList, 'UnlockPremium'>) => {
  const [selectedPlan, setSelectedPlan] = useState('annually');
  const [userPlan, setUserPlan] = useState<string>('free');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState<'ZAR' | 'USD'>('ZAR');
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loadingSubscriptionData, setLoadingSubscriptionData] = useState(false);
  const { logout } = useAuth(); // Use our centralized auth context
  
  // RevenueCat state - iOS payment integration
  const [revenueCatPackages, setRevenueCatPackages] = useState<SubscriptionPackage[]>([]);
  const [revenueCatStatus, setRevenueCatStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingRevenueCat, setLoadingRevenueCat] = useState(false);

  // Define pricing for both currencies
  const pricing = {
    ZAR: {
      annually: { total: 1800, monthly: 150, save: 120 },
      monthly: { total: 159.99 }
    },
    USD: {
      annually: { total: 99, monthly: 8.25, save: 7 },
      monthly: { total: 8.99 }
    }
  };

  // Currency symbols
  const currencySymbols = {
    ZAR: 'R',
    USD: '$'
  };

  useEffect(() => {
    const getUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const { email, plan } = JSON.parse(userData);
          setUserEmail(email);
          setUserPlan(plan);
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };

    // RevenueCat initialization - iOS only
    const initializeRevenueCat = async () => {
      if (!shouldUseRevenueCat()) {
        console.log('Not iOS platform, skipping RevenueCat initialization');
        return;
      }

      try {
        setLoadingRevenueCat(true);
        
        // Get user ID for RevenueCat
        const userId = await getUserId();
        if (!userId) {
          console.log('No user ID available for RevenueCat initialization');
          return;
        }

        // Configure RevenueCat with the shared secret
        const configured = await revenueCatService.configure({
          apiKey: 'appl_wtSPChhISOCRASiRWkuJSHTCVIF', // iOS API key
          userId: userId
        });

        if (configured) {
          // Load available packages
          const packages = await revenueCatService.getAvailablePackages();
          setRevenueCatPackages(packages);
          
          console.log(`RevenueCat: Loaded ${packages.length} packages:`, packages.map(p => p.identifier));
          
          // Check subscription status
          const status = await revenueCatService.getSubscriptionStatus();
          setRevenueCatStatus(status);
          
          console.log('RevenueCat: Subscription status:', status?.isActive ? 'Active' : 'Inactive');
          console.log('RevenueCat initialized successfully');
        } else {
          console.error('RevenueCat: Configuration failed');
        }
      } catch (error) {
        console.error('RevenueCat initialization error:', error);
      } finally {
        setLoadingRevenueCat(false);
      }
    };

    getUserData();
    checkSubscriptionStatus();
    initializeRevenueCat(); // Add RevenueCat initialization
  }, []);

  const checkSubscriptionStatus = async () => {
    setLoadingSubscriptionData(true);
    try {
      const response = await authenticatedFetchWithRefresh(ENDPOINTS.SUBSCRIPTION_STATUS, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.status && data.data?.isActive) {
          setUserPlan('premium');
          setSubscriptionData(data.data);
          
          // Update local storage with current subscription status
          const userData = await AsyncStorage.getItem('userData');
          if (userData) {
            const parsedUserData = JSON.parse(userData);
            parsedUserData.plan = 'premium';
            await AsyncStorage.setItem('userData', JSON.stringify(parsedUserData));
          }
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    } finally {
      setLoadingSubscriptionData(false);
    }
  };

  // Currency Toggle Component
  const CurrencyToggle = () => (
    <View style={styles.currencyToggleContainer}>
      <Text style={styles.currencyToggleLabel}>Currency:</Text>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            currency === 'ZAR' && styles.toggleOptionActive
          ]}
          onPress={() => setCurrency('ZAR')}
        >
          <Text style={[
            styles.toggleText,
            currency === 'ZAR' && styles.toggleTextActive
          ]}>
            ZAR (R)
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleOption,
            currency === 'USD' && styles.toggleOptionActive
          ]}
          onPress={() => setCurrency('USD')}
        >
          <Text style={[
            styles.toggleText,
            currency === 'USD' && styles.toggleTextActive
          ]}>
            USD ($)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Updated logout function using centralized AuthContext
  const logoutUser = async () => {
    try {
      console.log('UnlockPremium: Starting logout process...');
      
      // Perform server logout first (non-blocking)
      try {
        await performServerLogout();
      } catch (serverError) {
        console.log('UnlockPremium: Server logout failed, continuing with local logout:', serverError);
        // Continue with local logout even if server logout fails
      }
      
      // Use our centralized logout from AuthContext
      await logout();
      
      console.log('UnlockPremium: Logout completed, navigating to SignIn');
      
      // Use CommonActions to reset navigation to the initial route
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'SignIn' }],
        })
      );
      
    } catch (error) {
      console.error('UnlockPremium: Error during logout:', error);
      
      Alert.alert(
        'Logout Error', 
        'There was an issue logging out. You will be redirected to the sign-in screen.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'SignIn' }],
                })
              );
            }
          }
        ]
      );
    }
  };

  const handleCancelSubscription = async () => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel your premium subscription? You will lose access to premium features at the end of your billing period.',
      [
        {
          text: 'No, Keep Premium',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              const response = await authenticatedFetchWithRefresh(ENDPOINTS.CANCEL_SUBSCRIPTION, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                }
              });
              
              if (response.ok) {
                const result = await response.json();
                console.log('Cancellation result:', result);
                
                if (result.status) {
                  Alert.alert(
                    'Subscription Cancelled', 
                    'Your subscription has been cancelled successfully. You will now be logged out.',
                    [
                      {
                        text: 'OK',
                        onPress: () => logoutUser()
                      }
                    ]
                  );
                } else {
                  Alert.alert('Error', result.message || 'Failed to cancel subscription.');
                }
              } else {
                const errorResult = await response.json().catch(() => ({}));
                Alert.alert('Error', errorResult.message || 'Failed to cancel subscription. Please try again.');
              }
            } catch (error) {
              console.error('Error cancelling subscription:', error);
              Alert.alert('Error', 'An error occurred while cancelling your subscription. Please try again or contact support.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // iOS RevenueCat payment handler - additive change
  const handleIOSPayment = async () => {
    try {
      setIsProcessing(true);

      if (!revenueCatService.isReady()) {
        Alert.alert('Error', 'Payment system not ready. Please try again.');
        return;
      }

      // Find the appropriate package based on selected plan
      const targetPackage = revenueCatPackages.find(pkg => 
        selectedPlan === 'annually' ? 
          pkg.identifier.includes('annual') || pkg.packageType === 'ANNUAL' :
          pkg.identifier.includes('monthly') || pkg.packageType === 'MONTHLY'
      );

      if (!targetPackage) {
        Alert.alert('Error', 'Subscription plan not available. Please try again.');
        return;
      }

      console.log(`Purchasing iOS package: ${targetPackage.identifier}`);

      // Make the purchase
      const result = await revenueCatService.purchasePackage(targetPackage.identifier);

      if (result.success) {
        Alert.alert(
          'Purchase Successful!',
          'Your premium subscription is now active. Enjoy all premium features!',
          [
            {
              text: 'Continue',
              onPress: () => {
                // Refresh subscription status
                checkSubscriptionStatus();
              }
            }
          ]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Purchase could not be completed.');
      }

    } catch (error) {
      console.error('iOS payment error:', error);
      Alert.alert('Error', 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Existing Paystack payment handler (kept for non-iOS platforms)
  const handlePaymentInitiation = async () => {
    try {
      setIsProcessing(true);
      const currentPricing = pricing[currency];
      const amount = selectedPlan === 'annually' ? currentPricing.annually.total : currentPricing.monthly.total;

      const response = await authenticatedFetchWithRefresh(ENDPOINTS.INITIALIZE_PAYMENT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: userEmail,
          amount: amount,
          currency: currency,
          // Add a success URL that will handle returning to the app and logging out
          // This depends on deep linking configuration in your app
          callback_url: 'xscard://payment-success'
        }),
      });

      const data = await response.json();

      if (data.status && data.data?.authorization_url) {
        // Inform user they'll need to log back in after payment
        Alert.alert(
          'Payment Processing',
          'You will be redirected to complete your payment. After successful payment, please log back in to access your premium features.',
          [
            {
              text: 'Continue',
              onPress: async () => {
                // Open payment URL in browser
                await Linking.openURL(data.data.authorization_url);
              }
            }
          ]
        );
      } else {
        throw new Error('Payment initialization failed');
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Failed to initiate payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Platform-aware payment handler - determines which payment method to use
  const handlePayment = async () => {
    if (shouldUseRevenueCat()) {
      await handleIOSPayment();
    } else {
      await handlePaymentInitiation();
    }
  };

  // iOS restore purchases handler
  const handleRestorePurchases = async () => {
    if (!shouldUseRevenueCat()) {
      return;
    }

    try {
      setIsLoading(true);
      
      const result = await revenueCatService.restorePurchases();
      
      if (result.success) {
        // Check if any subscriptions were restored
        const status = await revenueCatService.getSubscriptionStatus();
        setRevenueCatStatus(status);
        
        if (status?.isActive) {
          Alert.alert(
            'Purchases Restored!',
            'Your premium subscription has been restored.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  checkSubscriptionStatus();
                }
              }
            ]
          );
        } else {
          Alert.alert('No Purchases Found', 'No previous purchases were found to restore.');
        }
      } else {
        Alert.alert('Restore Failed', result.error || 'Could not restore purchases.');
      }
      
    } catch (error) {
      console.error('Restore purchases error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPremiumUserUI = () => {
    const getNextBillingDate = () => {
      if (!subscriptionData) return null;
      
      // Try different possible fields for next billing date
      // Priority: Paystack live data > stored nextBillingDate > subscriptionEnd > trialEndDate > firstBillingDate
      const nextBilling = subscriptionData.paystackData?.nextPaymentDate ||
                         subscriptionData.nextBillingDate || 
                         subscriptionData.subscriptionEnd || 
                         subscriptionData.trialEndDate ||
                         subscriptionData.firstBillingDate;
      
      if (nextBilling) {
        const date = new Date(nextBilling);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
      
      return null;
    };

    const getBillingInfo = () => {
      if (!subscriptionData) return null;
      
      const nextBillingDate = getNextBillingDate();
      const interval = subscriptionData.interval || subscriptionData.paystackData?.interval || 'monthly';
      const amount = subscriptionData.amount || subscriptionData.paystackData?.amount;
      
      return {
        nextBillingDate,
        interval,
        amount,
        isLiveData: !!subscriptionData.paystackData
      };
    };

    const billingInfo = getBillingInfo();

    return (
      <View style={styles.premiumContainer}>
        <MaterialIcons name="verified" size={80} color={COLORS.success} />
        <Text style={styles.premiumTitle}>Premium Subscription Active</Text>
        <Text style={styles.premiumSubtitle}>
          You have access to all premium features
        </Text>
        
        {loadingSubscriptionData ? (
          <View style={styles.billingInfoContainer}>
            <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
            <View style={styles.billingInfoTextContainer}>
              <Text style={styles.billingInfoText}>
                Loading billing information...
              </Text>
            </View>
          </View>
        ) : billingInfo?.nextBillingDate ? (
          <View style={styles.billingInfoContainer}>
            <MaterialIcons name="schedule" size={20} color={COLORS.primary} />
            <View style={styles.billingInfoTextContainer}>
              <Text style={styles.billingInfoText}>
                Next billing: {billingInfo.nextBillingDate}
              </Text>
               {billingInfo.interval && billingInfo.amount && (
                 <Text style={styles.billingInfoSubtext}>
                   {billingInfo.interval === 'annually' ? 'Annual' : 'Monthly'} • R{(billingInfo.amount / 100).toFixed(2)}
                 </Text>
               )}
            </View>
          </View>
        ) : subscriptionData ? (
          <View style={styles.billingInfoContainer}>
            <MaterialIcons name="info" size={20} color={COLORS.primary} />
            <View style={styles.billingInfoTextContainer}>
              <Text style={styles.billingInfoText}>
                Premium subscription active
              </Text>
              <Text style={styles.billingInfoSubtext}>
                Billing details will be available soon
              </Text>
            </View>
          </View>
        ) : null}
        
        <TouchableOpacity
          style={[styles.cancelButton, isLoading && styles.disabledButton]}
          onPress={handleCancelSubscription}
          disabled={isLoading}
        >
          <Text style={styles.cancelButtonText}>
            {isLoading ? 'Processing...' : 'Cancel Subscription'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const currentPricing = pricing[currency];
  const symbol = currencySymbols[currency];

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton} 
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </TouchableOpacity>

      {userPlan === 'premium' ? (
        renderPremiumUserUI()
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>
            Be a better networker, upgrade to XS Card premium
          </Text>

          <TouchableOpacity 
            style={[
              styles.trialButton, 
              { marginVertical: 20 },
              isProcessing && styles.disabledButton
            ]}
            onPress={handlePayment}
            disabled={isProcessing}
          >
            <Text style={styles.trialButtonText}>
              {isProcessing ? 'Processing...' : 'Start your 7-day free trial'}
            </Text>
          </TouchableOpacity>

          {/* Currency Toggle */}
          <CurrencyToggle />

          {/* Pricing Options */}
          <View style={styles.pricingContainer}>
            <TouchableOpacity 
              style={[
                styles.planOption,
                selectedPlan === 'annually' && styles.selectedPlan
              ]}
              onPress={() => setSelectedPlan('annually')}
            >
              <View style={styles.saveBadge}>
                <Text style={styles.saveText}>Save {symbol}{currentPricing.annually.save}</Text>
              </View>
              <Text style={styles.planType}>Annually</Text>
              <Text style={styles.price}>{symbol}{currentPricing.annually.total.toFixed(2)}</Text>
              <Text style={styles.monthlyPrice}>{symbol}{currentPricing.annually.monthly.toFixed(2)}/month</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[
                styles.planOption,
                selectedPlan === 'monthly' && styles.selectedPlan
              ]}
              onPress={() => setSelectedPlan('monthly')}
            >
              <Text style={styles.planType}>Monthly</Text>
              <Text style={styles.price}>{symbol}{currentPricing.monthly.total.toFixed(2)}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.cancelText}>7-day free trial. Cancel anytime</Text>

          {/* Feature Comparison */}
          <View style={styles.comparisonContainer}>
            <View style={styles.comparisonCard}>
              <View style={styles.headerRow}>
                <View style={styles.featureHeaderColumn}>
                  <Text style={styles.headerTitle}>Features</Text>
                </View>
                <View style={styles.valueHeaderColumn}>
                  <Text style={styles.headerText}>Free</Text>
                </View>
                <View style={styles.valueHeaderColumn}>
                  <Text style={styles.headerTextPremium}>Premium</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>Maximum number of cards</Text>
                  <Text style={styles.featureSubtitle}>Create up to 5 cards with XSCard</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.freeValue}>1</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.premiumValue}>5</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>Add a custom color to your card</Text>
                  <Text style={styles.featureSubtitle}>Set your color theme to be any color you like.</Text>
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="lock" size={24} color="#9E9E9E" />
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="check-circle" size={24} color="#FF6B6B" />
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>QR code customization</Text>
                  <Text style={styles.featureSubtitle}>Premium QR code designs with brand colours</Text>
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="lock" size={24} color="#9E9E9E" />
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="check-circle" size={24} color="#FF6B6B" />
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>Analytics</Text>
                  <Text style={styles.featureSubtitle}>Track scans, contacts, and engagement</Text>
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="lock" size={24} color="#9E9E9E" />
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="check-circle" size={24} color="#FF6B6B" />
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>Email support</Text>
                  <Text style={styles.featureSubtitle}>48h response → 12h priority support</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.freeValue}>48h</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.premiumValue}>12h</Text>
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>Calendar integration</Text>
                  <Text style={styles.featureSubtitle}>Direct calendar booking and invites</Text>
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="lock" size={24} color="#9E9E9E" />
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="check-circle" size={24} color="#FF6B6B" />
                </View>
              </View>

              <View style={styles.featureRow}>
                <View style={styles.featureColumn}>
                  <Text style={styles.featureTitle}>Social media integration</Text>
                  <Text style={styles.featureSubtitle}>Connect all your social profiles</Text>
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="lock" size={24} color="#9E9E9E" />
                </View>
                <View style={styles.valueColumn}>
                  <MaterialIcons name="check-circle" size={24} color="#FF6B6B" />
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity>
            <Text style={styles.alreadyPaidText}>
              I have already paid for XSCard Premium.{' '}
              <Text style={styles.tapHereText}>Tap here</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[
              styles.bottomTrialButton,
              isProcessing && styles.disabledButton
            ]}
            onPress={handlePayment}
            disabled={isProcessing}
          >
            <Text style={styles.bottomTrialButtonText}>
              {isProcessing ? 'Processing...' : 'Start 7-day free trial'}
            </Text>
          </TouchableOpacity>

          {/* Restore Purchases button - iOS only */}
          {shouldUseRevenueCat() && (
            <TouchableOpacity 
              style={[
                styles.restoreButton,
                isLoading && styles.disabledButton
              ]}
              onPress={handleRestorePurchases}
              disabled={isLoading}
            >
              <Text style={styles.restoreButtonText}>
                {isLoading ? 'Restoring...' : 'Restore Purchases'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingBottom: 20,
  },
  closeButton: {
    padding: 15,
    position: 'absolute',
    top: 25,
    left: 10,
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#000',
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  trialButton: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  trialButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pricingContainer: {
    marginVertical: 20,
  },
  planOption: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 15,
    padding: 20,
    marginVertical: 10,
    position: 'relative',
  },
  selectedPlan: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
  },
  saveBadge: {
    position: 'absolute',
    top: -12,
    right: 20,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 15,
    paddingVertical: 5,
    borderRadius: 15,
  },
  saveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planType: {
    fontSize: 16,
    color: '#666',
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 5,
  },
  monthlyPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  cancelText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
  },
  comparisonContainer: {
    marginTop: 20,
    paddingHorizontal: 0,
  },
  comparisonCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 15,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  featureHeaderColumn: {
    flex: 2,
    alignItems: 'center',
  },
  headerTitle: {
    flex: 2,
    fontSize: 16,
    color: '#666',
  },
  valueHeaderColumn: {
    flex: 1,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 16,
    color: '#666',
  },
  headerTextPremium: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  featureRow: {
    flexDirection: 'row',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  featureColumn: {
    flex: 2,
    paddingRight: 10,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  featureSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  valueColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeValue: {
    fontSize: 16,
    color: '#666',
  },
  premiumValue: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  bottomTrialButton: {
    backgroundColor: '#000',
    padding: 15,
    borderRadius: 25,
    alignItems: 'center',
    marginVertical: 20,
  },
  bottomTrialButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  restoreButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignSelf: 'center',
  },
  restoreButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.primary,
    textAlign: 'center',
  },
  alreadyPaidText: {
    textAlign: 'center',
    color: '#666',
    marginVertical: 20,
    fontSize: 14,
  },
  tapHereText: {
    textDecorationLine: 'underline',
    color: '#666',
  },
  premiumContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 20,
    textAlign: 'center',
  },
  premiumSubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    marginTop: 10,
    textAlign: 'center',
    marginBottom: 30,
  },
  cancelButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 10,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  currencyToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  currencyToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginRight: 15,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    padding: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleOption: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: 'white',
  },
  billingInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginTop: 15,
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  billingInfoTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  billingInfoText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  billingInfoSubtext: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 2,
  },
});

export default UnlockPremium;
