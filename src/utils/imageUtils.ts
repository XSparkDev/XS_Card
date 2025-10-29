import { launchCamera, launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { API_BASE_URL } from './api';
import { Platform, PermissionsAndroid, Alert } from 'react-native';

export const checkPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      // Check current permission status first
      const cameraStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      
      // Check storage permission based on Android version
      let storageStatus = false;
      try {
        // Try READ_MEDIA_IMAGES first (Android 13+)
        storageStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);
      } catch (error) {
        // Fallback to READ_EXTERNAL_STORAGE for older Android versions
        try {
          storageStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        } catch (fallbackError) {
          console.warn('Could not check storage permissions:', fallbackError);
          storageStatus = false;
        }
      }

      return {
        cameraGranted: cameraStatus,
        galleryGranted: storageStatus,
      };
    } else {
      // iOS permissions are handled automatically by react-native-image-picker
      return {
        cameraGranted: true,
        galleryGranted: true,
      };
    }
  } catch (error) {
    console.error('Error checking permissions:', error);
    return {
      cameraGranted: false,
      galleryGranted: false,
    };
  }
};

export const requestPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      // First check if permissions are already granted
      const currentPermissions = await checkPermissions();
      if (currentPermissions.cameraGranted && currentPermissions.galleryGranted) {
        return currentPermissions;
      }

      let cameraGranted = currentPermissions.cameraGranted;
      let galleryGranted = currentPermissions.galleryGranted;

      // Only request camera permission if not already granted
      if (!cameraGranted) {
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
        cameraGranted = cameraPermission === PermissionsAndroid.RESULTS.GRANTED;
      }

      // Only request storage permission if not already granted
      if (!galleryGranted) {
        let storagePermission = null;
        try {
          // Try READ_MEDIA_IMAGES first (Android 13+)
          storagePermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
            {
              title: 'Photo Library Permission',
              message: 'XSCard needs photo library access to select profile pictures and company logos.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            }
          );
        } catch (error) {
          // Fallback to READ_EXTERNAL_STORAGE for older Android versions
          try {
            storagePermission = await PermissionsAndroid.request(
              PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
              {
                title: 'Photo Library Permission',
                message: 'XSCard needs photo library access to select profile pictures and company logos.',
                buttonNeutral: 'Ask Me Later',
                buttonNegative: 'Cancel',
                buttonPositive: 'OK',
              }
            );
          } catch (fallbackError) {
            console.warn('Could not request storage permissions:', fallbackError);
            storagePermission = PermissionsAndroid.RESULTS.DENIED;
          }
        }
        galleryGranted = storagePermission === PermissionsAndroid.RESULTS.GRANTED;
      }

      return {
        cameraGranted,
        galleryGranted,
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