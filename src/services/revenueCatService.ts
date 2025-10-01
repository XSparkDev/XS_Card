import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesError,
  PURCHASES_ERROR_CODE
} from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { shouldUseRevenueCat } from '../utils/paymentPlatform';

/**
 * RevenueCat Service
 * Following existing service patterns from eventService.ts
 * Handles iOS in-app purchase functionality
 */

export interface RevenueCatConfig {
  apiKey: string;
  userId?: string;
}

export interface SubscriptionPackage {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    description: string;
    title: string;
    price: number;
    priceString: string;
    currencyCode: string;
  };
  offeringIdentifier: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  productIdentifier?: string;
  originalTransactionId?: string;
  purchaseDate?: Date;
  expirationDate?: Date;
  willRenew: boolean;
  customerInfo: CustomerInfo;
}

class RevenueCatService {
  private isConfigured = false;
  private currentUserId: string | null = null;

  /**
   * Configure RevenueCat with API key and user ID
   */
  async configure(config: RevenueCatConfig): Promise<boolean> {
    try {
      if (!shouldUseRevenueCat()) {
        console.log('RevenueCat: Not iOS platform, skipping configuration');
        return false;
      }

      // Configure RevenueCat
      await Purchases.configure({ apiKey: config.apiKey });
      
      // Set user ID if provided
      if (config.userId) {
        await Purchases.logIn(config.userId);
        this.currentUserId = config.userId;
      }

      this.isConfigured = true;
      console.log('RevenueCat: Successfully configured');
      return true;
    } catch (error) {
      console.error('RevenueCat configuration error:', error);
      return false;
    }
  }

  /**
   * Check if RevenueCat is ready for use
   */
  isReady(): boolean {
    return this.isConfigured && shouldUseRevenueCat();
  }

  /**
   * Get available subscription offerings
   */
  async getOfferings(): Promise<SubscriptionPackage[]> {
    try {
      if (!this.isReady()) {
        throw new Error('RevenueCat not configured or not iOS platform');
      }

      const offerings = await Purchases.getOfferings();
      const packages: SubscriptionPackage[] = [];

      if (offerings.current) {
        for (const packageItem of offerings.current.availablePackages) {
          packages.push({
            identifier: packageItem.identifier,
            packageType: packageItem.packageType,
            product: {
              identifier: packageItem.product.identifier,
              description: packageItem.product.description,
              title: packageItem.product.title,
              price: packageItem.product.price,
              priceString: packageItem.product.priceString,
              currencyCode: packageItem.product.currencyCode,
            },
            offeringIdentifier: packageItem.offeringIdentifier,
          });
        }
      }

      return packages;
    } catch (error) {
      console.error('RevenueCat getOfferings error:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription package
   */
  async purchasePackage(packageIdentifier: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isReady()) {
        throw new Error('RevenueCat not configured or not iOS platform');
      }

      const offerings = await Purchases.getOfferings();
      const packageToPurchase = offerings.current?.availablePackages.find(
        pkg => pkg.identifier === packageIdentifier
      );

      if (!packageToPurchase) {
        throw new Error('Package not found');
      }

      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      
      // Check if purchase was successful
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasActiveSubscription) {
        // Store subscription status locally
        await AsyncStorage.setItem('subscriptionStatus', JSON.stringify({
          isActive: true,
          productIdentifier: packageToPurchase.product.identifier,
          purchaseDate: new Date().toISOString(),
          customerInfo: customerInfo
        }));

        return { success: true };
      } else {
        return { success: false, error: 'Purchase completed but no active subscription found' };
      }
    } catch (error) {
      console.error('RevenueCat purchase error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Purchase failed' 
      };
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isReady()) {
        throw new Error('RevenueCat not configured or not iOS platform');
      }

      const customerInfo = await Purchases.restorePurchases();
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

      if (hasActiveSubscription) {
        // Store restored subscription status
        await AsyncStorage.setItem('subscriptionStatus', JSON.stringify({
          isActive: true,
          restoreDate: new Date().toISOString(),
          customerInfo: customerInfo
        }));

        return { success: true };
      } else {
        return { success: false, error: 'No previous purchases found' };
      }
    } catch (error) {
      console.error('RevenueCat restore error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Restore failed' 
      };
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    try {
      if (!this.isReady()) {
        return null;
      }

      const customerInfo = await Purchases.getCustomerInfo();
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

      if (hasActiveSubscription) {
        const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
        
        return {
          isActive: true,
          productIdentifier: activeEntitlement.productIdentifier,
          originalTransactionId: activeEntitlement.originalTransactionId,
          purchaseDate: activeEntitlement.purchaseDate,
          expirationDate: activeEntitlement.expirationDate,
          willRenew: activeEntitlement.willRenew,
          customerInfo: customerInfo
        };
      } else {
        return {
          isActive: false,
          willRenew: false,
          customerInfo: customerInfo
        };
      }
    } catch (error) {
      console.error('RevenueCat getSubscriptionStatus error:', error);
      return null;
    }
  }

  /**
   * Log out current user
   */
  async logOut(): Promise<void> {
    try {
      if (this.isReady()) {
        await Purchases.logOut();
        this.currentUserId = null;
        await AsyncStorage.removeItem('subscriptionStatus');
      }
    } catch (error) {
      console.error('RevenueCat logOut error:', error);
    }
  }
}

// Export singleton instance
const revenueCatService = new RevenueCatService();
export default revenueCatService;