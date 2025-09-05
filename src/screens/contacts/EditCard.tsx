import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image, Platform, BackHandler, PanResponder, GestureResponderEvent, LayoutChangeEvent, Dimensions, SafeAreaView, Linking } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Modal as RNModal } from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import { COLORS, CARD_COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { useNavigation, useRoute } from '@react-navigation/native';
import { API_BASE_URL, ENDPOINTS, buildUrl, getUserId, authenticatedFetchWithRefresh } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EditCardScreenRouteProp, RootStackParamList } from '../../types/navigation';
import { RouteProp } from '@react-navigation/native';
import Modal from 'react-native-modal';
import { getImageUrl, pickImage, requestPermissions, checkPermissions } from '../../utils/imageUtils';

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

  useEffect(() => {
    loadUserData();
    getUserPlan();
  }, []);

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
        setFormData({
          firstName: userData.name || '',
          lastName: userData.surname || '',
          occupation: userData.occupation || '',
          company: userData.company || '',
          email: userData.email || '',
          phoneNumber: userData.phone || '',
          ...Object.keys(userData.socials || {}).reduce((acc, key) => ({
            ...acc,
            [key]: userData.socials[key]
          }), {}),
          profileImage: userData.profileImage || '',
          companyLogo: userData.companyLogo || '',
          logoZoomLevel: userData.logoZoomLevel || 1.0,
        });

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

  const validateForm = () => {
    if (!formData.company || !formData.email || !formData.phoneNumber || !formData.occupation) {
      setError('Please fill in all required fields');
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
        phone: formData.phoneNumber,
        socials: socialFields,
        colorScheme: selectedColor,
        profileImage: formData.profileImage,
        companyLogo: formData.companyLogo,
        logoZoomLevel: Number(zoomLevel) // Ensure it's a number
      };

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
      
      setModalMessage('Card updated successfully');
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
      // KeyboardAwareScrollView will automatically scroll to the new input when it's focused
      // No need for manual scrolling
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
      
      console.log('[Image Picker] Permissions already checked, launching picker...');
      
      // Use our utility function to pick image
      const imageUri = await pickImage(source === 'camera');
      
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
      
      // Check permissions using our utility function
      const { cameraGranted, galleryGranted } = await requestPermissions();
      
      if (source === 'camera' && !cameraGranted) {
          Alert.alert(
            'Camera Permission Required', 
            'Please enable camera access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
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
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }}
            ]
          );
          return;
      }

      console.log('[Logo Picker] Permissions granted, launching picker...');
      
      // Use our utility function to pick image
      const imageUri = await pickImage(source === 'camera');
      
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
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <View style={styles.rightButtons}>
          <TouchableOpacity onPress={handlePreview}>
            <View style={styles.previewButton}>
              <MaterialIcons name="visibility" size={16} color="#666" />
              <Text style={styles.previewButtonText}>Preview</Text>
            </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave}>
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
          {/* Warning Message */}
          <View style={styles.colorSection}>
            <Text style={styles.sectionTitle}>Card color</Text>
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
            </ScrollView>
          </View>

          {/* Images & Layout Section */}
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
                      : require('../../../assets/images/profile.png')
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

          {/* Link Socials Section */}
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

          {/* Personal Details Section */}
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
            <TextInput 
              style={styles.input}
              placeholder="Phone number"
              placeholderTextColor="#999"
              value={formData.phoneNumber}
              onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
              keyboardType="phone-pad"
            />

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
                  placeholder={`${socials.find(s => s.id === socialId)?.label} ${
                    socialId === 'website' ? 'URL' : 
                    socialId === 'whatsapp' ? 'number' : 
                    'username (without @)'
                  }`}
                  placeholderTextColor="#999"
                  value={formData[socialId]?.toString() || ''}
                  onChangeText={(text) => {
                    // Remove @ symbol if user includes it
                    const cleanText = text.startsWith('@') ? text.substring(1) : text;
                    setFormData({...formData, [socialId]: cleanText});
                  }}
                  keyboardType={socialId === 'whatsapp' ? 'phone-pad' : 'default'}
                />
              </Animated.View>
            ))}
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
        title="Remove Social Media"
        message="Are you sure you want to remove this social media link?"
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
                          : require('../../../assets/images/profile.png')
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
                <Text style={previewStyles.contactText}>{formData.phoneNumber}</Text>
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
    gap: 12,
  },
  input: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
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
  cancelButton: {
    color: '#666',
    fontSize: 16,
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
  saveButton: {
    color: '#666',
    fontSize: 16,
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

