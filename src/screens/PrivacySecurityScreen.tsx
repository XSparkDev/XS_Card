import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../constants/colors';

export default function PrivacySecurityScreen() {
  const navigation = useNavigation();
  
  // State for all toggle switches
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [loginNotifications, setLoginNotifications] = useState(true);
  const [autoDetectCurrency, setAutoDetectCurrency] = useState(true);
  const [locationServices, setLocationServices] = useState(false);
  
  // Currency dropdown state
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const currencies = ['USD', 'ZAR', 'EUR', 'GBP'];

  const handleMarketingEmailsToggle = (value: boolean) => {
    setMarketingEmails(value);
    if (value) {
      Alert.alert('Marketing Emails Enabled', 'You will receive promotional content and updates.');
    }
  };

  const handlePushNotificationsToggle = (value: boolean) => {
    setPushNotifications(value);
    if (!value) {
      Alert.alert(
        'Push Notifications Disabled',
        'You will not receive app updates or security alerts.',
        [
          { text: 'OK', style: 'default' },
          { text: 'Re-enable', onPress: () => setPushNotifications(true) }
        ]
      );
    }
  };

  const handleTwoFactorToggle = (value: boolean) => {
    if (value) {
      Alert.alert(
        'Enable Two-Factor Authentication',
        'This will add an extra layer of security to your account. You will need to verify your identity when logging in.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Enable', onPress: () => setTwoFactorAuth(true) }
        ]
      );
    } else {
      setTwoFactorAuth(false);
    }
  };

  const handleLoginNotificationsToggle = (value: boolean) => {
    setLoginNotifications(value);
    if (value) {
      Alert.alert('Login Notifications Enabled', 'You will receive email alerts for new logins.');
    }
  };

  const handleAutoDetectCurrencyToggle = (value: boolean) => {
    setAutoDetectCurrency(value);
    if (!value) {
      Alert.alert('Auto-detect Disabled', 'You will need to manually select your currency.');
    }
  };

  const handleLocationServicesToggle = (value: boolean) => {
    setLocationServices(value);
    if (value) {
      Alert.alert(
        'Location Services',
        'This app will use your location to automatically detect your preferred currency.',
        [
          { text: 'Cancel', onPress: () => setLocationServices(false) },
          { text: 'Allow', onPress: () => setLocationServices(true) }
        ]
      );
    }
  };

  const handleDataExport = () => {
    Alert.alert(
      'Export Your Data',
      'This will download all your personal data in a portable format. The download link will be sent to your email.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Export', onPress: () => {
          Alert.alert('Export Started', 'Your data export has been initiated. You will receive an email with the download link within 24 hours.');
        }}
      ]
    );
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      'You will be redirected to the password change page.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => {
          // Navigate to change password screen
          navigation.navigate('ChangePassword' as never);
        }}
      ]
    );
  };

  const handleLogoutAllDevices = () => {
    Alert.alert(
      'Logout All Devices',
      'This will sign you out of all devices except this one. You will need to log in again on other devices.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout All', style: 'destructive', onPress: () => {
          Alert.alert('Success', 'You have been logged out of all other devices.');
        }}
      ]
    );
  };

  const renderToggleSetting = (
    title: string,
    description: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    icon: string
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <MaterialIcons name={icon as any} size={24} color={COLORS.primary} />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#E0E0E0', true: COLORS.primary }}
        thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
      />
    </View>
  );

  const renderActionButton = (
    title: string,
    description: string,
    onPress: () => void,
    icon: string,
    isDestructive = false
  ) => (
    <TouchableOpacity style={styles.actionItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <MaterialIcons 
          name={icon as any} 
          size={24} 
          color={isDestructive ? '#FF4444' : COLORS.primary} 
        />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingTitle, isDestructive && styles.destructiveText]}>
            {title}
          </Text>
          <Text style={styles.settingDescription}>{description}</Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#C0C0C0" />
    </TouchableOpacity>
  );

  const renderCurrencyDropdown = () => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <MaterialIcons name="attach-money" size={24} color={COLORS.primary} />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>Manual Currency</Text>
          <Text style={styles.settingDescription}>Select your preferred currency</Text>
        </View>
      </View>
      <TouchableOpacity 
        style={styles.currencyButton}
        onPress={() => {
          Alert.alert(
            'Select Currency',
            'Choose your preferred currency',
            currencies.map(currency => ({
              text: currency,
              onPress: () => setSelectedCurrency(currency)
            }))
          );
        }}
      >
        <Text style={styles.currencyText}>{selectedCurrency}</Text>
        <MaterialIcons name="keyboard-arrow-down" size={20} color={COLORS.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & Security</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Security</Text>
          
          {renderToggleSetting(
            'Two-Factor Authentication',
            'Add an extra layer of security to your account',
            twoFactorAuth,
            handleTwoFactorToggle,
            'security'
          )}
          
          {renderToggleSetting(
            'Login Notifications',
            'Email alerts for new logins',
            loginNotifications,
            handleLoginNotificationsToggle,
            'notifications'
          )}
        </View>

        {/* Communication Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Communication</Text>
          
          {renderToggleSetting(
            'Marketing Emails',
            'Promotional content and updates',
            marketingEmails,
            handleMarketingEmailsToggle,
            'email'
          )}
          
          {renderToggleSetting(
            'Push Notifications',
            'App updates and security alerts',
            pushNotifications,
            handlePushNotificationsToggle,
            'notifications-active'
          )}
        </View>

        {/* Location & Currency Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location & Currency</Text>
          
          {renderToggleSetting(
            'Auto-detect Currency',
            'Use device location for currency',
            autoDetectCurrency,
            handleAutoDetectCurrencyToggle,
            'location-on'
          )}
          
          {renderToggleSetting(
            'Location Services',
            'For currency detection',
            locationServices,
            handleLocationServicesToggle,
            'my-location'
          )}
          
          {!autoDetectCurrency && renderCurrencyDropdown()}
        </View>

        {/* Data Management Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          {renderActionButton(
            'Data Export',
            'Download my data',
            handleDataExport,
            'download'
          )}
          
          {renderActionButton(
            'Change Password',
            'Update your password',
            handleChangePassword,
            'lock'
          )}
          
          {renderActionButton(
            'Logout All Devices',
            'Sign out from all devices',
            handleLogoutAllDevices,
            'logout',
            true
          )}
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Your privacy and security are important to us. All settings are saved automatically.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 15,
    paddingLeft: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 1,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 18,
  },
  destructiveText: {
    color: '#FF4444',
  },
  currencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  currencyText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.primary,
    marginRight: 4,
  },
  footer: {
    marginTop: 30,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 16,
  },
});
