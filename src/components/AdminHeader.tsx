import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AdminTabParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, performServerLogout } from '../utils/api';
import { useAuth } from '../context/AuthContext';

type AdminHeaderNavigationProp = BottomTabNavigationProp<AdminTabParamList>;

type AdminHeaderProps = {
  title: string;
};

export default function AdminHeader({ title }: AdminHeaderProps) {
  const navigation = useNavigation<any>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const { logout } = useAuth(); // Use our centralized auth context

  const handleNavigate = (screen: string) => {
    setIsMenuVisible(false);
    if (screen === 'Cards') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });
    } else {
      navigation.navigate(screen);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('AdminHeader: Starting logout process...');
      setIsMenuVisible(false); // Close menu immediately
      
      // Perform server logout first (non-blocking)
      try {
        await performServerLogout();
      } catch (serverError) {
        console.log('AdminHeader: Server logout failed, continuing with local logout:', serverError);
        // Continue with local logout even if server logout fails
      }
      
      // Use our centralized logout from AuthContext
      await logout();
      
      console.log('AdminHeader: Logout completed, navigating to SignIn');
      
      // Navigate to SignIn
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' as keyof AdminTabParamList }],
      });
      
    } catch (error) {
      console.error('AdminHeader: Error during logout:', error);
      
      // If everything fails, still try to navigate to sign in
      Alert.alert(
        'Logout Error', 
        'There was an issue logging out. You will be redirected to the sign-in screen.',
        [
          {
            text: 'OK',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'SignIn' as keyof AdminTabParamList }],
              });
            }
          }
        ]
      );
    }
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.icon}
          onPress={() => setIsMenuVisible(true)}
        >
          <MaterialIcons name="menu" size={24} color={COLORS.white} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.iconContainer}>
          <TouchableOpacity style={styles.icon}>
            <MaterialIcons name="notifications" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Cards')}
            >
              <MaterialIcons name="credit-card" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Cards</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Analytics')}
            >
              <MaterialIcons name="dashboard" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Calendar')}
            >
              <MaterialIcons name="calendar-today" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {
                handleLogout();
              }}
            >
              <MaterialIcons name="logout" size={24} color={COLORS.error} />
              <Text style={[styles.menuText, { color: COLORS.error }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.secondary,
    zIndex: 1,
  },
  titleContainer: {
    paddingTop: 52,
    position: 'absolute',
    left: '55%',
    transform: [{ translateX: '-50%' }],
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  icon: {
    width: 24,
    height: 24,
    marginHorizontal: 4,
  },
  iconContainer: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContainer: {
    position: 'absolute',
    top: 100,
    left: 20,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
  },
});