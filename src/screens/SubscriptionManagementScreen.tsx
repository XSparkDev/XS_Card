/**
 * Subscription Management Screen
 * 
 * Handles subscription management through Google Play Store
 * Following RevenueCat best practices: Let Google handle cancellation UI
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  ActivityIndicator,
  ScrollView
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authenticatedFetchWithRefresh } from '../utils/api';
import { COLORS } from '../constants/colors';

interface SubscriptionStatus {
  isActive: boolean;
  plan: string;
  subscriptionStatus: string;
  productId?: string;
  expiresDate?: string;
  willRenew?: boolean;
  store?: string;
  verifiedAt?: string;
}

export default function SubscriptionManagementScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Subscription Management: Loading subscription status...');
      
      // Get server-verified status (source of truth)
      const response = await authenticatedFetchWithRefresh('/api/revenuecat/status', {
        method: 'GET'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Subscription Management: Status loaded:', data);
      
      setSubscriptionStatus(data);
    } catch (error) {
      console.error('Subscription Management: Error loading status:', error);
      setError(error instanceof Error ? error.message : 'Failed to load subscription status');
    } finally {
      setLoading(false);
    }
  };

  const openGooglePlaySubscriptions = () => {
    try {
      console.log('Subscription Management: Opening Google Play subscriptions...');
      
      if (Platform.OS === 'android') {
        // Open Google Play Store subscriptions page
        Linking.openURL('https://play.google.com/store/account/subscriptions');
      } else {
        // For iOS, open App Store subscriptions
        Linking.openURL('https://apps.apple.com/account/subscriptions');
      }
    } catch (error) {
      console.error('Subscription Management: Error opening subscriptions:', error);
      Alert.alert(
        'Error',
        'Could not open subscription management. Please go to your device\'s app store to manage your subscription.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleManageSubscription = () => {
    Alert.alert(
      'Manage Subscription',
      'This will open your device\'s app store where you can view, modify, or cancel your subscription.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Open Store', 
          onPress: openGooglePlaySubscriptions 
        }
      ]
    );
  };


  const handleRefresh = () => {
    loadSubscriptionStatus();
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return COLORS.success;
      case 'expired':
      case 'cancelled':
        return COLORS.error;
      case 'trial':
        return COLORS.warning;
      default:
        return COLORS.text;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'check-circle';
      case 'expired':
      case 'cancelled':
        return 'cancel';
      case 'trial':
        return 'schedule';
      default:
        return 'help';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading subscription status...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={48} color={COLORS.error} />
        <Text style={styles.errorTitle}>Error Loading Subscription</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Subscription Management</Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={handleRefresh}
        >
          <MaterialIcons name="refresh" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Subscription Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <MaterialIcons 
              name={getStatusIcon(subscriptionStatus?.subscriptionStatus || '')} 
              size={32} 
              color={getStatusColor(subscriptionStatus?.subscriptionStatus || '')} 
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {subscriptionStatus?.isActive ? 'Active Subscription' : 'No Active Subscription'}
              </Text>
              <Text style={[styles.statusText, { color: getStatusColor(subscriptionStatus?.subscriptionStatus || '') }]}>
                {subscriptionStatus?.subscriptionStatus || 'Unknown'}
              </Text>
            </View>
          </View>

          {subscriptionStatus?.isActive && (
            <View style={styles.subscriptionDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Plan:</Text>
                <Text style={styles.detailValue}>{subscriptionStatus.plan}</Text>
              </View>
              
              {subscriptionStatus.productId && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Product:</Text>
                  <Text style={styles.detailValue}>{subscriptionStatus.productId}</Text>
                </View>
              )}

              {subscriptionStatus.expiresDate && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>
                    {subscriptionStatus.willRenew ? 'Renews:' : 'Expires:'}
                  </Text>
                  <Text style={styles.detailValue}>
                    {formatDate(subscriptionStatus.expiresDate)}
                  </Text>
                </View>
              )}

              {subscriptionStatus.store && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Store:</Text>
                  <Text style={styles.detailValue}>{subscriptionStatus.store}</Text>
                </View>
              )}

              {subscriptionStatus.verifiedAt && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Last Verified:</Text>
                  <Text style={styles.detailValue}>
                    {formatDate(subscriptionStatus.verifiedAt)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Management Actions */}
        <View style={styles.actionsCard}>
          <Text style={styles.actionsTitle}>Manage Your Subscription</Text>
          <Text style={styles.actionsDescription}>
            To modify, cancel, or view your subscription details, you'll need to go to your device's app store.
          </Text>

          <TouchableOpacity 
            style={styles.manageButton}
            onPress={handleManageSubscription}
          >
            <MaterialIcons name="store" size={24} color={COLORS.white} />
            <Text style={styles.manageButtonText}>
              Open {Platform.OS === 'android' ? 'Google Play' : 'App Store'}
            </Text>
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <MaterialIcons name="info" size={20} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Changes made in the app store will be reflected in this app within a few minutes.
            </Text>
          </View>
        </View>

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need Help?</Text>
          <Text style={styles.helpText}>
            • Cancellations take effect at the end of your current billing period{'\n'}
            • You'll keep access to premium features until your subscription expires{'\n'}
            • Refunds are handled through your app store{'\n'}
            • Contact{' '}
            <Text 
              style={styles.supportLink}
              onPress={() => Linking.openURL('https://xscard.co.za/support')}
            >
              support
            </Text>
            {' '}if you have billing issues
          </Text>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.text,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  refreshButton: {
    padding: 8,
  },
  content: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusInfo: {
    marginLeft: 12,
    flex: 1,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '500',
  },
  subscriptionDetails: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  actionsCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  actionsDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 20,
  },
  manageButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  manageButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  helpCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  supportLink: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
