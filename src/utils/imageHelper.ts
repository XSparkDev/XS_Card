import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export const requestPermissions = async () => {
  const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
  const galleryPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  
  return {
    cameraGranted: cameraPermission.status === 'granted',
    galleryGranted: galleryPermission.status === 'granted',
  };
};

export const pickImage = async (useCamera: boolean) => {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  };

  try {
    const result = useCamera 
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (!result.canceled) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error) {
    console.error('Error picking image:', error);
    throw error;
  }
};
