import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Modal, Alert, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { useMeetingNotifications } from '../context/MeetingNotificationContext';
import SideMenu from './SideMenu';
import ScanLimitBanner from './ScanLimitBanner';

type AdminHeaderProps = {
  title: string;
};

export default function AdminHeader({ title }: AdminHeaderProps) {
  const navigation = useNavigation<any>();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isNotificationsVisible, setIsNotificationsVisible] = useState(false);
  const { startingSoon, recentBookings } = useMeetingNotifications();
  const notificationCount = startingSoon.length + recentBookings.length;

  const handleNavigate = (screen: string) => {
    setIsMenuVisible(false);
    if (screen === 'Cards') {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainApp' }],
      });
    } else if (screen === 'Events') {
      navigation.navigate('Events');
    } else if (screen === 'ContactScreen') {
      navigation.navigate('MainTabs', { screen: 'Contacts' });
    } else if (screen === 'Settings') {
      navigation.navigate('Settings');
    } else {
      navigation.navigate(screen);
    }
  };

  return (
    <>
      <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
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
          <TouchableOpacity
            style={[styles.icon, styles.notificationIcon]}
            onPress={() => setIsNotificationsVisible(true)}
            disabled={notificationCount === 0 && startingSoon.length === 0 && recentBookings.length === 0}
          >
            <MaterialIcons name="notifications" size={24} color={COLORS.white} />
            {notificationCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>
                  {notificationCount > 9 ? '9+' : notificationCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Docks flush below this header's bottom edge while a free user is rate-limited */}
      <ScanLimitBanner top={headerHeight} />

      {/* Shared app-wide side menu */}
      <SideMenu visible={isMenuVisible} onClose={() => setIsMenuVisible(false)} />

      <Modal
        visible={isNotificationsVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsNotificationsVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsNotificationsVisible(false)}
        >
          <View style={styles.notificationContainer}>
            <View style={styles.notificationHeader}>
              <Text style={styles.notificationTitleText}>Notifications</Text>
              <TouchableOpacity onPress={() => setIsNotificationsVisible(false)}>
                <MaterialIcons name="close" size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {notificationCount === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="event-available" size={40} color={COLORS.secondary} />
                <Text style={styles.emptyStateText}>You’re all caught up</Text>
              </View>
            ) : (
              <ScrollView style={styles.notificationList}>
                {startingSoon.length > 0 && (
                  <View style={styles.notificationSection}>
                    <Text style={styles.sectionTitle}>Starting soon</Text>
                    {startingSoon.map(item => (
                      <View key={`soon-${item.id}`} style={styles.notificationItem}>
                        <View style={styles.notificationTextGroup}>
                          <Text style={styles.notificationItemTitle}>{item.title}</Text>
                          {item.formattedTime ? (
                            <Text style={styles.notificationItemSubtitle}>{item.formattedTime}</Text>
                          ) : null}
                          {item.meetingWith ? (
                            <Text style={styles.notificationItemSubtitle}>With {item.meetingWith}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => {
                            setIsNotificationsVisible(false);
                            handleNavigate('Calendar');
                          }}
                        >
                          <Text style={styles.viewButtonText}>View</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {recentBookings.length > 0 && (
                  <View style={styles.notificationSection}>
                    <Text style={styles.sectionTitle}>New bookings</Text>
                    {recentBookings.map(item => (
                      <View key={`recent-${item.id}`} style={styles.notificationItem}>
                        <View style={styles.notificationTextGroup}>
                          <Text style={styles.notificationItemTitle}>{item.title}</Text>
                          {item.formattedTime ? (
                            <Text style={styles.notificationItemSubtitle}>{item.formattedTime}</Text>
                          ) : null}
                          {item.meetingWith ? (
                            <Text style={styles.notificationItemSubtitle}>With {item.meetingWith}</Text>
                          ) : null}
                        </View>
                        <TouchableOpacity
                          style={styles.viewButton}
                          onPress={() => {
                            setIsNotificationsVisible(false);
                            handleNavigate('Calendar');
                          }}
                        >
                          <Text style={styles.viewButtonText}>Review</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}
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
    transform: [{ translateX: -50 }],
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Montserrat_700Bold',
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
  notificationIcon: {
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    paddingHorizontal: 4,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
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
  notificationContainer: {
    position: 'absolute',
    top: 90,
    right: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '85%',
    maxHeight: '60%',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  notificationList: {
    maxHeight: '100%',
  },
  notificationSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  notificationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  notificationTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  notificationItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  notificationItemSubtitle: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 2,
  },
  viewButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: COLORS.gray,
  },
});