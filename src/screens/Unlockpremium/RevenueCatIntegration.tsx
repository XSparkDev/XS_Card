import React, { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import RevenueCatService from '../../services/revenueCatService';
import { getPaymentPlatform, initializePaymentService } from '../../utils/paymentPlatform';

/**
 * RevenueCat Integration Component
 * Handles iOS-specific RevenueCat purchases
 */
export const useRevenueCatIntegration = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [offerings, setOfferings] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  const initializeRevenueCat = async () => {
    try {
      if (Platform.OS !== 'ios') {
        console.log('RevenueCat only available on iOS');
        return;
      }

      await initializePaymentService();
      const revenueCatService = RevenueCatService.getInstance();
      const offerings = await revenueCatService.getOfferings();
      
      setOfferings(offerings);
      setIsInitialized(true);
      console.log('RevenueCat initialized with offerings:', offerings);
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
    }
  };

  const purchaseSubscription = async (packageToPurchase: any) => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Error', 'RevenueCat is only available on iOS');
      return;
    }

    setIsLoading(true);
    try {
      const revenueCatService = RevenueCatService.getInstance();
      const customerInfo = await revenueCatService.purchasePackage(packageToPurchase);
      
      Alert.alert(
        'Success!', 
        'Your subscription is now active. You can enjoy all premium features.',
        [{ text: 'OK' }]
      );
      
      return customerInfo;
    } catch (error: any) {
      console.error('Purchase failed:', error);
      Alert.alert('Purchase Failed', error.message || 'Something went wrong. Please try again.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const restorePurchases = async () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Error', 'RevenueCat is only available on iOS');
      return;
    }

    setIsLoading(true);
    try {
      const revenueCatService = RevenueCatService.getInstance();
      const customerInfo = await revenueCatService.restorePurchases();
      
      if (Object.keys(customerInfo.entitlements.active).length > 0) {
        Alert.alert('Success!', 'Your purchases have been restored.');
      } else {
        Alert.alert('No Purchases', 'No active subscriptions found.');
      }
      
      return customerInfo;
    } catch (error: any) {
      console.error('Restore failed:', error);
      Alert.alert('Restore Failed', error.message || 'Failed to restore purchases.');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const revenueCatService = RevenueCatService.getInstance();
      const hasActiveSubscription = await revenueCatService.hasActiveSubscription();
      return hasActiveSubscription;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  };

  return {
    isLoading,
    offerings,
    isInitialized,
    purchaseSubscription,
    restorePurchases,
    checkSubscriptionStatus
  };
};
