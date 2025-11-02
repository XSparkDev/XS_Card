import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image, Platform, BackHandler, GestureResponderEvent, LayoutChangeEvent, Dimensions, SafeAreaView, Linking } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Modal as RNModal } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { COLORS, CARD_COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL, ENDPOINTS, buildUrl, getUserId, authenticatedFetchWithRefresh } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EditCardScreenRouteProp, RootStackParamList } from '../../types/navigation';
import { RouteProp } from '@react-navigation/native';
import Modal from 'react-native-modal';
import { getImageUrl, pickImage, requestPermissions, checkPermissions } from '../../utils/imageUtils';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import { getAltNumber, saveAltNumber, AltNumberData } from '../../utils/tempAltNumber';

// Create a type for social media platforms
type SocialMediaPlatform = 'whatsapp' | 'x' | 'facebook' | 'linkedin' | 'website' | 'tiktok' | 'instagram';

// Update the FormData interface to properly handle social media fields
interface FormData {
  firstName: string;
  lastName: string;
  occupation: string;
  company: string;
  email: string;
  phoneNumber: string;
  countryCode: string; // Add country code field
  // Social media fields
  whatsapp?: string;
  x?: string;
  facebook?: string;
  linkedin?: string;
  website?: string;
  tiktok?: string;
  instagram?: string;
  // Images and styling
  profileImage?: string;
  companyLogo?: string;
  logoZoomLevel?: number;
  
  // Add a more specific index signature for social media platforms
  [key: string]: string | number | undefined;
}


export default function EditCard() {
  const route = useRoute<EditCardScreenRouteProp>();
  const cardIndex = route.params?.cardIndex ?? 0; // Provide default value of 0
  const cardData = route.params?.cardData; // Get the passed card data
  const navigation = useNavigation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    occupation: '',
    company: '',
    email: '',
    phoneNumber: '',
    countryCode: '+27', // Default to South Africa
    whatsapp: '',
    x: '',
    facebook: '',
    linkedin: '',
    website: '',
    tiktok: '',
    instagram: '',
    profileImage: '',
    companyLogo: '',
    logoZoomLevel: 1.0,
  });
  const [selectedColor, setSelectedColor] = useState('#1B2B5B'); // Default color
  const [selectedSocials, setSelectedSocials] = useState<string[]>([]);
  const scrollViewRef = useRef<any>(null);
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);
  const [isSocialRemoveModalVisible, setIsSocialRemoveModalVisible] = useState(false);
  const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);
  const [currentSocialToRemove, setCurrentSocialToRemove] = useState<string | null>(null);
  const [modalMessage, setModalMessage] = useState('');
  const [userPlan, setUserPlan] = useState<string>('free');
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [socialNotification, setSocialNotification] = useState<string | null>(null);
  const [isCustomColorModalVisible, setIsCustomColorModalVisible] = useState(false);
  const [customColor, setCustomColor] = useState('#1B2B5B');
  const [showQuickColors, setShowQuickColors] = useState(false);
  const [pickerInitialized, setPickerInitialized] = useState(false);
  const [isHexEditing, setIsHexEditing] = useState(false);
  const [template, setTemplate] = useState<number>(1);
  // Alt number state
  const [altNumber, setAltNumber] = useState('');
  const [altCountryCode, setAltCountryCode] = useState('+27');
  const [showAltNumber, setShowAltNumber] = useState(false);

  // Helper function to parse phone number and extract country code
  const parsePhoneNumber = (phone: string) => {
    if (!phone) return { countryCode: '+27', number: '' };
    
    // If phone starts with +, try to find matching country code
    if (phone.startsWith('+')) {
      // Common country codes to check (sorted by length, longest first)
      const countryCodes = ['+27', '+44', '+33', '+49', '+86', '+91', '+81', '+61', '+55', '+39', '+34', '+31', '+46', '+47', '+45', '+41', '+43', '+32', '+351', '+30', '+48', '+420', '+36', '+40', '+359', '+385', '+386', '+421', '+370', '+371', '+372', '+358', '+353', '+354', '+352', '+7', '+380', '+90', '+82', '+65', '+60', '+66', '+84', '+63', '+62', '+880', '+92', '+98', '+972', '+966', '+971', '+20', '+234', '+254', '+52', '+54', '+56', '+57', '+51', '+64', '+1'];
      
      for (const code of countryCodes) {
        if (phone.startsWith(code)) {
          return {
            countryCode: code,
            number: phone.substring(code.length)
          };
        }
      }
    }
    
    // Default to South Africa if no match found
    return { countryCode: '+27', number: phone };
  };

  useEffect(() => {
    // Use passed card data if available, otherwise fall back to API call
    if (cardData) {
      loadCardDataFromProps();
    } else {
    loadUserData();
    }
    getUserPlan();
    loadAltNumber();
  }, [cardData, cardIndex]);
  
  // Load alt number from temp file
  const loadAltNumber = async () => {
    try {
      const altData = await getAltNumber(cardIndex);
      if (altData) {
        setAltNumber(altData.altNumber || '');
        setAltCountryCode(altData.altCountryCode || '+27');
        setShowAltNumber(altData.showAltNumber || false);
      }
    } catch (error) {
      console.error('Error loading alt number:', error);
    }
  };

  // New function to load data from passed props (no API call)
  const loadCardDataFromProps = () => {
    try {
      if (!cardData) {
        setError('No card data provided');
        return;
      }

      console.log('Loading card data from props:', cardData);
      
      setSelectedColor(cardData.colorScheme || '#1B2B5B');
      setCustomColor(cardData.colorScheme || '#1B2B5B');
      setFormData({
        firstName: cardData.name || '',
        lastName: cardData.surname || '',
        occupation: cardData.occupation || '',
        company: cardData.company || '',
        email: cardData.email || '',
        phoneNumber: parsePhoneNumber(cardData.phone || '').number,
        countryCode: parsePhoneNumber(cardData.phone || '').countryCode,
        ...Object.keys(cardData.socials || {}).reduce((acc, key) => ({
          ...acc,
          [key]: cardData.socials[key]
        }), {}),
        profileImage: cardData.profileImage || '',
        companyLogo: cardData.companyLogo || '',
        logoZoomLevel: cardData.logoZoomLevel || 1.0,
      });
      if (typeof cardData.template === 'number' && cardData.template >= 1) {
        setTemplate(cardData.template);
      } else {
        setTemplate(1);
      }

      // Set zoom level if it exists in the card data
      if (cardData.logoZoomLevel) {
        console.log('Setting zoom level from passed data:', cardData.logoZoomLevel);
        setZoomLevel(cardData.logoZoomLevel);
      } else {
        console.log('No saved zoom level found, using default 1.0');
        setZoomLevel(1.0);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading card data from props:', error);
      setError('Failed to load card data');
      setLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const userId = await getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_CARD + `/${userId}`);
      const responseData = await response.json();
      
      // Handle new response structure
      let cardsArray;
      
      if (responseData.cards) {
        // New structure: { cards: [...], analytics: {...} }
        cardsArray = responseData.cards;
      } else if (Array.isArray(responseData)) {
        // Fallback for old structure: [card1, card2, ...]
        cardsArray = responseData;
        console.log('Using fallback for old API response structure');
      } else {
        console.error('Unexpected API response structure:', responseData);
        setError('Failed to load user data - unexpected response format');
        return;
      }
      
      if (cardsArray && cardsArray.length > cardIndex) {
        const userData = cardsArray[cardIndex]; 
        console.log('Card data loaded with zoom level:', userData.logoZoomLevel);
        
        setSelectedColor(userData.colorScheme || '#1B2B5B');
        setCustomColor(userData.colorScheme || '#1B2B5B');
        setFormData({
          firstName: userData.name || '',
          lastName: userData.surname || '',
          occupation: userData.occupation || '',
          company: userData.company || '',
          email: userData.email || '',
          phoneNumber: parsePhoneNumber(userData.phone || '').number,
          countryCode: parsePhoneNumber(userData.phone || '').countryCode,
          ...Object.keys(userData.socials || {}).reduce((acc, key) => ({
            ...acc,
            [key]: userData.socials[key]
          }), {}),
          profileImage: userData.profileImage || '',
          companyLogo: userData.companyLogo || '',
          logoZoomLevel: userData.logoZoomLevel || 1.0,
        });
        if (typeof userData.template === 'number' && userData.template >= 1) {
          setTemplate(userData.template);
        } else {
          setTemplate(1);
        }

        // Set zoom level if it exists in the card data
        if (userData.logoZoomLevel) {
          console.log('Setting zoom level from saved data:', userData.logoZoomLevel);
          setZoomLevel(userData.logoZoomLevel);
        } else {
          console.log('No saved zoom level found, using default 1.0');
          setZoomLevel(1.0);
        }

        const existingSocials = Object.entries(userData.socials || {})
          .filter(([_, value]) => typeof value === 'string' && value.trim() !== '')
          .map(([key]) => key);

        setSelectedSocials(existingSocials);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const getUserPlan = async () => {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const { plan } = JSON.parse(userData);
        setUserPlan(plan);
      }
    } catch (error) {
      console.error('Error fetching user plan:', error);
    }
  };

  // Add this type for the socials array
  interface Social {
    id: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;  // This ensures the icon name is valid
    label: string;
    color: string;
  }

  // Update the socials array with the correct type
  const socials: Social[] = [
    { id: 'whatsapp' as SocialMediaPlatform, icon: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
    { id: 'x' as SocialMediaPlatform, icon: 'twitter', label: 'X', color: '#000000' },
    { id: 'facebook' as SocialMediaPlatform, icon: 'facebook', label: 'Facebook', color: '#1877F2' },
    { id: 'linkedin' as SocialMediaPlatform, icon: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
    { id: 'website' as SocialMediaPlatform, icon: 'web', label: 'Website', color: '#4285F4' },
    { id: 'tiktok' as SocialMediaPlatform, icon: 'music-note', label: 'TikTok', color: '#000000' },
    { id: 'instagram' as SocialMediaPlatform, icon: 'instagram', label: 'Instagram', color: '#E4405F' },
  ];

  const handleCancel = () => {
    navigation.goBack();
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };


  const validateForm = () => {
    if (!formData.company || !formData.email || !formData.phoneNumber || !formData.occupation) {
      setError('Please fill in all required fields');
      return false;
    }
    
    if (!validateEmail(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }
    
    setError('');
    return true;
  };

  const handleSave = async () => {
    try {
      if (!validateForm()) {
        return;
      }

      const userId = await getUserId();
      if (!userId) {
        setError('User ID not found');
        return;
      }

      // Create socials object with selected socials
      const socialFields: { [key: string]: string } = {};
      selectedSocials.forEach(socialId => {
        if (formData[socialId]) {
          socialFields[socialId] = formData[socialId] as string;
        }
      });

      // Create card data object - ensure logoZoomLevel is included as a number, not a string
      const cardData = {
        name: formData.firstName,
        surname: formData.lastName,
        occupation: formData.occupation,
        company: formData.company,
        email: formData.email,
        phone: `${formData.countryCode}${formData.phoneNumber}`,
        socials: socialFields,
        colorScheme: selectedColor,
        profileImage: formData.profileImage,
        companyLogo: formData.companyLogo,
        logoZoomLevel: Number(zoomLevel) // Ensure it's a number
      } as any;
      cardData.template = template;

      console.log('Saving card with zoom level:', cardData.logoZoomLevel);
      console.log('Full card data:', JSON.stringify(cardData, null, 2));

      // Send update request
      const response = await authenticatedFetchWithRefresh(
        `${ENDPOINTS.UPDATE_CARD.replace(':id', userId)}?cardIndex=${cardIndex}`,
        {
          method: 'PATCH',
          body: JSON.stringify(cardData),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update card');
      }

      const result = await response.json();
      console.log('Server response after save:', JSON.stringify(result, null, 2));
      
      // Save alt number to temp file
      await saveAltNumber(cardIndex, {
        altNumber,
        altCountryCode,
        showAltNumber,
      });
      
      setModalMessage('Card updated');
      setIsSuccessModalVisible(true);

    } catch (error) {
      console.error('Error updating card:', error);
      setError('Failed to update card');
    }
  };

  const handleSocialSelect = (socialId: SocialMediaPlatform) => {
    if (selectedSocials.includes(socialId)) {
      setCurrentSocialToRemove(socialId);
      setIsSocialRemoveModalVisible(true);
    } else {
      setSelectedSocials([...selectedSocials, socialId]);
      
      // Show notification for the added social link
      const socialName = socials.find(s => s.id === socialId)?.label || socialId;
      setSocialNotification(`A ${socialName} textbox has been added below.`);
      
      // Clear notification after 3 seconds
      setTimeout(() => {
        setSocialNotification(null);
      }, 3000);
    }
  };

  const handleRemoveSocial = (socialId: SocialMediaPlatform) => {
    setSelectedSocials(selectedSocials.filter(id => id !== socialId));
    setFormData({...formData, [socialId]: ''});
    setIsSocialRemoveModalVisible(false);
  };

  const handleProfileImageEdit = async () => {
    if (Platform.OS === 'android') {
      // Android: NO custom permission modals, just direct picker
      Alert.alert(
        'Select Profile Picture',
        'Choose where you want to get your profile picture from.',
        [
          { text: 'Camera', onPress: () => pickImageFromSource('camera') },
          { text: 'Gallery', onPress: () => pickImageFromSource('gallery') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      // iOS: Keep the existing custom permission flow (Apple requires it)
      const currentPermissions = await checkPermissions();
      
      if (currentPermissions.cameraGranted && currentPermissions.galleryGranted) {
        Alert.alert(
          'Select Profile Picture',
          'Choose where you want to get your profile picture from.',
          [
            { text: 'Camera', onPress: () => pickImageFromSource('camera') },
            { text: 'Gallery', onPress: () => pickImageFromSource('gallery') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        // Show permission request modal for iOS only
        Alert.alert(
          'Permission Required', 
          'XSCard needs camera and photo library access to let you add profile pictures and company logos to your digital business card. This helps create a professional appearance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Grant Permission', 
              onPress: async () => {
                const permissions = await requestPermissions();
                if (permissions.cameraGranted && permissions.galleryGranted) {
                  // Show picker after permissions granted
                  Alert.alert(
                    'Select Profile Picture',
                    'Choose where you want to get your profile picture from.',
                    [
                      { text: 'Camera', onPress: () => pickImageFromSource('camera') },
                      { text: 'Gallery', onPress: () => pickImageFromSource('gallery') },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }
              }
            }
          ]
        );
      }
    }
  };

  const handleLogoEdit = async () => {
    if (Platform.OS === 'android') {
      // Android: NO custom permission modals, just direct picker
      Alert.alert(
        'Select Company Logo',
        'Choose where you want to get your company logo from.',
        [
          { text: 'Camera', onPress: () => pickLogo('camera') },
          { text: 'Gallery', onPress: () => pickLogo('gallery') },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    } else {
      // iOS: Keep the existing custom permission flow (Apple requires it)
      const currentPermissions = await checkPermissions();
      
      if (currentPermissions.cameraGranted && currentPermissions.galleryGranted) {
        Alert.alert(
          'Select Company Logo',
          'Choose where you want to get your company logo from.',
          [
            { text: 'Camera', onPress: () => pickLogo('camera') },
            { text: 'Gallery', onPress: () => pickLogo('gallery') },
            { text: 'Cancel', style: 'cancel' },
          ]
        );
      } else {
        // Show permission request modal for iOS only
        Alert.alert(
          'Permission Required', 
          'XSCard needs camera and photo library access to let you add profile pictures and company logos to your digital business card. This helps create a professional appearance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Grant Permission', 
              onPress: async () => {
                const permissions = await requestPermissions();
                if (permissions.cameraGranted && permissions.galleryGranted) {
                  // Show picker after permissions granted
                  Alert.alert(
                    'Select Company Logo',
                    'Choose where you want to get your company logo from.',
                    [
                      { text: 'Camera', onPress: () => pickLogo('camera') },
                      { text: 'Gallery', onPress: () => pickLogo('gallery') },
                      { text: 'Cancel', style: 'cancel' },
                    ]
                  );
                }
              }
            }
          ]
        );
      }
    }
  };

  // Profile image picker function (simplified like logo picker)
  const pickImageFromSource = async (source: 'camera' | 'gallery') => {
    try {
      console.log(`[Image Picker] Starting ${source} selection...`);
      
      let imageUri: string | null = null;
      
      if (Platform.OS === 'android') {
        // Android: Direct pick, let system handle permissions
        console.log('[Image Picker] Android: Direct pick with system permission handling');
        imageUri = await pickImage(source === 'camera');
      } else {
        // iOS: Check permissions first, then pick
        console.log('[Image Picker] iOS: Permission check then pick');
        const { cameraGranted, galleryGranted } = await requestPermissions();
        
        if (source === 'camera' && !cameraGranted) {
          Alert.alert(
            'Camera Permission Required', 
            'Please enable camera access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                  Linking.openURL('app-settings:');
              }}
            ]
          );
          return;
        }
        
        if (source === 'gallery' && !galleryGranted) {
          Alert.alert(
            'Photo Library Permission Required', 
            'Please enable photo library access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                  Linking.openURL('app-settings:');
              }}
            ]
          );
          return;
        }

        console.log('[Image Picker] iOS: Permissions checked, launching picker...');
        imageUri = await pickImage(source === 'camera');
      }
      
      if (imageUri) {
        console.log('[Image Picker] Processing selected image...');
        const userId = await getUserId();
        if (!userId) {
          console.error('[Image Picker] User ID not found');
          Alert.alert('Error', 'User ID not found');
          return;
        }

        // Create form data for upload
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'profile-image.jpg',
        } as any);
        formData.append('imageType', 'profileImage');

        console.log('[Image Picker] Starting upload...');

        // Upload the image
        const response = await fetch(
          buildUrl(ENDPOINTS.UPDATE_CARD.replace(':id', userId)) + `?cardIndex=${cardIndex}`,
          {
            method: 'PATCH',
            body: formData,
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': await AsyncStorage.getItem('userToken') || '',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Image Picker] Upload failed:', response.status, errorText);
          throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Image Picker] Upload successful:', data.updatedCard?.profileImage ? 'Image URL received' : 'No image URL in response');
        
        setFormData(prev => ({
          ...prev,
          profileImage: data.updatedCard.profileImage
        }));

        Alert.alert('Success', 'Profile picture updated successfully');
      } else {
        console.log('[Image Picker] User canceled selection');
      }
    } catch (error) {
      console.error('[Image Picker] Error during image selection/upload:', error);
      
      // More specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          Alert.alert('Permission Error', 'Unable to access camera or photo library. Please check your device settings.');
        } else if (error.message.includes('Upload failed')) {
          Alert.alert('Upload Error', 'Failed to upload the image. Please try again.');
        } else {
          Alert.alert('Error', `Image selection failed: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'There was a problem with the image picker. Please try again.');
      }
    }
  };

  // Improved implementation for logo picker with iOS compatibility
  const pickLogo = async (source: 'camera' | 'gallery') => {
    try {
      console.log(`[Logo Picker] Starting ${source} selection...`);
      
      let imageUri: string | null = null;
      
      if (Platform.OS === 'android') {
        // Android: Direct pick, let system handle permissions
        console.log('[Logo Picker] Android: Direct pick with system permission handling');
        imageUri = await pickImage(source === 'camera');
      } else {
        // iOS: Check permissions first, then pick
        console.log('[Logo Picker] iOS: Permission check then pick');
        const { cameraGranted, galleryGranted } = await requestPermissions();
        
        if (source === 'camera' && !cameraGranted) {
          Alert.alert(
            'Camera Permission Required', 
            'Please enable camera access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                  Linking.openURL('app-settings:');
              }}
            ]
          );
          return;
        }
        
        if (source === 'gallery' && !galleryGranted) {
          Alert.alert(
            'Photo Library Permission Required', 
            'Please enable photo library access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                  Linking.openURL('app-settings:');
              }}
            ]
          );
          return;
        }

        console.log('[Logo Picker] iOS: Permissions checked, launching picker...');
        imageUri = await pickImage(source === 'camera');
      }
      
      if (imageUri) {
        console.log('[Logo Picker] Processing selected logo...');
        const userId = await getUserId();
        if (!userId) {
          console.error('[Logo Picker] User ID not found');
          Alert.alert('Error', 'User ID not found');
          return;
        }

        // Create form data for upload
        const formData = new FormData();
        formData.append('image', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'company-logo.jpg',
        } as any);
        formData.append('imageType', 'companyLogo');

        console.log('[Logo Picker] Starting upload...');

        // Upload the image
        const response = await fetch(
          buildUrl(ENDPOINTS.UPDATE_CARD.replace(':id', userId)) + `?cardIndex=${cardIndex}`,
          {
            method: 'PATCH',
            body: formData,
            headers: {
              'Content-Type': 'multipart/form-data',
              'Authorization': await AsyncStorage.getItem('userToken') || '',
            },
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Logo Picker] Upload failed:', response.status, errorText);
          throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('[Logo Picker] Upload successful:', data.updatedCard?.companyLogo ? 'Logo URL received' : 'No logo URL in response');
        
        setFormData(prev => ({
          ...prev,
          companyLogo: data.updatedCard.companyLogo
        }));

        Alert.alert('Success', 'Logo updated successfully');
        setZoomLevel(1.0); // Reset zoom level when new logo is uploaded
      } else {
        console.log('[Logo Picker] User canceled selection');
      }
    } catch (error) {
      console.error('[Logo Picker] Error during logo selection/upload:', error);
      
      // More specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          Alert.alert('Permission Error', 'Unable to access camera or photo library. Please check your device settings.');
        } else if (error.message.includes('Upload failed')) {
          Alert.alert('Upload Error', 'Failed to upload the logo. Please try again.');
        } else {
          Alert.alert('Error', `Logo selection failed: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'There was a problem with the logo picker. Please try again.');
      }
    }
  };

  // CustomModal component for other modals (not image selection)
  const CustomModal = ({ isVisible, onClose, title, message, buttons }: any) => {
    useEffect(() => {
      const backAction = () => {
        if (isVisible) {
          onClose();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

      return () => {
        if (backHandler) {
          backHandler.remove();
        }
      };
    }, [isVisible, onClose]);

    return (
      <Modal
        isVisible={isVisible}
        onBackdropPress={onClose}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
        style={{ margin: 20 }}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <View style={styles.modalButtonsContainer}>
            {buttons.map((button: any, index: number) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.modalButton,
                  button.type === 'cancel' && styles.modalButtonCancel,
                  button.type === 'confirm' && styles.modalButtonConfirm
                ]}
                onPress={button.onPress}
              >
                <Text style={[
                  styles.modalButtonText,
                  button.type === 'cancel' && styles.modalButtonTextCancel
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    );
  };

  const handleDelete = () => {
    // Prevent deletion of the default card (index 0)
    if (cardIndex === 0) {
      setModalMessage('The default card cannot be deleted. This ensures you always have at least one card available.');
      setIsSuccessModalVisible(true);
      return;
    }
    
    setModalMessage('Are you sure you want to delete this card? This action cannot be undone.');
    setIsConfirmModalVisible(true);
  };

  // Add this function to handle zoom reset
  const resetZoom = () => {
    setZoomLevel(1.0);
  };

  const handlePreview = () => {
    setIsPreviewModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <Header title="Edit Card" />
      
      {/* Cancel and Preview buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButtonContainer}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.rightButtons}>
          <TouchableOpacity onPress={handlePreview}>
            <View style={styles.previewButton}>
              <MaterialIcons name="visibility" size={16} color="#666" />
              <Text style={styles.previewButtonText}>Preview</Text>
            </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} style={styles.saveButtonContainer}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
        </View>
      </View>

      <KeyboardAwareScrollView 
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 } // Add extra padding for delete button
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={20}
        extraHeight={20}
        >
          {/* Card Color Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Card color</Text>
            
            {/* Current Color Indicator */}
            <View style={styles.currentColorIndicator}>
              <Text style={styles.currentColorLabel}>Preview colour:</Text>
              <View style={[styles.currentColorPreview, { backgroundColor: selectedColor }]} />
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorContainer}
            >
              {CARD_COLORS.map((color, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setSelectedColor(color)}
                  style={styles.colorButtonWrapper}
                >
                  <View style={[
                    styles.colorButton,
                    { backgroundColor: color },
                    selectedColor === color && styles.selectedColor,
                  ]} />
                </TouchableOpacity>
              ))}
              
              {/* Custom Color Picker Button */}
              <TouchableOpacity
                onPress={() => {
                  setCustomColor(selectedColor); // Sync with current selected color
                  setIsCustomColorModalVisible(true);
                }}
                style={styles.colorButtonWrapper}
              >
                <View style={[
                  styles.colorButton,
                  styles.customColorButton,
                  selectedColor === customColor && styles.selectedColor,
                ]}>
                  <MaterialIcons name="palette" size={20} color="#666" />
                </View>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Images & Layout Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Images & layout</Text>
            <View style={styles.logoContainer}>
            <View style={styles.logoFrame}>
            <Image
              source={formData.companyLogo ? 
                { uri: getImageUrl(formData.companyLogo) } : 
                require('../../../assets/images/logoplaceholder.jpg')
              }
                style={{ 
                  width: '100%', 
                  height: '100%',
                  transform: [{ scale: zoomLevel }],
                  opacity: 1,
                }}
                resizeMode="contain"
                fadeDuration={300}
            />
            </View>
            {userPlan !== 'enterprise' && (
              <TouchableOpacity 
                style={styles.editLogoButton}
                onPress={handleLogoEdit}
              >
                <MaterialIcons name="edit" size={24} color={COLORS.white} />
              </TouchableOpacity>
            )}
            
            {/* Logo Zoom Controls */}
            {formData.companyLogo && (
              <View style={styles.zoomSliderContainer}>
                <View style={styles.zoomHeaderRow}>
                  <Text style={styles.zoomLabel}>Logo Size: {zoomLevel.toFixed(2)}x</Text>
                  <TouchableOpacity onPress={resetZoom} style={styles.resetButton}>
                    <Text style={styles.resetButtonText}>Reset</Text>
                  </TouchableOpacity>
                </View>
                
                <View style={styles.zoomControlsContainer}>
                  <TouchableOpacity 
                    style={[styles.zoomButton, zoomLevel <= 0.5 && styles.zoomButtonDisabled]} 
                    onPress={() => {
                      if (zoomLevel > 0.5) {
                        setZoomLevel(Math.max(0.5, zoomLevel - 0.1));
                      }
                    }}
                    disabled={zoomLevel <= 0.5}
                  >
                    <MaterialIcons name="remove" size={20} color={zoomLevel <= 0.5 ? '#ccc' : COLORS.white} />
                  </TouchableOpacity>
                  
                  <View style={styles.zoomBarContainer}>
                    <View style={styles.zoomBarTrack}>
                      <View 
                        style={[
                          styles.zoomBarFill, 
                          { width: `${((zoomLevel - 0.5) / 1.0) * 100}%` }
                        ]} 
                      />
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.zoomButton, zoomLevel >= 1.5 && styles.zoomButtonDisabled]} 
                    onPress={() => {
                      if (zoomLevel < 1.5) {
                        setZoomLevel(Math.min(1.5, zoomLevel + 0.1));
                      }
                    }}
                    disabled={zoomLevel >= 1.5}
                  >
                    <MaterialIcons name="add" size={20} color={zoomLevel >= 1.5 ? '#ccc' : COLORS.white} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.zoomLabels}>
                  <Text style={styles.zoomLabelText}>Small</Text>
                  <Text style={styles.zoomLabelText}>Large</Text>
                </View>
              </View>
            )}
            
            {/* Profile Image Overlaying Logo */}
            <View style={styles.profileOverlayContainer}>
              <View style={styles.profileImageContainer}>
                <Image
                  style={styles.profileImage}
                  source={
                        formData.profileImage
                      ? { uri: getImageUrl(formData.profileImage) }
                      : require('../../../assets/images/profile2.jpg')
                  }
                />
                <TouchableOpacity 
                  style={styles.editProfileButton}
                  onPress={handleProfileImageEdit}
                >
                  <MaterialIcons name="edit" size={24} color={COLORS.white} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Template Selection */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Template</Text>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={() => setTemplate(1)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: template === 1 ? COLORS.secondary : '#ddd',
                  backgroundColor: template === 1 ? '#F6F7FF' : '#FFF',
                  marginRight: 8
                }}
              >
                <Text style={{ color: COLORS.black }}>Template 1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTemplate(2)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: template === 2 ? COLORS.secondary : '#ddd',
                  backgroundColor: template === 2 ? '#F6F7FF' : '#FFF',
                  marginRight: 8
                }}
              >
                <Text style={{ color: COLORS.black }}>Template 2</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTemplate(3)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: template === 3 ? COLORS.secondary : '#ddd',
                  backgroundColor: template === 3 ? '#F6F7FF' : '#FFF',
                  marginRight: 8
                }}
              >
                <Text style={{ color: COLORS.black }}>Template 3</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTemplate(4)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: template === 4 ? COLORS.secondary : '#ddd',
                  backgroundColor: template === 4 ? '#F6F7FF' : '#FFF',
                  marginRight: 8
                }}
              >
                <Text style={{ color: COLORS.black }}>Template 4</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTemplate(5)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: template === 5 ? COLORS.secondary : '#ddd',
                  backgroundColor: template === 5 ? '#F6F7FF' : '#FFF'
                }}
              >
                <Text style={{ color: COLORS.black }}>Template 5</Text>
              </TouchableOpacity>
            </View>
          </View>
          </View>

          {/* Personal Details Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Personal details</Text>
          <View style={styles.form}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <TextInput 
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="#999"
              value={formData.firstName}
              onChangeText={(text) => setFormData({...formData, firstName: text})}
            />
            <TextInput 
              style={styles.input}
              placeholder="Occupation"
              placeholderTextColor="#999"
              value={formData.occupation}
              onChangeText={(text) => setFormData({...formData, occupation: text})}
            />
            <TextInput 
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="#999"
              value={formData.lastName}
              onChangeText={(text) => setFormData({...formData, lastName: text})}
            />
            <TextInput 
              style={[
                styles.input, 
                userPlan === 'enterprise' && styles.disabledInput
              ]}
              placeholder="Company name"
              placeholderTextColor="#999"
              value={formData.company}
              onChangeText={(text) => setFormData({...formData, company: text})}
              editable={userPlan !== 'enterprise'}
            />
            <TextInput 
              style={[
                styles.input, 
                userPlan === 'enterprise' && styles.disabledInput
              ]}
              placeholder="Email"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              keyboardType="email-address"
              editable={userPlan !== 'enterprise'}
            />
            <PhoneNumberInput
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
              onCountryCodeChange={(code) => setFormData({...formData, countryCode: code})}
              placeholder="Phone number"
            />
            
            <PhoneNumberInput
              value={altNumber}
              onChangeText={(text) => setAltNumber(text)}
              onCountryCodeChange={(code) => setAltCountryCode(code)}
              placeholder="Alt number"
            />
            
            {/* Toggle to show/hide alt number on card */}
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleLabel}>Show alt number on card</Text>
              <TouchableOpacity
                style={[styles.toggleSwitch, showAltNumber && styles.toggleSwitchActive]}
                onPress={() => setShowAltNumber(!showAltNumber)}
              >
                <View style={[styles.toggleThumb, showAltNumber && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {/* Social Media URL Inputs */}
            {selectedSocials.map((socialId) => (
              <Animated.View 
                key={socialId}
                style={styles.socialInputContainer}
              >
                <View style={styles.socialInputHeader}>
                  <MaterialCommunityIcons
                    name={socials.find(s => s.id === socialId)?.icon || 'link'}
                    size={24}
                    color={socials.find(s => s.id === socialId)?.color}
                  />
                  <Text style={styles.socialInputLabel}>
                    {socials.find(s => s.id === socialId)?.label}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleSocialSelect(socialId as SocialMediaPlatform)}
                    style={styles.removeSocialButton}
                  >
                    <MaterialIcons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder={
                    socialId === 'website' ? 'URL' : 
                    socialId === 'whatsapp' ? 'Phone number' : 
                    'Username'
                  }
                  placeholderTextColor="#999"
                  value={formData[socialId]?.toString() || ''}
                  onChangeText={(text) => {
                    // Remove @ symbol if user includes it
                    const cleanText = text.startsWith('@') ? text.substring(1) : text;
                    setFormData({...formData, [socialId]: cleanText});
                  }}
                  keyboardType={socialId === 'whatsapp' ? 'phone-pad' : 'default'}
                />
                {/* Helpful notes for social platforms */}
                {socialId !== 'website' && socialId !== 'whatsapp' && (
                  <Text style={styles.socialNote}>
                    * Enter username without @ symbol
                  </Text>
                )}
                {socialId === 'whatsapp' && (
                  <Text style={styles.socialNote}>
                    * Include country code (e.g., +1234567890)
                  </Text>
                )}
              </Animated.View>
            ))}
          </View>
          </View>

          {/* Social Link Notification */}
          {socialNotification && (
            <View style={styles.notificationContainer}>
              <MaterialIcons name="info" size={20} color="#1976D2" />
              <Text style={styles.notificationText}>{socialNotification}</Text>
            </View>
          )}

          {/* Link Socials Section */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Link Socials</Text>
          <View style={styles.socialsGrid}>
            {socials.map((social) => (
              <TouchableOpacity
                key={social.id}
                style={[
                  styles.socialItem,
                  selectedSocials.includes(social.id) && styles.selectedSocialItem
                ]}
                onPress={() => handleSocialSelect(social.id as SocialMediaPlatform)}
              >
                <MaterialCommunityIcons
                  name={social.icon || 'link'}
                  size={24}
                  color={social.color}
                />
                <Text style={styles.socialLabel}>{social.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          </View>

          {/* Delete Button */}
          {userPlan !== 'free' && (
            <TouchableOpacity 
              style={[
                styles.deleteButton,
                cardIndex === 0 ? styles.deleteButtonDisabled : null
              ]}
              onPress={handleDelete}
            >
              <Text style={styles.deleteButtonText}>
                {cardIndex === 0 ? "Default Card (Cannot Delete)" : "Delete Card"}
              </Text>
            </TouchableOpacity>
          )}
      </KeyboardAwareScrollView>

      <CustomModal
        isVisible={isSocialRemoveModalVisible}
        onClose={() => setIsSocialRemoveModalVisible(false)}
        title="Remove social media"
        message="Are you sure?"
        buttons={[
          {
            text: 'Cancel',
            type: 'cancel',
            onPress: () => setIsSocialRemoveModalVisible(false)
          },
          {
            text: 'Remove',
            type: 'confirm',
            onPress: () => {
              if (currentSocialToRemove) {
                handleRemoveSocial(currentSocialToRemove as SocialMediaPlatform);
              }
            }
          }
        ]}
      />

      <CustomModal
        isVisible={isConfirmModalVisible}
        onClose={() => setIsConfirmModalVisible(false)}
        title="Delete Card"
        message={modalMessage}
        buttons={[
          {
            text: 'Cancel',
            type: 'cancel',
            onPress: () => setIsConfirmModalVisible(false)
          },
          {
            text: 'Delete',
            type: 'confirm',
            onPress: async () => {
              try {
                const userId = await getUserId();
                if (!userId) {
                  setError('User ID not found');
                  return;
                }

                const response = await authenticatedFetchWithRefresh(
                  `${ENDPOINTS.DELETE_CARD.replace(':id', userId)}?cardIndex=${cardIndex}`,
                  {
                    method: 'DELETE'
                  }
                );

                if (!response.ok) {
                  throw new Error('Failed to delete card');
                }

                // Get updated cards list from response
                const updatedData = await response.json();
                
                // Update local storage with new cards list
                await AsyncStorage.setItem('userCards', JSON.stringify(updatedData.cards));

                setIsConfirmModalVisible(false);
                setModalMessage('Card deleted successfully');
                setIsSuccessModalVisible(true);
              } catch (error) {
                console.error('Error deleting card:', error);
                setError('Failed to delete card');
              }
            }
          }
        ]}
      />


      <CustomModal
        isVisible={isSuccessModalVisible}
        onClose={() => setIsSuccessModalVisible(false)}
        title="Success"
        message={modalMessage}
        buttons={[
          {
            text: 'OK',
            type: 'confirm',
            onPress: () => {
              setIsSuccessModalVisible(false);
              if (modalMessage.includes('updated successfully') || modalMessage.includes('deleted successfully')) {
              navigation.goBack();
              }
            }
          }
        ]}
      />

      {/* Preview Modal */}
      <RNModal
        visible={isPreviewModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsPreviewModalVisible(false)}
      >
        <SafeAreaView style={previewStyles.modalContainer}>
          <View style={previewStyles.modalHeader}>
            <Text style={previewStyles.modalTitle}>Card Preview</Text>
            <TouchableOpacity onPress={() => setIsPreviewModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#000" />
            </TouchableOpacity>
    </View>
          
          <ScrollView style={previewStyles.cardScrollView}>
            <View style={previewStyles.cardContainer}>
              {/* QR Code Placeholder */}
              <View style={previewStyles.qrContainer}>
                <View style={previewStyles.qrPlaceholder}>
                  <MaterialIcons name="qr-code-2" size={80} color="#ccc" />
                  <Text style={previewStyles.qrText}>QR Code</Text>
                </View>
              </View>
              
              {/* Company Logo and Profile Image */}
              <View style={previewStyles.logoContainer}>
                <View style={previewStyles.logoFrame}>
                  <Image 
                    source={formData.companyLogo ? 
                      { uri: getImageUrl(formData.companyLogo) } : 
                      require('../../../assets/images/logoplaceholder.jpg')
                    }
                    style={{ 
                      width: '100%', 
                      height: '100%',
                      transform: [{ scale: zoomLevel }],
                      opacity: 1,
                    }}
                    resizeMode="contain"
                    fadeDuration={300}
                  />
                </View>
                
                {/* Profile Image */}
                <View style={previewStyles.profileContainer}>
                  <View style={previewStyles.profileImageContainer}>
                    <Image
                      style={previewStyles.profileImage}
                      source={
                        formData.profileImage
                          ? { uri: getImageUrl(formData.profileImage) }
                          : require('../../../assets/images/profile2.jpg')
                      }
                    />
                  </View>
                </View>
              </View>
              
              {/* Basic Info - these should NOT use the color scheme as per user's request */}
              <Text style={previewStyles.name}>
                {`${formData.firstName} ${formData.lastName}`}
              </Text>
              <Text style={previewStyles.position}>
                {formData.occupation}
              </Text>
              <Text style={previewStyles.company}>
                {formData.company}
              </Text>
              
              {/* Contact Info - SHOULD use the color scheme */}
              <TouchableOpacity style={previewStyles.contactSection}>
                <MaterialCommunityIcons name="email-outline" size={24} color={selectedColor} />
                <Text style={previewStyles.contactText}>{formData.email}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={previewStyles.contactSection}>
                <MaterialCommunityIcons name="phone-outline" size={24} color={selectedColor} />
                <Text style={previewStyles.contactText}>{`${formData.countryCode}${formData.phoneNumber}`}</Text>
              </TouchableOpacity>
              
              {/* Social Links - SHOULD use the color scheme */}
              {selectedSocials.map(socialId => {
                const social = socials.find(s => s.id === socialId);
                if (social && formData[socialId]) {
                  return (
                    <TouchableOpacity key={socialId} style={previewStyles.contactSection}>
                      <MaterialCommunityIcons 
                        name={social.icon} 
                        size={24} 
                        color={selectedColor} 
                      />
                      <Text style={previewStyles.contactText}>
                        {formData[socialId]?.toString() || ''}
                      </Text>
                    </TouchableOpacity>
                  );
                }
                return null;
              })}
            </View>
          </ScrollView>
          
          <View style={previewStyles.modalActions}>
            <TouchableOpacity 
              style={[previewStyles.continueButton, { borderColor: selectedColor }]}
              onPress={() => setIsPreviewModalVisible(false)}
            >
              <Text style={[previewStyles.continueText, { color: selectedColor }]}>Continue Editing</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[previewStyles.saveButton, { backgroundColor: selectedColor }]}
              onPress={() => {
                setIsPreviewModalVisible(false);
                handleSave();
              }}
            >
              <Text style={previewStyles.saveText}>Save & Exit</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </RNModal>

      {/* Custom Color Picker Modal */}
      <Modal
        isVisible={isCustomColorModalVisible}
        onBackdropPress={() => setIsCustomColorModalVisible(false)}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropOpacity={0.5}
        style={{ margin: 20 }}
        propagateSwipe
        useNativeDriver={false}
        onModalShow={() => {
          // Force ColorPicker to re-initialize when modal opens
          setPickerInitialized(false);
          setTimeout(() => setPickerInitialized(true), 100);
        }}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>Choose Custom Color</Text>
          
          {/* Professional Color Picker - Moved to top */}
          <View style={styles.visualColorPickerContainer}>
            <Text style={styles.colorPickerLabel}>Select your color:</Text>
            <View style={styles.professionalColorPicker}>
              {pickerInitialized && (
                <ColorPicker
                  // Update in real-time for iOS drag gestures
                  onColorChange={isHexEditing ? undefined : (color: string) => setCustomColor(color)}
                  onColorChangeComplete={isHexEditing ? undefined : (color: string) => setCustomColor(color)}
                  color={customColor}
                  thumbSize={36}
                  sliderSize={36}
                  gapSize={10}
                  swatches={false}
                  noSnap
                  discrete={false}
                />
              )}
            </View>
          </View>
          
          {/* Color Preview */}
          <View style={styles.colorPreviewContainer}>
            <Text style={styles.colorPreviewLabel}>Preview:</Text>
            <View style={[styles.colorPreviewLarge, { backgroundColor: customColor }]} />
            <Text style={styles.colorHexText}>{customColor.toUpperCase()}</Text>
          </View>
          
          {/* Color Input */}
          <View style={styles.colorInputContainer}>
            <Text style={styles.colorInputLabel}>Hex Color:</Text>
            <TextInput
              style={styles.colorInput}
              value={customColor}
              onFocus={() => setIsHexEditing(true)}
              onBlur={() => setIsHexEditing(false)}
              onChangeText={(text) => {
                // Ensure it starts with # and is valid hex
                let cleanText = text.replace(/[^0-9A-Fa-f]/g, '');
                if (cleanText.length > 6) cleanText = cleanText.substring(0, 6);
                setCustomColor('#' + cleanText.toUpperCase());
              }}
              placeholder="#000000"
              placeholderTextColor="#999"
              autoCapitalize="characters"
              autoCorrect={false}
              selectTextOnFocus
              maxLength={7}
            />
          </View>
          
          {/* Quick Color Presets Toggle Button */}
          <TouchableOpacity
            style={styles.quickColorsToggleButton}
            onPress={() => setShowQuickColors(!showQuickColors)}
          >
            <Text style={styles.quickColorsToggleText}>
              {showQuickColors ? 'Hide Quick Colors' : 'Show Quick Colors'}
            </Text>
            <MaterialIcons 
              name={showQuickColors ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
              size={24} 
              color={COLORS.primary} 
            />
          </TouchableOpacity>

          {/* Quick Color Presets - Conditionally Rendered */}
          {showQuickColors && (
            <View style={styles.quickColorsContainer}>
              <Text style={styles.quickColorsLabel}>Quick Colors:</Text>
              <View style={styles.quickColorsGrid}>
                {['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#FFC0CB', '#A52A2A', '#808080', '#000000'].map((color, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setCustomColor(color)}
                    style={[styles.quickColorButton, { backgroundColor: color }]}
                  />
                ))}
              </View>
            </View>
          )}
          
          <View style={styles.modalButtonsContainer}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={() => setIsCustomColorModalVisible(false)}
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonConfirm]}
              onPress={() => {
                setSelectedColor(customColor);
                setIsCustomColorModalVisible(false);
              }}
            >
              <Text style={styles.modalButtonText}>Apply Color</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    marginTop: 130,
    marginBottom: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    marginTop: 0,
  },
  warningText: {
    marginLeft: 8,
    color: COLORS.black,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
    color: COLORS.black,
  },
  imageButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  imageButton: {
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  buttonText: {
    color: COLORS.black,
    marginLeft: 4,
  },
  form: {
    // Spacing handled by individual input marginBottom
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 96,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
  },
  rightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButtonContainer: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButton: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  previewButtonText: {
    color: '#666',
    fontSize: 14,
    marginLeft: 4,
  },
  saveButtonContainer: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  saveButton: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#1E1B4B',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  sectionContainer: {
    marginTop: 20,
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  colorSection: {
    marginTop: 20,
    marginBottom: 24,
  },
  colorContainer: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
    flexDirection: 'row',
  },
  colorButtonWrapper: {
    padding: 3, // Space for the selection border
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    margin: 4,
  },
  selectedColor: {
    borderWidth: 3,
    borderColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  currentColorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  currentColorLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  currentColorPreview: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  customColorButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  colorPreviewLabel: {
    fontSize: 16,
    color: COLORS.black,
    marginRight: 12,
  },
  colorPreviewLarge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginRight: 12,
  },
  colorHexText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    fontFamily: 'monospace',
  },
  visualColorPickerContainer: {
    marginBottom: 20,
  },
  colorPickerLabel: {
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 12,
  },
  professionalColorPicker: {
    width: '100%',
    height: Math.min(Dimensions.get('window').height * 0.35, 280),
  },
  colorInputContainer: {
    marginBottom: 20,
  },
  colorInputLabel: {
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 8,
  },
  colorInput: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickColorsToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  quickColorsToggleText: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '500',
    marginRight: 8,
  },
  quickColorsContainer: {
    marginBottom: 20,
  },
  quickColorsLabel: {
    fontSize: 16,
    color: COLORS.black,
    marginBottom: 12,
  },
  quickColorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickColorButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  logoContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    marginLeft: -20,
    marginRight: -20,
    alignSelf: 'center',
    marginBottom: 80,
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
    padding: 0,
    borderRadius: 12,
  },
  logo: {
    width: '80%', // Use percentage of container
    height: '80%', // Use percentage of container
    resizeMode: 'contain',
  },
  profileOverlayContainer: {
    position: 'absolute',
    bottom: -80,
    left: '50%',
    transform: [{ translateX: -60 }],
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
  editLogoButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  editProfileButton: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  socialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  socialItem: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  selectedSocialItem: {
    backgroundColor: '#E8E8E8',
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  socialLabel: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
    color: COLORS.black,
  },
  socialInputContainer: {
    marginBottom: 12,
  },
  socialInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  socialInputLabel: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
  },
  removeSocialButton: {
    padding: 4,
  },
  socialNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    marginLeft: 4,
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 20,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: COLORS.black,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    marginBottom: 20,
    color: COLORS.black,
    textAlign: 'center',
  },
  modalButtonsContainer: {
    flexDirection: 'column',
    gap: 10,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F0F0F0',
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.primary,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.white,
  },
  modalButtonTextCancel: {
    color: COLORS.black,
  },
  deleteButton: {
    backgroundColor: COLORS.error, // or '#FF0000' for red
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginHorizontal: 16,
    marginBottom: 20,
  },
  deleteButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  disabledInput: {
    backgroundColor: '#E8E8E8',
    color: '#666',
  },
  zoomSliderContainer: {
    width: '100%',
    backgroundColor: '#F5F7FA',
    borderRadius: 8,
    padding: 15,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E0E5EC',
  },
  zoomHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  zoomLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.black,
  },
  resetButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  resetButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '500',
  },
  zoomControlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  zoomButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomButtonDisabled: {
    backgroundColor: '#D3D3D3',
  },
  zoomBarContainer: {
    flex: 1,
    marginHorizontal: 10,
    height: 40,
    justifyContent: 'center',
  },
  zoomBarTrack: {
    height: 4,
    backgroundColor: '#D3D3D3',
    borderRadius: 2,
    position: 'relative',
  },
  zoomBarFill: {
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  zoomLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 5,
  },
  zoomLabelText: {
    fontSize: 12,
    color: '#666',
  },
  notificationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#1976D2',
  },
  notificationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#1976D2',
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  toggleLabel: {
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
  },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: COLORS.secondary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignSelf: 'flex-start',
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  previewModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  previewCardScrollView: {
    flex: 1,
  },
  previewCardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 16,
    margin: 16,
  },
  previewQrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  previewQrPlaceholder: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  previewQrText: {
    marginTop: 10,
    color: '#999',
  },
  previewLogoContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    marginBottom: 80,
    borderRadius: 12,
    padding: 8,
  },
  previewLogoFrame: {
    width: '100%',
    height: 200,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
  },
  previewProfileContainer: {
    position: 'absolute',
    bottom: -60,
    left: '50%',
    transform: [{ translateX: -60 }],
    alignItems: 'center',
  },
  previewProfileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  previewProfileImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  previewName: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 5,
    marginTop: 20,
    textAlign: 'center',
    color: COLORS.black,
  },
  previewPosition: {
    fontSize: 18,
    marginBottom: 5,
    textAlign: 'center',
    color: '#444',
  },
  previewCompany: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  previewContactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
  },
  previewContactText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
  previewModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  previewContinueButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  previewContinueText: {
    fontWeight: '500',
  },
  previewSaveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewSaveText: {
    color: COLORS.white,
    fontWeight: '500',
  },
});

const previewStyles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  cardScrollView: {
    flex: 1,
  },
  cardContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 16,
    margin: 16,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrPlaceholder: {
    width: 150,
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  qrText: {
    marginTop: 10,
    color: '#999',
  },
  logoContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'visible',
    marginBottom: 80,
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
  profileContainer: {
    position: 'absolute',
    bottom: -60,
    left: '50%',
    transform: [{ translateX: -60 }],
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
    color: COLORS.black,
    marginLeft: 10,
  },
  position: {
    fontSize: 18,
    marginBottom: 5,
    color: '#444',
    marginLeft: 10,
  },
  company: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 20,
    color: '#666',
    marginLeft: 10,
  },
  contactSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    padding: 5,
    borderRadius: 8,
    marginLeft: 10,
  },
  contactText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFEFEF',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 12,
    marginRight: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  continueText: {
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    marginLeft: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveText: {
    color: COLORS.white,
    fontWeight: '500',
  },
});

