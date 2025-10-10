import Purchases, {
  PurchasesOffering,
  PurchasesPackage,
  CustomerInfo,
  PurchasesError,
  PURCHASES_ERROR_CODE
} from 'react-native-purchases';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { shouldUseRevenueCat } from '../utils/paymentPlatform';
import { authenticatedFetchWithRefresh } from '../utils/api';

/**
 * RevenueCat Service for Android & iOS
 * 
 * Following golden rules:
 * 1. All purchase verification happens server-side
 * 2. Never trust client data for financial decisions
 * 3. Comprehensive error handling
 * 4. Full audit logging via server
 * 5. Platform-agnostic implementation (works for both Android & iOS)
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
   * Works for both Android and iOS
   */
  async configure(config: RevenueCatConfig): Promise<boolean> {
    try {
      if (!shouldUseRevenueCat()) {
        console.log('RevenueCat: Not using RevenueCat platform (web or other), skipping configuration');
        return false;
      }

      console.log(`RevenueCat: Configuring SDK for ${Platform.OS}`);
      console.log(`RevenueCat: User ID: ${config.userId || 'anonymous'}`);

      // Configure RevenueCat SDK
      await Purchases.configure({ apiKey: config.apiKey });
      
      // Set user ID if provided - CRITICAL for server-side verification
      if (config.userId) {
        await Purchases.logIn(config.userId);
        this.currentUserId = config.userId;
        console.log('RevenueCat: User logged in successfully');
      }

      this.isConfigured = true;
      console.log(`RevenueCat: Successfully configured for ${Platform.OS}`);
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
      
      // Debug: Log all available offerings
      console.log('RevenueCat: All offerings:', Object.keys(offerings.all || {}));
      console.log('RevenueCat: Current offering:', offerings.current?.identifier || 'NONE');
      console.log('RevenueCat: Current packages:', offerings.current?.availablePackages.length || 0);
      
      const packages: SubscriptionPackage[] = [];

      // Try to use current offering first, or fallback to any available offering
      let selectedOffering = offerings.current;
      
      if (!selectedOffering && offerings.all) {
        // If no current offering, try to find XS_Card_Offerings or use the first available
        const offeringKeys = Object.keys(offerings.all);
        console.log('RevenueCat: No current offering, checking available offerings:', offeringKeys);
        
        if (offeringKeys.includes('XS_Card_Offerings')) {
          selectedOffering = offerings.all['XS_Card_Offerings'];
          console.log('RevenueCat: Using XS_Card_Offerings');
        } else if (offeringKeys.length > 0) {
          selectedOffering = offerings.all[offeringKeys[0]];
          console.log('RevenueCat: Using first available offering:', offeringKeys[0]);
        }
      }

      if (selectedOffering && selectedOffering.availablePackages.length > 0) {
        // Use offerings if available
        for (const packageItem of selectedOffering.availablePackages) {
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
      } else {
        // Fallback: Get products directly from RevenueCat when offerings are empty
        console.log('RevenueCat: No offerings configured, fetching products directly...');
        const products = await this.getProductsDirectly();
        return products;
      }

      return packages;
    } catch (error) {
      console.error('RevenueCat getOfferings error:', error);
      
      // Fallback: Try to get products directly when offerings fail
      console.log('RevenueCat: Offerings failed, trying direct product fetch...');
      try {
        const products = await this.getProductsDirectly();
        return products;
      } catch (fallbackError) {
        console.error('RevenueCat fallback also failed:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Get products directly from RevenueCat when offerings are not configured
   * This is a fallback method that gets real product data from RevenueCat
   */
  private async getProductsDirectly(): Promise<SubscriptionPackage[]> {
    try {
      console.log('RevenueCat: Fetching products directly from RevenueCat...');
      
      // Get product IDs from backend configuration (no hardcoding)
      const productIds = await this.getProductIdsFromBackend();
      
      console.log('RevenueCat: Product IDs from backend:', productIds);
      
      if (productIds.length === 0) {
        console.log('RevenueCat: No product IDs available from backend');
        return [];
      }

      // Get all available products from RevenueCat
      console.log('RevenueCat: Requesting products from RevenueCat SDK:', productIds);
      const products = await Purchases.getProducts(productIds);
      console.log('RevenueCat: SDK returned products:', products.map(p => ({ id: p.identifier, title: p.title, price: p.priceString })));
      
      // DEBUG: Show what RevenueCat SDK returned
      console.log('RevenueCat: SDK Response - Requested:', JSON.stringify(productIds));
      console.log('RevenueCat: SDK Response - Returned:', products.length, 'products');
      console.log('RevenueCat: SDK Response - Products:', products.map(p => ({ id: p.identifier, title: p.title, price: p.priceString })));
      Alert.alert('RevenueCat SDK Response', `Requested: ${JSON.stringify(productIds)}\n\nReturned: ${products.length} products`);

      const packages: SubscriptionPackage[] = [];

      for (const product of products) {
        // Create package structure that matches offerings format
        packages.push({
          identifier: product.identifier.includes('monthly') ? 'monthly' : 'annual',
          packageType: product.identifier.includes('monthly') ? 'MONTHLY' : 'ANNUAL',
          product: {
            identifier: product.identifier,
            description: product.description,
            title: product.title,
            price: product.price,
            priceString: product.priceString,
            currencyCode: product.currencyCode,
          },
          offeringIdentifier: 'default', // Use default when no offering configured
        });
      }

      console.log(`RevenueCat: Found ${packages.length} products directly`);
      
      // DEBUG: Show what we found
      console.log('RevenueCat: Final packages found:', packages.length);
      console.log('RevenueCat: Final packages:', packages.map(p => ({ 
        id: p.identifier, 
        product: p.product.identifier, 
        title: p.product.title, 
        price: p.product.priceString 
      })));
      
      return packages;

    } catch (error) {
      console.error('RevenueCat: Failed to get products directly:', error);
      throw error;
    }
  }

  /**
   * Get product IDs from backend configuration
   * This ensures we get the real product IDs from the server, not hardcoded values
   */
  private async getProductIdsFromBackend(): Promise<string[]> {
    try {
      console.log('RevenueCat: Fetching product IDs from backend...');
      
      const response = await authenticatedFetchWithRefresh('/api/revenuecat/products', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch product IDs from backend');
      }

      const data = await response.json();
      console.log('RevenueCat: Product IDs from backend:', data.productIds);
      
      return data.productIds || [];
    } catch (error) {
      console.error('RevenueCat: Failed to get product IDs from backend:', error);
      // Return empty array if backend call fails
      return [];
    }
  }

  /**
   * Purchase a subscription package
   * 
   * CRITICAL: Following golden rules
   * 1. Purchase happens through RevenueCat SDK
   * 2. Verification happens server-side via webhook
   * 3. Client only initiates purchase, server validates
   */
  async purchasePackage(packageIdentifier: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.isReady()) {
        throw new Error('RevenueCat not configured');
      }

      if (!this.currentUserId) {
        throw new Error('User ID not set. Cannot make purchase without user identification.');
      }

      console.log('RevenueCat: Starting purchase flow');
      console.log(`RevenueCat: Package: ${packageIdentifier}`);
      console.log(`RevenueCat: User: ${this.currentUserId}`);

      // Get offerings to find the package
      const offerings = await Purchases.getOfferings();
      
      // Try to use current offering first, or fallback to any available offering
      let selectedOffering = offerings.current;
      
      if (!selectedOffering && offerings.all) {
        const offeringKeys = Object.keys(offerings.all);
        if (offeringKeys.includes('XS_Card_Offerings')) {
          selectedOffering = offerings.all['XS_Card_Offerings'];
        } else if (offeringKeys.length > 0) {
          selectedOffering = offerings.all[offeringKeys[0]];
        }
      }
      
      if (!selectedOffering) {
        throw new Error('No offerings available');
      }
      
      console.log(`RevenueCat: Using offering: ${selectedOffering.identifier}`);
      console.log(`RevenueCat: Available packages:`, selectedOffering.availablePackages.map(p => p.identifier));
      
      // Find the package in the offering
      const rcPackage = selectedOffering.availablePackages.find(p => p.identifier === packageIdentifier);
      
      if (!rcPackage) {
        console.error(`RevenueCat: Package ${packageIdentifier} not found in offering`);
        console.error(`RevenueCat: Available packages:`, selectedOffering.availablePackages.map(p => p.identifier));
        throw new Error(`Package ${packageIdentifier} not found in offering`);
      }

      console.log(`RevenueCat: Found package: ${rcPackage.identifier}`);
      console.log(`RevenueCat: Product: ${rcPackage.product.identifier}`);
      console.log(`RevenueCat: Price: ${rcPackage.product.priceString}`);

      // Initiate purchase through RevenueCat SDK using the package directly
      // This is the CORRECT way - purchase the package, not the product
      const { customerInfo } = await Purchases.purchasePackage(rcPackage);
      
      console.log('RevenueCat: Purchase transaction completed');
      console.log(`RevenueCat: Customer Info received, checking entitlements...`);
      
      // Check local entitlements (but remember: server is source of truth)
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;
      
      if (hasActiveSubscription) {
        console.log('RevenueCat: ✅ Active entitlement found locally');
        
        // Store locally for immediate UI update
        // But server webhook will be the final source of truth
        await AsyncStorage.setItem('subscriptionStatus', JSON.stringify({
          isActive: true,
          productIdentifier: rcPackage.product.identifier,
          purchaseDate: new Date().toISOString(),
          customerInfo: customerInfo,
          needsServerVerification: true // Flag to indicate server needs to verify
        }));

        // IMPORTANT: Trigger server-side verification
        // The webhook will be called by RevenueCat, but we can also manually sync
        try {
          console.log('RevenueCat: Triggering server-side verification...');
          const response = await authenticatedFetchWithRefresh('/api/revenuecat/sync', {
            method: 'POST'
          });
          
          if (response.ok) {
            console.log('RevenueCat: ✅ Server verification completed');
          } else {
            console.warn('RevenueCat: ⚠️  Server verification failed, will rely on webhook');
          }
        } catch (syncError) {
          console.warn('RevenueCat: ⚠️  Could not sync with server immediately, webhook will handle it');
        }

        return { success: true };
      } else {
        console.error('RevenueCat: ❌ Purchase completed but no active entitlement found');
        return { 
          success: false, 
          error: 'Purchase completed but subscription not activated. Please contact support if charged.' 
        };
      }
    } catch (error: any) {
      console.error('RevenueCat: ❌ Purchase error:', error);
      
      // Handle user cancellation gracefully
      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return {
          success: false,
          error: 'Purchase cancelled'
        };
      }
      
      // Handle other errors
      return { 
        success: false, 
        error: error.message || 'Purchase failed. Please try again.' 
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
   * 
   * IMPORTANT: This gets LOCAL status from SDK
   * For server-verified status, use getServerVerifiedStatus()
   */
  async getSubscriptionStatus(): Promise<SubscriptionStatus | null> {
    try {
      if (!this.isReady()) {
        return null;
      }

      console.log('RevenueCat: Fetching local subscription status...');
      const customerInfo = await Purchases.getCustomerInfo();
      const hasActiveSubscription = Object.keys(customerInfo.entitlements.active).length > 0;

      if (hasActiveSubscription) {
        const activeEntitlement = Object.values(customerInfo.entitlements.active)[0];
        
        console.log('RevenueCat: ✅ Active subscription found locally');
        console.log(`   Product: ${activeEntitlement.productIdentifier}`);
        console.log(`   Expires: ${activeEntitlement.expirationDate || 'Never'}`);
        
        return {
          isActive: true,
          productIdentifier: activeEntitlement.productIdentifier,
          originalTransactionId: (activeEntitlement as any).originalTransactionId || null,
          purchaseDate: (activeEntitlement as any).purchaseDate ? new Date((activeEntitlement as any).purchaseDate) : undefined,
          expirationDate: activeEntitlement.expirationDate ? new Date(activeEntitlement.expirationDate) : undefined,
          willRenew: activeEntitlement.willRenew,
          customerInfo: customerInfo
        };
      } else {
        console.log('RevenueCat: No active subscription found locally');
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
   * Get server-verified subscription status
   * 
   * CRITICAL: This is the source of truth
   * Always use this for important decisions (showing premium content, etc.)
   */
  async getServerVerifiedStatus(): Promise<{ isActive: boolean; data?: any; error?: string }> {
    try {
      console.log('RevenueCat: Fetching server-verified status...');
      
      const response = await authenticatedFetchWithRefresh('/api/revenuecat/status', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch server status');
      }

      const data = await response.json();
      
      console.log('RevenueCat: ✅ Server-verified status received');
      console.log(`   Active: ${data.isActive}`);
      console.log(`   Plan: ${data.plan}`);
      
      return {
        isActive: data.isActive,
        data: data
      };
    } catch (error) {
      console.error('RevenueCat: ❌ Failed to get server-verified status:', error);
      return {
        isActive: false,
        error: error instanceof Error ? error.message : 'Failed to verify status'
      };
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