import React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { COLORS } from '../constants/colors';
import { authenticatedFetchWithRefresh, ENDPOINTS, getUserId } from '../utils/api';
import { getImageUrl } from '../utils/imageUtils';

interface CardData {
  name: string;
  surname: string;
  profileImage?: string | null;
  company?: string;
  occupation?: string;
}

interface UserProfileData {
  id: string;
  fullName?: string;
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  plan?: string;
  company?: string;
  occupation?: string;
  bio?: string;
  organiserStatus?: string;
  active?: boolean;
  createdAt?: string;
  country?: string;
  city?: string;
  cards?: CardData[];
}

const formatPlan = (plan?: string) => {
  if (!plan) return 'Free';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
};

const formatStatus = (status?: string, fallback = 'Not available') => {
  if (!status) return fallback;
  return status
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

type TimestampValue = string | { _seconds: number; _nanoseconds?: number } | undefined | null;

const formatDate = (value?: TimestampValue) => {
  if (!value) return 'Not available';

  if (typeof value === 'string') {
    const dateFromString = new Date(value);
    if (!Number.isNaN(dateFromString.getTime())) {
      return dateFromString.toLocaleDateString();
    }
    return value;
  }

  if (typeof value === 'object' && '_seconds' in value) {
    const millis = value._seconds * 1000 + Math.floor((value._nanoseconds || 0) / 1_000_000);
    const dateFromTimestamp = new Date(millis);
    if (!Number.isNaN(dateFromTimestamp.getTime())) {
      return dateFromTimestamp.toLocaleDateString();
    }
  }

  return 'Not available';
};

const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || 'Not set'}</Text>
  </View>
);

export default function UserProfileScreen() {
  const [userData, setUserData] = React.useState<UserProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [avatarLoading, setAvatarLoading] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);

  const fetchProfile = React.useCallback(async () => {
    setLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        console.warn('UserProfileScreen: Missing user ID');
        return;
      }

      const response = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_USER}/${userId}`);
      if (response.ok) {
        const data = await response.json();
        const normalizedData: UserProfileData = {
          ...(data || {}),
          id: data?.id || userId,
        };
        setUserData(normalizedData);
        await AsyncStorage.setItem('userData', JSON.stringify(normalizedData));
      } else {
        console.warn('UserProfileScreen: Failed to fetch user profile', response.status);
      }

      setAvatarLoading(true);
      try {
        const cardResponse = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_CARD}/${userId}`);
        if (cardResponse.ok) {
          const cardPayload = await cardResponse.json();
          const cardsArray: CardData[] | undefined = cardPayload?.cards
            ? cardPayload.cards
            : Array.isArray(cardPayload)
              ? cardPayload
              : undefined;

          if (cardsArray) {
            const firstCard = cardsArray[0];
            setUserData(prev => (prev ? { ...prev, cards: cardsArray } : prev));
            if (firstCard?.profileImage) {
              setAvatarUrl(getImageUrl(firstCard.profileImage));
            } else {
              setAvatarUrl(null);
            }
          } else {
            setAvatarUrl(null);
          }
        } else {
          setAvatarUrl(null);
        }
      } catch (cardError) {
        console.error('UserProfileScreen: Failed to load cards for avatar', cardError);
        setAvatarUrl(null);
      } finally {
        setAvatarLoading(false);
      }
    } catch (error) {
      console.error('UserProfileScreen: Error loading profile data', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchProfile();
  }, [fetchProfile]);

  const fullNameFromFields = [userData?.name, userData?.surname]
    .filter(Boolean)
    .join(' ')
    .trim();

  const primaryCardFullName =
    userData?.cards && userData.cards[0]
      ? [userData.cards[0].name, userData.cards[0].surname].filter(Boolean).join(' ').trim()
      : '';

  const displayName =
    (userData?.fullName && userData.fullName.trim().length > 0 && userData.fullName) ||
    (fullNameFromFields.length > 0 ? fullNameFromFields : '') ||
    (primaryCardFullName.length > 0 ? primaryCardFullName : '') ||
    'User';

  const organiserStatus = formatStatus(userData?.organiserStatus, 'Not registered');

  const renderAvatar = () => {
    if (avatarLoading) {
      return (
        <View style={styles.profileAvatar}>
          <ActivityIndicator size="small" color={COLORS.white} />
        </View>
      );
    }

    if (avatarUrl) {
      return <Image source={{ uri: avatarUrl }} style={styles.profileAvatarImage} />;
    }

    return (
      <View style={styles.profileAvatar}>
        <MaterialIcons name="person" size={42} color={COLORS.white} />
      </View>
    );
  };

  if (loading && !userData && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Profile" />
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Profile" />
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[COLORS.secondary]}
          />
        }
      >
        <View style={styles.profileCard}>
          {renderAvatar()}
          <Text style={styles.profileName}>{displayName}</Text>
          <Text style={styles.profileEmail}>{userData?.email || 'No email provided'}</Text>
          <View style={[styles.planBadge, userData?.plan === 'premium' && styles.premiumBadge]}>
            <Text
              style={[
                styles.planBadgeText,
                userData?.plan === 'premium' && styles.premiumBadgeText,
              ]}
            >
              {formatPlan(userData?.plan)}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userData?.cards?.length ?? 0}</Text>
              <Text style={styles.statLabel}>Cards</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{formatStatus(userData?.organiserStatus, '—')}</Text>
              <Text style={styles.statLabel}>Organiser</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{userData?.active === false ? 'Inactive' : 'Active'}</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Details</Text>
          <InfoRow label="Full Name" value={displayName} />
          <InfoRow label="Email" value={userData?.email} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoRow label="Plan" value={formatPlan(userData?.plan)} />
          <InfoRow label="Account Status" value={userData?.active === false ? 'Deactivated' : 'Active'} />
          <InfoRow label="Organiser Status" value={organiserStatus} />
          <InfoRow label="Member Since" value={formatDate(userData?.createdAt)} />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 100,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  profileAvatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
    textAlign: 'center',
  },
  profileEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 12,
    textAlign: 'center',
  },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  planBadgeText: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  premiumBadge: {
    backgroundColor: COLORS.primary,
  },
  premiumBadgeText: {
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 12,
  },
  statCard: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 12,
  },
  infoRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.black,
  },
  cardPreview: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
  },
  bottomSpacer: {
    height: 80,
  },
});

