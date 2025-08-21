import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image, ScrollView, SafeAreaView, Alert, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../../constants/colors';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../../types';
import { API_BASE_URL, ENDPOINTS, buildUrl } from '../../utils/api';
import * as ImagePicker from 'expo-image-picker';
import { pickImage, requestPermissions } from '../../utils/imageUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';

type CompleteProfileRouteProp = RouteProp<AuthStackParamList, 'CompleteProfile'>;
type CompleteProfileNavigationProp = StackNavigationProp<AuthStackParamList>;

export default function CompleteProfile() {
  const navigation = useNavigation<CompleteProfileNavigationProp>();
  const route = useRoute<CompleteProfileRouteProp>();
  const [userId, setUserId] = useState<string | null>(route.params?.userId || null);
  const [idError, setIdError] = useState<string | null>(null);
  
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [phone, setPhone] = useState('');
  const [occupation, setOccupation] = useState('');
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState({
    phone: '',
    occupation: '',
    company: ''
  });

  // Ensure we have a userId, first from route params, then from AsyncStorage
  useEffect(() => {
    const getUserId = async () => {
      try {
        // If userId already exists (from route.params), no need to get from storage
        if (userId) {
          console.log('Using userId from route params:', userId);
          return;
        }

        // Try to get userId from AsyncStorage
        const storedUserId = await AsyncStorage.getItem('tempUserId');
        if (storedUserId) {
          console.log('Retrieved userId from AsyncStorage:', storedUserId);
          setUserId(storedUserId);
        } else {
          console.error('No userId found in route params or AsyncStorage');
          setIdError('User ID not found. Please try signing up again.');
        }
      } catch (error) {
        console.error('Error retrieving userId:', error);
        setIdError('Error retrieving user data. Please try again.');
      }
    };

    getUserId();
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
              // This would typically open app settings, but we'll just show the alert
              Alert.alert(
                'Enable Permissions',
                'Please go to your device Settings > XSCard and enable Camera and Photos permissions to continue.'
              );
            }
          }
        ]
      );
      return;
    }

    Alert.alert(
      'Select Profile Picture',
      'Choose where you want to get your profile picture from. This will be displayed on your digital business card.',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const imageUri = await pickImage(true);
            if (imageUri) setProfileImage(imageUri);
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const imageUri = await pickImage(false);
            if (imageUri) setProfileImage(imageUri);
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
              // This would typically open app settings, but we'll just show the alert
              Alert.alert(
                'Enable Permissions',
                'Please go to your device Settings > XSCard and enable Camera and Photos permissions to continue.'
              );
            }
          }
        ]
      );
      return;
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
      occupation: '',
      company: ''
    };

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
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
      formData.append('phone', phone);
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
        phone: phone || '',
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
              <Text style={styles.stepActiveText}>2</Text>
              <MaterialIcons name="check" size={20} color={COLORS.white} />
            </View>
            <View style={styles.stepLine} />
            <View style={styles.stepActive}>
              <Text style={styles.stepActiveText}>2</Text>
            </View>
          </View>
          
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>
            Add your details to create your digital business card.
          </Text>

          {/* Business Information Fields */}
          <TextInput
            style={[styles.input, errors.phone ? styles.inputError : null]}
            placeholder="Phone number"
            value={phone}
            onChangeText={(text) => {
              setPhone(text);
              setErrors(prev => ({ ...prev, phone: '' }));
            }}
            keyboardType="phone-pad"
            placeholderTextColor="#999"
          />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}

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
}); 