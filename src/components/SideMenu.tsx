/**
 * SideMenu
 *
 * The single, app-wide side navigation drawer. Used by every header (Header and
 * AdminHeader) so the menu looks and behaves identically on every page, with all
 * options always available. Parent components own the open/close state and render
 * <SideMenu visible={...} onClose={...} /> next to their menu (hamburger) button.
 */
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  StatusBar,
  Switch,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { COLORS } from '../constants/colors';
import { performServerLogout } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { usePremiumUpsell } from '../hooks/usePremiumUpsell';
import { useTooltipContext } from '../context/TooltipContext';

// Side-menu palette: near-black text on white with soft-gray icons.
const MENU_TEXT = '#1A1A1A';
const MENU_ICON = '#5A5A5A';

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function SideMenu({ visible, onClose }: SideMenuProps) {
  const navigation = useNavigation<any>();
  const { logout, user } = useAuth();
  const { triggerUpsell, isPremium, isLoadingUserStatus } = usePremiumUpsell();
  const { tooltipsEnabled, setTooltipsEnabled, resetTips } = useTooltipContext();

  // Only show premium lock badges once the plan is definitively known.
  const showLock = !isLoadingUserStatus && !isPremium;

  // Profile header info.
  const firstName = (user?.name || '').trim().split(' ')[0] || 'there';
  const profileEmail = user?.email || '';
  const profileInitial = ((user?.name || user?.email || '?').trim().charAt(0) || '?').toUpperCase();

  const handleResetTips = () => {
    Alert.alert(
      'Reset tips',
      'This will show all feature tips again. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => { resetTips(); } },
      ],
    );
  };

  // Walk up to the root navigator and reset to the auth flow — works from any
  // screen/navigator the menu is opened from.
  const resetToSignIn = () => {
    let currentNav: any = navigation;
    while (currentNav?.getParent && currentNav.getParent()) {
      currentNav = currentNav.getParent();
    }
    if (currentNav?.dispatch) {
      currentNav.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Auth', state: { index: 0, routes: [{ name: 'SignIn' }] } }],
        }),
      );
    } else {
      try { navigation.navigate('Auth'); } catch {}
    }
  };

  const handleLogout = async () => {
    try {
      onClose();
      try {
        await performServerLogout();
      } catch (serverError) {
        console.log('SideMenu: Server logout failed, continuing with local logout:', serverError);
      }
      await logout();
      resetToSignIn();
    } catch (error) {
      console.error('SideMenu: Error during logout:', error);
      Alert.alert(
        'Logout Error',
        'There was an issue logging out. You will be redirected to the sign-in screen.',
        [{ text: 'OK', onPress: resetToSignIn }],
      );
    }
  };

  const handleNavigate = (screenName: string, screen?: string) => {
    // Premium-gated items (Dashboard / Calendar): free users see the upsell and
    // the menu stays open behind it; premium users navigate after it animates out.
    if (screenName === 'AdminDashboard') {
      const isCalendar = screen === 'Calendar';
      const featureName = isCalendar ? 'Calendar' : 'Dashboard';
      const description = isCalendar
        ? 'The Calendar gives you full control over your event schedule. Upgrade to Premium to unlock it.'
        : 'The Dashboard provides analytics and insights about your cards and contacts. Upgrade to Premium to unlock it.';
      const icon = isCalendar ? 'calendar-clock' : 'chart-bar';
      const bodyText = isCalendar
        ? 'Never miss an event. You have contacts ready to create an appointment and send a real invite.'
        : undefined;
      if (triggerUpsell({ featureName, description, icon, bodyText })) return;
      onClose();
      setTimeout(() => {
        try {
          if (screen) {
            navigation.navigate('AdminDashboard', { screen });
          } else {
            navigation.navigate('AdminDashboard');
          }
        } catch (error) {
          console.error('Navigation error:', error);
          Alert.alert('Error', 'Failed to navigate. Please try again.');
        }
      }, 300);
      return;
    }

    // Non-gated items: close the menu, then navigate after the fade-out.
    onClose();
    setTimeout(() => {
      try {
        if (screenName === 'Cards' || screenName === 'Contacts') {
          navigation.navigate('MainTabs', { screen: screenName });
        } else {
          navigation.navigate(screenName);
        }
      } catch (error) {
        console.error('Navigation error:', error);
        Alert.alert('Error', 'Failed to navigate. Please try again.');
      }
    }, 300);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        {/* Tap outside the drawer to close */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.drawer}>
          {/* Profile header */}
          <View style={styles.profileHeader}>
            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profileInitial}</Text>
              </View>
              <View style={styles.profileTextWrap}>
                <Text style={styles.greeting} numberOfLines={1}>Hi {firstName}!</Text>
                {!!profileEmail && (
                  <Text style={styles.profileEmail} numberOfLines={1}>{profileEmail}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={22} color={MENU_ICON} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.menuScroll}
            contentContainerStyle={styles.menuList}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('AdminDashboard')}>
              <MaterialIcons name="dashboard" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Dashboard</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('Cards')}>
              <MaterialIcons name="credit-card" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Cards</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('Contacts')}>
              <MaterialIcons name="people" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Contacts</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('AdminDashboard', 'Calendar')}>
              <MaterialIcons name="calendar-today" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('Events')}>
              <MaterialIcons name="event" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Events</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('Settings')}>
              <MaterialIcons name="settings" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Settings</Text>
            </TouchableOpacity>

            {/* Premium upgrade — free users only */}
            {showLock && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  onClose();
                  setTimeout(() => {
                    try { navigation.navigate('UnlockPremium'); } catch {}
                  }, 300);
                }}
              >
                <MaterialIcons name="workspace-premium" size={22} color={COLORS.primary} />
                <Text style={[styles.menuText, { color: COLORS.primary }]}>Upgrade to Premium</Text>
              </TouchableOpacity>
            )}

            {/* ── Feature Tips controls ── */}
            <View style={styles.divider} />

            <View style={styles.menuItem}>
              <MaterialIcons name="lightbulb-outline" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Feature Tips</Text>
              <Switch
                value={tooltipsEnabled}
                onValueChange={setTooltipsEnabled}
                trackColor={{ false: COLORS.disabled, true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>

            <TouchableOpacity
              style={styles.resetTipsButton}
              onPress={handleResetTips}
              activeOpacity={0.7}
            >
              <Text style={styles.resetTipsText}>Reset tips</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <MaterialIcons name="logout" size={22} color={MENU_ICON} />
              <Text style={styles.menuText}>Log Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  // Full-height left drawer — white surface with a soft elevation shadow.
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '80%',
    maxWidth: 330,
    backgroundColor: COLORS.white,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 24 : 64,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECECEC',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
  },
  profileTextWrap: {
    flex: 1,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '700',
    color: MENU_TEXT,
  },
  profileEmail: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 2,
  },
  menuScroll: {
    flex: 1,
  },
  menuList: {
    paddingTop: 10,
    paddingBottom: 28,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 16,
  },
  menuText: {
    fontSize: 15,
    fontWeight: '500',
    color: MENU_TEXT,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ECECEC',
    marginVertical: 8,
    marginHorizontal: 20,
  },
  resetTipsButton: {
    paddingHorizontal: 20,
    paddingVertical: 6,
    alignItems: 'flex-start',
  },
  resetTipsText: {
    fontSize: 13,
    color: COLORS.gray,
  },
});
