import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Animated, ScrollView, ImageStyle, Modal, Linking, Alert, TextInput, ViewStyle, ActivityIndicator, Platform, Dimensions } from 'react-native';
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
  icon: 'whatsapp' | 'send' | 'email';
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
  const [modalData, setModalData] = useState<string>('');

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
        
        setUserData({
          id: userId,
          cards: cardsArray,
          analytics: analytics // Store analytics for future use
        });

        // Set card color from the first card (index 0)
        if (cardsArray[0].colorScheme) {
          updateColorScheme(cardsArray[0].colorScheme);
        }
      }

      // Generate QR code
      fetchQRCode(userId);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

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

  const handleEditCard = () => {
    navigation.navigate('EditCard', { 
      cardIndex: currentPage // Ensure currentPage is passed
    });
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
              <MaterialIcons name="edit" size={24} color={COLORS.black} />
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
                        }}
                      />
                    </Animated.View>
                  </View>
                </View>

                {/* Basic Info */}
                <Text style={[styles.name, styles.leftAligned]}>
                  {`${card.name} ${card.surname}`}
                </Text>
                <Text style={[styles.position, styles.leftAligned]}>
                  {card.occupation}
                </Text>
                <Text style={[styles.company, styles.leftAligned]}>
                  {card.company}
                </Text>

                {/* Contact Info */}
                <TouchableOpacity 
                  style={[styles.contactSection, styles.leftAligned]}
                  onPress={() => handleEmailPress(card.email)}
                >
                  <MaterialCommunityIcons name="email-outline" size={30} color={card.colorScheme} />
                  <Text style={styles.contactText}>{card.email}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.contactSection, styles.leftAligned]}
                  onPress={() => handlePhonePress(card.phone)}
                >
                  <MaterialCommunityIcons name="phone-outline" size={30} color={card.colorScheme} />
                  <Text style={styles.contactText}>{card.phone}</Text>
                </TouchableOpacity>

                {/* Social Links */}
                {card.socials && Object.entries(card.socials).map(([platform, value]) => {
                  const textValue = typeof value === 'string' ? value.trim() : '';
                  if (socialIcons[platform] && textValue !== '') {
                    return (
                      <TouchableOpacity 
                        key={platform}
                        style={[styles.contactSection, styles.leftAligned]}
                        onPress={() => {
                          // ...existing social link handling code...
                        }}
                      >
                        <MaterialCommunityIcons 
                          name={socialIcons[platform]} 
                          size={30} 
                          color={card.colorScheme} 
                        />
                        <Text style={styles.contactText}>{textValue}</Text>
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
                      <MaterialCommunityIcons name="whatsapp" size={24} color={COLORS.white} />
                    ) : (
                      <MaterialIcons name={option.icon as 'send' | 'email'} size={24} color={COLORS.white} />
                    )}
                  </View>
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
    padding: 20,
    borderRadius: 20,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
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
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  shareOption: {
    padding: 10,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
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
});
