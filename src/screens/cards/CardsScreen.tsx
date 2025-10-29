import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Animated, ScrollView, ImageStyle, Modal, Linking, Alert, TextInput, ViewStyle, ActivityIndicator, Platform, Dimensions, Share } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { API_BASE_URL, ENDPOINTS, buildUrl, getUserId, authenticatedFetchWithRefresh, forceLogoutExpiredToken } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useColorScheme } from '../../context/ColorSchemeContext';
import { getImageUrl } from '../../utils/imageUtils';
import { isProfileIncompleteError } from '../../utils/profileErrorHandler';
import ProfileCompletionModal from '../../components/ProfileCompletionModal';

// Update interfaces to match new data structure
interface UserData {
  id: string;
  cards: CardData[];
  phone?: string;
  name?: string;
  surname?: string;
  email?: string;
  occupation?: string;
  company?: string;
  profileImage?: string;
  companyLogo?: string;
  logoZoomLevel?: number;
  analytics?: any;
}

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
  createdAt: string;
  UserId: any;
  logoZoomLevel?: number;
}

interface ShareOption {
  id: string;
  name: string;
  icon: 'whatsapp' | 'send' | 'email' | 'more-horiz' | 'linkedin';
  color: string;
  action: () => void;
}

// Add this mapping for social icons
const socialIcons: { [key: string]: keyof typeof MaterialCommunityIcons.glyphMap } = {
  whatsapp: 'whatsapp',
  x: 'twitter',
  facebook: 'facebook',
  linkedin: 'linkedin',
  website: 'web',
  tiktok: 'music-note',
  instagram: 'instagram'
};

// Add this mapping for social media base URLs
const socialBaseUrls: { [key: string]: string } = {
  whatsapp: 'https://wa.me/',  // WhatsApp expects phone number
  x: 'https://x.com/',  // X (Twitter)
  facebook: 'https://facebook.com/',
  linkedin: 'https://linkedin.com/in/',
  website: '',  // Website should already include http(s)://
  tiktok: 'https://tiktok.com/@',
  instagram: 'https://instagram.com/'
};

// Add this interface at the top with other interfaces
interface Card {
  CardId: string;
  Company: string;
  Email: string;
  PhoneNumber: string;
  title: string;
  socialLinks: any[];
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function CardsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [qrCode, setQrCode] = useState<string>('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const { colorScheme, updateColorScheme } = useColorScheme();
  // Remove cardData state since it's now part of userData
  const borderRotation = useRef(new Animated.Value(0)).current;
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);
  const [isWalletLoading, setIsWalletLoading] = useState(false);

  // Add these new state variables at the beginning of the CardsScreen component
  const [isOptionsModalVisible, setIsOptionsModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'email' | 'phone' | null>(null);
  const [showProfileCompletionModal, setShowProfileCompletionModal] = useState(false);
  const [modalData, setModalData] = useState<string>('');
  
  // Mock pass preview states
  const [showPassPreview, setShowPassPreview] = useState(false);
  const [passPreviewData, setPassPreviewData] = useState<any>(null);

  // Update the cards state definition
  const [cards, setCards] = useState<Card[]>([]);
  // Add this state to track current page
  const [currentPage, setCurrentPage] = useState(0);


  // Add this function to handle scroll events
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / Dimensions.get('window').width);
    setCurrentPage(page);
  };

  // Add this to load cards when the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const loadCards = async () => {
        try {
          const cardsJson = await AsyncStorage.getItem('userCards');
          if (cardsJson) {
            const loadedCards = JSON.parse(cardsJson);
            setCards(loadedCards);
          }
        } catch (error) {
          console.error('Error loading cards:', error);
        }
      };

      loadCards();
    }, [])
  );

  const loadUserData = async () => {
    try {
      const userId = await getUserId(); // Gets userId stored during login
      if (!userId) {
        console.error('No user ID found');
        return;
      }

      // Uses authenticated request to fetch cards
      const cardResponse = await authenticatedFetchWithRefresh(ENDPOINTS.GET_CARD + `/${userId}`);
      const responseData = await cardResponse.json();

      // Handle new response structure
      let cardsArray;
      let analytics;
      
      if (responseData.cards) {
        // New structure: { cards: [...], analytics: {...} }
        cardsArray = responseData.cards;
        analytics = responseData.analytics;
        console.log('Scan analytics:', analytics);
      } else if (Array.isArray(responseData)) {
        // Fallback for old structure: [card1, card2, ...]
        cardsArray = responseData;
        console.log('Using fallback for old API response structure');
      } else {
        console.error('Unexpected API response structure:', responseData);
        return;
      }

      if (cardsArray && cardsArray.length > 0) {
        // Log the first card's data to check if scans and logoZoomLevel are included
        console.log('Card data received:', JSON.stringify(cardsArray[0], null, 2));
        
        // Debug profile image and company logo specifically
        cardsArray.forEach((card: any, index: number) => {
          console.log(`Card ${index} - Profile Image:`, card.profileImage);
          console.log(`Card ${index} - Company Logo:`, card.companyLogo);
          console.log(`Card ${index} - Profile Image URL processed:`, getImageUrl(card.profileImage));
          console.log(`Card ${index} - Company Logo URL processed:`, getImageUrl(card.companyLogo));
        });
        
        setUserData({
          id: userId,
          cards: cardsArray,
          analytics: analytics // Store analytics for future use
        });

        // Cache cards data in AsyncStorage with timestamp
        try {
          const cacheData = {
            data: cardsArray,
            analytics: analytics,
            timestamp: Date.now()
          };
          await AsyncStorage.setItem('cachedCards', JSON.stringify(cacheData));
          console.log('✅ Cached cards data for Dashboard reuse');
        } catch (cacheError) {
          console.error('Error caching cards:', cacheError);
        }

        // Set card color from the first card (index 0)
        if (cardsArray[0].colorScheme) {
          updateColorScheme(cardsArray[0].colorScheme);
        }
      }

      // Generate QR code
      fetchQRCode(userId);
    } catch (error) {
      console.error('Error loading data:', error);
      
      // Check if this is a profile incomplete error
      if (isProfileIncompleteError(error)) {
        console.log('Detected profile incomplete error during data loading, showing completion modal');
        setShowProfileCompletionModal(true);
        return;
      }
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      setIsLoading(true);
      
      // Add a direct API check when screen gets focus to verify server data
      const verifyServerData = async () => {
        try {
          const userId = await getUserId();
          if (userId) {
            const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_CARD + `/${userId}`);
            const cardsData = await response.json();
            console.log('FOCUS CHECK - Cards API response:', JSON.stringify(cardsData, null, 2));
            
            // Check if logoZoomLevel exists in the data
            if (cardsData && cardsData.length > 0) {
              cardsData.forEach((card: any, index: number) => {
                console.log(`Card ${index} zoom level:`, card.logoZoomLevel);
              });
            }
          }
        } catch (error) {
          console.error('Error in verification check:', error);
        }
      };
      
      verifyServerData();
      loadUserData().finally(() => {
        setIsLoading(false);
      });
    }, [])
  );

  // Add this effect to update card color when page changes
  useEffect(() => {
    if (userData?.cards && userData.cards[currentPage]) {
      const newColor = userData.cards[currentPage].colorScheme || COLORS.secondary;
      updateColorScheme(newColor);
    }
  }, [currentPage, userData]);

  const fetchQRCode = async (userId: string) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Update URL to include currentPage as cardIndex
      const response = await fetch(buildUrl(ENDPOINTS.GENERATE_QR_CODE) + `/${userId}/${currentPage}`, {
        method: 'GET',
        headers: {
          'Authorization': token || '',
          'Accept': 'image/png'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QR code');
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setQrCode(reader.result);
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error fetching QR code:', error);
      
      // Check if this is a profile incomplete error
      if (isProfileIncompleteError(error)) {
        console.log('Detected profile incomplete error, showing completion modal');
        setShowProfileCompletionModal(true);
        return;
      }
      
      // Show technical errors for other issues
      Alert.alert('Error', 'Failed to generate QR code');
    }
  };

  // Add an effect to update QR code when page changes
  useEffect(() => {
    const updateQRCode = async () => {
      const userId = await getUserId();
      if (userId) {
        fetchQRCode(userId);
      }
    };
    updateQRCode();
  }, [currentPage]); // Re-run when currentPage changes

  useEffect(() => {
    Animated.timing(borderRotation, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: true,
    }).start();
  }, []);

  const rotateInterpolate = borderRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shareOptions: ShareOption[] = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: 'whatsapp',
      color: '#25D366',
      action: async () => {
        if (!userData?.id) {
          Alert.alert('Error', 'User data not available');
          return;
        }
        const saveContactUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
        const message = `Check out my digital business card! ${saveContactUrl}`;
        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() => {
          Alert.alert('Error', 'WhatsApp is not installed on your device');
        });
      }
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: 'send',
      color: '#0088cc',
      action: async () => {
        if (!userData?.id) {
          Alert.alert('Error', 'User data not available');
          return;
        }
        const saveContactUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
        const message = `Check out my digital business card! ${saveContactUrl}`;
        Linking.openURL(`tg://msg?text=${encodeURIComponent(message)}`).catch(() => {
          Alert.alert('Error', 'Telegram is not installed on your device');
        });
      }
    },
    {
      id: 'email',
      name: 'Email',
      icon: 'email',
      color: '#EA4335',
      action: async () => {
        if (!userData?.id || !userData.cards || !userData.cards[currentPage]) {
          Alert.alert('Error', 'User data not available');
          return;
        }
        
        const currentCard = userData.cards[currentPage];
        const saveContactUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
        
        // Make it clear in the message who is sending this card
        const message = `Hello,\n\nI'm ${currentCard.name} ${currentCard.surname} from ${currentCard.company}.\n\nHere's my digital business card: ${saveContactUrl}\n\nBest regards,\n${currentCard.name} ${currentCard.surname}\n${currentCard.phone}\n${currentCard.email}`;
        
        // Try to set Reply-To header with the card's email, and make subject clearer
        const emailUrl = `mailto:?reply-to=${encodeURIComponent(currentCard.email)}&cc=${encodeURIComponent(currentCard.email)}&subject=${encodeURIComponent(`Digital Business Card - ${currentCard.name} ${currentCard.surname}, ${currentCard.company}`)}&body=${encodeURIComponent(message)}`;
        
        Linking.openURL(emailUrl).catch(() => {
          Alert.alert('Error', 'Could not open email client');
        });
      }
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: 'linkedin',
      color: '#0077B5',
      action: async () => {
        if (!userData?.id) {
          Alert.alert('Error', 'User data not available');
          return;
        }
        
        const saveContactUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
        const message = `Check out my digital business card!`;
        
        const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(saveContactUrl)}&summary=${encodeURIComponent(message)}`;
        
        Linking.openURL(linkedinUrl).catch(() => {
          Alert.alert('Error', 'Could not open LinkedIn');
        });
      }
    },
    {
      id: 'more',
      name: 'More',
      icon: 'more-horiz',
      color: '#6B7280',
      action: async () => {
        if (!userData?.id) {
          Alert.alert('Error', 'User data not available');
          return;
        }
        
        const saveContactUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
        const message = `Check out my digital business card!`;
        
        try {
          await Share.share({
            message: `${message}\n\n${saveContactUrl}`,
            url: saveContactUrl,
            title: 'My Digital Business Card'
          });
        } catch (error) {
          Alert.alert('Error', 'Could not open share options');
        }
      }
    }
  ];

  const handlePlatformSelect = (platform: string) => {
    const selectedOption = shareOptions.find(opt => opt.id === platform);
    if (selectedOption) {
      selectedOption.action();
      setIsShareModalVisible(false);
      setSelectedPlatform(null);
    }
  };

  const handleAddToWallet = async () => {
    try {
      // Check if card data is available
      const currentCard = userData?.cards?.[currentPage];
      if (!currentCard) {
        Alert.alert('Error', 'Card data not available');
        return;
      }

      // Show mock mode options
      Alert.alert(
        '🔧 Mock Wallet Mode',
        'Choose how you want to test the wallet pass:',
        [
          {
            text: 'Preview Pass',
            onPress: () => previewWalletPass()
          },
          {
            text: 'Generate File',
            onPress: () => createWalletPass()
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } catch (error) {
      console.error('Error preparing wallet pass:', error);
      Alert.alert('Error', 'Failed to prepare wallet pass');
    }
  };

  const previewWalletPass = async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        return;
      }

      const endpoint = `${ENDPOINTS.ADD_TO_WALLET
        .replace(':userId', userId)
        .replace(':cardIndex', currentPage.toString())}/preview`;

      console.log('Fetching pass preview from:', endpoint);

      const response = await authenticatedFetchWithRefresh(endpoint, {
        method: 'GET'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch pass preview');
      }

      const previewData = await response.json();
      console.log('[Preview] Received data:', JSON.stringify(previewData, null, 2));
      setPassPreviewData(previewData);
      setShowPassPreview(true);

    } catch (error) {
      console.error('Error fetching pass preview:', error);
      Alert.alert('Error', 'Failed to fetch pass preview');
    }
  };

  const createWalletPass = async () => {
    setIsWalletLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        return;
      }

      // Build the endpoint with userId, card index, and platform detection
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const endpoint = ENDPOINTS.ADD_TO_WALLET
        .replace(':userId', userId)
        .replace(':cardIndex', currentPage.toString()) + 
        `?platform=${platform}`;

      console.log('Making wallet request to:', endpoint);

      // Use authenticatedFetchWithRefresh which automatically handles the token
      const response = await authenticatedFetchWithRefresh(endpoint, {
        method: 'POST'
      });

      // Check if we're in mock mode
      const isMockMode = response.headers.get('X-Mock-Mode') === 'true';

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add to wallet');
      }

      // Handle mock mode
      if (isMockMode) {
        console.log('[Mock Mode] Received mock wallet pass');
        
        // Get the pass data
        const passData = await response.arrayBuffer();
        const currentCard = userData?.cards?.[currentPage];
        const filename = `${currentCard?.name || 'card'}_${currentPage}${Platform.OS === 'ios' ? '.pkpass' : '.json'}`;
        
        // Save to device
        await saveMockPassToDevice(passData, filename);
        return;
      }

      // Handle production mode platform-specific responses
      if (Platform.OS === 'ios') {
        // For iOS, we expect a .pkpass file
        const passData = await response.arrayBuffer();
        const filename = `${userData?.cards?.[currentPage]?.name || 'card'}_${currentPage}.pkpass`;
        
        // Create a blob URL and trigger download
        const blob = new Blob([passData], { type: 'application/vnd.apple.pkpass' });
        const url = URL.createObjectURL(blob);
        
        // Open the pass URL which should trigger Apple Wallet
        await Linking.openURL(url);
        
        // Clean up the blob URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        
        console.log('Apple Wallet pass created and opened');
        
      } else {
        // For Android, we expect a Google Wallet save URL
        const data = await response.json();
        
        if (data.saveUrl) {
          // Open the Google Wallet save URL
          await Linking.openURL(data.saveUrl);
          console.log('Google Wallet pass created and opened');
        } else {
          throw new Error('No save URL received from server');
        }
      }

    } catch (error) {
      console.error('Wallet error:', error);
      
      // Extract the error message
      const errorMessage = error instanceof Error ? error.message : 
        `Failed to add to ${Platform.OS === 'ios' ? 'Apple' : 'Google'} Wallet`;
      
      Alert.alert(
        'Wallet Pass Error', 
        errorMessage,
        [{ text: 'OK' }]
      );
    } finally {
      setIsWalletLoading(false);
    }
  };

  const saveMockPassToDevice = async (passData: ArrayBuffer, filename: string) => {
    try {
      // Convert ArrayBuffer to base64
      const uint8Array = new Uint8Array(passData);
      let binary = '';
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      // Create directory for wallet passes
      const dirPath = `${FileSystem.documentDirectory}wallet-passes/`;
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      // Save file
      const filePath = `${dirPath}${filename}`;
      await FileSystem.writeAsStringAsync(filePath, base64, {
        encoding: FileSystem.EncodingType.Base64
      });

      console.log('[Mock Mode] Pass saved to:', filePath);

      // Show success message with options
      Alert.alert(
        '🔧 Mock Pass Saved!',
        `File saved to:\n${Platform.OS === 'ios' ? 'Documents/wallet-passes/' : 'Files/wallet-passes/'}\n\nThis is a mock pass for testing. You can inspect the file structure.\n\nNote: Mock passes won't open in ${Platform.OS === 'ios' ? 'Apple' : 'Google'} Wallet.`,
        [
          {
            text: 'Share File',
            onPress: () => sharePassFile(filePath, filename)
          },
          {
            text: 'OK',
            style: 'default'
          }
        ]
      );

    } catch (error) {
      console.error('[Mock Mode] Error saving pass:', error);
      Alert.alert('Error', 'Failed to save mock pass to device');
    }
  };

  const sharePassFile = async (filePath: string, filename: string) => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          mimeType: Platform.OS === 'ios' ? 'application/vnd.apple.pkpass' : 'application/json',
          dialogTitle: `Share ${filename}`,
          UTI: Platform.OS === 'ios' ? 'com.apple.pkpass' : undefined
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('Error sharing file:', error);
      Alert.alert('Error', 'Failed to share file');
    }
  };

  const handleEmailPress = (email: string) => {
    setModalType('email');
    setModalData(email);
    setIsOptionsModalVisible(true);
  };

  const handlePhonePress = (phone: string) => {
    setModalType('phone');
    setModalData(phone);
    setIsOptionsModalVisible(true);
  };

  const handleSocialPress = (platform: string, value: string) => {
    try {
      let url = '';
      
      switch (platform) {
        case 'whatsapp':
          // WhatsApp expects phone number without + or spaces
          const cleanPhone = value.replace(/[^\d]/g, '');
          url = `https://wa.me/${cleanPhone}`;
          break;
        case 'x':
          // X (Twitter) - remove @ if present
          const twitterHandle = value.startsWith('@') ? value.substring(1) : value;
          url = `https://x.com/${twitterHandle}`;
          break;
        case 'facebook':
          // Facebook - remove @ if present
          const facebookHandle = value.startsWith('@') ? value.substring(1) : value;
          url = `https://facebook.com/${facebookHandle}`;
          break;
        case 'linkedin':
          // LinkedIn - remove @ if present
          const linkedinHandle = value.startsWith('@') ? value.substring(1) : value;
          url = `https://linkedin.com/in/${linkedinHandle}`;
          break;
        case 'website':
          // Website - add https:// if not present
          url = value.startsWith('http') ? value : `https://${value}`;
          break;
        case 'tiktok':
          // TikTok - remove @ if present
          const tiktokHandle = value.startsWith('@') ? value.substring(1) : value;
          url = `https://tiktok.com/@${tiktokHandle}`;
          break;
        case 'instagram':
          // Instagram - remove @ if present
          const instagramHandle = value.startsWith('@') ? value.substring(1) : value;
          url = `https://instagram.com/${instagramHandle}`;
          break;
        default:
          console.warn('Unknown social platform:', platform);
          return;
      }
      
      // Open the URL
      Linking.openURL(url).catch((error) => {
        console.error('Failed to open social link:', error);
        Alert.alert('Error', `Could not open ${platform}. Please check if the app is installed.`);
      });
      
    } catch (error) {
      console.error('Error handling social press:', error);
      Alert.alert('Error', 'Failed to open social media link');
    }
  };

  const handleEditCard = () => {
    // Pass the actual card data instead of just the index
    const currentCardData = userData?.cards?.[currentPage];
    if (currentCardData) {
      navigation.navigate('EditCard', { 
        cardIndex: currentPage,
        cardData: currentCardData // Pass the full card data
      } as any);
    }
  };

  // Update the dynamic styles for the share button
  const getDynamicStyles = (cardColorScheme: string) => StyleSheet.create({
    sendButton: {
      flexDirection: 'row',
      backgroundColor: cardColorScheme,
      paddingVertical: 10,
      paddingHorizontal: 20,
      borderRadius: 25,
      alignItems: 'center' as const,
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    shareButton: {
      flexDirection: 'row',
      backgroundColor: cardColorScheme,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
      marginHorizontal: 10, // Add horizontal margins like saveContact
      alignSelf: 'stretch', // Use full width instead of centering
      gap: 8,
    },
    input: {
      width: '80%',
      height: 40,
      borderColor: cardColorScheme,
      borderWidth: 1,
      marginBottom: 20,
      padding: 10,
    },
    contactBorder: {
      borderWidth: 1,
      borderColor: cardColorScheme,
      borderRadius: 8,
      padding: 10,
      marginBottom: 15,
      shadowColor: '#1B2B5B',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.5,
      shadowRadius: 8,
    },
    qrContainer: {
      width: 170,
      height: 170,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: 20,
      backgroundColor: '#fff',
      marginTop: 20,
      padding: 10,
      alignSelf: 'center', // Add this to center the container itself
    },
    walletButton: {
      flexDirection: 'row',
      backgroundColor: COLORS.white,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: 10,
      marginHorizontal: 10, // Add horizontal margins like saveContact
      alignSelf: 'stretch', // Use full width instead of centering
      borderWidth: 2,
      borderColor: cardColorScheme,
      gap: 8,
    },
  });

  // Enhance the applyLogoZoom function with better debugging and handling
  const applyLogoZoom = (card: CardData) => {
    try {
      if (card.logoZoomLevel !== undefined && card.logoZoomLevel !== null) {
        const zoomLevel = Number(card.logoZoomLevel);
        if (!isNaN(zoomLevel)) {
          console.log(`Applying zoom level ${zoomLevel} to card logo`);
          return {
            transform: [{ scale: zoomLevel }]
          };
        } else {
          console.warn('Invalid zoom level value:', card.logoZoomLevel);
        }
      } else {
        console.log('No zoom level found for card');
      }
    } catch (error) {
      console.error('Error applying zoom level:', error);
    }
    return undefined;
  };

  // Add an effect to log when cards change in the userData state
  useEffect(() => {
    if (userData?.cards && userData.cards.length > 0 && currentPage < userData.cards.length) {
      const currentCard = userData.cards[currentPage];
      if (currentCard) {
        console.log(`Current card (${currentPage}) zoom level:`, currentCard.logoZoomLevel);
      }
    }
  }, [userData, currentPage]);

  return (
    <View style={styles.container}>
      <Header 
        title="Cards" 
        showAddButton={true}  // Add this prop
        rightIcon={
          <TouchableOpacity onPress={handleEditCard}>
            <Text style={styles.headerIconContainer}>
              <MaterialIcons name="edit" size={24} color={COLORS.white} />
            </Text>
          </TouchableOpacity>
        }
      />
      <ScrollView 
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {userData?.cards?.map((card, index) => (
          <View key={index} style={styles.pageContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.cardContent}>
                {/* QR Code */}
                <View style={getDynamicStyles(card.colorScheme || colorScheme).qrContainer}>
                  {qrCode ? (
                    <Image
                      style={styles.qrCode}
                      source={{ uri: qrCode }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text>Loading QR Code...</Text>
                  )}
                </View>

                {/* Company Logo and Profile Image */}
                <View style={styles.logoContainer}>
                  <View style={styles.logoFrame}>
                  <Image
                    source={card.companyLogo && getImageUrl(card.companyLogo) ? 
                      { uri: getImageUrl(card.companyLogo) } : 
                      require('../../../assets/images/logoplaceholder.jpg')
                    }
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        transform: card.logoZoomLevel ? 
                          [{ scale: parseFloat(String(card.logoZoomLevel)) }] : 
                          undefined,
                        opacity: 1,  // Full opacity
                      }}
                      resizeMode="contain"
                      fadeDuration={300} // Smooth fade-in animation when loading
                      onError={(error) => {
                        console.warn('Failed to load company logo:', error.nativeEvent.error);
                        console.log('Company logo URL that failed:', card.companyLogo);
                        console.log('Processed logo URL:', getImageUrl(card.companyLogo));
                      }}
                      onLoad={() => {
                        console.log('Company logo loaded successfully:', card.companyLogo);
                      }}
                  />
                  </View>
                  <View style={styles.profileOverlayContainer}>
                    <Animated.View style={[styles.profileImageContainer, { transform: [{ rotate: rotateInterpolate }] }]}>
                      <Image
                        style={styles.profileImage}
                        source={card.profileImage && getImageUrl(card.profileImage) ? 
                          { uri: getImageUrl(card.profileImage) } : 
                          require('../../../assets/images/profile.png')
                        }
                        onError={(error) => {
                          console.warn('Failed to load profile image:', error.nativeEvent.error);
                          console.log('Profile image URL that failed:', card.profileImage);
                          console.log('Processed URL:', getImageUrl(card.profileImage));
                        }}
                        onLoad={() => {
                          console.log('Profile image loaded successfully:', card.profileImage);
                        }}
                      />
                    </Animated.View>
                  </View>
                </View>

                {/* Basic Info */}
                <Text style={[styles.name, styles.leftAligned]}>
                  {`${card.name || ''} ${card.surname || ''}`}
                </Text>
                <Text style={[styles.position, styles.leftAligned]}>
                  {card.occupation || 'No occupation'}
                </Text>
                <Text style={[styles.company, styles.leftAligned]}>
                  {card.company || 'No company'}
                </Text>

                {/* Contact Info */}
                <TouchableOpacity 
                  style={[styles.contactSection, styles.leftAligned]}
                  onPress={() => handleEmailPress(card.email)}
                >
                  <MaterialCommunityIcons name="email-outline" size={30} color={card.colorScheme} />
                  <Text style={styles.contactText}>{card.email || 'No email address'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.contactSection, styles.leftAligned]}
                  onPress={() => handlePhonePress(card.phone)}
                >
                  <MaterialCommunityIcons name="phone-outline" size={30} color={card.colorScheme} />
                  <Text style={styles.contactText}>{card.phone || 'No phone number'}</Text>
                </TouchableOpacity>

                {/* Social Links */}
                {card.socials && Object.entries(card.socials).map(([platform, value]) => {
                  const textValue = typeof value === 'string' ? value.trim() : '';
                  if (socialIcons[platform] && textValue !== '') {
                    return (
                      <TouchableOpacity 
                        key={platform}
                        style={[styles.contactSection, styles.leftAligned]}
                        onPress={() => handleSocialPress(platform, textValue)}
                      >
                        <MaterialCommunityIcons 
                          name={socialIcons[platform]} 
                          size={30} 
                          color={card.colorScheme} 
                        />
                        <Text style={styles.contactText}>{textValue || ''}</Text>
                      </TouchableOpacity>
                    );
                  }
                  return null;
                })}

                {/* Share and Wallet Buttons */}
                <TouchableOpacity 
                  onPress={() => setIsShareModalVisible(true)} 
                  style={[getDynamicStyles(card.colorScheme || colorScheme).shareButton]}
                >
                  <MaterialIcons name="share" size={24} color={COLORS.white} />
                  <Text style={styles.shareButtonText}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={handleAddToWallet} 
                  style={[getDynamicStyles(card.colorScheme || colorScheme).walletButton]}
                  disabled={isWalletLoading}
                >
                  {isWalletLoading ? (
                    <ActivityIndicator size="small" color={card.colorScheme || colorScheme} />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="wallet" size={24} color={card.colorScheme || colorScheme} />
                      <Text style={[styles.walletButtonText, { color: card.colorScheme || colorScheme }]}>
                        Add to {Platform.OS === 'ios' ? 'Apple' : 'Google'} Wallet
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Page Indicator */}
      <View style={styles.pageIndicator}>
        <View style={styles.dotContainer}>
          {userData?.cards?.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentPage === index && styles.activeDot
              ]}
            />
          ))}
        </View>
      </View>

      <Modal
        visible={isShareModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setIsShareModalVisible(false);
          setSelectedPlatform(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setIsShareModalVisible(false);
                setSelectedPlatform(null);
              }}
            >
              <MaterialIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Share via</Text>
            <View style={styles.shareOptions}>
              {shareOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.shareOption}
                  onPress={() => handlePlatformSelect(option.id)}
                >
                  <View style={[styles.iconCircle, { backgroundColor: option.color }]}>
                    {option.id === 'whatsapp' ? (
                      <MaterialCommunityIcons name="whatsapp" size={22} color={COLORS.white} />
                    ) : option.id === 'linkedin' ? (
                      <MaterialCommunityIcons name="linkedin" size={22} color={COLORS.white} />
                    ) : (
                      <MaterialIcons name={option.icon as 'send' | 'email' | 'more-horiz'} size={22} color={COLORS.white} />
                    )}
                  </View>
                  <Text style={styles.shareOptionText} numberOfLines={1}>{option.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isOptionsModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsOptionsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsOptionsModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              {modalType === 'email' ? 'Email Options' : 'Phone Options'}
            </Text>

            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: userData?.cards?.[currentPage]?.colorScheme || colorScheme }]}
                onPress={async () => {
                  await Clipboard.setStringAsync(modalData);
                  setIsOptionsModalVisible(false);
                  Alert.alert('Success', `${modalType === 'email' ? 'Email' : 'Phone number'} copied to clipboard`);
                }}
              >
                <MaterialIcons name="content-copy" size={24} color={COLORS.white} />
                <Text style={styles.optionButtonText}>
                  Copy {modalType === 'email' ? 'Email' : 'Number'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, { backgroundColor: userData?.cards?.[currentPage]?.colorScheme || colorScheme }]}
                onPress={() => {
                  const url = modalType === 'email' ? `mailto:${modalData}` : `tel:${modalData}`;
                  Linking.openURL(url).catch(() => {
                    Alert.alert('Error', `Could not open ${modalType === 'email' ? 'email' : 'phone'} app`);
                  });
                  setIsOptionsModalVisible(false);
                }}
              >
                <MaterialIcons 
                  name={modalType === 'email' ? 'email' : 'phone'} 
                  size={24} 
                  color={COLORS.white} 
                />
                <Text style={styles.optionButtonText}>
                  {modalType === 'email' ? 'Send Email' : 'Call'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Completion Modal */}
      <ProfileCompletionModal
        visible={showProfileCompletionModal}
        onClose={() => setShowProfileCompletionModal(false)}
        onCompleteProfile={() => {
          setShowProfileCompletionModal(false);
          // Navigate to Auth stack first, then to CompleteProfile
          // CardsScreen is in MainApp, CompleteProfile is in Auth stack
          navigation.getParent()?.getParent()?.navigate('Auth', {
            screen: 'CompleteProfile',
            params: { userId: userData?.id }
          });
        }}
      />

      {/* Pass Preview Modal */}
      <Modal
        visible={showPassPreview}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPassPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '90%', height: '80%' }]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowPassPreview(false)}
            >
              <MaterialIcons name="close" size={24} color={COLORS.black} />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>🔧 Wallet Pass Preview</Text>
            
            <Text style={{ fontSize: 12, color: COLORS.gray, textAlign: 'center', marginBottom: 10 }}>
              Debug: passPreviewData exists: {passPreviewData ? 'YES' : 'NO'}
              {passPreviewData && ` | primary fields: ${passPreviewData.passStructure?.primary?.length || 0}`}
            </Text>
            
            {/* Debug: Show raw data */}
            {passPreviewData && (
              <Text style={{ fontSize: 10, color: COLORS.gray, textAlign: 'center', marginBottom: 10 }}>
                Name: {passPreviewData.cardData?.name} | Company: {passPreviewData.cardData?.company}
              </Text>
            )}
            
            {passPreviewData ? (
              <View style={{ flex: 1 }}>
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {/* Mock Mode Notice */}
                  <View style={[styles.noticeBox, { backgroundColor: '#fff3cd', borderColor: '#ffeaa7' }]}>
                    <MaterialIcons name="info" size={20} color="#856404" />
                    <Text style={[styles.noticeText, { color: '#856404' }]}>
                      This is a preview of your wallet pass. In production, this will open in {Platform.OS === 'ios' ? 'Apple' : 'Google'} Wallet.
                    </Text>
                  </View>

                  {/* Pass Preview Card */}
                  <View style={[styles.passPreviewCard, { 
                    backgroundColor: passPreviewData.cardData?.colorScheme || '#1B2B5B',
                    borderColor: passPreviewData.cardData?.colorScheme || '#1B2B5B'
                  }]}>
                    {/* Gradient overlay for depth */}
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '30%',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderTopLeftRadius: 16,
                      borderTopRightRadius: 16,
                    }} />
                    {/* Header */}
                    <View style={styles.passHeader}>
                      <Text style={[styles.passTitle, { color: passPreviewData.template?.foregroundColor || '#ffffff' }]}>
                        {passPreviewData.cardData?.name} {passPreviewData.cardData?.surname}
                      </Text>
                      <Text style={[styles.passSubtitle, { color: passPreviewData.template?.foregroundColor || '#ffffff' }]}>
                        {passPreviewData.cardData?.occupation}
                      </Text>
                      <Text style={[styles.passCompany, { color: passPreviewData.template?.foregroundColor || '#ffffff' }]}>
                        {passPreviewData.cardData?.company}
                      </Text>
                    </View>

                    {/* Images */}
                    <View style={styles.passImages}>
                      {passPreviewData.cardData?.companyLogo && (
                        <Image
                          source={{ uri: passPreviewData.cardData.companyLogo }}
                          style={styles.passLogo}
                          resizeMode="contain"
                        />
                      )}
                      {passPreviewData.cardData?.profileImage && (
                        <Image
                          source={{ uri: passPreviewData.cardData.profileImage }}
                          style={styles.passProfileImage}
                          resizeMode="cover"
                        />
                      )}
                    </View>

                    {/* Fields */}
                    <View style={styles.passFields}>
                      {passPreviewData.passStructure?.primary?.map((field: any, index: number) => (
                        <View key={index} style={styles.passField}>
                          <Text style={[styles.passFieldLabel, { color: passPreviewData.template?.foregroundColor || '#ffffff' }]}>
                            {field.label}
                          </Text>
                          <Text style={[styles.passFieldValue, { color: passPreviewData.template?.foregroundColor || '#ffffff' }]}>
                            {field.value}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* QR Code */}
                    {passPreviewData.barcode?.dataUrl && (
                      <View style={styles.passQRContainer}>
                        <Image
                          source={{ uri: passPreviewData.barcode.dataUrl }}
                          style={styles.passQRCode}
                          resizeMode="contain"
                        />
                        <Text style={[styles.passQRText, { color: passPreviewData.template?.foregroundColor || '#ffffff' }]}>
                          Scan to save contact
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Pass Data Summary */}
                  <View style={styles.passDataSummary}>
                    <Text style={styles.summaryTitle}>Pass Data Summary</Text>
                    
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Template:</Text>
                      <Text style={styles.summaryValue}>{passPreviewData.template?.name || 'Basic'}</Text>
                    </View>
                    
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>User Plan:</Text>
                      <Text style={styles.summaryValue}>{passPreviewData.userPlan || 'free'}</Text>
                    </View>
                    
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Platform:</Text>
                      <Text style={styles.summaryValue}>{Platform.OS === 'ios' ? 'Apple Wallet' : 'Google Wallet'}</Text>
                    </View>
                    
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Mock Mode:</Text>
                      <Text style={styles.summaryValue}>{passPreviewData.mockMode ? 'Yes' : 'No'}</Text>
                    </View>
                  </View>
                </ScrollView>
              </View>
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, color: COLORS.gray }}>
                  Loading preview data...
                </Text>
                <Text style={{ fontSize: 12, color: COLORS.gray, marginTop: 8 }}>
                  passPreviewData: {passPreviewData ? 'exists' : 'null'}
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.passActions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
                onPress={() => {
                  setShowPassPreview(false);
                  createWalletPass();
                }}
              >
                <MaterialIcons name="download" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Generate File</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.gray }]}
                onPress={() => setShowPassPreview(false)}
              >
                <MaterialIcons name="close" size={20} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Update the static styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  pageContainer: {
    width: Dimensions.get('window').width,
    paddingTop: 100, // Adjust based on your header height
  },
  cardContent: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
  },
  logoContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    marginLeft: -20,
    marginRight: -20,
    alignSelf: 'center',
    marginBottom: 75,
    borderRadius: 12,
    padding: 8,
  },
  logoFrame: {
    width: '100%',
    height: 200,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  logo: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  profileOverlayContainer: {
    position: 'absolute',
    bottom: -80,
    left: '50%',
    transform: [{ translateX: -60 }], // Half of profile image width
    alignItems: 'center',
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  profileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  name: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 20,
    fontFamily: 'Montserrat-Bold',
    marginLeft:25,
  },
  position: {
    fontSize: 20,
    marginBottom: 5,
    fontFamily: 'Montserrat-Regular',
    marginLeft:25,
  },
  contactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 5,
    borderRadius: 8,
    marginLeft:17,
  },
  contactText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  socialLinksContainer: {
    marginVertical: 5,
    width: '100%',
    paddingHorizontal: 10,
    marginRight:20,
  },
  leftAligned: {
    alignSelf: 'stretch',
  },
  shareButton: {
  }, // Keep empty or remove if using only dynamic style
  sendButton: {}, // Keep empty or remove if using only dynamic style
  input: {}, // Keep empty or remove if using only dynamic style
  shareButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',  // Center text
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 5,
  },
  shareOption: {
    alignItems: 'center',
    padding: 4,
    flex: 1,
    maxWidth: 60,
  },
  shareOptionText: {
    fontSize: 10,
    color: COLORS.black,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
  },
  inputContainer: {
    width: '100%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: COLORS.disabled,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Bold',
  },
  walletButton: {
    marginTop: 10,
  },
  walletButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',  // Center text
  },
  optionsContainer: {
    width: '100%',
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    gap: 10,
  },
optionButtonText: {
  color: COLORS.white,
  fontSize: 16,
  fontWeight: 'bold',
  fontFamily: 'Montserrat-Bold',
},
qrCode: {
  width: 150,
  height: 150,
  alignSelf: 'center', // Add this to center the QR code image
},
  qrContainer: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    backgroundColor: '#fff',
    marginTop: 20,
    padding: 10,
    alignSelf: 'center', // Add this to center the container itself
  },
  company: {
    fontSize: 17,
    // fontWeight: ,
    marginBottom: 10,
    fontFamily: 'Montserrat-Bold',
    marginLeft: 25, // Add this to match position's marginLeft
  },
  title: {
    fontSize: 18,
    color: COLORS.gray,
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    marginBottom: 5,
  },
  phone: {
    fontSize: 16,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  dotContainer: {
    flexDirection: 'row',
    gap: 1,
    marginLeft:320
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 4,
    backgroundColor: COLORS.gray + '50',
  },
  activeDot: {
    width: 24,
    backgroundColor: COLORS.secondary,
  },
  headerEditButton: {
    padding: 8,
  },
  headerIconContainer: {
    textAlignVertical: 'center',
  },
  testButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  testButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'Montserrat-Bold',
    marginLeft: 5,
  },
  // Pass Preview Styles
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    backgroundColor: '#fff3cd',
    borderColor: '#ffeaa7',
  },
  noticeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    lineHeight: 20,
    color: '#856404',
    fontWeight: '500',
  },
  passPreviewCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  passHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  passTitle: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  passSubtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 6,
    opacity: 0.9,
    fontWeight: '500',
  },
  passCompany: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
    fontWeight: '400',
  },
  passImages: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    gap: 20,
  },
  passLogo: {
    width: 70,
    height: 70,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 8,
  },
  passProfileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  passFields: {
    marginBottom: 24,
  },
  passField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  passFieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.9,
    flex: 1,
  },
  passFieldValue: {
    fontSize: 15,
    flex: 2,
    textAlign: 'right',
    fontWeight: '400',
  },
  passQRContainer: {
    alignItems: 'center',
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  passQRCode: {
    width: 140,
    height: 140,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  passQRText: {
    fontSize: 13,
    marginTop: 12,
    opacity: 0.9,
    fontWeight: '500',
    textAlign: 'center',
  },
  passDataSummary: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
    color: COLORS.black,
    textAlign: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.gray,
  },
  summaryValue: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '500',
  },
  passActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
