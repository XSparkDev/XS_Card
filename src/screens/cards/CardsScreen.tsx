import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Animated, ScrollView, ImageStyle, Modal, Linking, Alert, TextInput, ViewStyle, ActivityIndicator, Platform, Dimensions, Share } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { API_BASE_URL, ENDPOINTS, buildUrl, getUserId, authenticatedFetchWithRefresh, forceLogoutExpiredToken } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { useColorScheme } from '../../context/ColorSchemeContext';
import { getImageUrl } from '../../utils/imageUtils';
import { isProfileIncompleteError } from '../../utils/profileErrorHandler';
import ProfileCompletionModal from '../../components/ProfileCompletionModal';
import { isTablet, getCardWidth, scale, getSpacing } from '../../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import CardTemplate2 from '../../components/cards/CardTemplate2';
import CardTemplate3 from '../../components/cards/CardTemplate3';
import CardTemplate4 from '../../components/cards/CardTemplate4';
import CardTemplate5 from '../../components/cards/CardTemplate5';
import { getAltNumber, migrateAltNumbersToBackend } from '../../utils/tempAltNumber';
import GradientAvatar from '../../components/GradientAvatar';

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
  template?: number;
  showAltNumber?: boolean;
  altNumber?: string;
  altCountryCode?: string;
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
  // Change QR code to map per card index for tablet multi-card support
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({});
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

  // Update the cards state definition
  const [cards, setCards] = useState<Card[]>([]);
  // Add this state to track current page
  const [currentPage, setCurrentPage] = useState(0);
  // Alt numbers state - stores alt number data per card index
  const [altNumbers, setAltNumbers] = useState<Record<number, { altNumber?: string; altCountryCode?: string; showAltNumber?: boolean }>>({});
  
  // Track card heights for tablet shadow positioning
  const [cardHeights, setCardHeights] = useState<Record<number, number>>({});

  // Get responsive card width (mobile: full width, tablet: fixed width)
  const cardWidth = getCardWidth(420);

  // Add this function to handle scroll events
  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    // Use responsive card width instead of full screen width
    const pageWidth = isTablet() ? cardWidth : Dimensions.get('window').width;
    const page = Math.round(offsetX / pageWidth);
    setCurrentPage(page);
  };

  // Function to load alt numbers for migration purposes (deprecated - alt numbers now come from backend)
  // Kept for backward compatibility during migration period
  const loadAltNumbers = async (cardCount: number) => {
    try {
      const altNumbersData: Record<number, { altNumber?: string; altCountryCode?: string; showAltNumber?: boolean }> = {};
      for (let i = 0; i < cardCount; i++) {
        const altData = await getAltNumber(i);
        if (altData) {
          altNumbersData[i] = altData;
        }
      }
      setAltNumbers(altNumbersData);
      console.log('Alt numbers loaded from AsyncStorage (migration fallback):', altNumbersData);
    } catch (error) {
      console.error('Error loading alt numbers from AsyncStorage:', error);
    }
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
            // Load alt numbers when cards are loaded
            await loadAltNumbers(loadedCards.length);
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
      
      // Check if response is OK before parsing
      if (!cardResponse.ok) {
        const errorData = await cardResponse.json().catch(() => ({ message: 'Unknown error' }));
        console.log('Cards API returned error:', cardResponse.status, errorData);
        
        // Handle 404 - No cards found
        if (cardResponse.status === 404 || errorData.message === 'No cards found for this user') {
          console.log('No cards found for user, showing profile completion modal');
          setShowProfileCompletionModal(true);
          setUserData({ id: userId, cards: [] }); // Set empty cards to prevent further errors
          return;
        }
        
        // For other errors, throw to be caught by catch block
        throw new Error(errorData.message || 'Failed to fetch cards');
      }

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
      } else if (responseData.message) {
        // Handle message-only responses (e.g., "No cards found for this user")
        console.log('API returned message:', responseData.message);
        if (responseData.message === 'No cards found for this user' || responseData.message.toLowerCase().includes('no cards')) {
          console.log('No cards found for user, showing profile completion modal');
          setShowProfileCompletionModal(true);
          setUserData({ id: userId, cards: [] }); // Set empty cards to prevent further errors
          return;
        }
        throw new Error(responseData.message);
      } else {
        console.error('Unexpected API response structure:', responseData);
        setShowProfileCompletionModal(true);
        setUserData({ id: userId, cards: [] }); // Set empty cards to prevent further errors
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

        // Clear existing QR codes before loading new ones
        setQrCodes({});

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

        // Generate QR codes based on device type - only if we have cards
        if (isTablet()) {
          // On tablet: Pre-load QR codes for all cards
          console.log(`Loading QR codes for ${cardsArray.length} cards on tablet`);
          cardsArray.forEach((_: any, index: number) => {
            fetchQRCode(userId, index);
          });
        } else {
          // On mobile: Load QR code for current card (existing behavior)
          if (cardsArray.length > currentPage) {
            fetchQRCode(userId, currentPage);
          }
        }
        
        // Run migration once to sync any existing AsyncStorage alt numbers to backend
        if (cardsArray && cardsArray.length > 0) {
          migrateAltNumbersToBackend(userId).catch(err => {
            console.error('Migration error (non-blocking):', err);
          });
        }
      } else {
        // No cards found in response
        console.log('No cards in response array, showing profile completion modal');
        setShowProfileCompletionModal(true);
        setUserData({ id: userId, cards: [] }); // Set empty cards to prevent further errors
      }
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
            
            // Check response status before parsing
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
              console.log('FOCUS CHECK - Cards API returned error:', response.status, errorData);
              return;
            }
            
            const cardsData = await response.json();
            console.log('FOCUS CHECK - Cards API response:', JSON.stringify(cardsData, null, 2));
            
            // Handle response structure
            const cardsArray = cardsData.cards || (Array.isArray(cardsData) ? cardsData : []);
            
            // Check if logoZoomLevel exists in the data
            if (cardsArray && cardsArray.length > 0) {
              cardsArray.forEach((card: any, index: number) => {
                console.log(`Card ${index} zoom level:`, card.logoZoomLevel);
              });
            }
          }
        } catch (error) {
          console.error('Error in verification check:', error);
        }
      };
      
      verifyServerData();
      loadUserData().then(async () => {
        setIsLoading(false);
        // Reload alt numbers when screen comes into focus (after returning from EditCard)
        // Get card count from userData or try to load from cache
        try {
          const userId = await getUserId();
          if (userId) {
            const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_CARD + `/${userId}`);
            
            // Check response status before parsing
            if (!response.ok) {
              console.log('Error reloading alt numbers - response not OK:', response.status);
              return;
            }
            
            const responseData = await response.json();
            const cardsArray = responseData.cards || (Array.isArray(responseData) ? responseData : []);
            if (cardsArray && cardsArray.length > 0) {
              await loadAltNumbers(cardsArray.length);
            }
          }
        } catch (err) {
          console.error('Error reloading alt numbers on focus:', err);
        }
      }).catch(() => {
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

  const fetchQRCode = async (userId: string, cardIndex: number) => {
    try {
      const token = await AsyncStorage.getItem('userToken');
      // Fetch QR code for specific card index
      const response = await fetch(buildUrl(ENDPOINTS.GENERATE_QR_CODE) + `/${userId}/${cardIndex}`, {
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
          // Store QR code per card index
          setQrCodes(prev => ({
            ...prev,
            [cardIndex]: reader.result as string
          }));
        }
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error(`Error fetching QR code for card ${cardIndex}:`, error);
      
      // Check if this is a profile incomplete error
      if (isProfileIncompleteError(error)) {
        console.log('Detected profile incomplete error, showing completion modal');
        setShowProfileCompletionModal(true);
        return;
      }
      
      // Only show alert for current card (mobile behavior)
      if (cardIndex === currentPage) {
      Alert.alert('Error', 'Failed to generate QR code');
      }
    }
  };

  // Add an effect to update QR code when page changes (mobile only)
  useEffect(() => {
    if (!isTablet()) {
      // Mobile: Load QR code when card comes into view
    const updateQRCode = async () => {
      const userId = await getUserId();
      if (userId) {
          fetchQRCode(userId, currentPage);
      }
    };
    updateQRCode();
    }
    // Tablet QR codes are pre-loaded, no need to update on scroll
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
      // First check if any images are missing
      const currentCard = userData?.cards?.[currentPage];
      if (!currentCard) {
        Alert.alert('Error', 'Card data not available');
        return;
      }

      const missingImages = [];
      if (!currentCard.profileImage) missingImages.push('Profile image');
      if (!currentCard.companyLogo) missingImages.push('Company logo');

      // If images are missing, show warning and confirmation
      if (missingImages.length > 0) {
        Alert.alert(
          'Missing Images',
          `Your wallet pass will be created without the following: ${missingImages.join(', ')}. This may reduce the visual appeal of your digital card in the wallet. Would you like to continue?`,
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue anyway',
              onPress: () => createWalletPass(true)
            }
          ]
        );
        return;
      }

      // If all images are present, check if we're in a local environment
      const isLocalEnvironment = API_BASE_URL.match(/localhost|127\.0\.0\.1|192\.168\.|10\./);
      if (isLocalEnvironment) {
        Alert.alert(
          'Development Environment',
          'You are in a development environment. Images may not be accessible to the wallet service. Continue?',
          [
            {
              text: 'Cancel',
              style: 'cancel'
            },
            {
              text: 'Continue',
              onPress: () => createWalletPass(false)
            }
          ]
        );
        return;
      }
      
      // No issues detected, proceed normally
      await createWalletPass(false);
    } catch (error) {
      console.error('Error preparing wallet pass:', error);
      Alert.alert('Error', 'Failed to prepare wallet pass');
    }
  };

  const createWalletPass = async (skipImages: boolean) => {
    setIsWalletLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        Alert.alert('Error', 'User ID not found');
        return;
      }

      // Build the endpoint with userId, card index, and skipImages flag
      const endpoint = ENDPOINTS.ADD_TO_WALLET
        .replace(':userId', userId)
        .replace(':cardIndex', currentPage.toString()) + 
        (skipImages ? '?skipImages=true' : '');

      console.log('Making wallet request to:', endpoint);

      // Use authenticatedFetchWithRefresh which automatically handles the token
      const response = await authenticatedFetchWithRefresh(endpoint, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add to wallet');
      }

      console.log('Wallet pass created:', data);

      // Check if there's a warning about images
      if (data.warning) {
        console.log('Wallet warning:', data.warning);
      }

      if (data.passPageUrl) {
        await Linking.openURL(data.passPageUrl);
      } else {
        throw new Error('No pass page URL received');
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

  // New function for per-card edit buttons (tablet use)
  const handleEditCardAtIndex = (cardIndex: number) => {
    const cardData = userData?.cards?.[cardIndex];
    if (cardData) {
      navigation.navigate('EditCard', { 
        cardIndex: cardIndex,
        cardData: cardData
      } as any);
    }
  };

  // Update the dynamic styles for the share button
  const getDynamicStyles = (cardColorScheme: string) => StyleSheet.create({
    sendButton: {
      flexDirection: 'row',
      backgroundColor: cardColorScheme,
      paddingVertical: isTablet() ? scale(10) : 10,
      paddingHorizontal: isTablet() ? scale(20) : 20,
      borderRadius: isTablet() ? scale(25) : 25,
      alignItems: 'center' as const,
      marginBottom: isTablet() ? scale(20) : 20,
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
      paddingVertical: isTablet() ? scale(12) : 12,
      paddingHorizontal: isTablet() ? scale(24) : 24,
      borderRadius: isTablet() ? scale(25) : 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: isTablet() ? scale(10) : 10,
      marginHorizontal: isTablet() ? scale(10) : 10,
      alignSelf: 'stretch',
      gap: isTablet() ? scale(8) : 8,
    },
    input: {
      width: '80%',
      height: isTablet() ? scale(40) : 40,
      borderColor: cardColorScheme,
      borderWidth: 1,
      marginBottom: isTablet() ? scale(20) : 20,
      padding: isTablet() ? scale(10) : 10,
    },
    contactBorder: {
      borderWidth: 1,
      borderColor: cardColorScheme,
      borderRadius: isTablet() ? scale(8) : 8,
      padding: isTablet() ? scale(10) : 10,
      marginBottom: isTablet() ? scale(15) : 15,
      shadowColor: '#1B2B5B',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.5,
      shadowRadius: 8,
    },
    qrContainer: {
      width: isTablet() ? scale(170) : 170,
      height: isTablet() ? scale(170) : 170,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginBottom: isTablet() ? scale(20) : 20,
      backgroundColor: '#fff',
      marginTop: isTablet() ? scale(20) : 20,
      padding: isTablet() ? scale(10) : 10,
      alignSelf: 'center',
    },
    walletButton: {
      flexDirection: 'row',
      backgroundColor: COLORS.white,
      paddingVertical: isTablet() ? scale(12) : 12,
      paddingHorizontal: isTablet() ? scale(24) : 24,
      borderRadius: isTablet() ? scale(25) : 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: isTablet() ? scale(10) : 10,
      marginHorizontal: isTablet() ? scale(10) : 10,
      alignSelf: 'stretch',
      borderWidth: isTablet() ? scale(2) : 2,
      borderColor: cardColorScheme,
      gap: isTablet() ? scale(8) : 8,
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
          !isTablet() ? (
            <TouchableOpacity onPress={handleEditCard}>
              <Text style={styles.headerIconContainer}>
                <MaterialIcons name="edit" size={24} color={COLORS.white} />
              </Text>
            </TouchableOpacity>
          ) : undefined
        }
      />
      <ScrollView 
        horizontal
        pagingEnabled={!isTablet()}
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isTablet() && { 
            paddingRight: (Dimensions.get('window').width - cardWidth) / 2,
            // No left padding so first card starts at left edge
          }
        ]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        snapToInterval={isTablet() ? cardWidth + 30 : undefined}
        snapToAlignment={isTablet() ? 'start' : undefined}
        decelerationRate={isTablet() ? 'fast' : undefined}
      >
        {userData?.cards?.map((card, index) => (
          <View key={index} style={[
            styles.pageContainer,
            isTablet() && {
              width: cardWidth,
              marginHorizontal: 15, // Extra space between cards for shadow visibility
              position: 'relative', // Enable absolute positioning for shadows
            }
          ]}>
            {/* Tablet-only side shadows OUTSIDE the card border with curved top */}
            {isTablet() && cardHeights[index] !== undefined && (
              <>
                <View style={[
                  styles.sideShadowLeft,
                  {
                    height: cardHeights[index] - 8, // Subtract margins to match card content height
                    top: 100 + 4, // pageContainer paddingTop + card marginTop to align with card's top edge
                  }
                ]}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={[COLORS.black + '10', COLORS.black + '06', 'transparent']}
                    start={{ x: 1, y: 0 }}
                    end={{ x: 0, y: 0 }}
                    locations={[0, 0.3, 1]}
                    style={styles.sideShadowGradient}
                  />
                </View>
                <View style={[
                  styles.sideShadowRight,
                  {
                    height: cardHeights[index] - 8, // Subtract margins to match card content height
                    top: 100 + 4, // pageContainer paddingTop + card marginTop to align with card's top edge
                  }
                ]}>
                  <LinearGradient
                    pointerEvents="none"
                    colors={['transparent', COLORS.black + '06', COLORS.black + '10']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    locations={[0, 0.7, 1]}
                    style={styles.sideShadowGradient}
                  />
                </View>
              </>
            )}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={isTablet() ? { paddingVertical: 0 } : undefined}>
              {/* Render by template: 2 uses alternative layout; 3 uses outlined version; default keeps existing */}
              {card.template === 2 ? (
                <View
                  style={[
                    styles.cardContent,
                    isTablet() && styles.cardContentTablet,
                    isTablet() && { borderWidth: 0.5, borderColor: COLORS.border + '30', marginTop: 4, marginBottom: 4, borderRadius: 15 }
                  ]}
                >
                  <CardTemplate2
                    card={card}
                    qrUri={qrCodes[index]}
                    colorFallback={colorScheme}
                    isWalletLoading={isWalletLoading}
                    onPressShare={() => setIsShareModalVisible(true)}
                    onPressWallet={handleAddToWallet}
                    onPressEmail={handleEmailPress}
                    onPressPhone={handlePhonePress}
                    onPressSocial={handleSocialPress}
                    altNumber={card.showAltNumber && card.altNumber ? {
                      altNumber: card.altNumber,
                      altCountryCode: card.altCountryCode || '+27',
                      showAltNumber: card.showAltNumber
                    } : undefined}
                    onPressEdit={isTablet() ? () => handleEditCardAtIndex(index) : undefined}
                  />
                </View>
              ) : card.template === 3 ? (
                <View
                  style={[
                    styles.cardContent,
                    isTablet() && styles.cardContentTablet,
                    isTablet() && { borderWidth: 0.5, borderColor: COLORS.border + '30', marginTop: 4, marginBottom: 4, borderRadius: 15 }
                  ]}
                >
                  <CardTemplate3
                    card={card}
                    qrUri={qrCodes[index]}
                    colorFallback={colorScheme}
                    isWalletLoading={isWalletLoading}
                    onPressShare={() => setIsShareModalVisible(true)}
                    onPressWallet={handleAddToWallet}
                    onPressEmail={handleEmailPress}
                    onPressPhone={handlePhonePress}
                    onPressSocial={handleSocialPress}
                    altNumber={card.showAltNumber && card.altNumber ? {
                      altNumber: card.altNumber,
                      altCountryCode: card.altCountryCode || '+27',
                      showAltNumber: card.showAltNumber
                    } : undefined}
                    onPressEdit={isTablet() ? () => handleEditCardAtIndex(index) : undefined}
                  />
                </View>
              ) : card.template === 4 ? (
                <View
                  style={[
                    styles.cardContent,
                    isTablet() && styles.cardContentTablet,
                    isTablet() && { borderWidth: 0.5, borderColor: COLORS.border + '30', marginTop: 4, marginBottom: 4, borderRadius: 15 }
                  ]}
                >
                  <CardTemplate4
                    card={card}
                    qrUri={qrCodes[index]}
                    colorFallback={colorScheme}
                    isWalletLoading={isWalletLoading}
                    onPressShare={() => setIsShareModalVisible(true)}
                    onPressWallet={handleAddToWallet}
                    onPressEmail={handleEmailPress}
                    onPressPhone={handlePhonePress}
                    onPressSocial={handleSocialPress}
                    altNumber={card.showAltNumber && card.altNumber ? {
                      altNumber: card.altNumber,
                      altCountryCode: card.altCountryCode || '+27',
                      showAltNumber: card.showAltNumber
                    } : undefined}
                    onPressEdit={isTablet() ? () => handleEditCardAtIndex(index) : undefined}
                  />
                </View>
              ) : card.template === 5 ? (
                <View
                  style={[
                    styles.cardContent,
                    isTablet() && styles.cardContentTablet,
                    isTablet() && { borderWidth: 0.5, borderColor: COLORS.border + '30', marginTop: 4, marginBottom: 4, borderRadius: 15 }
                  ]}
                >
                  <CardTemplate5
                    card={card}
                    qrUri={qrCodes[index]}
                    colorFallback={colorScheme}
                    isWalletLoading={isWalletLoading}
                    onPressShare={() => setIsShareModalVisible(true)}
                    onPressWallet={handleAddToWallet}
                    onPressEmail={handleEmailPress}
                    onPressPhone={handlePhonePress}
                    onPressSocial={handleSocialPress}
                    altNumber={card.showAltNumber && card.altNumber ? {
                      altNumber: card.altNumber,
                      altCountryCode: card.altCountryCode || '+27',
                      showAltNumber: card.showAltNumber
                    } : undefined}
                    onPressEdit={isTablet() ? () => handleEditCardAtIndex(index) : undefined}
                  />
                </View>
              ) : (
              <View 
                style={[
                  styles.cardContent,
                  // Add edit button overlay for tablet
                  isTablet() && styles.cardContentTablet,
                  // Tablet-only: ultra-thin border (shadows are outside)
                  isTablet() && {
                    borderWidth: 0.5,
                    borderColor: COLORS.border + '30', // Ultra thin, very light border
                    marginTop: 4,
                    marginBottom: 4,
                    borderRadius: 15, // Explicitly set to match shadow radius
                  }
                ]}
                onLayout={(event) => {
                  if (isTablet()) {
                    const { height, y } = event.nativeEvent.layout;
                    // Store height including the margin (height already includes it, but we need exact measurement)
                    setCardHeights(prev => ({ ...prev, [index]: height + 8 })); // height + marginTop (4) + marginBottom (4)
                  }
                }}
              >
                {/* Edit Button for Tablet - shown on each card */}
                {isTablet() && (
                  <TouchableOpacity
                    style={[
                      styles.cardEditButton,
                      isTablet() && {
                        width: scale(40),
                        height: scale(40),
                        borderRadius: scale(20),
                        top: scale(10),
                        right: scale(10),
                      }
                    ]}
                    onPress={() => handleEditCardAtIndex(index)}
                  >
                    <MaterialIcons 
                      name="edit" 
                      size={isTablet() ? scale(20) : 20} 
                      color={COLORS.white} 
                    />
                  </TouchableOpacity>
                )}
                
                {/* QR Code */}
                <View style={getDynamicStyles(card.colorScheme || colorScheme).qrContainer}>
                  {qrCodes[index] ? (
                    <Image
                      style={[
                        styles.qrCode,
                        isTablet() && { width: scale(150), height: scale(150) }
                      ]}
                      source={{ uri: qrCodes[index] }}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={isTablet() && { fontSize: scale(16) }}>Loading QR Code...</Text>
                  )}
                </View>

                {/* Company Logo and Profile Image */}
                <View style={[
                  styles.logoContainer,
                  isTablet() && {
                    marginBottom: scale(75),
                    padding: scale(8),
                  }
                ]}>
                  <View style={[
                    styles.logoFrame,
                    isTablet() && { height: scale(200) }
                  ]}>
                  {card.companyLogo && getImageUrl(card.companyLogo) ? (
                    <Image
                      source={{ uri: getImageUrl(card.companyLogo) ?? undefined }}
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        transform: card.logoZoomLevel ? 
                          [{ scale: parseFloat(String(card.logoZoomLevel)) }] : 
                          undefined,
                        opacity: 1,
                      }}
                      resizeMode="contain"
                      fadeDuration={300}
                      onError={(error) => {
                        console.warn('Failed to load company logo:', error.nativeEvent.error);
                        console.log('Company logo URL that failed:', card.companyLogo);
                        console.log('Processed logo URL:', getImageUrl(card.companyLogo));
                      }}
                      onLoad={() => {
                        console.log('Company logo loaded successfully:', card.companyLogo);
                      }}
                    />
                  ) : (
                    <View style={styles.logoPlaceholder}>
                      <Text style={styles.logoPlaceholderText}>LOGO</Text>
                    </View>
                  )}
                  </View>
                  <View style={[
                    styles.profileOverlayContainer,
                    isTablet() && {
                      bottom: -scale(80),
                      transform: [{ translateX: -scale(60) }]
                    }
                  ]}>
                    <Animated.View style={[
                      styles.profileImageContainer,
                      isTablet() && {
                        width: scale(120),
                        height: scale(120),
                        borderRadius: scale(60),
                        borderWidth: scale(5),
                      },
                      { transform: [{ rotate: rotateInterpolate }] }
                    ]}>
                      {card.profileImage && getImageUrl(card.profileImage) ? (
                        <Image
                          style={[
                            styles.profileImage,
                            isTablet() && {
                              width: scale(110),
                              height: scale(110),
                              borderRadius: scale(55),
                            }
                          ]}
                          source={{ uri: getImageUrl(card.profileImage) || '' }}
                          onError={(error) => {
                            console.warn('Failed to load profile image:', error.nativeEvent.error);
                            console.log('Profile image URL that failed:', card.profileImage);
                            console.log('Processed URL:', getImageUrl(card.profileImage));
                          }}
                          onLoad={() => {
                            console.log('Profile image loaded successfully:', card.profileImage);
                          }}
                        />
                      ) : (
                        <GradientAvatar 
                          size={isTablet() ? scale(110) : 110}
                          style={isTablet() ? {
                            borderRadius: scale(55),
                          } : undefined}
                        />
                      )}
                    </Animated.View>
                  </View>
                </View>

                {/* Basic Info */}
                <Text style={[
                  styles.name,
                  styles.leftAligned,
                  isTablet() && { fontSize: scale(22), marginLeft: scale(25), marginTop: scale(20), marginBottom: scale(5) }
                ]}>
                  {`${card.name || ''} ${card.surname || ''}`}
                </Text>
                <Text style={[
                  styles.position,
                  styles.leftAligned,
                  isTablet() && { fontSize: scale(20), marginLeft: scale(25), marginBottom: scale(5) }
                ]}>
                  {card.occupation || 'No occupation'}
                </Text>
                <Text style={[
                  styles.company,
                  styles.leftAligned,
                  isTablet() && { fontSize: scale(17), marginLeft: scale(25), marginBottom: scale(10) }
                ]}>
                  {card.company || 'No company'}
                </Text>

                {/* Contact Info */}
                <TouchableOpacity 
                  style={[
                    styles.contactSection,
                    styles.leftAligned,
                    isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
                  ]}
                  onPress={() => handleEmailPress(card.email)}
                >
                  <MaterialCommunityIcons 
                    name="email-outline" 
                    size={isTablet() ? scale(30) : 30} 
                    color={card.colorScheme} 
                  />
                  <Text style={[
                    styles.contactText,
                    isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
                  ]}>
                    {card.email || 'No email address'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[
                    styles.contactSection,
                    styles.leftAligned,
                    isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
                  ]}
                  onPress={() => handlePhonePress(card.phone)}
                >
                  <MaterialCommunityIcons 
                    name="phone-outline" 
                    size={isTablet() ? scale(30) : 30} 
                    color={card.colorScheme} 
                  />
                  <Text style={[
                    styles.contactText,
                    isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
                  ]}>
                    {card.phone || 'No phone number'}
                  </Text>
                </TouchableOpacity>

                {/* Alt Number - only show if toggle is enabled and alt number exists */}
                {card.showAltNumber && card.altNumber && (
                  <TouchableOpacity 
                    style={[
                      styles.contactSection,
                      styles.leftAligned,
                      isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
                    ]}
                    onPress={() => handlePhonePress(`${card.altCountryCode || '+27'}${card.altNumber || ''}`)}
                  >
                    <MaterialCommunityIcons 
                      name="phone-outline" 
                      size={isTablet() ? scale(30) : 30} 
                      color={card.colorScheme} 
                    />
                    <Text style={[
                      styles.contactText,
                      isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
                    ]}>
                      {`${card.altCountryCode || '+27'}${card.altNumber || ''}`}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Social Links */}
                {card.socials && Object.entries(card.socials).map(([platform, value]) => {
                  const textValue = typeof value === 'string' ? value.trim() : '';
                  if (socialIcons[platform] && textValue !== '') {
                    return (
                      <TouchableOpacity 
                        key={platform}
                        style={[
                          styles.contactSection,
                          styles.leftAligned,
                          isTablet() && { marginLeft: scale(17), marginBottom: scale(15), padding: scale(5) }
                        ]}
                        onPress={() => handleSocialPress(platform, textValue)}
                      >
                        <MaterialCommunityIcons 
                          name={socialIcons[platform]} 
                          size={isTablet() ? scale(30) : 30} 
                          color={card.colorScheme} 
                        />
                        <Text style={[
                          styles.contactText,
                          isTablet() && { fontSize: scale(16), marginLeft: scale(10) }
                        ]}>
                          {textValue || ''}
                        </Text>
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
                  <MaterialIcons name="share" size={isTablet() ? scale(24) : 24} color={COLORS.white} />
                  <Text style={[
                    styles.shareButtonText,
                    isTablet() && { fontSize: scale(16) }
                  ]}>
                    Share
                  </Text>
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
                      <MaterialCommunityIcons 
                        name="wallet" 
                        size={isTablet() ? scale(24) : 24} 
                        color={card.colorScheme || colorScheme} 
                      />
                      <Text style={[
                        styles.walletButtonText,
                        { color: card.colorScheme || colorScheme },
                        isTablet() && { fontSize: scale(16) }
                      ]}>
                        Add to {Platform.OS === 'ios' ? 'Apple' : 'Google'} Wallet
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              )}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      {/* Page Indicator */}
      <View style={[
        styles.pageIndicator,
        isTablet() && styles.pageIndicatorTablet
      ]}>
        <View style={[
          styles.dotContainer,
          isTablet() && styles.dotContainerTablet
        ]}>
          {userData?.cards?.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                isTablet() && styles.dotTablet,
                currentPage === index && styles.activeDot,
                currentPage === index && isTablet() && styles.activeDotTablet
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
          <View style={[
            styles.modalContent,
            isTablet() && {
              padding: scale(30),
              borderRadius: scale(24),
              maxWidth: scale(600),
            }
          ]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setIsShareModalVisible(false);
                setSelectedPlatform(null);
              }}
            >
              <MaterialIcons name="close" size={isTablet() ? scale(24) : 24} color={COLORS.black} />
            </TouchableOpacity>

            <Text style={[
              styles.modalTitle,
              isTablet() && { fontSize: scale(18), marginBottom: scale(20) }
            ]}>
              Share via
            </Text>
            <View style={styles.shareOptions}>
              {shareOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.shareOption,
                    isTablet() && { padding: scale(4), maxWidth: scale(60) }
                  ]}
                  onPress={() => handlePlatformSelect(option.id)}
                >
                  <View style={[
                    styles.iconCircle,
                    { backgroundColor: option.color },
                    isTablet() && {
                      width: scale(45),
                      height: scale(45),
                      borderRadius: scale(22.5),
                    }
                  ]}>
                    {option.id === 'whatsapp' ? (
                      <MaterialCommunityIcons 
                        name="whatsapp" 
                        size={isTablet() ? scale(22) : 22} 
                        color={COLORS.white} 
                      />
                    ) : option.id === 'linkedin' ? (
                      <MaterialCommunityIcons 
                        name="linkedin" 
                        size={isTablet() ? scale(22) : 22} 
                        color={COLORS.white} 
                      />
                    ) : (
                      <MaterialIcons 
                        name={option.icon as 'send' | 'email' | 'more-horiz' | 'nfc'} 
                        size={isTablet() ? scale(22) : 22} 
                        color={COLORS.white} 
                      />
                    )}
                  </View>
                  <Text style={[
                    styles.shareOptionText,
                    isTablet() && { fontSize: scale(10), marginTop: scale(4) }
                  ]} numberOfLines={1}>
                    {option.name}
                  </Text>
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
          <View style={[
            styles.modalContent,
            isTablet() && {
              padding: scale(30),
              borderRadius: scale(24),
              maxWidth: scale(600),
            }
          ]}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setIsOptionsModalVisible(false)}
            >
              <MaterialIcons name="close" size={isTablet() ? scale(24) : 24} color={COLORS.black} />
            </TouchableOpacity>

            <Text style={[
              styles.modalTitle,
              isTablet() && { fontSize: scale(18), marginBottom: scale(20) }
            ]}>
              {modalType === 'email' ? 'Email Options' : 'Phone Options'}
            </Text>

            <View style={[
              styles.optionsContainer,
              isTablet() && { gap: scale(10) }
            ]}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: userData?.cards?.[currentPage]?.colorScheme || colorScheme },
                  isTablet() && {
                    padding: scale(15),
                    borderRadius: scale(10),
                    gap: scale(10),
                  }
                ]}
                onPress={async () => {
                  await Clipboard.setStringAsync(modalData);
                  setIsOptionsModalVisible(false);
                  Alert.alert('Success', `${modalType === 'email' ? 'Email' : 'Phone number'} copied to clipboard`);
                }}
              >
                <MaterialIcons 
                  name="content-copy" 
                  size={isTablet() ? scale(24) : 24} 
                  color={COLORS.white} 
                />
                <Text style={[
                  styles.optionButtonText,
                  isTablet() && { fontSize: scale(16) }
                ]}>
                  Copy {modalType === 'email' ? 'Email' : 'Number'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: userData?.cards?.[currentPage]?.colorScheme || colorScheme },
                  isTablet() && {
                    padding: scale(15),
                    borderRadius: scale(10),
                    gap: scale(10),
                  }
                ]}
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
                  size={isTablet() ? scale(24) : 24} 
                  color={COLORS.white} 
                />
                <Text style={[
                  styles.optionButtonText,
                  isTablet() && { fontSize: scale(16) }
                ]}>
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
        onCompleteProfile={async () => {
          setShowProfileCompletionModal(false);
          try {
            // Get user data from AsyncStorage (logged-in user data)
            const userId = await getUserId();
            if (!userId) {
              Alert.alert('Error', 'User ID not found. Please try signing in again.');
              return;
            }

            // Get user data from AsyncStorage
            const userDataString = await AsyncStorage.getItem('userData');
            if (userDataString) {
              const storedUserData = JSON.parse(userDataString);
              
              // Store userId and email in temp storage for CompleteProfile to use
              // This mimics what SignUpScreen does when navigating to CompleteProfile
              await AsyncStorage.setItem('tempUserId', userId);
              if (storedUserData.email) {
                await AsyncStorage.setItem('tempUserEmail', storedUserData.email);
              }
              
              console.log('Stored user data for CompleteProfile:', {
                userId,
                email: storedUserData.email
              });
            } else {
              // If no userData in storage, still store userId
              await AsyncStorage.setItem('tempUserId', userId);
            }

            // Navigate to Auth stack first, then to CompleteProfile
            // CardsScreen is in MainApp, CompleteProfile is in Auth stack
            navigation.getParent()?.getParent()?.navigate('Auth', {
              screen: 'CompleteProfile',
              params: { userId: userId }
            });
          } catch (error) {
            console.error('Error navigating to CompleteProfile:', error);
            Alert.alert('Error', 'Failed to navigate to profile completion. Please try again.');
          }
        }}
      />
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
    // Tablet: position relative to contain absolute shadow gradients
    // Mobile: no change
  },
  cardContent: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    // Mobile: no border/shadow (keep original)
    // Tablet: border/shadow added conditionally in component JSX, not here
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
  logoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#d3d3d3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoPlaceholderText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
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
  // Tablet-specific styles (only applied when isTablet() is true via conditional styling)
  pageIndicatorTablet: {
    // Tablet styles applied conditionally in component
  },
  dotContainerTablet: {
    // Tablet styles applied conditionally in component
  },
  dotTablet: {
    // Tablet styles applied conditionally in component
  },
  activeDotTablet: {
    // Tablet styles applied conditionally in component
  },
  cardContentTablet: {
    position: 'relative',
  },
  cardEditButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: COLORS.secondary,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sideShadowLeft: {
    position: 'absolute',
    left: -30, // Outside the card border - wider for more dispersion
    width: 30, // Wider for more gradual fade
    zIndex: 0,
    borderTopLeftRadius: 15, // Match card's border radius exactly to follow the curve
    borderBottomLeftRadius: 15, // Match card's border radius at bottom
    overflow: 'hidden', // Clip gradient to rounded corners - CRITICAL for curve
    // top and height set dynamically in component based on card measurements
  },
  sideShadowRight: {
    position: 'absolute',
    right: -30, // Outside the card border - wider for more dispersion
    width: 30, // Wider for more gradual fade
    zIndex: 0,
    borderTopRightRadius: 15, // Match card's border radius exactly to follow the curve
    borderBottomRightRadius: 15, // Match card's border radius at bottom
    overflow: 'hidden', // Clip gradient to rounded corners - CRITICAL for curve
    // top and height set dynamically in component based on card measurements
  },
  sideShadowGradient: {
    width: '100%',
    height: '100%',
  },
});
