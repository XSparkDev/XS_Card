import { launchCamera, launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { API_BASE_URL } from './api';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export const requestPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      // Request camera permission
      const cameraPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'XSCard needs camera access to take profile pictures and company logos.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      // Request storage permission (for Android 13+)
      const storagePermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        {
          title: 'Photo Library Permission',
          message: 'XSCard needs photo library access to select profile pictures and company logos.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return {
        cameraGranted: cameraPermission === PermissionsAndroid.RESULTS.GRANTED,
        galleryGranted: storagePermission === PermissionsAndroid.RESULTS.GRANTED,
      };
    } else {
      // iOS permissions are handled automatically by react-native-image-picker
      return {
        cameraGranted: true,
        galleryGranted: true,
      };
    }
  } catch (error) {
    console.error('Error requesting permissions:', error);
    return {
      cameraGranted: false,
      galleryGranted: false,
    };
  }
};

export const pickImage = async (useCamera: boolean = false): Promise<string | null> => {
  return new Promise((resolve) => {
    const options = {
      mediaType: 'photo' as MediaType, // Images only, no video
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1] as [number, number], // Square aspect ratio
    };

    const callback = (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        console.log('Image picker cancelled or error:', response.errorMessage);
        resolve(null);
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        if (asset.uri) {
          resolve(asset.uri);
        } else {
          console.error('No URI in selected asset');
          resolve(null);
        }
      } else {
        console.error('No assets in response');
        resolve(null);
      }
    };

    if (useCamera) {
      launchCamera(options, callback);
    } else {
      launchImageLibrary(options, callback);
    }
  });
};

/**
 * Gets the correct image URL regardless of storage location
 * Works with both Firebase Storage URLs and local server paths
 * 
 * @param {string} imageUri - The image URI from the database
 * @returns {string|null} - The full URL to the image or null if no image
 */
export const getImageUrl = (imageUri: string | undefined | null): string | null => {
  // Handle null, undefined, or empty string
  if (!imageUri || typeof imageUri !== 'string' || imageUri.trim() === '') {
    return null;
  }
  
  // Trim whitespace to prevent URI parsing issues
  const cleanUri = imageUri.trim();
  
  // If it's already a full URL (Firebase Storage), return as is
  if (cleanUri.startsWith('http://') || cleanUri.startsWith('https://')) {
    return cleanUri;
  }
  
  // Otherwise, it's a local path, prepend the API base URL
  // Ensure we don't double-slash
  const basePath = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const imagePath = cleanUri.startsWith('/') ? cleanUri.slice(1) : cleanUri;
  
  return `${basePath}${imagePath}`;
};