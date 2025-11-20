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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { authenticatedFetchWithRefresh, ENDPOINTS, getUserId, API_BASE_URL } from '../utils/api';
import { useToast } from '../hooks/useToast';
import Header from '../components/Header';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getImageUrl } from '../utils/imageUtils';
import { useFocusEffect } from '@react-navigation/native';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CardData {
  name: string;
  surname: string;
  email: string;
  phone: string;
  company: string;
  occupation: string;
  profileImage: string | null;
  companyLogo: string | null;
  socials: {
    [key: string]: string | null;
  };
  colorScheme?: string;
}

interface UserData {
  id: string;
  name: string;
  surname: string;
  email: string;
  plan: string;
  organiserStatus?: string;
  phone?: string;
  company?: string;
  occupation?: string;
  bio?: string;
  country?: string;
  city?: string;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  cards?: CardData[];
}

export default function SettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const toast = useToast();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [profileImageLoading, setProfileImageLoading] = useState(false);

  // Load user data when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadUserData();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const [userId, cachedUserDataString] = await Promise.all([
        getUserId(),
        AsyncStorage.getItem('userData'),
      ]);

      if (!userId) {
        console.warn('SettingsScreen: No user ID found while loading profile data');
        return;
      }

      if (cachedUserDataString) {
        const cached = JSON.parse(cachedUserDataString);
        setUserData(cached);
      }

      try {
        const response = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_USER}/${userId}`);
        if (response.ok) {
          const freshUserData = await response.json();
          const normalizedUserData: UserData = {
            ...(freshUserData || {}),
            id: freshUserData?.id || userId,
          };

          setUserData(prev => (prev ? { ...prev, ...normalizedUserData } : normalizedUserData));

          await AsyncStorage.setItem('userData', JSON.stringify(normalizedUserData));
        } else {
          console.warn('SettingsScreen: Failed to fetch users collection data:', response.status);
        }
      } catch (userFetchError) {
        console.error('SettingsScreen: Error fetching users collection data:', userFetchError);
      }

      setProfileImageLoading(true);
      try {
        const cardResponse = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_CARD}/${userId}`);
        if (cardResponse.ok) {
          const responseData = await cardResponse.json();
          
          let cardsArray: CardData[] | undefined;
          if (responseData?.cards) {
            cardsArray = responseData.cards;
          } else if (Array.isArray(responseData)) {
            cardsArray = responseData;
          }

          if (cardsArray) {
            setUserData(prev => (prev ? { ...prev, cards: cardsArray } : prev));
          }
        }
      } catch (cardError) {
        console.log('Could not load cards, profile image will use default:', cardError);
      } finally {
        setProfileImageLoading(false);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setProfileImageLoading(false);
    }
  };

  const handleProfilePress = () => {
    navigation.navigate('UserProfile');
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
      'This will temporarily disable your account. Your data will be preserved and you can contact support to reactivate.\n\nFor permanent deletion, use "Delete Account" instead.',
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
          routes: [{ name: 'Auth' }],
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? This action cannot be undone and you will lose access to all your data.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    console.log('🗑️ confirmDeleteAccount called');
    console.log('🗑️ Endpoint:', ENDPOINTS.DELETE_ACCOUNT);
    console.log('🗑️ API Base URL:', API_BASE_URL);
    
    setDeactivating(true);
    try {
      console.log('🗑️ Sending DELETE request...');
      const response = await authenticatedFetchWithRefresh(ENDPOINTS.DELETE_ACCOUNT, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('🗑️ Response status:', response.status);
      console.log('🗑️ Response ok:', response.ok);

      if (response.ok) {
        toast.success('Account Deleted', 'Your account has been permanently deleted.');
        
        // Clear local storage
        await AsyncStorage.clear();
        
        // Navigate to sign in
        navigation.reset({
          index: 0,
          routes: [{ name: 'Auth' }],
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(
        'Deletion Failed',
        error instanceof Error ? error.message : 'Failed to delete account. Please try again.'
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
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          
          {userData && (
            <TouchableOpacity
              style={styles.userInfo}
              activeOpacity={0.85}
              onPress={handleProfilePress}
            >
              <View style={styles.userInfoContent}>
                {/* Display first card's profile image or default blue avatar */}
                {profileImageLoading ? (
                  // Show loading state only for avatar
                  <View style={styles.avatar}>
                    <ActivityIndicator size="small" color={COLORS.white} />
                  </View>
                ) : (() => {
                  const imageUrl = userData.cards?.[0]?.profileImage ? getImageUrl(userData.cards[0].profileImage) : null;
                  return imageUrl ? (
                    // Show profile image from first card
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.avatarImage}
                      onError={() => {
                        console.log('Failed to load profile image, using default avatar');
                      }}
                    />
                  ) : (
                    // Show default blue circle with icon
                    <View style={styles.avatar}>
                      <MaterialIcons name="person" size={32} color={COLORS.white} />
                    </View>
                  );
                })()}
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>
                    {userData.name && userData.surname 
                      ? `${userData.name} ${userData.surname}`
                      : userData.name 
                        ? userData.name
                        : userData.cards && userData.cards[0] 
                          ? `${userData.cards[0].name} ${userData.cards[0].surname}`
                          : 'User'
                    }
                  </Text>
                  <Text style={styles.userEmail}>{userData.email || 'No email'}</Text>
                  <Text style={styles.userPlan}>
                    Plan: {userData.plan === 'premium' ? 'Premium' : 'Free'}
                  </Text>
                </View>
              </View>
              <MaterialIcons name="chevron-right" size={24} color={COLORS.gray} />
            </TouchableOpacity>
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
              'View Subscription Details',
              'See your plan and manage it',
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

          {(userData?.plan === 'premium' || userData?.plan === 'enterprise') && (
            renderSettingItem(
              'calendar-today',
              'Calendar Preferences',
              'Configure your public booking calendar',
              () => navigation.navigate('CalendarPreferences')
            )
          )}

          {renderSettingItem(
            'security',
            'Privacy & Security',
            'Manage your privacy and security settings',
            () => navigation.navigate('PrivacySecurity')
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
            'block',
            'Deactivate Account',
            'Temporarily disable your account',
            handleDeactivateAccount,
            false,
            true
          )}

          {renderSettingItem(
            'delete-forever',
            'Delete Account',
            'Permanently delete account and data',
            handleDeleteAccount,
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
    paddingTop: 100,
  },
  scrollContent: {
    paddingBottom: 20,
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
    justifyContent: 'space-between',
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
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
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.secondary,
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