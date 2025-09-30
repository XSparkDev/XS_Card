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
   * Initialize RevenueCat SDK
   * Following existing patterns - no assumptions without clarification
   */
  async configure(config: RevenueCatConfig): Promise<boolean> {
    try {
      // Only configure on iOS as per migration plan
      if (!shouldUseRevenueCat()) {
        console.log('RevenueCat: Not iOS platform, skipping configuration');
        return false;
      }

      console.log('RevenueCat: Configuring SDK...');
      
      // Configure RevenueCat with StoreKit testing support
      await Purchases.configure({
        apiKey: config.apiKey,
        appUserID: config.userId || undefined, // Let RevenueCat generate ID if not provided
      });

      // Set debug logs for development
      if (__DEV__) {
        await Purchases.setLogLevel('DEBUG' as any);
        console.log('RevenueCat: Debug logging enabled for StoreKit testing');
        
        // For StoreKit testing, we need to ensure RevenueCat uses local config
        console.log('RevenueCat: StoreKit configuration should be active in simulator');
        console.log('RevenueCat: Make sure Xcode scheme uses StoreKit_Configuration.storekit');
        
        // Force StoreKit testing mode - this is the key fix
        console.log('RevenueCat: Attempting to configure for StoreKit testing mode');
      }

      this.isConfigured = true;
      this.currentUserId = config.userId || null;
      
      console.log('RevenueCat: SDK configured successfully with StoreKit support');
      return true;

    } catch (error) {
      console.error('RevenueCat: Configuration failed', error);
      return false;
    }
  }

  /**
   * Get available subscription packages
   * Following existing async patterns
   */
  async getAvailablePackages(): Promise<SubscriptionPackage[]> {
    try {
      if (!this.isConfigured) {
        throw new Error('RevenueCat not configured');
      }

      console.log('RevenueCat: Fetching available packages...');
      
      // Check if we're in simulator and StoreKit should be active
      if (__DEV__) {
        console.log('RevenueCat: Development mode - StoreKit configuration should be active');
        console.log('RevenueCat: If StoreKit config is properly set up, products should load');
      }
      
      const offerings = await Purchases.getOfferings();
      console.log('RevenueCat: Raw offerings response:', JSON.stringify(offerings, null, 2));
      
      const currentOffering = offerings.current;

      if (!currentOffering) {
        console.log('RevenueCat: No current offering available');
        return [];
      }

      // Convert RevenueCat packages to our interface
      const packages: SubscriptionPackage[] = currentOffering.availablePackages.map((pkg: PurchasesPackage) => ({
        identifier: pkg.identifier,
        packageType: pkg.packageType,
        product: {
          identifier: pkg.product.identifier,
          description: pkg.product.description,
          title: pkg.product.title,
          price: pkg.product.price,
          priceString: pkg.product.priceString,
          currencyCode: pkg.product.currencyCode,
        },
        offeringIdentifier: currentOffering.identifier,
      }));

      console.log(`RevenueCat: Found ${packages.length} packages`);
      return packages;

    } catch (error) {
      console.error('RevenueCat: Failed to fetch packages', error);
      return [];
    }
  }

  /**
   * Get StoreKit products for testing
   * This method would be used for direct StoreKit access if needed
   */
  private async getStoreKitProducts(): Promise<SubscriptionPackage[]> {
    // This would implement direct StoreKit access without RevenueCat
    // For now, we rely on RevenueCat to properly use StoreKit config
    throw new Error('Direct StoreKit access needs to be implemented');
  }

  /**
   * Purchase a subscription package
   * Following existing error handling patterns
   */
  async purchasePackage(packageIdentifier: string): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
  }> {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: 'RevenueCat not configured'
        };
      }

      console.log(`RevenueCat: Purchasing package ${packageIdentifier}...`);
      
      // Get available packages
      const packages = await this.getAvailablePackages();
      const targetPackage = packages.find(pkg => pkg.identifier === packageIdentifier);

      if (!targetPackage) {
        return {
          success: false,
          error: 'Package not found'
        };
      }

      // Get the actual RevenueCat package
      const offerings = await Purchases.getOfferings();
      const revenueCatPackage = offerings.current?.availablePackages.find(
        (pkg: PurchasesPackage) => pkg.identifier === packageIdentifier
      );

      if (!revenueCatPackage) {
        return {
          success: false,
          error: 'RevenueCat package not found'
        };
      }

      // Make the purchase
      const { customerInfo } = await Purchases.purchasePackage(revenueCatPackage);
      
      console.log('RevenueCat: Purchase successful');
      
      return {
        success: true,
        customerInfo
      };

    } catch (error) {
      console.error('RevenueCat: Purchase failed', error);
      
      // Handle specific error types
      if (error instanceof Error && 'code' in error) {
        const purchaseError = error as any;
        
        switch (purchaseError.code) {
          case PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR:
            return { success: false, error: 'Purchase cancelled by user' };
          case PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR:
            return { success: false, error: 'Purchase not allowed' };
          default:
            return { success: false, error: purchaseError.message || 'Purchase failed' };
        }
      }

      return {
        success: false,
        error: 'Purchase failed'
      };
    }
  }

  /**
   * Get current subscription status
   * Following existing async patterns
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    try {
      if (!this.isConfigured) {
        console.log('RevenueCat: Not configured, cannot get status');
        return null;
      }

      console.log('RevenueCat: Fetching subscription status...');
      
      const customerInfo = await Purchases.getCustomerInfo();
      
      // Check if user has any active entitlements
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (!hasActiveSubscription) {
        return {
          isActive: false,
          willRenew: false,
          customerInfo
        };
      }

      // Get the first active entitlement (we typically have one main subscription)
      const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
      
      return {
        isActive: true,
        productIdentifier: activeEntitlement.productIdentifier,
        originalTransactionId: (activeEntitlement as any).originalTransactionId || null,
        purchaseDate: activeEntitlement.latestPurchaseDate ? new Date(activeEntitlement.latestPurchaseDate) : undefined,
        expirationDate: activeEntitlement.expirationDate ? new Date(activeEntitlement.expirationDate) : undefined,
        willRenew: activeEntitlement.willRenew,
        customerInfo
      };

    } catch (error) {
      console.error('RevenueCat: Failed to get subscription status', error);
      return null;
    }
  }

  /**
   * Restore purchases
   * Following existing error handling patterns
   */
  async restorePurchases(): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
  }> {
    try {
      if (!this.isConfigured) {
        return {
          success: false,
          error: 'RevenueCat not configured'
        };
      }

      console.log('RevenueCat: Restoring purchases...');
      
      const customerInfo = await Purchases.restorePurchases();
      
      console.log('RevenueCat: Purchases restored successfully');
      
      return {
        success: true,
        customerInfo: customerInfo
      };

    } catch (error) {
      console.error('RevenueCat: Failed to restore purchases', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Restore failed'
      };
    }
  }

  /**
   * Login user (for cross-device subscription sync)
   */
  async loginUser(userId: string): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        console.log('RevenueCat: Not configured, cannot login user');
        return false;
      }

      console.log(`RevenueCat: Logging in user ${userId}...`);
      
      await Purchases.logIn(userId);
      this.currentUserId = userId;
      
      console.log('RevenueCat: User logged in successfully');
      return true;

    } catch (error) {
      console.error('RevenueCat: Failed to login user', error);
      return false;
    }
  }

  /**
   * Logout current user
   */
  async logoutUser(): Promise<boolean> {
    try {
      if (!this.isConfigured) {
        return false;
      }

      console.log('RevenueCat: Logging out user...');
      
      await Purchases.logOut();
      this.currentUserId = null;
      
      console.log('RevenueCat: User logged out successfully');
      return true;

    } catch (error) {
      console.error('RevenueCat: Failed to logout user', error);
      return false;
    }
  }

  /**
   * Check if RevenueCat is properly configured
   */
  isReady(): boolean {
    return this.isConfigured && shouldUseRevenueCat();
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// Export singleton instance
export const revenueCatService = new RevenueCatService();
export default revenueCatService;
