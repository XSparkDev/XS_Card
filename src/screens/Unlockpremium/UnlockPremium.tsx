import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { getRevenueCatApiKey } from '../../config/revenueCatConfig';
import { PRICING, DEFAULT_CURRENCY, getUserCurrency, getPricing } from '../../config/pricing';

type UnlockPremiumStackParamList = {
  UnlockPremium: undefined;
  SignIn: undefined;
};

const UnlockPremium = ({ navigation }: NativeStackScreenProps<UnlockPremiumStackParamList, 'UnlockPremium'>) => {
  const insets = useSafeAreaInsets();
  const [selectedPlan, setSelectedPlan] = useState('annually');
  const [userPlan, setUserPlan] = useState<string>('free');
  const [isProcessing, setIsProcessing] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currency, setCurrency] = useState<'ZAR' | 'USD'>(DEFAULT_CURRENCY as 'ZAR' | 'USD');
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [loadingSubscriptionData, setLoadingSubscriptionData] = useState(false);
  const { logout } = useAuth(); // Use our centralized auth context
  
  // RevenueCat state - iOS payment integration
  const [revenueCatPackages, setRevenueCatPackages] = useState<SubscriptionPackage[]>([]);
  const [revenueCatStatus, setRevenueCatStatus] = useState<SubscriptionStatus | null>(null);
  const [loadingRevenueCat, setLoadingRevenueCat] = useState(false);

  // Get current pricing based on selected currency
  const currentPricing = getPricing(currency);
  
  // Format pricing for display - maintain the expected structure
  const pricing = {
    [currency]: {
      annually: { 
        total: currentPricing.annual, 
        monthly: currentPricing.annual / 12, 
        save: Math.round((currentPricing.monthly * 12) - currentPricing.annual) 
      },
      monthly: { total: currentPricing.monthly }
    }
  };

  // Currency symbols
  const currencySymbols = {
    ZAR: 'R',
    USD: '$'
  };

  useEffect(() => {
    // Auto-detect user's preferred currency
    const detectedCurrency = getUserCurrency();
    setCurrency(detectedCurrency as 'ZAR' | 'USD');
    console.log(`Auto-detected currency: ${detectedCurrency}`);

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

    getUserData();
    checkSubscriptionStatus();
    
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

        // Configure RevenueCat with platform-specific API key
        const apiKey = getRevenueCatApiKey();
        
        // DEBUG: Show API key in console
        console.log('RevenueCat: API Key Debug - Platform:', Platform.OS);
        console.log('RevenueCat: API Key Debug - Key:', apiKey.substring(0, 20) + '...');
        
        const configured = await revenueCatService.configure({
          apiKey: apiKey,
          userId: userId
        });

        if (configured) {
          // Load available packages
          const packages = await revenueCatService.getOfferings();
          setRevenueCatPackages(packages);
          
          // DEBUG: Show RevenueCat packages in console
          console.log('RevenueCat: Debug Info - Found', packages.length, 'packages');
          console.log('RevenueCat: Debug Info - Packages:', packages.map(p => ({
            id: p.identifier,
            product: p.product.identifier,
            title: p.product.title,
            price: p.product.priceString
          })));
          
          // Check current subscription status
          const status = await revenueCatService.getSubscriptionStatus();
          setRevenueCatStatus(status);
        }
      } catch (error) {
        console.error('RevenueCat initialization error:', error);
      } finally {
        setLoadingRevenueCat(false);
      }
    };

    initializeRevenueCat();
  }, []);

  const checkSubscriptionStatus = async () => {
    setLoadingSubscriptionData(true);
    try {
      // CENTRALIZED RBAC: Only check users.plan field from GET_USER endpoint
      const userId = await getUserId();
      if (!userId) {
        console.log('UnlockPremium: No user ID found');
        return;
      }
      
      const response = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_USER}/${userId}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Get plan from users collection (single source of truth)
        const userPlanFromDB = data.plan || 'free';
        console.log('UnlockPremium: User plan from database:', userPlanFromDB);
        
        setUserPlan(userPlanFromDB);
        
        // Update local storage with current plan
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          parsedUserData.plan = userPlanFromDB;
          await AsyncStorage.setItem('userData', JSON.stringify(parsedUserData));
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    } finally {
      setLoadingSubscriptionData(false);
    }
  };

  // iOS RevenueCat payment handler
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

      // Purchase the package
      const result = await revenueCatService.purchasePackage(targetPackage.identifier);
      
      if (result.success) {
        console.log('✅ Purchase successful, syncing with backend...');
        
        // CRITICAL: Sync with backend to update Firestore database
        // This is necessary because webhooks don't fire for simulator purchases
        try {
          const syncResponse = await authenticatedFetchWithRefresh(ENDPOINTS.REVENUECAT_SYNC, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (syncResponse.ok) {
            const syncData = await syncResponse.json();
            console.log('✅ Backend sync successful:', syncData);
          } else {
            console.warn('⚠️ Backend sync failed, but purchase was successful');
          }
        } catch (syncError) {
          console.error('❌ Backend sync error:', syncError);
          // Don't fail the purchase flow - user already paid
        }
        
        // Update subscription status
        const status = await revenueCatService.getSubscriptionStatus();
        setRevenueCatStatus(status);
        
        // Update user plan locally
        setUserPlan('premium');
        
        // Update local storage
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          const parsedUserData = JSON.parse(userData);
          parsedUserData.plan = 'premium';
          await AsyncStorage.setItem('userData', JSON.stringify(parsedUserData));
        }

        Alert.alert(
          'Payment Successful!',
          'Your premium subscription is now active. Enjoy all premium features!',
          [
            {
              text: 'Continue',
              onPress: () => {
                // Navigate back or refresh the screen
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        Alert.alert('Payment Failed', result.error || 'Could not complete purchase. Please try again.');
      }
    } catch (error) {
      console.error('iOS payment error:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
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


  // Currency Toggle Component - USD first (bigger market)
  const CurrencyToggle = () => (
    <View style={styles.currencyToggleContainer}>
      <Text style={styles.currencyToggleLabel}>Currency:</Text>
      <View style={styles.toggleContainer}>
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

  const handleManageSubscription = () => {
    // Navigate directly to subscription management screen
    navigation.navigate('SubscriptionManagement' as never);
  };

  const handlePaymentInitiation = async () => {
    try {
      setIsProcessing(true);
      const amount = selectedPlan === 'annually' ? pricing[currency].annually.total : pricing[currency].monthly.total;

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
          style={[styles.manageButton, isLoading && styles.disabledButton]}
          onPress={handleManageSubscription}
          disabled={isLoading}
        >
          <Text style={styles.manageButtonText}>
            Manage Subscription
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const symbol = currencySymbols[currency];

  // Helper function to get trial text from package
  const getTrialText = (pkg: SubscriptionPackage | undefined): string => {
    if (!pkg?.product.introPrice) return '';
    
    const intro = pkg.product.introPrice;
    if (intro.price === 0) {
      // Free trial
      const duration = `${intro.periodNumberOfUnits} ${intro.periodUnit.toLowerCase()}${intro.periodNumberOfUnits > 1 ? 's' : ''}`;
      return `${duration} free trial`;
    }
    // Discounted trial
    return `${intro.priceString} for ${intro.periodNumberOfUnits} ${intro.periodUnit.toLowerCase()}${intro.periodNumberOfUnits > 1 ? 's' : ''}`;
  };

  // Get packages for display
  const annualPackage = revenueCatPackages.find(pkg => 
    pkg.identifier.includes('annual') || pkg.packageType === 'ANNUAL'
  );
  const monthlyPackage = revenueCatPackages.find(pkg => 
    pkg.identifier.includes('monthly') || pkg.packageType === 'MONTHLY'
  );

  // Determine if we're using RevenueCat pricing
  const useRevenueCat = shouldUseRevenueCat() && revenueCatPackages.length > 0;
  
  // Show loading state while RevenueCat initializes
  const isLoadingPricing = shouldUseRevenueCat() && loadingRevenueCat;

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={[styles.closeButton, { top: Math.max(insets.top, 25) }]} 
        onPress={() => navigation.goBack()}
      >
        <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      {userPlan === 'premium' ? (
        renderPremiumUserUI()
      ) : (
        <ScrollView style={styles.content}>
          <Text style={styles.title}>
            Be a better networker, upgrade to XS Card premium
          </Text>

          {isLoadingPricing ? (
            <View style={[styles.trialButton, { marginVertical: 20, justifyContent: 'center' }]}>
              <Text style={styles.trialButtonText}>Loading pricing...</Text>
            </View>
          ) : (
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
                {isProcessing ? 'Processing...' : (() => {
                  const currentPackage = selectedPlan === 'annually' ? annualPackage : monthlyPackage;
                  const trialText = currentPackage?.product.introPrice 
                    ? `Start your ${getTrialText(currentPackage)}`
                    : 'Subscribe Now';
                  return trialText;
                })()}
              </Text>
            </TouchableOpacity>
          )}

          {/* Subscription Information - Required by Apple */}
          <View style={styles.subscriptionInfoContainer}>
            <Text style={styles.subscriptionInfoTitle}>XS Card Premium Subscription</Text>
            <Text style={styles.subscriptionInfoText}>
              • {selectedPlan === 'annually' ? 'Annual' : 'Monthly'} subscription{'\n'}
              • Price: {currencySymbols[currency]}{selectedPlan === 'annually' ? pricing[currency].annually.total : pricing[currency].monthly.total}{'\n'}
              • Auto-renewable subscription{'\n'}
              • Cancel anytime in your device settings
            </Text>
            
            <View style={styles.legalLinksContainer}>
              <TouchableOpacity 
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://xscard.co.za/terms')}
              >
                <Text style={styles.legalLinkText}>Terms of Use</Text>
              </TouchableOpacity>
              <Text style={styles.legalSeparator}> • </Text>
              <TouchableOpacity 
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://xscard.co.za/privacy')}
              >
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Currency Toggle - Only show for non-RevenueCat platforms */}
          {!useRevenueCat && <CurrencyToggle />}

          {/* Pricing Options */}
          <View style={styles.pricingContainer}>
            {isLoadingPricing ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading subscription options...</Text>
              </View>
            ) : (
              <>
                {/* Annual Plan */}
                {useRevenueCat && annualPackage && (
                  <TouchableOpacity 
                    style={[
                      styles.planOption,
                      selectedPlan === 'annually' && styles.selectedPlan
                    ]}
                    onPress={() => setSelectedPlan('annually')}
                  >
                    {monthlyPackage && (
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveText}>
                          Save {annualPackage.product.currencyCode === 'USD' ? '$' : ''}{(monthlyPackage.product.price * 12 - annualPackage.product.price).toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.planType}>Annually</Text>
                    <Text style={styles.price}>{annualPackage.product.priceString}</Text>
                    <Text style={styles.monthlyPrice}>
                      {(annualPackage.product.price / 12).toFixed(2)} {annualPackage.product.currencyCode}/month
                    </Text>
                    {annualPackage.product.introPrice && (
                      <Text style={styles.trialBadge}>{getTrialText(annualPackage)}</Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* Monthly Plan */}
                {useRevenueCat && monthlyPackage && (
                  <TouchableOpacity 
                    style={[
                      styles.planOption,
                      selectedPlan === 'monthly' && styles.selectedPlan
                    ]}
                    onPress={() => setSelectedPlan('monthly')}
                  >
                    <Text style={styles.planType}>Monthly</Text>
                    <Text style={styles.price}>{monthlyPackage.product.priceString}</Text>
                    {monthlyPackage.product.introPrice && (
                      <Text style={styles.trialBadge}>{getTrialText(monthlyPackage)}</Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* FALLBACK PRICING - COMMENTED OUT FOR NOW, PRESERVED FOR FUTURE USE */}
                {/* 
                {!useRevenueCat && (
                  <>
                    <TouchableOpacity 
                      style={[
                        styles.planOption,
                        selectedPlan === 'annually' && styles.selectedPlan
                      ]}
                      onPress={() => setSelectedPlan('annually')}
                    >
                      <View style={styles.saveBadge}>
                        <Text style={styles.saveText}>Save {symbol}{pricing[currency].annually.save}</Text>
                      </View>
                      <Text style={styles.planType}>Annually</Text>
                      <Text style={styles.price}>{symbol}{pricing[currency].annually.total.toFixed(2)}</Text>
                      <Text style={styles.monthlyPrice}>{symbol}{pricing[currency].annually.monthly.toFixed(2)}/month</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      style={[
                        styles.planOption,
                        selectedPlan === 'monthly' && styles.selectedPlan
                      ]}
                      onPress={() => setSelectedPlan('monthly')}
                    >
                      <Text style={styles.planType}>Monthly</Text>
                      <Text style={styles.price}>{symbol}{pricing[currency].monthly.total.toFixed(2)}</Text>
                    </TouchableOpacity>
                  </>
                )}
                */}
              </>
            )}
          </View>

          {/* Trial text - Dynamic based on selected plan */}
          {!isLoadingPricing && useRevenueCat && (
            <Text style={styles.cancelText}>
              {selectedPlan === 'annually' && annualPackage?.product.introPrice
                ? `${getTrialText(annualPackage)}. Cancel anytime`
                : selectedPlan === 'monthly' && monthlyPackage?.product.introPrice
                ? `${getTrialText(monthlyPackage)}. Cancel anytime`
                : 'Cancel anytime'}
            </Text>
          )}

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
    padding: 8,
    position: 'absolute',
    top: 25,
    left: 10,
    zIndex: 1,
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
  trialBadge: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
    marginTop: 8,
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
  manageButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginTop: 10,
  },
  manageButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
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
  restoreButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 10,
    marginHorizontal: 20,
  },
  restoreButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  subscriptionInfoContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginVertical: 15,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  subscriptionInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subscriptionInfoText: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 12,
  },
  legalLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  legalLink: {
    paddingVertical: 4,
  },
  legalLinkText: {
    fontSize: 14,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 14,
    color: COLORS.gray,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});

export default UnlockPremium;