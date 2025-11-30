import { launchCamera, launchImageLibrary, ImagePickerResponse, MediaType, PhotoQuality } from 'react-native-image-picker';
import { Platform, PermissionsAndroid } from 'react-native';

export const checkPermissions = async () => {
  try {
    if (Platform.OS === 'android') {
      // Check current permission status first
      const cameraStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
      const storageStatus = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES);

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
            message: 'XS Card needs camera access to take profile pictures and company logos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        cameraGranted = cameraPermission === PermissionsAndroid.RESULTS.GRANTED;
      }

      // Only request storage permission if not already granted
      if (!galleryGranted) {
        const storagePermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: 'Photo Library Permission',
            message: 'XS Card needs photo library access to select profile pictures and company logos.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
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

export const pickImage = async (useCamera: boolean): Promise<string | null> => {
  return new Promise((resolve) => {
    const options = {
      mediaType: 'photo' as MediaType, // Images only, no video
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 0.7 as PhotoQuality,
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