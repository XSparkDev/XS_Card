import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from '../context/ColorSchemeContext';
import { authenticatedFetchWithRefresh, ENDPOINTS, getUserId } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { usePremiumUpsell } from '../hooks/usePremiumUpsell';
import { useTooltipContext } from '../context/TooltipContext';
import FeatureTip from './FeatureTip';
import SideMenu from './SideMenu';
import ScanLimitBanner from './ScanLimitBanner';

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
  /**
   * When set, the Add-card feature tip is held back until the tip with this key
   * has been dismissed. Lets a screen sequence the two header tips so they never
   * appear (and collide) at the same time.
   */
  deferAddTipUntil?: string;
}

export default function Header({ title, rightIcon, showAddButton = false, deferAddTipUntil }: HeaderProps) {
  const [userPlan, setUserPlan] = useState<string>('free');
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const { colorScheme } = useColorScheme();
  const { updateUserPlan } = useAuth(); // Use our centralized auth context
  const { triggerUpsell } = usePremiumUpsell();
  const { dismissedTips } = useTooltipContext();
  // Hold the Add-card tip back until the deferred-until tip (e.g. the Edit-card
  // tip on the Cards screen) has been dismissed, so the two header tooltips show
  // one at a time instead of overlapping.
  const deferAddTip = !!deferAddTipUntil && !dismissedTips[deferAddTipUntil];

  // 🔥 FIX: Enhanced plan checking with backend synchronization
  const syncUserPlan = async () => {
    try {
      // First, get cached plan from AsyncStorage
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const { plan } = JSON.parse(userData);
        setUserPlan(plan);
        // Converge AuthContext from cache immediately (no-op if unchanged)
        if (plan) updateUserPlan(plan);
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
            // Push the fresh backend plan into AuthContext so every premium
            // gate (upsell, lock icons) reads the correct value (no-op if same)
            updateUserPlan(actualPlan);
            
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
    if (triggerUpsell({ featureName: 'Add Card', description: 'Add Card lets you create multiple digital business cards. Upgrade to Premium to unlock this feature.' })) return;
    navigation.navigate('AddCards');
  };

  const handleEditPress = () => {
    navigation.navigate('EditCard');
  };

  return (
    <>
      <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
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
          {showAddButton && userPlan !== 'enterprise' && (
            <FeatureTip
              tipKey="home_add_button"
              content="Tap to add a new card"
              position="bottom"
              arrowAtAnchor
              suppressed={deferAddTip}
            >
              <TouchableOpacity style={styles.icon} onPress={handleAddPress}>
                <Text style={styles.iconContainer}>
                  <MaterialIcons name="add" size={24} color={COLORS.black} />
                </Text>
              </TouchableOpacity>
            </FeatureTip>
          )}
          {rightIcon}
        </View>
      </View>

      {/* Docks flush below this header's bottom edge while a free user is rate-limited */}
      <ScanLimitBanner top={headerHeight} />

      {/* Shared app-wide side menu */}
      <SideMenu visible={isMenuVisible} onClose={() => setIsMenuVisible(false)} />
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
    backgroundColor: COLORS.white,
    zIndex: 1,
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
    fontFamily: 'Montserrat_700Bold',
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
});