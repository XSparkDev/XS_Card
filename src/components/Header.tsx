import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '../context/ColorSchemeContext';
import { API_BASE_URL, performServerLogout, authenticatedFetchWithRefresh, ENDPOINTS } from '../utils/api';
import { useAuth } from '../context/AuthContext';

// Update this type to match your actual navigation type
type RootStackParamList = {
  MainTabs: undefined;
  AddCards: undefined;
  EditCard: undefined;
  SignIn: undefined;
  UnlockPremium: undefined;
  Cards: undefined;
  Events: undefined;
  Contacts: undefined;
  Settings: undefined;
  AdminDashboard: undefined;
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
  useEffect(() => {
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
        try {
          const response = await authenticatedFetchWithRefresh(ENDPOINTS.SUBSCRIPTION_STATUS, {
            method: 'GET',
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('Header: Subscription status check:', data);
            
            let actualPlan = 'free'; // Default
            
            // Check if user has active subscription
            if (data.status && data.data?.isActive) {
              actualPlan = 'premium';
              console.log('Header: User has active subscription status - setting to premium');
            }
            
            // 🔥 ADDITIONAL CHECK: Also check the user's plan field directly from GET_USER endpoint
            try {
              const userResponse = await authenticatedFetchWithRefresh(ENDPOINTS.GET_USER, {
                method: 'GET',
              });
              
              if (userResponse.ok) {
                const userResponseData = await userResponse.json();
                console.log('Header: User data check:', userResponseData);
                
                // Check if user data indicates premium plan
                const userPlan = userResponseData.user?.plan || userResponseData.plan;
                if (userPlan === 'premium' || userPlan === 'enterprise') {
                  actualPlan = userPlan;
                  console.log(`Header: User data shows plan: ${userPlan} - overriding subscription check`);
                }
              }
            } catch (userError) {
              console.log('Header: Could not fetch user data for plan check:', userError instanceof Error ? userError.message : 'Unknown error');
            }
            
            console.log('Header: Final determined plan:', actualPlan);
            
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
            console.log('Header: Could not check subscription status, using cached plan');
          }
        } catch (syncError) {
          console.log('Header: Sync failed, using cached plan:', syncError instanceof Error ? syncError.message : 'Unknown error');
          // Continue with cached plan if sync fails
        }
      } catch (error) {
        console.error('Header: Error in plan synchronization:', error);
      }
    };

    syncUserPlan();
  }, []);

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
      
      // Navigate to SignIn
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' }],
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
                routes: [{ name: 'SignIn' }],
              });
            }
          }
        ]
      );
    }
  };

  const handleNavigate = async (screenName: keyof RootStackParamList) => {
    setIsMenuVisible(false);
    try {
      // For AdminDashboard, just navigate directly
      if (screenName === 'AdminDashboard') {
        navigation.navigate('AdminDashboard');
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
            <MaterialIcons name="menu" size={24} color={COLORS.black} />
          </Text>
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
        </View>

        <View style={styles.rightIconContainer}>
          {showAddButton && userPlan !== 'free' && userPlan !== 'enterprise' && (
            <TouchableOpacity style={styles.icon} onPress={handleAddPress}>
              <Text style={styles.iconContainer}>
                <MaterialIcons name="add" size={24} color={COLORS.black} />
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
    paddingTop: 55,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.white,
    zIndex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    color: COLORS.black,
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