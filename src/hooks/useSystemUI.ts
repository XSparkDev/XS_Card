import { useEffect } from 'react';
import { Platform, StatusBar } from 'react-native';

export const useSystemUI = () => {
  useEffect(() => {
    if (Platform.OS === 'android') {
      // Configure status bar to work with hidden navigation bar
      StatusBar.setHidden(false, 'fade');
      StatusBar.setBackgroundColor('transparent', true);
      StatusBar.setTranslucent(true);
      StatusBar.setBarStyle('dark-content', true);
      
      console.log('System UI: Configured for Android with hidden navigation bar');
    }
  }, []);
};
