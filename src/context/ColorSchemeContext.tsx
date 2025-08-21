import React, { createContext, useState, useContext, useEffect } from 'react';
import { COLORS } from '../constants/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ColorSchemeContextType {
  colorScheme: string;
  updateColorScheme: (newColor: string) => Promise<void>;
}

const ColorSchemeContext = createContext<ColorSchemeContextType>({
  colorScheme: COLORS.secondary,
  updateColorScheme: async () => {},
});

export const ColorSchemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [colorScheme, setColorScheme] = useState(COLORS.secondary);

  useEffect(() => {
    // Load saved color scheme on startup
    loadColorScheme();
  }, []);

  const loadColorScheme = async () => {
    try {
      const savedColor = await AsyncStorage.getItem('userColorScheme');
      if (savedColor) {
        setColorScheme(savedColor);
      }
    } catch (error) {
      console.error('Error loading color scheme:', error);
    }
  };

  const updateColorScheme = async (newColor: string) => {
    try {
      await AsyncStorage.setItem('userColorScheme', newColor);
      setColorScheme(newColor);
    } catch (error) {
      console.error('Error saving color scheme:', error);
    }
  };

  return (
    <ColorSchemeContext.Provider value={{ colorScheme, updateColorScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
};

export const useColorScheme = () => useContext(ColorSchemeContext);
