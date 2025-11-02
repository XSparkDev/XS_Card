import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, Keyboard } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Animated } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { COLORS, CARD_COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types';
import { authenticatedFetchWithRefresh, ENDPOINTS, getUserId, buildUrl, API_BASE_URL } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pickImage, requestPermissions, checkPermissions } from '../../utils/imageUtils';
import PhoneNumberInput from '../../components/PhoneNumberInput';
import { saveAltNumber } from '../../utils/tempAltNumber';

type AddCardsNavigationProp = StackNavigationProp<RootStackParamList>;

export default function AddCards() {
  const navigation = useNavigation<AddCardsNavigationProp>();
  const [error, setError] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    occupation: '',
    company: '',
    email: '',
    phoneNumber: '',
    countryCode: '+27', // Default to South Africa
    // Social media fields
    whatsapp: '',
    x: '',
    facebook: '',
    linkedin: '',
    website: '',
    tiktok: '',
    instagram: '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('#1B2B5B'); // Default color
  const [selectedSocials, setSelectedSocials] = useState<string[]>([]);
  const [template, setTemplate] = useState<number>(1);
  const [isCustomColorModalVisible, setIsCustomColorModalVisible] = useState(false);
  const [customColor, setCustomColor] = useState('#1B2B5B');
  const [showQuickColors, setShowQuickColors] = useState(false);
  const [socialNotification, setSocialNotification] = useState<string | null>(null);
  // Alt number state
  const [altNumber, setAltNumber] = useState('');
  const [altCountryCode, setAltCountryCode] = useState('+27');
  const [showAltNumber, setShowAltNumber] = useState(false);

  // Social media platforms data
  const socials = [
    { id: 'whatsapp', icon: 'whatsapp', label: 'WhatsApp', color: '#25D366' },
    { id: 'x', icon: 'twitter', label: 'X', color: '#000000' },
    { id: 'facebook', icon: 'facebook', label: 'Facebook', color: '#1877F2' },
    { id: 'linkedin', icon: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
    { id: 'website', icon: 'web', label: 'Website', color: '#4285F4' },
    { id: 'tiktok', icon: 'music-note', label: 'TikTok', color: '#000000' },
    { id: 'instagram', icon: 'instagram', label: 'Instagram', color: '#E4405F' },
  ];

  // Keyboard event listeners
  React.useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []);

  const handleCancel = () => {
    navigation.goBack();
  };

  const validateForm = () => {
    if (!formData.firstName || !formData.lastName || !formData.company || !formData.email || !formData.phoneNumber || !formData.occupation) {
      setError('Please fill in all required fields');
      return false;
    }
    setError('');
    return true;
  };

  const handleProfileImagePick = async () => {
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
                  Alert.alert('Open Settings', 'Please go to Settings > XSCard > Camera');
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
                  Alert.alert('Open Settings', 'Please go to Settings > XSCard > Photos');
              }}
            ]
          );
          return;
        }

        console.log('[Image Picker] iOS: Permissions checked, launching picker...');
        imageUri = await pickImage(source === 'camera');
      }
      
      if (imageUri) {
        console.log('[Image Picker] Image selected successfully');
        setProfileImage(imageUri);
      } else {
        console.log('[Image Picker] User canceled selection');
      }
    } catch (error) {
      console.error('[Image Picker] Error during image selection:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          Alert.alert('Permission Error', 'Unable to access camera or photo library. Please check your device settings.');
        } else {
          Alert.alert('Error', `Image selection failed: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'There was a problem with the image picker. Please try again.');
      }
    }
  };

  const handleLogoUpload = async () => {
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
                  Alert.alert('Open Settings', 'Please go to Settings > XSCard > Camera');
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
                  Alert.alert('Open Settings', 'Please go to Settings > XSCard > Photos');
              }}
            ]
          );
          return;
        }

        console.log('[Logo Picker] iOS: Permissions checked, launching picker...');
        imageUri = await pickImage(source === 'camera');
      }
      
      if (imageUri) {
        console.log('[Logo Picker] Logo selected successfully');
        setCompanyLogo(imageUri);
      } else {
        console.log('[Logo Picker] User canceled selection');
      }
    } catch (error) {
      console.error('[Logo Picker] Error during logo selection:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('Permission')) {
          Alert.alert('Permission Error', 'Unable to access camera or photo library. Please check your device settings.');
        } else {
          Alert.alert('Error', `Logo selection failed: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'There was a problem with the image picker. Please try again.');
      }
    }
  };

  const handleSocialSelect = (socialId: string) => {
    if (selectedSocials.includes(socialId)) {
      setSelectedSocials(selectedSocials.filter(id => id !== socialId));
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

  const handleRemoveSocial = (socialId: string) => {
    setSelectedSocials(selectedSocials.filter(id => id !== socialId));
    setFormData(prev => ({
      ...prev,
      [socialId]: ''
    }));
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setShowQuickColors(false);
  };

  const handleCustomColorSelect = (color: string) => {
    setCustomColor(color);
    setSelectedColor(color);
    setIsCustomColorModalVisible(false);
  };

  const handleAdd = async () => {
    try {
      if (!validateForm()) {
        return;
      }

      const userId = await getUserId();

      if (!userId) {
        Alert.alert('Error', 'Please login first');
        return;
      }

      const form = new FormData();
      
      // Use formData state to append values
      form.append('company', formData.company);
      form.append('email', formData.email);
      form.append('phone', `${formData.countryCode}${formData.phoneNumber}`);
      form.append('title', formData.occupation);
      form.append('name', formData.firstName);
      form.append('surname', formData.lastName);

      // Add social media fields
      const socialFields: { [key: string]: string } = {};
      selectedSocials.forEach(socialId => {
        if (formData[socialId as keyof typeof formData]) {
          socialFields[socialId] = formData[socialId as keyof typeof formData] as string;
        }
      });
      form.append('socials', JSON.stringify(socialFields));

      // Add color scheme
      form.append('colorScheme', selectedColor);
      // Add template
      form.append('template', String(template));

      if (profileImage) {
        const imageName = profileImage.split('/').pop() || 'profile.jpg';
        form.append('profileImage', {
          uri: profileImage,
          type: 'image/jpeg',
          name: imageName,
        } as any);
      }

      if (companyLogo) {
        const logoName = companyLogo.split('/').pop() || 'logo.jpg';
        form.append('companyLogo', {
          uri: companyLogo,
          type: 'image/jpeg',
          name: logoName,
        } as any);
      }

      // Use authenticatedFetchWithRefresh for proper token handling
      const response = await authenticatedFetchWithRefresh(ENDPOINTS.ADD_CARD, {
        method: 'POST',
        body: form,
      });

      const responseData = await response.json();
      console.log('Server Response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to create card');
      }

      // Get the new card index (it should be the last card in the array)
      // Fetch updated cards list to get the correct index
      try {
        const cardsResponse = await authenticatedFetchWithRefresh(ENDPOINTS.GET_CARD + `/${userId}`);
        const cardsData = await cardsResponse.json();
        const cardsArray = cardsData.cards || (Array.isArray(cardsData) ? cardsData : []);
        const newCardIndex = cardsArray.length > 0 ? cardsArray.length - 1 : 0;
        
        // Save alt number to temp file
        await saveAltNumber(newCardIndex, {
          altNumber,
          altCountryCode,
          showAltNumber,
        });
      } catch (altError) {
        console.error('Error saving alt number:', altError);
        // Don't fail the whole operation if alt number save fails
      }

      Alert.alert('Success', 'Card created successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack()
        }
      ]);

    } catch (error) {
      console.error('Error creating card:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create card');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Add Card" />
      
      {/* Cancel and Save buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelButton}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleAdd}>
          <Text style={styles.saveButton}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            isKeyboardVisible && styles.scrollContentKeyboard
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Warning Message */}
          <View style={styles.warningBox}>
            <MaterialIcons name="info" size={20} color={COLORS.black} />
            <Text style={styles.warningText}>
              New Card, new you! Create a card that will help you connect with your network. 
            </Text>
          </View>

          {/* Images & Layout Section */}
          <Text style={styles.sectionTitle}>Images & layout</Text>
          <View style={styles.imageSection}>
            <Text style={styles.sectionDescription}>
              Add your profile picture and company logo to enhance your digital business card.
            </Text>
            <View style={styles.imageButtonsRow}>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={handleProfileImagePick}
              >
                {profileImage ? (
                  <Image source={{ uri: profileImage }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="person" size={40} color={COLORS.primary} />
                    <Text style={styles.imagePlaceholderText}>Profile Picture</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={handleLogoUpload}
              >
                {companyLogo ? (
                  <Image source={{ uri: companyLogo }} style={styles.imagePreview} />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <MaterialIcons name="business" size={40} color={COLORS.primary} />
                    <Text style={styles.imagePlaceholderText}>Company Logo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Template Selection */}
          <Text style={styles.sectionTitle}>Template</Text>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <TouchableOpacity
              onPress={() => setTemplate(1)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: template === 1 ? COLORS.secondary : '#ddd',
                backgroundColor: template === 1 ? '#F6F7FF' : '#FFF'
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
                backgroundColor: template === 2 ? '#F6F7FF' : '#FFF'
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
                backgroundColor: template === 3 ? '#F6F7FF' : '#FFF'
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
                backgroundColor: template === 4 ? '#F6F7FF' : '#FFF'
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
              placeholder="Last name"
                placeholderTextColor="#999"
                value={formData.lastName}
                onChangeText={(text) => setFormData({...formData, lastName: text})}
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
              placeholder="Company name"
                placeholderTextColor="#999"
                value={formData.company}
                onChangeText={(text) => setFormData({...formData, company: text})}
              />

              <TextInput 
                style={styles.input}
              placeholder="Email address"
                placeholderTextColor="#999"
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                keyboardType="email-address"
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
          </View>

          {/* Add Button - Now inside ScrollView */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add Card</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 150,
    paddingBottom: 20,
  },
  scrollContentKeyboard: {
    paddingBottom: 40,
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
  imageSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#777',
    marginBottom: 15,
  },
  imageButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  imageButton: {
    width: 130,
    height: 130,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    zIndex: 1,
    paddingVertical: 0,
  },
  cancelButton: {
    color: '#666',
    fontSize: 16,
  },
  saveButton: {
    color: '#666',
    fontSize: 16,
  },
  buttonContainer: {
    padding: 16,
    paddingBottom: 32,
    marginTop: 20,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: COLORS.error,
    marginBottom: 10,
    fontSize: 14,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
});
