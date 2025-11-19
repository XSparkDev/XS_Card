import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, SafeAreaView, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Linking, Modal, FlatList } from 'react-native';
import { COLORS } from '../../constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { ENDPOINTS, buildUrl } from '../../utils/api';
import { pickImage, requestPermissions, checkPermissions } from '../../utils/imageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CompleteProfileRouteProp = RouteProp<AuthStackParamList, 'CompleteProfile'>;
type CompleteProfileNavigationProp = StackNavigationProp<AuthStackParamList>;

// Country data with flags and codes (most common countries)
const COUNTRIES = [
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
  { code: '+36', name: 'Hungary', flag: '🇭🇺' },
  { code: '+40', name: 'Romania', flag: '🇷🇴' },
  { code: '+359', name: 'Bulgaria', flag: '🇧🇬' },
  { code: '+385', name: 'Croatia', flag: '🇭🇷' },
  { code: '+386', name: 'Slovenia', flag: '🇸🇮' },
  { code: '+421', name: 'Slovakia', flag: '🇸🇰' },
  { code: '+370', name: 'Lithuania', flag: '🇱🇹' },
  { code: '+371', name: 'Latvia', flag: '🇱🇻' },
  { code: '+372', name: 'Estonia', flag: '🇪🇪' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+353', name: 'Ireland', flag: '🇮🇪' },
  { code: '+354', name: 'Iceland', flag: '🇮🇸' },
  { code: '+352', name: 'Luxembourg', flag: '🇱🇺' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+380', name: 'Ukraine', flag: '🇺🇦' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+98', name: 'Iran', flag: '🇮🇷' },
  { code: '+972', name: 'Israel', flag: '🇮🇱' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: '+51', name: 'Peru', flag: '🇵🇪' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
];

export default function CompleteProfile() {
  const navigation = useNavigation<CompleteProfileNavigationProp>();
  const route = useRoute<CompleteProfileRouteProp>();
  const [userId, setUserId] = useState<string | null>(route.params?.userId || null);
  const [idError, setIdError] = useState<string | null>(null);
  
  // User data from signup/login
  const [userName, setUserName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [userSurname, setUserSurname] = useState<string>('');
  
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [oauthPrefillImage, setOauthPrefillImage] = useState<string | null>(null); // Store OAuth provider image URL
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+27'); // Default to South Africa
  const [selectedCountry, setSelectedCountry] =
    useState(COUNTRIES.find(c => c.code === '+27') || COUNTRIES[0]); // Default to South Africa
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySelectorTarget, setCountrySelectorTarget] = useState<'primary' | 'alternate'>('primary');
  const [countrySearch, setCountrySearch] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [alternateCountryCode, setAlternateCountryCode] = useState('+27');
  const [alternateSelectedCountry, setAlternateSelectedCountry] =
    useState(COUNTRIES.find(c => c.code === '+27') || COUNTRIES[0]);
  const [isAlternateExpanded, setIsAlternateExpanded] = useState(false);
  const [occupation, setOccupation] = useState('');
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState({
    phone: '',
    alternatePhone: '',
    occupation: '',
    company: ''
  });

  // Phone validation function
  const validatePhone = (phoneNumber: string) => {
    // Remove all non-digit characters for validation
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid phone number (7-15 digits)
    const phoneRegex = /^\d{7,15}$/;
    return phoneRegex.test(cleanPhone);
  };

  // Real-time phone validation
  const handlePhoneChange = (text: string, field: 'primary' | 'alternate') => {
    // Only allow digits, spaces, hyphens, and parentheses
    const cleanedText = text.replace(/[^\d\s\-\(\)]/g, '');
    
    if (field === 'primary') {
      setPhone(cleanedText);
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: '' }));
      }
    } else {
      setAlternatePhone(cleanedText);
      if (errors.alternatePhone) {
        setErrors(prev => ({ ...prev, alternatePhone: '' }));
      }
    }
    
    // Real-time validation feedback
    if (cleanedText.length > 0 && !validatePhone(cleanedText)) {
      const cleanPhone = cleanedText.replace(/\D/g, '');
      const errorMessage =
        cleanPhone.length < 7
          ? 'Phone number must be at least 7 digits'
          : cleanPhone.length > 15
            ? 'Phone number must be no more than 15 digits'
            : 'Please enter a valid phone number (7-15 digits)';

      if (field === 'primary') {
        setErrors(prev => ({ ...prev, phone: errorMessage }));
      } else {
        setErrors(prev => ({ ...prev, alternatePhone: errorMessage }));
      }
    }
  };

  // Ensure we have a userId, first from route params, then from AsyncStorage
  // Also load user data (name, email) from AsyncStorage
  useEffect(() => {
    const getUserIdAndUserData = async () => {
      try {
        // If userId already exists (from route.params), no need to get from storage
        if (userId) {
          console.log('Using userId from route params:', userId);
        } else {
          // Try to get userId from AsyncStorage
          const storedUserId = await AsyncStorage.getItem('tempUserId');
          if (storedUserId) {
            console.log('Retrieved userId from AsyncStorage:', storedUserId);
            setUserId(storedUserId);
          } else {
            console.error('No userId found in route params or AsyncStorage');
            setIdError('User ID not found. Please try signing up again.');
            return;
          }
        }

        // Load user data from AsyncStorage (userData from login/signup)
        // This contains name, email, etc. from the signup/login process
        try {
          const userDataString = await AsyncStorage.getItem('userData');
          if (userDataString) {
            const userData = JSON.parse(userDataString);
            console.log('Loaded user data from AsyncStorage:', userData);
            
            // Set user name and email for display
            if (userData.name) {
              setUserName(userData.name);
            }
            if (userData.surname) {
              setUserSurname(userData.surname);
            }
            if (userData.email) {
              setUserEmail(userData.email);
              // Also store in tempUserEmail if not already there (for backend call)
              const existingTempEmail = await AsyncStorage.getItem('tempUserEmail');
              if (!existingTempEmail && userData.email) {
                await AsyncStorage.setItem('tempUserEmail', userData.email);
              }
            }
          } else {
            // Try to get email from tempUserEmail as fallback
            const tempEmail = await AsyncStorage.getItem('tempUserEmail');
            if (tempEmail) {
              setUserEmail(tempEmail);
            }
          }
        } catch (userDataError) {
          console.error('Error loading user data:', userDataError);
          // Not critical - continue without user data display
        }

        // Load OAuth prefill data if available (from OAuth sign-in)
        try {
          const oauthPrefillDataString = await AsyncStorage.getItem('oauthPrefillData');
          if (oauthPrefillDataString) {
            const oauthPrefillData = JSON.parse(oauthPrefillDataString);
            console.log('Loaded OAuth prefill data from AsyncStorage:', oauthPrefillData);
            
            // Prefill name fields if available and not already set
            if (oauthPrefillData.givenName && !userName) {
              setUserName(oauthPrefillData.givenName);
              console.log('Prefilled userName from OAuth:', oauthPrefillData.givenName);
            }
            if (oauthPrefillData.familyName && !userSurname) {
              setUserSurname(oauthPrefillData.familyName);
              console.log('Prefilled userSurname from OAuth:', oauthPrefillData.familyName);
            }
            
            // Store OAuth picture URL for prefill (but don't set as profileImage yet)
            if (oauthPrefillData.picture) {
              setOauthPrefillImage(oauthPrefillData.picture);
              // Set as default profile image if user hasn't picked one yet
              setProfileImage(oauthPrefillData.picture);
              console.log('Prefilled profile image from OAuth:', oauthPrefillData.picture);
            }
          }
        } catch (oauthPrefillError) {
          console.error('Error loading OAuth prefill data:', oauthPrefillError);
          // Not critical - continue without OAuth prefill
        }
      } catch (error) {
        console.error('Error retrieving userId:', error);
        setIdError('Error retrieving user data. Please try again.');
      }
    };

    getUserIdAndUserData();
  }, [userId]);

  useEffect(() => {
    // Load stored image URIs if they exist
    const loadStoredImages = async () => {
      try {
        const storedImages = await AsyncStorage.getItem('tempUserImages');
        if (storedImages) {
          const { profileImage, companyLogo } = JSON.parse(storedImages);
          setProfileImage(profileImage);
          setCompanyLogo(companyLogo);
        }
      } catch (error) {
        console.error('Error loading stored images:', error);
      }
    };

    loadStoredImages();
  }, []);

  const handleImagePick = async () => {
    // Check if we have a userId before allowing image upload
    if (!userId) {
      Alert.alert('Error', 'Cannot upload images without a user ID. Please try signing up again.');
      return;
    }

    // First check if permissions are already granted
    const currentPermissions = await checkPermissions();
    
    if (!currentPermissions.cameraGranted || !currentPermissions.galleryGranted) {
      // Need to request permissions
      const { cameraGranted, galleryGranted } = await requestPermissions();
      
      if (!cameraGranted || !galleryGranted) {
        Alert.alert(
          'Permission Required', 
          'XSCard needs camera and photo library access to let you add profile pictures and company logos to your digital business card. This helps create a professional appearance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }
    }

    Alert.alert(
      'Select Profile Picture',
      'Choose where you want to get your profile picture from. This will be displayed on your digital business card.',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const imageUri = await pickImage(true);
            if (imageUri) {
              setProfileImage(imageUri);
              // Clear OAuth prefill image if user picks their own
              setOauthPrefillImage(null);
            }
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const imageUri = await pickImage(false);
            if (imageUri) {
              setProfileImage(imageUri);
              // Clear OAuth prefill image if user picks their own
              setOauthPrefillImage(null);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleLogoUpload = async () => {
    // Check if we have a userId before allowing image upload
    if (!userId) {
      Alert.alert('Error', 'Cannot upload images without a user ID. Please try signing up again.');
      return;
    }

    // First check if permissions are already granted
    const currentPermissions = await checkPermissions();
    
    if (!currentPermissions.cameraGranted || !currentPermissions.galleryGranted) {
      // Need to request permissions
      const { cameraGranted, galleryGranted } = await requestPermissions();
      
      if (!cameraGranted || !galleryGranted) {
        Alert.alert(
          'Permission Required', 
          'XSCard needs camera and photo library access to let you add profile pictures and company logos to your digital business card. This helps create a professional appearance.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Settings', 
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }
    }

    Alert.alert(
      'Select Company Logo',
      'Choose where you want to get your company logo from. This will be displayed on your digital business card.',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const imageUri = await pickImage(true);
            if (imageUri) setCompanyLogo(imageUri);
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const imageUri = await pickImage(false);
            if (imageUri) setCompanyLogo(imageUri);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Validate the form fields
  const validateForm = () => {
    let isValid = true;
    const newErrors = {
      phone: '',
    alternatePhone: '',
      occupation: '',
      company: ''
    };

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
      isValid = false;
    } else if (!validatePhone(phone)) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 7) {
        newErrors.phone = 'Phone number must be at least 7 digits';
      } else if (cleanPhone.length > 15) {
        newErrors.phone = 'Phone number must be no more than 15 digits';
      } else {
        newErrors.phone = 'Please enter a valid phone number (7-15 digits)';
      }
      isValid = false;
    }

  if (alternatePhone.trim() && !validatePhone(alternatePhone)) {
    const cleanPhone = alternatePhone.replace(/\D/g, '');
    if (cleanPhone.length < 7) {
      newErrors.alternatePhone = 'Alternate number must be at least 7 digits';
    } else if (cleanPhone.length > 15) {
      newErrors.alternatePhone = 'Alternate number must be no more than 15 digits';
    } else {
      newErrors.alternatePhone = 'Please enter a valid alternate number (7-15 digits)';
      }
      isValid = false;
    }

    if (!occupation.trim()) {
      newErrors.occupation = 'Occupation is required';
      isValid = false;
    }

    if (!company.trim()) {
      newErrors.company = 'Company name is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleUploadImages = async () => {
    // Check for userId first
    if (!userId) {
      console.error('No userId available for upload');
      
      // Try one more time to get it from AsyncStorage
      try {
        const storedUserId = await AsyncStorage.getItem('tempUserId');
        if (storedUserId) {
          console.log('Retrieved userId from AsyncStorage on last attempt:', storedUserId);
          setUserId(storedUserId);
          
          // Show alert but let user try again
          Alert.alert(
            'User ID Retrieved',
            'Your user ID was found in storage. Please try uploading again.',
            [{ text: 'OK' }]
          );
          return;
        } else {
          Alert.alert('Error', 'User ID not found. Please try signing up again.');
          return;
        }
      } catch (error) {
        console.error('Final attempt to get userId failed:', error);
        Alert.alert('Error', 'User ID not found. Please try signing up again.');
        return;
      }
    }

    // Validate form fields
    if (!validateForm()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setIsLoading(true);

    try {
      // Get email from AsyncStorage as a backup
      const email = await AsyncStorage.getItem('tempUserEmail');
      
      console.log(`UPLOAD ATTEMPT - Using userId: ${userId} and email: ${email}`);
      
      // Create FormData with the selected images and other fields
      const formData = new FormData();
      
      // First field MUST be userId - add it clearly
      formData.append('userId', userId); // ADD USER ID EXPLICITLY
      if (email) {
        formData.append('email', email); // ADD EMAIL EXPLICITLY
      }
      
      // Add images
      if (profileImage) {
        const imageName = profileImage.split('/').pop() || 'profile.jpg';
        formData.append('profileImage', {
          uri: profileImage,
          type: 'image/jpeg',
          name: imageName,
        } as any);
        console.log('Added profile image to form data:', imageName);
      } else {
        console.log('No profile image to upload');
      }

      if (companyLogo) {
        const logoName = companyLogo.split('/').pop() || 'logo.jpg';
        formData.append('companyLogo', {
          uri: companyLogo,
          type: 'image/jpeg',
          name: logoName,
        } as any);
        console.log('Added company logo to form data:', logoName);
      } else {
        console.log('No company logo to upload');
      }

      // Add other user data
      formData.append('phone', `${countryCode}${phone}`);
      formData.append('alternatePhone', alternatePhone ? `${alternateCountryCode}${alternatePhone}` : '');
      formData.append('occupation', occupation);
      formData.append('company', company);

      // Add userId again to make sure it's included
      formData.append('uid', userId);
      
      // Create URL with userId explicitly in query parameters too
      const endpoint = `${buildUrl(ENDPOINTS.UPLOAD_USER_IMAGES.replace(':userId', userId))}?userId=${userId}`;
      console.log('ENDPOINT WITH USERID:', endpoint);
      
      // Log FormData for debugging
      console.log('FormData created with fields for userId:', userId);
      // We can't easily log FormData contents due to its structure

      // Upload images and create card
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          // Don't set Content-Type for FormData with files - React Native will set it automatically with the correct boundary
          'Accept': 'application/json',
        },
        body: formData,
      });

      // Check response
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
          console.error('SERVER ERROR:', JSON.stringify(errorData));
        } catch (jsonError) {
          console.error('Could not parse error response as JSON');
          errorData = { message: 'Unknown server error' };
        }
        throw new Error(errorData.message || 'Failed to create your card');
      }

      // Handle success
      console.log('UPLOAD SUCCESS!');
      
      // Clean up temporary storage
      await AsyncStorage.removeItem('tempUserId');
      await AsyncStorage.removeItem('tempUserEmail');
      await AsyncStorage.removeItem('tempUserImages');
      await AsyncStorage.removeItem('oauthPrefillData'); // Clean up OAuth prefill data

      // Navigate to main app
      Alert.alert(
        'Profile Complete',
        'Your business card has been created successfully!',
        [{ text: 'Get Started', onPress: () => navigation.navigate('SignIn') }]
      );
    } catch (error) {
      console.error('UPLOAD ERROR:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create your business card'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    // Check for userId first
    if (!userId) {
      Alert.alert('Error', 'User ID not found. Please try signing up again.');
      return;
    }

    // Validate form fields
    if (!validateForm()) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    setIsSkipping(true);
    
    try {
      // Get email from AsyncStorage as a backup
      const email = await AsyncStorage.getItem('tempUserEmail');
      
      console.log(`SKIP UPLOAD - Using userId: ${userId} and email: ${email}`);
      
      // Create object with required fields - INCLUDE USER ID EXPLICITLY
      const requestData = {
        userId: userId,
        email: email || '', // Include email as well
        phone: phone ? `${countryCode}${phone}` : '',
        alternatePhone: alternatePhone ? `${alternateCountryCode}${alternatePhone}` : '',
        occupation: occupation || '',
        company: company || '',
        uid: userId // Add uid as an alternative
      };

      // Create URL with userId explicitly in query parameters too
      const endpoint = `${buildUrl(ENDPOINTS.UPLOAD_USER_IMAGES.replace(':userId', userId))}?userId=${userId}`;
      console.log('ENDPOINT WITH USERID:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      // Check response
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('SERVER ERROR:', JSON.stringify(errorData));
        throw new Error(errorData.message || 'Failed to create your card');
      }
      
      // Handle success
      console.log('SKIP UPLOAD SUCCESS!');

      // Clean up temporary storage
      await AsyncStorage.removeItem('tempUserId');
      await AsyncStorage.removeItem('tempUserEmail');
      await AsyncStorage.removeItem('tempUserImages');
      await AsyncStorage.removeItem('oauthPrefillData'); // Clean up OAuth prefill data
      
      // Navigate to main app
      Alert.alert(
        'Profile Complete',
        'Your business card has been created successfully!',
        [{ text: 'Get Started', onPress: () => navigation.navigate('SignIn') }]
      );
    } catch (error) {
      console.error('SKIP ERROR:', error);
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create your business card'
      );
    } finally {
      setIsSkipping(false);
    }
  };

  // Add useEffect to retrieve and store user token if available during sign-up
  useEffect(() => {
    const getUserToken = async () => {
      try {
        // Check for any token that might have been obtained during signup
        const emailItem = await AsyncStorage.getItem('tempUserEmail');
        if (emailItem) {
          console.log('User email found in storage:', emailItem);
        }
      } catch (error) {
        console.error('Error retrieving token:', error);
      }
    };

    getUserToken();
  }, []);

  // In case of user ID error, show a user-friendly message
  if (idError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="red" />
          <Text style={styles.errorTitle}>User ID Error</Text>
          <Text style={styles.errorMessage}>{idError}</Text>
          <TouchableOpacity 
            style={styles.signUpButton}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.signUpButtonText}>Go Back to Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.stepIndicator}>
            <View style={styles.stepCompleted}>
              <Text style={styles.stepActiveText}>1</Text>
              <MaterialIcons name="check" size={20} color={COLORS.white} />
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepActive}>
              <Text style={styles.stepActiveText}>2</Text>
            </View>
          </View>
          
          <Text style={styles.title}>Complete Your Profile</Text>
          {userName || userSurname || userEmail ? (
            <View style={styles.userInfoContainer}>
              {(userName || userSurname) ? (
                <Text style={styles.userName}>
                  Welcome back, {userName}{userSurname ? ` ${userSurname}` : ''}!
                </Text>
              ) : null}
              {userEmail ? (
                <Text style={styles.userEmail}>{userEmail}</Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.subtitle}>
            Add your details to create your digital business card.
          </Text>

          {/* Business Information Fields */}
          <View style={styles.phoneContainer}>
            <TouchableOpacity 
              style={[styles.countryCodeButton, errors.phone ? styles.inputError : null]}
              onPress={() => {
                setCountrySelectorTarget('primary');
                setShowCountryModal(true);
              }}
            >
              <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
              <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
              <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
            </TouchableOpacity>
            <TextInput
              style={[styles.phoneInput, errors.phone ? styles.inputError : null]}
              placeholder="Phone number"
              value={phone}
              onChangeText={text => handlePhoneChange(text, 'primary')}
              keyboardType="phone-pad"
              placeholderTextColor="#999"
              maxLength={15}
            />
          </View>
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

          <TouchableOpacity
            style={styles.alternateToggle}
            onPress={() =>
              setIsAlternateExpanded(prev => {
                const next = !prev;
                if (!next) {
                  setErrors(current => ({ ...current, alternatePhone: '' }));
                }
                return next;
              })
            }
          >
            <View style={styles.alternateToggleContent}>
              <MaterialIcons
                name={isAlternateExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color={COLORS.primary}
              />
              <Text style={styles.alternateToggleText}>
                {isAlternateExpanded ? 'Hide alternate number' : 'Add alternate number'}
              </Text>
            </View>
            {alternatePhone ? (
              <Text style={styles.alternateSummary}>
                {`${alternateCountryCode}${alternatePhone}`}
              </Text>
            ) : null}
          </TouchableOpacity>

          {isAlternateExpanded ? (
            <>
              <View style={styles.phoneContainer}>
                <TouchableOpacity
                  style={[styles.countryCodeButton, errors.alternatePhone ? styles.inputError : null]}
                  onPress={() => {
                    setCountrySelectorTarget('alternate');
                    setShowCountryModal(true);
                  }}
                >
                  <Text style={styles.countryFlag}>{alternateSelectedCountry.flag}</Text>
                  <Text style={styles.countryCodeText}>{alternateSelectedCountry.code}</Text>
                  <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
                </TouchableOpacity>
                <TextInput
                  style={[styles.phoneInput, errors.alternatePhone ? styles.inputError : null]}
                  placeholder="Alternate phone number"
                  value={alternatePhone}
                  onChangeText={text => handlePhoneChange(text, 'alternate')}
                  keyboardType="phone-pad"
                  placeholderTextColor="#999"
                  maxLength={15}
                />
              </View>
              {errors.alternatePhone ? <Text style={styles.errorText}>{errors.alternatePhone}</Text> : null}
            </>
          ) : null}

          <TextInput
            style={[styles.input, errors.occupation ? styles.inputError : null]}
            placeholder="Occupation"
            value={occupation}
            onChangeText={(text) => {
              setOccupation(text);
              setErrors(prev => ({ ...prev, occupation: '' }));
            }}
            placeholderTextColor="#999"
          />
          {errors.occupation ? <Text style={styles.errorText}>{errors.occupation}</Text> : null}

          <TextInput
            style={[styles.input, errors.company ? styles.inputError : null]}
            placeholder="Company name"
            value={company}
            onChangeText={(text) => {
              setCompany(text);
              setErrors(prev => ({ ...prev, company: '' }));
            }}
            placeholderTextColor="#999"
          />
          {errors.company ? <Text style={styles.errorText}>{errors.company}</Text> : null}

          {/* Image Upload Section */}
          <View style={styles.imageSection}>
            <Text style={styles.sectionHeader}>Profile Images</Text>
            <Text style={styles.sectionDescription}>
              Add your profile picture and company logo to enhance your digital business card.
            </Text>
            <View style={styles.imageButtonsRow}>
              <TouchableOpacity 
                style={styles.imageButton}
                onPress={handleImagePick}
                disabled={isLoading}
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
                disabled={isLoading}
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

          {/* Action Buttons */}
          <TouchableOpacity 
            style={[styles.signUpButton, isLoading && styles.disabledButton]}
            onPress={handleUploadImages}
            disabled={isLoading}
          >
            <Text style={styles.signUpButtonText}>
              {isLoading ? 'Creating Card...' : 'Complete Profile'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.skipButton, (isLoading || isSkipping) && styles.disabledButton]} 
            onPress={() => {
              if (validateForm()) {
                handleSkip();
              } else {
                Alert.alert('Missing Information', 'Please fill in all required fields.');
              }
            }}
            disabled={isLoading || isSkipping}
          >
            <Text style={styles.skipButtonText}>
              {isSkipping ? 'Processing...' : 'Skip Image Upload'}
            </Text>
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowCountryModal(false);
          setCountrySearch('');
          setCountrySelectorTarget('primary');
        }}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                onPress={() => {
                  setShowCountryModal(false);
                  setCountrySearch('');
                setCountrySelectorTarget('primary');
                }}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {/* Search Bar */}
            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search countries..."
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholderTextColor="#999"
              />
            </View>
            
            <FlatList
              data={COUNTRIES.filter(country => 
                country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                country.code.includes(countrySearch)
              )}
              keyExtractor={(item, index) => `${item.code}-${index}`}
              renderItem={({ item }) => {
                const isSelected =
                  countrySelectorTarget === 'primary'
                    ? selectedCountry.code === item.code && selectedCountry.name === item.name
                    : alternateSelectedCountry.code === item.code && alternateSelectedCountry.name === item.name;

                return (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                      isSelected && styles.selectedCountryItem
                  ]}
                  onPress={() => {
                      if (countrySelectorTarget === 'primary') {
                    setSelectedCountry(item);
                    setCountryCode(item.code);
                      } else {
                        setAlternateSelectedCountry(item);
                        setAlternateCountryCode(item.code);
                      }
                    setShowCountryModal(false);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <View style={styles.countryItemInfo}>
                    <Text style={styles.countryItemName}>{item.name}</Text>
                    <Text style={styles.countryItemCode}>{item.code}</Text>
                  </View>
                    {isSelected && (
                    <MaterialIcons name="check" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
                );
              }}
              style={styles.countryList}
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
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
    padding: 20,
    paddingTop: 60,
    paddingBottom: 100,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  stepCompleted: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00C851',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#00C851',
    marginHorizontal: 10,
  },
  stepActive: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepActiveText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  userInfoContainer: {
    backgroundColor: '#F0F7FF',
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    marginTop: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E8F0',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#666',
  },
  devInfo: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
    alignItems: 'center',
  },
  devInfoText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 15,
  },
  alternateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 5,
    marginBottom: 10,
  },
  alternateToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alternateToggleText: {
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  alternateSummary: {
    fontSize: 14,
    color: '#666',
  },
  imageSection: {
    backgroundColor: '#f5f5f5',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
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
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  signUpButton: {
    backgroundColor: '#1E1B4B',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  signUpButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  skipButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  },
  skipButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    opacity: 0.7,
    backgroundColor: '#999',
  },
  bottomPadding: {
    height: 50,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 10,
  },
  errorMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  // Phone container and country code styles
  phoneContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  countryCodeButton: {
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    marginRight: 5,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    padding: 15,
    fontSize: 16,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  countryList: {
    flex: 1,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedCountryItem: {
    backgroundColor: '#F0F8FF',
  },
  countryItemFlag: {
    fontSize: 24,
    marginRight: 15,
  },
  countryItemInfo: {
    flex: 1,
  },
  countryItemName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  countryItemCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
}); 