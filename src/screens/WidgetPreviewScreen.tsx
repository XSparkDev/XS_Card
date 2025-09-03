import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { getWidgetPreferences, toggleWidgetPreference } from '../utils/widgetUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import { getUserId } from '../utils/api';
import WidgetDataService from '../services/WidgetDataService';

type NavigationProp = NativeStackNavigationProp<any>;

interface CardData {
  index: number;
  name: string;
  surname: string;
  company: string;
  colorScheme: string;
}

type Platform = 'ios' | 'android';

export default function WidgetPreviewScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [platform, setPlatform] = useState<Platform>('ios');
  const [widgetPreferences, setWidgetPreferences] = useState<{ [key: number]: boolean }>({});
  const [userCards, setUserCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWidgetSize, setSelectedWidgetSize] = useState<'small' | 'full'>('full');
  const [realUserId, setRealUserId] = useState<string | null>(null);

  useEffect(() => {
    loadWidgetData();
  }, []);

  const loadWidgetData = async () => {
    try {
      setLoading(true);
      
      // Get real user ID
      const userId = await getUserId();
      setRealUserId(userId);
      
      // Load widget preferences
      const preferences = await getWidgetPreferences();
      setWidgetPreferences(preferences);
      
      // Load user cards from storage
      const cardsData = await AsyncStorage.getItem('userCards');
      if (cardsData) {
        const cards = JSON.parse(cardsData);
        setUserCards(cards);
      } else {
        // Create sample data for testing
        setUserCards([
          {
            index: 0,
            name: 'John',
            surname: 'Doe',
            company: 'Tech Corp',
            colorScheme: '#4CAF50'
          },
          {
            index: 1,
            name: 'Jane',
            surname: 'Smith',
            company: 'Design Studio',
            colorScheme: '#2196F3'
          },
          {
            index: 2,
            name: 'Mike',
            surname: 'Johnson',
            company: 'Marketing Pro',
            colorScheme: '#FF9800'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading widget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWidget = async (cardIndex: number) => {
    try {
      const newValue = !widgetPreferences[cardIndex];
      await toggleWidgetPreference(cardIndex, newValue);
      setWidgetPreferences(prev => ({
        ...prev,
        [cardIndex]: newValue
      }));
    } catch (error) {
      console.error('Error toggling widget:', error);
      Alert.alert('Error', 'Failed to update widget preference');
    }
  };

  const handleUpdateRealWidgets = async () => {
    try {
      await WidgetDataService.updateAllWidgets();
      Alert.alert(
        'Widgets Updated!', 
        'Your home screen widgets have been updated with the latest data. If you don\'t see widgets on your home screen, you may need to add them manually from your device\'s widget gallery.'
      );
    } catch (error) {
      console.error('Error updating real widgets:', error);
      Alert.alert('Error', 'Failed to update home screen widgets. Make sure you have widgets enabled and added to your home screen.');
    }
  };

  const renderPlatformToggle = () => (
    <View style={styles.platformToggle}>
      <Text style={styles.sectionTitle}>Platform Preview</Text>
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.platformButton,
            platform === 'ios' && styles.platformButtonActive
          ]}
          onPress={() => setPlatform('ios')}
        >
          <MaterialIcons 
            name="phone-iphone" 
            size={20} 
            color={platform === 'ios' ? COLORS.white : COLORS.gray} 
          />
          <Text style={[
            styles.platformButtonText,
            platform === 'ios' && styles.platformButtonTextActive
          ]}>
            iOS
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.platformButton,
            platform === 'android' && styles.platformButtonActive
          ]}
          onPress={() => setPlatform('android')}
        >
          <MaterialIcons 
            name="phone-android" 
            size={20} 
            color={platform === 'android' ? COLORS.white : COLORS.gray} 
          />
          <Text style={[
            styles.platformButtonText,
            platform === 'android' && styles.platformButtonTextActive
          ]}>
            Android
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderWidgetSizeSelector = () => (
    <View style={styles.sizeSelector}>
      <Text style={styles.sectionTitle}>Widget Size</Text>
      <View style={styles.sizeButtons}>
        {(['small', 'full'] as const).map((size) => (
          <TouchableOpacity
            key={size}
            style={[
              styles.sizeButton,
              selectedWidgetSize === size && styles.sizeButtonActive
            ]}
            onPress={() => setSelectedWidgetSize(size)}
          >
            <Text style={[
              styles.sizeButtonText,
              selectedWidgetSize === size && styles.sizeButtonTextActive
            ]}>
              {size.charAt(0).toUpperCase() + size.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderQRCodeInfo = () => (
    <View style={styles.qrCodeInfo}>
      <Text style={styles.sectionTitle}>QR Code Information</Text>
      <View style={styles.qrCodeInfoContent}>
        <MaterialIcons name="qr-code" size={24} color={COLORS.primary} />
        <View style={styles.qrCodeInfoText}>
          <Text style={styles.qrCodeInfoTitle}>What's in the QR Code?</Text>
          <Text style={styles.qrCodeInfoDescription}>
            Each widget displays a unique QR code that links directly to your digital business card. 
            When scanned, it opens a web page where people can save your contact information.
          </Text>
          <Text style={styles.qrCodeInfoFormat}>
            Format: https://xscard-app-8ign.onrender.com/saveContact?userId={realUserId || 'USER_ID'}&cardIndex=CARD_INDEX
          </Text>
        </View>
      </View>
    </View>
  );

  const renderHomeScreenPreview = () => {
    const enabledCards = userCards.filter(card => widgetPreferences[card.index]);
    
    return (
      <View style={styles.homeScreenPreview}>
        <Text style={styles.sectionTitle}>
          {platform === 'ios' ? 'iOS Home Screen' : 'Android Home Screen'} Preview
        </Text>
        
        <View style={[
          styles.homeScreenContainer,
          platform === 'ios' ? styles.iosHomeScreen : styles.androidHomeScreen
        ]}>
          {/* Status Bar */}
          <View style={[
            styles.statusBar,
            platform === 'ios' ? styles.iosStatusBar : styles.androidStatusBar
          ]}>
            <Text style={styles.statusBarText}>
              {platform === 'ios' ? '9:41' : '9:41'}
            </Text>
            <View style={styles.statusBarIcons}>
              {platform === 'ios' ? (
                <>
                  <View style={styles.iosSignalIcon}>
                    <View style={[styles.iosSignalBar, { height: 4 }]} />
                    <View style={[styles.iosSignalBar, { height: 6 }]} />
                    <View style={[styles.iosSignalBar, { height: 8 }]} />
                    <View style={[styles.iosSignalBar, { height: 10 }]} />
                  </View>
                  <View style={styles.iosWifiIcon}>
                    <View style={styles.iosWifiArc} />
                  </View>
                  <View style={styles.iosBatteryIcon}>
                    <View style={styles.iosBatteryOutline} />
                    <View style={styles.iosBatteryFill} />
                  </View>
                </>
              ) : (
                <>
                  <MaterialIcons name="signal-cellular-4-bar" size={16} color={COLORS.white} />
                  <MaterialIcons name="wifi" size={16} color={COLORS.white} />
                  <MaterialIcons name="battery-full" size={16} color={COLORS.white} />
                </>
              )}
            </View>
          </View>

          {/* Widget Area */}
          <View style={styles.widgetArea}>
            {enabledCards.length > 0 ? (
              enabledCards.map((card, index) => (
                <View
                  key={card.index}
                  style={[
                    styles.widgetPreview,
                    platform === 'ios' ? styles.iosWidget : styles.androidWidget,
                    { width: getWidgetWidth(selectedWidgetSize) }
                  ]}
                >
                  {selectedWidgetSize === 'small' ? (
                    // Small widget: 100% QR code - fills entire widget
                    <QRCode
                      value={`https://xscard-app-8ign.onrender.com/saveContact?userId=${realUserId || 'user123'}&cardIndex=${card.index}`}
                      size={getWidgetQRSize(selectedWidgetSize)}
                      color={COLORS.black}
                      backgroundColor={COLORS.white}
                    />
                  ) : (
                    // Full widget: 100% QR code - fills entire widget
                    <QRCode
                      value={`https://xscard-app-8ign.onrender.com/saveContact?userId=${realUserId || 'user123'}&cardIndex=${card.index}`}
                      size={getWidgetQRSize(selectedWidgetSize)}
                      color={COLORS.black}
                      backgroundColor={COLORS.white}
                    />
                  )}
                </View>
              ))
            ) : (
              <View style={styles.noWidgetsMessage}>
                <MaterialIcons name="widgets" size={48} color={COLORS.gray} />
                <Text style={styles.noWidgetsText}>No widgets enabled</Text>
                <Text style={styles.noWidgetsSubtext}>
                  Enable widgets for your cards to see them here
                </Text>
              </View>
            )}
          </View>

                    {/* App Icons - Platform Specific */}
          <View style={styles.appIcons}>
            {platform === 'ios' ? (
              // iOS App Icons
              <>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#007AFF' }]}>
                  <MaterialIcons name="phone" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#34C759' }]}>
                  <MaterialIcons name="message" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#FF9500' }]}>
                  <MaterialIcons name="calendar-today" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#5856D6' }]}>
                  <MaterialIcons name="mail" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#FF2D92' }]}>
                  <MaterialIcons name="camera-alt" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#FF3B30' }]}>
                  <MaterialIcons name="settings" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: '#FF6B35' }]}>
                  <MaterialIcons name="public" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.iosAppIcon, { backgroundColor: COLORS.primary }]}>
                  <MaterialIcons name="contact-page" size={20} color={COLORS.white} />
                </View>
              </>
            ) : (
              // Android App Icons
              <>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#4285F4' }]}>
                  <MaterialIcons name="phone" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#34A853' }]}>
                  <MaterialIcons name="message" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#FBBC04' }]}>
                  <MaterialIcons name="calendar-today" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#EA4335' }]}>
                  <MaterialIcons name="mail" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#FF5722' }]}>
                  <MaterialIcons name="camera-alt" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#9C27B0' }]}>
                  <MaterialIcons name="store" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: '#795548' }]}>
                  <MaterialIcons name="settings" size={20} color={COLORS.white} />
                </View>
                <View style={[styles.appIcon, styles.androidAppIcon, { backgroundColor: COLORS.primary }]}>
                  <MaterialIcons name="contact-page" size={20} color={COLORS.white} />
                </View>
              </>
            )}
          </View>
        <Text style={styles.sizeDescription}>
          {selectedWidgetSize === 'small' && 'Small: 100% QR code'}
          {selectedWidgetSize === 'full' && 'Full: 100% QR code'}
        </Text>
      </View>
    </View>
  );
  };

  const getWidgetWidth = (size: 'small' | 'full') => {
    const screenWidth = Dimensions.get('window').width - 32;
    switch (size) {
      case 'small': return screenWidth * 0.375; // 0.5 * 0.75 = 0.375 (25% smaller)
      case 'full': return screenWidth * 0.525; // 0.7 * 0.75 = 0.525 (25% smaller)
      default: return screenWidth * 0.525;
    }
  };

  const getWidgetQRSize = (size: 'small' | 'full') => {
    const widgetWidth = getWidgetWidth(size);
    switch (size) {
      case 'small': return widgetWidth * 0.9; // 90% of widget width
      case 'full': return widgetWidth * 0.9; // 90% of widget width
      default: return widgetWidth * 0.9;
    }
  };

  const renderWidgetControls = () => (
    <View style={styles.widgetControls}>
      <Text style={styles.sectionTitle}>Widget Controls</Text>
      
      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>Enable/Disable Widgets</Text>
        {userCards.map((card) => (
          <View key={card.index} style={styles.widgetToggle}>
            <View style={styles.widgetToggleInfo}>
              <View style={[styles.cardColor, { backgroundColor: card.colorScheme }]} />
              <View>
                <Text style={styles.cardName}>
                  {card.name} {card.surname}
                </Text>
                <Text style={styles.cardCompany}>{card.company}</Text>
              </View>
            </View>
            <Switch
              value={widgetPreferences[card.index] || false}
              onValueChange={() => handleToggleWidget(card.index)}
              trackColor={{ false: COLORS.lightGray, true: COLORS.secondary }}
              thumbColor={widgetPreferences[card.index] ? COLORS.white : COLORS.gray}
            />
          </View>
        ))}
      </View>

             <View style={styles.controlSection}>
         <Text style={styles.controlLabel}>Widget Actions</Text>
         <TouchableOpacity
           style={styles.actionButton}
           onPress={() => {
             Alert.alert('Widget Action', 'This would refresh all widgets in a real implementation');
           }}
         >
           <MaterialIcons name="refresh" size={20} color={COLORS.white} />
           <Text style={styles.actionButtonText}>Refresh All Widgets</Text>
         </TouchableOpacity>
         
         <TouchableOpacity
           style={styles.actionButton}
           onPress={() => {
             Alert.alert('Widget Action', 'This would open the app from a widget tap');
           }}
         >
           <MaterialIcons name="launch" size={20} color={COLORS.white} />
           <Text style={styles.actionButtonText}>Test Widget Tap</Text>
         </TouchableOpacity>

                       <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  Alert.alert('QR Code Test', 'In a real widget, this QR code would be scannable and contain your card data!');
                }}
              >
                <MaterialIcons name="qr-code-scanner" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Test QR Code Scan</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={handleUpdateRealWidgets}
              >
                <MaterialIcons name="home" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Update Home Screen Widgets</Text>
              </TouchableOpacity>
       </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Widget Preview" />
        <View style={styles.loadingContainer}>
          <Text>Loading widget preview...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Widget Preview" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderPlatformToggle()}
        {renderWidgetSizeSelector()}
        {renderQRCodeInfo()}
        {renderHomeScreenPreview()}
        {renderWidgetControls()}
        
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 16,
  },
  platformToggle: {
    marginBottom: 24,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 4,
  },
  platformButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  platformButtonActive: {
    backgroundColor: COLORS.primary,
  },
  platformButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.gray,
  },
  platformButtonTextActive: {
    color: COLORS.white,
  },
  sizeSelector: {
    marginBottom: 24,
  },
  sizeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
  },
  sizeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  sizeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
  },
  sizeButtonTextActive: {
    color: COLORS.white,
  },
  sizeDescription: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
  qrCodeInfo: {
    marginBottom: 24,
  },
  qrCodeInfoContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 12,
  },
  qrCodeInfoText: {
    flex: 1,
    marginLeft: 16,
  },
  qrCodeInfoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  qrCodeInfoDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: 8,
  },
  qrCodeInfoFormat: {
    fontSize: 12,
    color: COLORS.primary,
    fontFamily: 'monospace',
    backgroundColor: COLORS.white,
    padding: 8,
    borderRadius: 6,
  },
  homeScreenPreview: {
    marginBottom: 24,
  },
  homeScreenContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
  },
  iosHomeScreen: {
    backgroundColor: '#000',
    borderColor: '#333',
  },
  androidHomeScreen: {
    backgroundColor: '#121212',
    borderColor: '#444',
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iosStatusBar: {
    backgroundColor: '#000',
  },
  androidStatusBar: {
    backgroundColor: '#121212',
  },
  statusBarText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  statusBarIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  widgetArea: {
    padding: 16,
    minHeight: 200,
    alignItems: 'center',
    gap: 16,
  },
  widgetPreview: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosWidget: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    backdropFilter: 'blur(20px)',
  },
  androidWidget: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },

  noWidgetsMessage: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noWidgetsText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray,
    marginTop: 16,
  },
  noWidgetsSubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  appIcons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconText: {
    fontSize: 24,
  },
  // iOS Status Bar Icons
  iosSignalIcon: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1,
    height: 12,
  },
  iosSignalBar: {
    width: 3,
    backgroundColor: COLORS.white,
    borderRadius: 1,
  },
  iosWifiIcon: {
    width: 16,
    height: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iosWifiArc: {
    width: 16,
    height: 12,
    borderTopWidth: 2,
    borderTopColor: COLORS.white,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  iosBatteryIcon: {
    width: 24,
    height: 12,
    position: 'relative',
  },
  iosBatteryOutline: {
    width: 24,
    height: 12,
    borderWidth: 1,
    borderColor: COLORS.white,
    borderRadius: 2,
    position: 'absolute',
  },
  iosBatteryFill: {
    width: 20,
    height: 8,
    backgroundColor: COLORS.white,
    borderRadius: 1,
    position: 'absolute',
    top: 2,
    left: 2,
  },
  // iOS App Icons
  iosAppIcon: {
    borderRadius: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  // Android App Icons
  androidAppIcon: {
    borderRadius: 8,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  widgetControls: {
    marginBottom: 24,
  },
  controlSection: {
    marginBottom: 20,
  },
  controlLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 12,
  },
  widgetToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  widgetToggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardColor: {
    width: 12,
    height: 40,
    borderRadius: 6,
    marginRight: 16,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: COLORS.gray,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  bottomSpacing: {
    height: 100,
  },
});
