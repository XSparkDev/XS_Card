import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../utils/api';
import { useToast } from '../hooks/useToast';
import Header from '../components/Header';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWidgetPreferences, toggleWidgetPreference } from '../utils/widgetUtils';

type NavigationProp = NativeStackNavigationProp<any>;

interface UserData {
  id: string;
  name: string;
  surname: string;
  email: string;
  plan: string;
  organiserStatus?: string;
}

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const toast = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        const data = JSON.parse(userDataString);
        setUserData(data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleBecomeOrganiser = () => {
    console.log('Become Organiser button pressed');
    try {
      navigation.navigate('OrganiserRegistration');
    } catch (error) {
      console.error('Error navigating to OrganiserRegistration:', error);
    }
  };

  const handleTermsOfService = async () => {
    console.log('Terms of Service button pressed');
    try {
      const supported = await Linking.canOpenURL('https://xscard.co.za/terms');
      if (supported) {
        await Linking.openURL('https://xscard.co.za/terms');
      } else {
        Alert.alert('Error', 'Cannot open Terms of Service link');
      }
    } catch (error) {
      console.error('Error opening Terms of Service:', error);
      Alert.alert('Error', 'Failed to open Terms of Service');
    }
  };

  const handlePrivacyPolicy = async () => {
    console.log('Privacy Policy button pressed');
    try {
      const supported = await Linking.canOpenURL('https://xscard.co.za/privacy');
      if (supported) {
        await Linking.openURL('https://xscard.co.za/privacy');
      } else {
        Alert.alert('Error', 'Cannot open Privacy Policy link');
      }
    } catch (error) {
      console.error('Error opening Privacy Policy:', error);
      Alert.alert('Error', 'Failed to open Privacy Policy');
    }
  };

  const handleHelpAndSupport = async () => {
    console.log('Help & Support button pressed');
    try {
      const supported = await Linking.canOpenURL('https://xscard.co.za/support');
      if (supported) {
        await Linking.openURL('https://xscard.co.za/support');
      } else {
        Alert.alert('Error', 'Cannot open Help & Support link');
      }
    } catch (error) {
      console.error('Error opening Help & Support:', error);
      Alert.alert('Error', 'Failed to open Help & Support');
    }
  };

  const handleDeactivateAccount = () => {
    Alert.alert(
      'Deactivate Account',
      'Are you sure you want to deactivate your account? This action cannot be undone and you will lose access to all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: confirmDeactivateAccount,
        },
      ]
    );
  };

  const confirmDeactivateAccount = async () => {
    setDeactivating(true);
    try {
      const response = await authenticatedFetchWithRefresh(ENDPOINTS.DEACTIVATE_USER, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: false,
        }),
      });

      if (response.ok) {
        toast.success('Account Deactivated', 'Your account has been deactivated successfully.');
        
        // Clear local storage
        await AsyncStorage.clear();
        
        // Navigate to sign in
        navigation.reset({
          index: 0,
          routes: [{ name: 'SignIn' }],
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to deactivate account');
      }
    } catch (error) {
      console.error('Error deactivating account:', error);
      toast.error(
        'Deactivation Failed',
        error instanceof Error ? error.message : 'Failed to deactivate account. Please try again.'
      );
    } finally {
      setDeactivating(false);
    }
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle?: string,
    onPress?: () => void,
    showArrow: boolean = true,
    destructive: boolean = false
  ) => {
    console.log(`Rendering setting item: ${title}, onPress: ${!!onPress}, showArrow: ${showArrow}`);
    return (
    <TouchableOpacity
      style={[styles.settingItem, destructive && styles.destructiveItem]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingItemLeft}>
        <MaterialIcons
          name={icon as any}
          size={24}
          color={destructive ? COLORS.error : COLORS.secondary}
        />
        <View style={styles.settingItemText}>
          <Text style={[styles.settingItemTitle, destructive && styles.destructiveText]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.settingItemSubtitle, destructive && styles.destructiveText]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      {showArrow && onPress && (
        <MaterialIcons
          name="chevron-right"
          size={24}
          color={destructive ? COLORS.error : COLORS.gray}
        />
      )}
    </TouchableOpacity>
  );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Settings" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          {userData && (
            <View style={styles.userInfo}>
              <View style={styles.avatar}>
                <MaterialIcons name="person" size={32} color={COLORS.white} />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {userData.name} {userData.surname}
                </Text>
                <Text style={styles.userEmail}>{userData.email}</Text>
                <Text style={styles.userPlan}>
                  Plan: {userData.plan === 'premium' ? 'Premium' : 'Free'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Features Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Features</Text>
          
          {userData?.plan === 'free' && (
            renderSettingItem(
              'star',
              'Unlock Premium',
              'Upgrade to premium for more features',
              () => navigation.navigate('UnlockPremium')
            )
          )}

          {userData?.plan === 'premium' && (
            renderSettingItem(
              'settings',
              'Manage Subscription',
              'Update your subscription settings',
              () => navigation.navigate('UnlockPremium')
            )
          )}

          {(!userData?.organiserStatus || userData?.organiserStatus === 'not_registered') && (
            renderSettingItem(
              'event',
              'Become an Event Organiser',
              'Create paid events and collect payments',
              handleBecomeOrganiser
            )
          )}

          {userData?.organiserStatus === 'pending_banking_details' && (
            renderSettingItem(
              'pending',
              'Complete Organiser Registration',
              'Finish setting up your payment account',
              handleBecomeOrganiser
            )
          )}

          {userData?.organiserStatus === 'pending_verification' && (
            renderSettingItem(
              'schedule',
              'Organiser Registration Pending',
              'Your account is being reviewed',
              undefined,
              false
            )
          )}

          {userData?.organiserStatus === 'active' && (
            renderSettingItem(
              'check-circle',
              'Event Organiser',
              'You can create paid events',
              undefined,
              false
            )
          )}

          {renderSettingItem(
            'widgets',
            'Manage Widgets',
            'Configure home screen widgets for your cards',
            () => navigation.navigate('WidgetSettings')
          )}
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          
          {renderSettingItem(
            'notifications',
            'Notifications',
            'Manage your notification preferences',
            () => navigation.navigate('EventPreferences')
          )}

          {renderSettingItem(
            'security',
            'Privacy & Security',
            'Manage your privacy settings',
            undefined,
            false
          )}
        </View>



        {/* Support Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          
          {renderSettingItem(
            'help',
            'Help & Support',
            'Get help with your account',
            handleHelpAndSupport,
            true
          )}

          {renderSettingItem(
            'description',
            'Terms of Service',
            'Read our terms and conditions',
            handleTermsOfService,
            true
          )}

          {renderSettingItem(
            'privacy-tip',
            'Privacy Policy',
            'Read our privacy policy',
            handlePrivacyPolicy,
            true
          )}
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          {renderSettingItem(
            'delete-forever',
            'Deactivate Account',
            'Permanently deactivate your account',
            handleDeactivateAccount,
            false,
            true
          )}
        </View>



        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 4,
  },
  userPlan: {
    fontSize: 14,
    color: COLORS.secondary,
    fontWeight: '500',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  destructiveItem: {
    borderBottomColor: COLORS.error + '20',
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    marginLeft: 16,
    flex: 1,
  },
  settingItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
  },
  settingItemSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
  },
  destructiveText: {
    color: COLORS.error,
  },
  bottomSpacing: {
    height: 100,
  },
}); 