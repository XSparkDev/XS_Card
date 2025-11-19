import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Alert, Platform, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '../context/ColorSchemeContext';
import { API_BASE_URL, performServerLogout, authenticatedFetchWithRefresh, ENDPOINTS, getUserId } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Update this type to match your actual navigation type
type RootStackParamList = {
  MainTabs: undefined;
  AddCards: undefined;
  EditCard: undefined;
  SignIn: undefined;
  Auth: undefined;
  UnlockPremium: undefined;
  Cards: undefined;
  Events: undefined;
  Contacts: undefined;
  Settings: undefined;
  AdminDashboard: { screen?: 'Analytics' | 'Calendar' } | undefined;
  MainApp: undefined;
  EventPreferences: undefined;
  MyEvents: undefined;
};

interface HeaderProps {
  title: string;
  rightIcon?: React.ReactNode;
  showAddButton?: boolean;
}

export default function Header({ title, rightIcon, showAddButton = false }: HeaderProps) {
  const [userPlan, setUserPlan] = useState<string>('free');
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const { colorScheme } = useColorScheme();
  const { logout } = useAuth(); // Use our centralized auth context

  // 🔥 FIX: Enhanced plan checking with backend synchronization
  const syncUserPlan = async () => {
    try {
      // First, get cached plan from AsyncStorage
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const { plan } = JSON.parse(userData);
        setUserPlan(plan);
        console.log('Header: Loaded cached plan:', plan);
      }

        // Then, sync with backend to ensure accuracy
        // CENTRALIZED RBAC: Only check users.plan field from GET_USER endpoint
        try {
          // Get current user ID
          const userId = await getUserId();
          if (!userId) {
            console.log('Header: No user ID found, using cached plan');
            return;
          }
          
          // Get current user's data (not all users)
          const userResponse = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_USER}/${userId}`, {
            method: 'GET',
          });
          
          if (userResponse.ok) {
            const userResponseData = await userResponse.json();
            console.log('Header: User data check:', userResponseData);
            
            // Get plan from users collection (single source of truth)
            const actualPlan = userResponseData.plan || 'free';
            console.log(`Header: User plan from database: ${actualPlan}`);
            
            // Update UI immediately
            setUserPlan(actualPlan);
            
            // Update cached data if it's different
            if (userData) {
              const parsedUserData = JSON.parse(userData);
              if (parsedUserData.plan !== actualPlan) {
                console.log(`Header: Plan mismatch detected! Cached: ${parsedUserData.plan}, Actual: ${actualPlan}`);
                console.log('Header: Updating cached plan to match backend');
                
                parsedUserData.plan = actualPlan;
                await AsyncStorage.setItem('userData', JSON.stringify(parsedUserData));
                console.log('Header: Successfully updated cached plan');
              } else {
                console.log('Header: Cached plan matches backend plan');
              }
            }
          } else {
            console.log('Header: Could not check user data, using cached plan');
          }
        } catch (syncError) {
          console.log('Header: Sync failed, using cached plan:', syncError instanceof Error ? syncError.message : 'Unknown error');
          // Continue with cached plan if sync fails
        }
    } catch (error) {
      console.error('Header: Error in plan synchronization:', error);
    }
  };

  // Initial load
  useEffect(() => {
    syncUserPlan();
  }, []);

  // 🔥 CRITICAL FIX: Refresh plan when screen comes into focus
  // This ensures RBAC updates when database changes
  useFocusEffect(
    React.useCallback(() => {
      console.log('Header: Screen focused - refreshing user plan...');
      syncUserPlan();
    }, [])
  );

  const handleAddPress = () => {
    navigation.navigate('AddCards');
  };

  const handleEditPress = () => {
    navigation.navigate('EditCard');
  };

  const handleLogout = async () => {
    try {
      console.log('Header: Starting logout process...');
      setIsMenuVisible(false); // Close menu immediately
      
      // Perform server logout first (non-blocking)
      try {
        await performServerLogout();
      } catch (serverError) {
        console.log('Header: Server logout failed, continuing with local logout:', serverError);
        // Continue with local logout even if server logout fails
      }
      
      // Use our centralized logout from AuthContext
      await logout();
      
      console.log('Header: Logout completed, navigating to SignIn');
      
      // Navigate to Auth
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
      
    } catch (error) {
      console.error('Header: Error during logout:', error);
      
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
                routes: [{ name: 'Auth' }],
              });
            }
          }
        ]
      );
    }
  };

  const handleNavigate = async (screenName: keyof RootStackParamList, screen?: string) => {
    setIsMenuVisible(false);
    try {
      // For AdminDashboard, navigate with optional screen parameter
      if (screenName === 'AdminDashboard') {
        if (screen) {
          navigation.navigate('AdminDashboard', { screen: screen as 'Analytics' | 'Calendar' });
        } else {
          navigation.navigate('AdminDashboard');
        }
      } else if (screenName === 'Cards' || screenName === 'Contacts') {
        // For tab screens, navigate to MainTabs with the specific screen
        (navigation as any).navigate('MainTabs', { screen: screenName });
      } else {
        navigation.navigate(screenName);
      }
    } catch (error) {
      console.error('Navigation error:', error);
      Alert.alert('Error', 'Failed to navigate. Please try again.');
    }
  };

  return (
    <>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.icon}
          onPress={() => setIsMenuVisible(true)}
        >
          <Text style={styles.iconContainer}>
            <MaterialIcons name="menu" size={24} color={COLORS.white} />
          </Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.rightIconContainer}>
          {showAddButton && userPlan !== 'free' && userPlan !== 'enterprise' && (
            <TouchableOpacity style={styles.icon} onPress={handleAddPress}>
              <Text style={styles.iconContainer}>
                <MaterialIcons name="add" size={24} color={COLORS.white} />
              </Text>
            </TouchableOpacity>
          )}
          {rightIcon}
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
            {userPlan !== 'free' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('AdminDashboard')}
              >
                <MaterialIcons name="dashboard" size={24} color={COLORS.secondary} />
                <Text style={[styles.menuText, { color: COLORS.secondary }]}>Dashboard</Text>
              </TouchableOpacity>
            )}

            {userPlan !== 'free' && (
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={() => handleNavigate('AdminDashboard', 'Calendar')}
              >
                <MaterialIcons name="calendar-today" size={24} color={COLORS.secondary} />
                <Text style={[styles.menuText, { color: COLORS.secondary }]}>Calendar</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Cards')}
            >
              <MaterialIcons name="credit-card" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Cards</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Events')}
            >
              <MaterialIcons name="event" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Events</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Contacts')}
            >
              <MaterialIcons name="people" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Contacts</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => handleNavigate('Settings')}
            >
              <MaterialIcons name="settings" size={24} color={COLORS.secondary} />
              <Text style={[styles.menuText, { color: COLORS.secondary }]}>Settings</Text>
            </TouchableOpacity>



            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleLogout}
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 20 : 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.secondary,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  titleContainer: {
    paddingTop: 52,
    position: 'absolute',
    left: '55%',
    transform: [{ translateX: -50 }],
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
  rightIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '500',
    color: COLORS.secondary,
  },
});