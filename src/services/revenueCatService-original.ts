import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesError,
  LOG_LEVEL
} from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat configuration
const REVENUECAT_API_KEY = {
  ios: 'your_ios_api_key_here', // Replace with your actual iOS API key
  android: 'your_android_api_key_here' // Replace with your actual Android API key
};

class RevenueCatService {
  private static instance: RevenueCatService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): RevenueCatService {
    if (!RevenueCatService.instance) {
      RevenueCatService.instance = new RevenueCatService();
    }
    return RevenueCatService.instance;
  }

  /**
   * Initialize RevenueCat SDK
   */
  async initialize(userId?: string): Promise<void> {
    if (this.isInitialized) {
      console.log('RevenueCat already initialized');
      return;
    }

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY.ios : REVENUECAT_API_KEY.android;
      
      // Configure RevenueCat
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey });

      // Set user ID if provided
      if (userId) {
        await Purchases.logIn(userId);
      }

      this.isInitialized = true;
      console.log('RevenueCat initialized successfully');
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      throw error;
    }
  }

  /**
   * Get available offerings
   */
  async getOfferings(): Promise<PurchasesOffering[]> {
    try {
      const offerings = await Purchases.getOfferings();
      return Object.values(offerings.all);
    } catch (error) {
      console.error('Failed to get offerings:', error);
      throw error;
    }
  }

  /**
   * Purchase a package
   */
  async purchasePackage(packageToPurchase: PurchasesPackage): Promise<CustomerInfo> {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      console.log('Purchase successful:', customerInfo);
      return customerInfo;
    } catch (error: any) {
      console.error('Purchase failed:', error);
      
      if (error.code === 'PURCHASES_ERROR_PURCHASE_CANCELLED') {
        throw new Error('Purchase was cancelled');
      } else if (error.code === 'PURCHASES_ERROR_PAYMENT_PENDING') {
        throw new Error('Payment is pending');
      } else {
        throw new Error('Purchase failed: ' + error.message);
      }
    }
  }

  /**
   * Restore purchases
   */
  async restorePurchases(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log('Purchases restored:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      throw error;
    }
  }

  /**
   * Get customer info
   */
  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('Failed to get customer info:', error);
      throw error;
    }
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      return Object.keys(customerInfo.entitlements.active).length > 0;
    } catch (error) {
      console.error('Failed to check subscription status:', error);
      return false;
    }
  }

  /**
   * Get active entitlements
   */
  async getActiveEntitlements(): Promise<string[]> {
    try {
      const customerInfo = await this.getCustomerInfo();
      return Object.keys(customerInfo.entitlements.active);
    } catch (error) {
      console.error('Failed to get active entitlements:', error);
      return [];
    }
  }

  /**
   * Log out user
   */
  async logOut(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.logOut();
      console.log('User logged out:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Failed to log out:', error);
      throw error;
    }
  }

  /**
   * Set user ID
   */
  async setUserId(userId: string): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.logIn(userId);
      console.log('User ID set:', customerInfo);
      return customerInfo;
    } catch (error) {
      console.error('Failed to set user ID:', error);
      throw error;
    }
  }
}

export default RevenueCatService;
