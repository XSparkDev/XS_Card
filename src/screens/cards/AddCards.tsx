import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../../types';
import { authenticatedFetchWithRefresh, ENDPOINTS, getUserId, buildUrl, API_BASE_URL } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pickImage, requestPermissions } from '../../utils/imageUtils';

type AddCardsNavigationProp = StackNavigationProp<RootStackParamList>;

export default function AddCards() {
  const navigation = useNavigation<AddCardsNavigationProp>();
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    occupation: '',
    company: '',
    email: '',
    phoneNumber: '',
  });
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

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

  const handleProfileImagePick = async () => {
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
      form.append('phone', formData.phoneNumber);
      form.append('title', formData.occupation);
      form.append('name', formData.firstName);
      form.append('surname', formData.lastName);

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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 30 : 0}
      >
        <ScrollView 
          style={styles.content}
          contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 20 : 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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

          {/* Personal Details Section */}
          <Text style={styles.sectionTitle}>Personal details</Text>
          <View style={styles.form}>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter first name"
                placeholderTextColor="#999"
                value={formData.firstName}
                onChangeText={(text) => setFormData({...formData, firstName: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Last Name *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter last name"
                placeholderTextColor="#999"
                value={formData.lastName}
                onChangeText={(text) => setFormData({...formData, lastName: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Occupation *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter occupation"
                placeholderTextColor="#999"
                value={formData.occupation}
                onChangeText={(text) => setFormData({...formData, occupation: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company Name *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter company name"
                placeholderTextColor="#999"
                value={formData.company}
                onChangeText={(text) => setFormData({...formData, company: text})}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter email address"
                placeholderTextColor="#999"
                value={formData.email}
                onChangeText={(text) => setFormData({...formData, email: text})}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput 
                style={styles.input}
                placeholder="Enter phone number"
                placeholderTextColor="#999"
                value={formData.phoneNumber}
                onChangeText={(text) => setFormData({...formData, phoneNumber: text})}
                keyboardType="phone-pad"
              />
            </View>
                      </View>
          </ScrollView>

          {/* Add Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
              <Text style={styles.addButtonText}>Add Card</Text>
            </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>
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
    marginTop: 150,
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
    gap: 12,
  },
  inputGroup: {
    marginBottom: 0,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.white,
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
    backgroundColor: COLORS.white,
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
