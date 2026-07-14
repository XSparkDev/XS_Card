import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Linking,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Share,
  Dimensions,
  Pressable,
  InteractionManager,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import RNShare from 'react-native-share';

// Local imports
import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import { useColorScheme } from '../../context/ColorSchemeContext';
import { RootStackParamList } from '../../types/navigation';
import { 
  API_BASE_URL, 
  ENDPOINTS, 
  getUserId, 
  authenticatedFetchWithRefresh,
  useToast 
} from '../../utils/api';
import { formatTimestamp } from '../../utils/dateFormatter';
import { AuthManager } from '../../utils/authManager';
import GradientAvatar from '../../components/GradientAvatar';
import { getPlanLimits, UserPlan } from '../../utils/userPlan';
import { usePremiumUpsell } from '../../hooks/usePremiumUpsell';
import FeatureTip from '../../components/FeatureTip';
import ContactDetailPanel from '../../components/ContactDetailPanel';
import AddContactPanel from '../../components/AddContactPanel';
import { tabBarScrollY } from '../../utils/tabBarScroll';

// Constants
const FREE_PLAN_CONTACT_LIMIT = 20;
const DEFAULT_COUNTRY_CODE = '+27'; // South Africa
// Blank manual-add form. Phone is pre-seeded with the default dialling code so the
// user only types the local part; a lone code is stripped back to empty on submit.
const EMPTY_ADD_CONTACT_FORM = {
  name: '',
  surname: '',
  email: '',
  company: '',
  phone: DEFAULT_COUNTRY_CODE + ' ',
  howWeMet: '',
};
// Which field carries the bold/primary emphasis on each contact card.
type ContactEmphasisField = 'name' | 'company';
const CONTACT_EMPHASIS_STORAGE_KEY = 'contacts_emphasis_field';

// Type definitions
interface Timestamp {
  seconds: number;
  nanoseconds?: number;
}

interface Contact {
  id?: string;
  name: string;
  surname: string;
  phone: string;
  email?: string;
  company?: string;
  howWeMet: string;
  createdAt: string | Timestamp;
  // Contact linking fields
  isXsCardUser?: boolean;
  sourceUserId?: string;
  sourceCardIndex?: number;
  profileImageUrl?: string; // Legacy single URL
  profileImageUrls?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
    original?: string;
  };
  linkedAt?: string;
  // Scanner geolocation captured at scan time (optional).
  location?: ContactLocation | null;
  locationCapturedAt?: string | null;
  // Follow-up campaign fields (set by publicContactService on QR scan).
  contactId?: string;
  followUpStatus?: 'active' | 'contacted' | 'not_interested' | 'completed' | 'cancelled';
}

interface ContactLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  formattedAddress?: string;
  city?: string;
  area?: string;
  country?: string;
  capturedAt?: string;
}

interface ContactData {
  id: string;
  contactList: Contact[];
}

interface UserData {
  id: string;
  plan: UserPlan;
  colorScheme?: string;
}

interface UserCardFilterOption {
  cardIndex: number;
  company: string;
  label: string;
  isSpeakerEngagementCard: boolean;
}

interface UserCardRecord {
  cardName?: string;
  company?: string;
  isSpeakerEngagementCard?: boolean;
}

const isSpeakerCardEnabled = (value: unknown): boolean => {
  return value === true || value === 'true';
};

const buildCardFilterOptions = (cards: UserCardRecord[]): UserCardFilterOption[] => {
  const companyUsage = new Map<string, number>();

  // Identify each card by its user-defined card name, falling back to the
  // company name, then to a generic "Card N" label when neither is set.
  const resolveCardIdentifier = (card: UserCardRecord, index: number) =>
    (card.cardName || '').trim() || (card.company || '').trim() || `Card ${index + 1}`;

  cards.forEach((card, index) => {
    const identifier = resolveCardIdentifier(card, index);
    companyUsage.set(identifier, (companyUsage.get(identifier) || 0) + 1);
  });

  const duplicateTracker = new Map<string, number>();

  return cards.map((card, index) => {
    const identifier = resolveCardIdentifier(card, index);
    const occurrence = (duplicateTracker.get(identifier) || 0) + 1;
    duplicateTracker.set(identifier, occurrence);
    const needsSuffix = (companyUsage.get(identifier) || 0) > 1;

    return {
      cardIndex: index,
      company: identifier,
      label: needsSuffix ? `${identifier} (Card ${index + 1})` : identifier,
      isSpeakerEngagementCard: isSpeakerCardEnabled(card.isSpeakerEngagementCard),
    };
  });
};

interface ShareOption {
  id: string;
  name: string;
  icon: 'whatsapp' | 'send' | 'email' | 'more-horiz' | 'linkedin';
  color: string;
  action: (contact?: Contact) => Promise<void>;
}

// Lazy Contact Image Component
interface LazyContactImageProps {
  contact: Contact;
  style: any;
  onLayout?: (event: any) => void;
}

const LazyContactImage: React.FC<LazyContactImageProps> = ({ contact, style, onLayout }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const viewRef = useRef<View>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get the appropriate image URL
  const getImageUrl = useCallback(() => {
    if (!contact.isXsCardUser) return null;
    
    // Prefer new structure with multiple sizes
    if (contact.profileImageUrls?.thumbnail) {
      return contact.profileImageUrls.thumbnail;
    }
    
    // Fallback to legacy single URL
    if (contact.profileImageUrl) {
      return contact.profileImageUrl;
    }
    
    return null;
  }, [contact]);

  // Check if component is visible on screen
  const checkVisibility = useCallback(() => {
    if (!viewRef.current) return;
    
    viewRef.current.measure((x, y, width, height, pageX, pageY) => {
      const windowHeight = Dimensions.get('window').height;
      const isInViewport = pageY < windowHeight && (pageY + height) > 0;
      
      if (isInViewport && !isVisible) {
        console.log('Contact image becoming visible:', contact.name);
        setIsVisible(true);
      }
    });
  }, [isVisible, contact.name]);

  // Load image when visible
  useEffect(() => {
    if (!isVisible || imageLoaded || imageError) return;
    
    const url = getImageUrl();
    if (!url) {
      console.log('No image URL for contact:', contact.name);
      return;
    }

    console.log('Loading image for contact:', contact.name, 'URL:', url);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    const loadImage = async () => {
      try {
        // Pre-load the image to check if it exists
        const response = await fetch(url, {
          method: 'HEAD',
          signal: abortControllerRef.current?.signal
        });

        if (response.ok) {
          console.log('Image loaded successfully for:', contact.name);
          setImageUri(url);
          setImageLoaded(true);
        } else {
          console.log('Image load failed for:', contact.name, 'Status:', response.status);
          setImageError(true);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.log('Failed to load contact image:', contact.name, error);
          setImageError(true);
        }
      }
    };

    loadImage();
  }, [isVisible, imageLoaded, imageError, getImageUrl, contact.name]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Check visibility on layout
  const handleLayout = useCallback((event: any) => {
    onLayout?.(event);
    setTimeout(checkVisibility, 100);
    
    // Fallback: if visibility check doesn't trigger after 1 second, force load
    setTimeout(() => {
      if (!isVisible && !imageLoaded && !imageError) {
        console.log('Fallback: forcing image load for:', contact.name);
        setIsVisible(true);
      }
    }, 1000);
  }, [checkVisibility, onLayout, isVisible, imageLoaded, imageError, contact.name]);

  // Render appropriate image
  if (!contact.isXsCardUser || imageError || (!imageLoaded && !isVisible)) {
    // Show default avatar for non-XS Card users or when image failed/not loaded
    // Extract size from style if available, otherwise use default 50
    // Handle percentage-based sizes (100% means use parent container size)
    let size = 50; // default
    if (style?.width && typeof style.width === 'number') {
      size = style.width;
    } else if (style?.height && typeof style.height === 'number') {
      size = style.height;
    } else if (style?.width === '100%' || style?.height === '100%') {
      // For percentage-based styles, check if parent container has a defined size
      // If modalContactImage, parent container is 60x60
      size = 60; // Default for modal/percentage-based styles
    }
    return (
      <View ref={viewRef} style={style} onLayout={handleLayout}>
        <GradientAvatar 
          size={size}
          style={style}
        />
        {contact.isXsCardUser && (
          <View style={styles.xsCardBadge}>
            <MaterialIcons name="verified" size={12} color={COLORS.primary} />
          </View>
        )}
      </View>
    );
  }

  if (imageLoaded && imageUri) {
    // Show profile image with XS Card badge
    return (
      <View ref={viewRef} style={style} onLayout={handleLayout}>
        <Image 
          source={{ uri: imageUri }} 
          style={style}
          onError={() => setImageError(true)}
        />
        <View style={styles.xsCardBadge}>
          <MaterialIcons name="verified" size={12} color={COLORS.primary} />
        </View>
      </View>
    );
  }

  // Show loading state
  return (
    <View ref={viewRef} style={[style, styles.imageLoadingContainer]} onLayout={handleLayout}>
      <ActivityIndicator size="small" color="#666" />
      <View style={styles.xsCardBadge}>
        <MaterialIcons name="verified" size={12} color={COLORS.primary} />
      </View>
    </View>
  );
};

// Utility function to format phone number with country code
const formatPhoneWithCountryCode = (phone: string): string => {
  if (!phone) return '';
  
  // Remove any spaces, hyphens, or parentheses
  const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');
  
  // If already has a country code (starts with +), return as is
  if (cleanedPhone.startsWith('+')) {
    return cleanedPhone;
  }
  
  // If starts with 00, replace with +
  if (cleanedPhone.startsWith('00')) {
    return '+' + cleanedPhone.substring(2);
  }
  
  // If starts with 0 (local number), add country code
  if (cleanedPhone.startsWith('0')) {
    return DEFAULT_COUNTRY_CODE + cleanedPhone.substring(1);
  }
  
  // Otherwise, add country code to the number
  return DEFAULT_COUNTRY_CODE + cleanedPhone;
};

// ============= GEOLOCATION HELPERS =============

// True only when the contact has a usable location with real coordinates.
const hasContactLocation = (location?: ContactLocation | null): location is ContactLocation =>
  !!location &&
  typeof location.latitude === 'number' &&
  typeof location.longitude === 'number';

// Human-readable label for a contact's location. Never shows raw coordinates.
// Returns '' when no address parts are available (caller shows "Location available").
const getContactLocationLabel = (location: ContactLocation): string => {
  const area = (location.area || '').trim();
  const city = (location.city || '').trim();
  const country = (location.country || '').trim();
  const formatted = (location.formattedAddress || '').trim();

  if (area && city) return `${area}, ${city}`;
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  if (formatted) {
    const firstLine = formatted.split(',')[0].trim();
    return firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine;
  }
  return '';
};

// Open the contact's coordinates in the native maps app, falling back to web.
const openContactLocationInMaps = (location: ContactLocation) => {
  const { latitude, longitude } = location;
  const url = Platform.select({
    ios: `maps:?q=${latitude},${longitude}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
  });
  const webFallback = `https://www.google.com/maps?q=${latitude},${longitude}`;
  Linking.openURL(url || webFallback).catch(() => {
    Linking.openURL(webFallback).catch(() => {});
  });
};

// Follow-up status badge + "Mark as Contacted" action shown inside each contact card.
type FollowUpRowProps = {
  contact: Contact;
  displayIndex: number;
  contacts: Contact[];
  userId: string | null;
  onStatusChange: (updated: Contact) => void;
};

function FollowUpRow({ contact, displayIndex, contacts, userId, onStatusChange }: FollowUpRowProps) {
  const [loading, setLoading] = React.useState(false);
  const toast = useToast();

  const status = contact.followUpStatus ?? 'active';

  const badgeLabel: Record<string, string> = {
    active: 'Follow-Up Active',
    contacted: 'Contacted',
    not_interested: 'Not Interested',
    completed: 'Sequence Complete',
  };
  const badgeColor: Record<string, string> = {
    active: '#22A55B',
    contacted: '#1B2B5B',
    not_interested: '#888888',
    completed: '#888888',
  };

  const markAsContacted = async () => {
    if (!userId || loading) return;
    setLoading(true);
    try {
      const backendIndex = contacts.length - 1 - displayIndex;
      const url = ENDPOINTS.UPDATE_FOLLOW_UP_STATUS
        .replace(':userId', userId)
        .replace(':index', String(backendIndex));
      const res = await authenticatedFetchWithRefresh(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpStatus: 'contacted' }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      onStatusChange({ ...contact, followUpStatus: 'contacted' });
    } catch {
      toast.error('Update Failed', 'Could not update follow-up status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={followUpStyles.row}>
      <View style={[followUpStyles.badge, { backgroundColor: badgeColor[status] ?? '#888888' }]}>
        <Text style={followUpStyles.badgeText}>{badgeLabel[status] ?? status}</Text>
      </View>
      {status === 'active' && (
        <TouchableOpacity
          style={followUpStyles.btn}
          onPress={markAsContacted}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={followUpStyles.btnText}>{loading ? '…' : 'Mark as Contacted'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const followUpStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    flexWrap: 'wrap',
    gap: 6,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  btn: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#FF4B6E',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
});

// Main Component
export default function ContactsScreen() {
  // Navigation
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colorScheme } = useColorScheme();
  
  // Core state
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { triggerUpsell, isFreeUser: isFreeUserFromPlan, isLoadingUserStatus } = usePremiumUpsell();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [cardFilterOptions, setCardFilterOptions] = useState<UserCardFilterOption[]>([]);
  const [selectedCardFilter, setSelectedCardFilter] = useState<number | 'all'>('all');
  const [isCardFilterDropdownVisible, setIsCardFilterDropdownVisible] = useState(false);
  const [isDownloadingSpeakerCsv, setIsDownloadingSpeakerCsv] = useState(false);
  // Which field (name or company) is shown bold/primary on each contact card.
  const [emphasisField, setEmphasisField] = useState<ContactEmphasisField>('name');

  // Plan and limits
  const [remainingContacts, setRemainingContacts] = useState<number | 'unlimited'>(FREE_PLAN_CONTACT_LIMIT);
  
  // Modal states
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isContactOptionsVisible, setIsContactOptionsVisible] = useState(false);
  const [isCopyFieldSheetVisible, setIsCopyFieldSheetVisible] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  // Contact detail panel (replaces the options popup on tap)
  const [contactPanelVisible, setContactPanelVisible] = useState(false);
  const [contactPanelDockedTop, setContactPanelDockedTop] = useState(0);
  const [contactPanelContact, setContactPanelContact] = useState<Contact | null>(null);
  const [contactPanelIndex, setContactPanelIndex] = useState(0);
  // Refs that let us scroll a tapped contact up into the visible "priority" zone
  // above the docked panel (so the panel stops right at the contact's bottom and
  // the space above stays scrollable for picking another contact).
  const contactsScrollRef = useRef<ScrollView>(null);
  const contactsScrollY = useRef(0);
  const listWrapperRef = useRef<View>(null);
  const cardLayouts = useRef<Map<string, { y: number; height: number }>>(new Map());

  // Selected items
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactForOptions, setSelectedContactForOptions] = useState<Contact | null>(null);
  const [selectedContactForCopy, setSelectedContactForCopy] = useState<Contact | null>(null);
  const [pendingShareContact, setPendingShareContact] = useState<Contact | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContactKeys, setSelectedContactKeys] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [pressedCopyRowId, setPressedCopyRowId] = useState<string | null>(null);
  const [showUpsellModal, setShowUpsellModal] = useState(false);
  const [showUpsellInfoModal, setShowUpsellInfoModal] = useState(false);
  const [upsellDontShow, setUpsellDontShow] = useState(false);

  // Manual "Add contact" — mirrors the saveContact.html exchange form so a contact
  // added by hand is saved exactly like one captured from a scan (same /AddContact
  // endpoint, same payload, same owner-notification email).
  const [isAddContactVisible, setIsAddContactVisible] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [addContactForm, setAddContactForm] = useState(EMPTY_ADD_CONTACT_FORM);

  // Upsell modal refs
  const upsellFocusedRef = useRef(false);
  const upsellEvaluatedRef = useRef(false);

  // Toast
  const toast = useToast();
  
  // Swipeable refs
  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const getContactKey = useCallback((contact: Contact) => {
    return [
      contact.name || '',
      contact.surname || '',
      contact.phone || '',
      contact.email || '',
      typeof contact.createdAt === 'string'
        ? contact.createdAt
        : JSON.stringify(contact.createdAt || {})
    ].join('|');
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedContactKeys(new Set());
  }, []);

  // Load the saved emphasis preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(CONTACT_EMPHASIS_STORAGE_KEY).then((saved) => {
      if (saved === 'name' || saved === 'company') {
        setEmphasisField(saved);
      }
    }).catch(() => {});
  }, []);

  const updateEmphasisField = useCallback((field: ContactEmphasisField) => {
    setEmphasisField(field);
    AsyncStorage.setItem(CONTACT_EMPHASIS_STORAGE_KEY, field).catch(() => {});
  }, []);

  const hasAdvancedFeatures = getPlanLimits(userPlan).hasAdvancedFeatures;
  const isFreeUser = userPlan === 'free';
  const firstSpeakerCardIndex = cardFilterOptions.find(c => c.isSpeakerEngagementCard)?.cardIndex ?? -1;
  const selectedCardFilterOption = cardFilterOptions.find(
    (card) => card.cardIndex === selectedCardFilter
  );
  const selectedCardFilterLabel = selectedCardFilterOption?.label || 'All Cards';

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    clearSelection();
  }, [clearSelection]);

  const toggleSelectionMode = useCallback(() => {
    setIsSelectionMode((prev) => {
      if (prev) {
        clearSelection();
        return false;
      }
      setIsCardFilterDropdownVisible(false);
      return true;
    });
  }, [clearSelection]);

  const toggleContactSelection = useCallback((contact: Contact) => {
    const key = getContactKey(contact);
    setSelectedContactKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, [getContactKey]);

  const handleLongPressSelect = useCallback((contact: Contact) => {
    if (isSelectionMode) return;
    const key = getContactKey(contact);
    setIsSelectionMode(true);
    setSelectedContactKeys(new Set([key]));
  }, [getContactKey, isSelectionMode]);

  const openCopyFieldSheet = useCallback((contact: Contact) => {
    setSelectedContactForCopy(contact);
    setIsCopyFieldSheetVisible(true);
  }, []);

  const closeCopyFieldSheet = useCallback(() => {
    setIsCopyFieldSheetVisible(false);
    setSelectedContactForCopy(null);
  }, []);

  const showCopyToast = useCallback(
    (type: 'success' | 'error', title: string, message: string) => {
      InteractionManager.runAfterInteractions(() => {
        if (type === 'success') {
          toast.success(title, message);
        } else {
          toast.error(title, message);
        }
      });
    },
    [toast],
  );

  const copyContactField = useCallback(
    async (
      contact: Contact,
      field:
        | 'phone'
        | 'nameShort'
        | 'email'
        | 'metAt'
        | 'dateMet'
        | 'fullName',
    ) => {
      const trimmedFirst = String(contact.name || '').trim();
      const trimmedLast = String(contact.surname || '').trim();
      const fullName = [trimmedFirst, trimmedLast].filter(Boolean).join(' ').trim();

      let value = '';
      let label = '';

      switch (field) {
        case 'phone':
          value = formatPhoneWithCountryCode(contact.phone || '');
          label = 'Phone number';
          break;
        case 'nameShort':
          value = trimmedFirst;
          label = 'Name';
          break;
        case 'email':
          value = String(contact.email || '').trim();
          label = 'Email';
          break;
        case 'metAt':
          value = String(contact.howWeMet || '').trim();
          label = 'Met at';
          break;
        case 'dateMet':
          value = formatTimestamp(contact.createdAt);
          label = 'Date met';
          break;
        case 'fullName':
          value = fullName;
          label = 'Full name';
          break;
        default:
          value = '';
          label = 'Value';
          break;
      }

      // Dismiss the sheet immediately so it never lingers during clipboard I/O.
      closeCopyFieldSheet();

      if (!value) {
        showCopyToast('error', 'Copy Failed', `${label} is not available to copy.`);
        return;
      }

      try {
        await Clipboard.setStringAsync(value);
        showCopyToast('success', 'Copied', `${label} copied to clipboard`);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        showCopyToast(
          'error',
          'Copy Failed',
          'Unable to copy to clipboard. Please try again.',
        );
      }
    },
    [closeCopyFieldSheet, showCopyToast],
  );

  const copyToClipboard = useCallback(
    async (label: string, value: string) => {
      const safeValue = String(value || '').trim();
      if (!safeValue) {
        showCopyToast('error', 'Copy Failed', `${label} is not available to copy.`);
        return;
      }

      try {
        await Clipboard.setStringAsync(safeValue);
        showCopyToast('success', 'Copied', `${label} copied to clipboard`);
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        showCopyToast(
          'error',
          'Copy Failed',
          'Unable to copy to clipboard. Please try again.',
        );
      }
    },
    [showCopyToast],
  );

  // Debug share modal state changes
  useEffect(() => {
    console.log('🔍 Share modal visibility changed:', isShareModalVisible);
    console.log('🔍 Current selectedContact:', selectedContact ? `${selectedContact.name} ${selectedContact.surname}` : 'null');
  }, [isShareModalVisible, selectedContact]);

  // Debug contact options modal state changes
  useEffect(() => {
    console.log('🔍 Contact options modal visibility changed:', isContactOptionsVisible);
    console.log('🔍 Current selectedContactForOptions:', selectedContactForOptions ? `${selectedContactForOptions.name} ${selectedContactForOptions.surname}` : 'null');
  }, [isContactOptionsVisible, selectedContactForOptions]);


  // ============= CORE FUNCTIONS =============
  

  // Share functionality - moved before useEffect that uses it
  const handleShare = useCallback(async (contact?: Contact) => {
    try {
      console.log('🚀 handleShare called with contact:', contact ? `${contact.name} ${contact.surname}` : 'null');
      console.log('🚀 Current isShareModalVisible:', isShareModalVisible);
      console.log('🚀 Current selectedContact:', selectedContact ? `${selectedContact.name} ${selectedContact.surname}` : 'null');
      
      // Check limit for new shares
      if (!contact && remainingContacts === 0) {
        console.log('🚀 Share limit reached, showing limit modal');
        setShowLimitModal(true);
        return;
      }
      
      console.log('🚀 Setting selected contact to:', contact ? `${contact.name} ${contact.surname}` : 'null');
      setSelectedContact(contact || null);
      
      console.log('🚀 Setting share modal visible to true');
      setIsShareModalVisible(true);
      
      console.log('🚀 Share modal state should now be: visible=true, contact=', contact ? `${contact.name} ${contact.surname}` : 'null');
    } catch (error) {
      console.error('🚀 Error preparing share:', error);
      toast.error('Sharing Failed', 'Failed to prepare sharing');
    }
  }, [remainingContacts, isShareModalVisible, selectedContact]);

  // Handle pending share when contact options modal is fully closed
  useEffect(() => {
    console.log('💫 useEffect triggered - isContactOptionsVisible:', isContactOptionsVisible, 'pendingShareContact:', pendingShareContact ? `${pendingShareContact.name} ${pendingShareContact.surname}` : 'null');
    
    if (!isContactOptionsVisible && pendingShareContact) {
      console.log('💫 Contact options modal fully closed, triggering share for:', `${pendingShareContact.name} ${pendingShareContact.surname}`);
      
      // Store the contact before clearing it
      const contactToShare = pendingShareContact;
      
      // Clear the pending contact first
      setPendingShareContact(null);
      
      // Then trigger the share with a longer delay
      setTimeout(() => {
        console.log('💫 Calling handleShare after modal fully closed');
        handleShare(contactToShare);
      }, 1000); // Much longer delay to ensure modal is completely dismissed
    }
  }, [isContactOptionsVisible, pendingShareContact, handleShare]);

  // Swipeable utilities
  const closeAllSwipeables = useCallback(() => {
    swipeableRefs.current.forEach(ref => ref?.close());
  }, []);

  // Load contacts from API
  const loadContacts = useCallback(async () => {
    setIsLoading(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }
      setUserId(userId);

      // Fetch contacts and user data in parallel
      const [contactResponse, userResponse] = await Promise.all([
        authenticatedFetchWithRefresh(`${ENDPOINTS.GET_CONTACTS}/${userId}`),
        authenticatedFetchWithRefresh(`${ENDPOINTS.GET_USER}/${userId}`)
      ]);

      if (!contactResponse.ok) {
        throw new Error(`Failed to load contacts: ${contactResponse.status}`);
      }

      const contactData = await contactResponse.json();
      const userData = await userResponse.json();
      const resolvedPlan: UserPlan =
        userData.plan === 'premium' || userData.plan === 'enterprise' ? userData.plan : 'free';

      // Process contacts with null safety
      const contactList = Array.isArray(contactData?.contactList) ? contactData.contactList : [];
      setContacts(contactList);
      setUserPlan(resolvedPlan);

      // Cache contacts data in AsyncStorage with timestamp
      try {
        const cacheData = {
          data: contactList,
          timestamp: Date.now()
        };
        await AsyncStorage.setItem('cachedContacts', JSON.stringify(cacheData));
        console.log('✅ Cached contacts data for Dashboard reuse');
      } catch (cacheError) {
        console.error('Error caching contacts:', cacheError);
      }

      if (getPlanLimits(resolvedPlan).hasAdvancedFeatures) {
        try {
          const cardsResponse = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_CARD}/${userId}`);
          if (!cardsResponse.ok) {
            throw new Error(`Failed to load cards: ${cardsResponse.status}`);
          }

          const cardsResponseData = await cardsResponse.json();
          const cardsArray = Array.isArray(cardsResponseData?.cards)
            ? cardsResponseData.cards
            : Array.isArray(cardsResponseData)
              ? cardsResponseData
              : [];

          setCardFilterOptions(buildCardFilterOptions(cardsArray));
        } catch (cardError) {
          console.error('Error loading card filter options:', cardError);
          setCardFilterOptions([]);
        }
      } else {
        setCardFilterOptions([]);
        setSelectedCardFilter('all');
        setIsCardFilterDropdownVisible(false);
      }

      // Set remaining contacts based on plan
      if (resolvedPlan === 'free') {
        const remaining = Math.max(0, FREE_PLAN_CONTACT_LIMIT - contactList.length);
        setRemainingContacts(remaining);
      } else {
        setRemainingContacts('unlimited');
      }

    } catch (error) {
      console.error('Error loading contacts:', error);
      setContacts([]);
      setRemainingContacts('unlimited');
      toast.error('Loading Failed', 'Unable to load contacts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Open the manual add-contact form. Free users at their limit get the upgrade
  // prompt instead — same gate the backend enforces, surfaced up front.
  const openAddContact = useCallback(() => {
    if (isFreeUser && remainingContacts !== 'unlimited' && remainingContacts <= 0) {
      setShowLimitModal(true);
      return;
    }
    setAddContactForm(EMPTY_ADD_CONTACT_FORM);
    setIsAddContactVisible(true);
  }, [isFreeUser, remainingContacts]);

  const closeAddContact = useCallback(() => {
    setIsAddContactVisible(false);
  }, []);

  const updateAddContactField = useCallback(
    (field: keyof typeof EMPTY_ADD_CONTACT_FORM, value: string) => {
      setAddContactForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Save a hand-entered contact through the SAME public /AddContact endpoint the
  // saveContact.html scan page uses, with an identical payload shape — so manual
  // contacts behave exactly like scanned ones (owner email, free-plan limit, etc.).
  const handleAddContactSubmit = useCallback(async () => {
    const name = addContactForm.name.trim();
    const surname = addContactForm.surname.trim();
    const email = addContactForm.email.trim();
    const company = addContactForm.company.trim();
    // Drop a lone country-code prefix so an untouched phone field saves as empty.
    const phoneRaw = addContactForm.phone.trim();
    const phone = phoneRaw === DEFAULT_COUNTRY_CODE ? '' : phoneRaw;
    const howWeMet = addContactForm.howWeMet.trim();

    // Match saveContact.html's required fields (name, surname, email, how we met).
    if (!name || !surname || !email || !howWeMet) {
      toast.error('Missing details', 'Please fill in first name, last name, email and how you met.');
      return;
    }
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailValid) {
      toast.error('Invalid email', 'Please enter a valid email address.');
      return;
    }

    setIsAddingContact(true);
    try {
      const userId = await getUserId();
      if (!userId) {
        throw new Error('No user ID found');
      }

      // Same payload structure saveContact.html sends to /AddContact.
      const payload = {
        userId,
        cardIndex: 0,
        contactInfo: { name, surname, phone, email, company, howWeMet },
      };

      const response = await authenticatedFetchWithRefresh(ENDPOINTS.ADD_CONTACT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.status === 403) {
        // Free-plan contact limit hit on the server — show the upgrade path.
        setIsAddContactVisible(false);
        setShowLimitModal(true);
        return;
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `Failed to add contact (${response.status})`);
      }

      setIsAddContactVisible(false);
      setAddContactForm(EMPTY_ADD_CONTACT_FORM);
      toast.success('Contact added', `${name} ${surname} was saved to your contacts.`);
      await loadContacts();
    } catch (error) {
      console.error('Error adding contact manually:', error);
      toast.error('Could not add contact', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsAddingContact(false);
    }
  }, [addContactForm, toast, loadContacts]);

  // Delete contact
  const handleDeleteContact = useCallback(async (contact: Contact) => {
    const contactKey = getContactKey(contact);
    const swipeableToDelete = swipeableRefs.current.get(contactKey);
    swipeableToDelete?.close();

    setTimeout(() => {
      Alert.alert(
        "Delete Contact",
        "Are you sure you want to delete this contact?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive",
            onPress: async () => {
              try {
                const userId = await getUserId();
                if (!userId) throw new Error('User ID not found');

                const displayIndex = contacts.findIndex((c) => c === contact);
                if (displayIndex === -1) {
                  throw new Error('Contact not found locally');
                }

                const backendIndex = contacts.length - 1 - displayIndex;

                const response = await authenticatedFetchWithRefresh(
                  `${ENDPOINTS.DELETE_CONTACT}/${userId}/contact/${backendIndex}`,
                  { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                  }
                );

                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.message || 'Failed to delete contact');
                }

                // Update local state
                const updatedContacts = [...contacts];
                updatedContacts.splice(displayIndex, 1);
                setContacts(updatedContacts);
                
                // Update remaining contacts count
                setRemainingContacts((prev) => {
                  if (typeof prev === 'number') {
                    return Math.min(FREE_PLAN_CONTACT_LIMIT, prev + 1);
                  }
                  return prev;
                });
                
                toast.success('Contact Deleted', 'Contact deleted successfully');
              } catch (error) {
                console.error('Error deleting contact:', error);
                toast.error('Delete Failed', error instanceof Error ? error.message : 'Failed to delete contact');
              }
            }
          }
        ]
      );
    }, 300);
  }, [contacts, remainingContacts, getContactKey]);

  const performBulkDelete = useCallback(async (keys: string[]) => {
    if (!keys.length) return;
    setIsBulkDeleting(true);

    try {
      const userId = await getUserId();
      if (!userId) throw new Error('User ID not found');

      const selectedKeysSet = new Set(keys);
      const displayIndexes = keys
        .map((key) => contacts.findIndex((c) => getContactKey(c) === key))
        .filter((index) => index !== -1);

      if (!displayIndexes.length) {
        throw new Error('Selected contacts not found');
      }

      const backendIndexes = displayIndexes.map((index) => contacts.length - 1 - index);
      const uniqueBackendIndexes = Array.from(new Set(backendIndexes));

      const response = await authenticatedFetchWithRefresh(
        `${ENDPOINTS.DELETE_CONTACT}/${userId}/bulk`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ indexes: uniqueBackendIndexes })
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete contacts');
      }

      const updatedContacts = contacts.filter(
        (contact) => !selectedKeysSet.has(getContactKey(contact))
      );
      setContacts(updatedContacts);

      setRemainingContacts((prev) => {
        if (typeof prev === 'number') {
          return Math.min(FREE_PLAN_CONTACT_LIMIT, prev + keys.length);
        }
        return prev;
      });

      exitSelectionMode();
      toast.success(
        'Contacts Deleted',
        `${keys.length} contact${keys.length === 1 ? '' : 's'} removed successfully`
      );
    } catch (error) {
      console.error('Error deleting contacts:', error);
      toast.error('Delete Failed', error instanceof Error ? error.message : 'Failed to delete contacts');
    } finally {
      setIsBulkDeleting(false);
    }
  }, [contacts, exitSelectionMode, getContactKey, toast]);

  const handleBulkDeleteConfirmation = useCallback(() => {
    if (isBulkDeleting) return;
    const keys = Array.from(selectedContactKeys);
    if (!keys.length) return;

    Alert.alert(
      'Delete Contacts',
      `Are you sure you want to delete ${keys.length} contact${keys.length === 1 ? '' : 's'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => performBulkDelete(keys)
        }
      ]
    );
  }, [isBulkDeleting, performBulkDelete, selectedContactKeys]);


  // Contact press handler
  const handleContactPress = useCallback((contact: Contact, contactKey: string, touchY: number = 0, index: number = 0) => {
    if (isSelectionMode) {
      toggleContactSelection(contact);
      return;
    }
    const windowH = Dimensions.get('window').height;
    // The panel should never dock lower than this — keeps the tapped contact and
    // a scrollable strip above it visible while the panel covers the lower half.
    const MAX_DOCK = windowH * 0.5;

    // Show immediately at a first estimate (touch point + ~half card height) so the
    // panel never flashes from the top while we refine the position below.
    const initialDock = Math.max(180, Math.min(touchY + 55, MAX_DOCK));
    setContactPanelContact(contact);
    setContactPanelIndex(index);
    setContactPanelDockedTop(initialDock);
    setContactPanelVisible(true);

    // After the layout settles: the filter / select rows have collapsed and the
    // expanded bottom padding is in place, so the list has moved up and grown.
    // Now scroll the tapped contact up until its bottom sits at the dock line, then
    // dock the panel exactly there. Works for the last contact too.
    setTimeout(() => {
      const wrapper = listWrapperRef.current;
      const layout = cardLayouts.current.get(contactKey);
      if (!wrapper || !layout) return;
      wrapper.measureInWindow((_x, listTopY) => {
        const cardBottomInContent = layout.y + layout.height;
        const cardBottomOnScreen = listTopY + cardBottomInContent - contactsScrollY.current;
        // Where we want the contact's bottom (and therefore the panel's top) to land.
        const targetDock = Math.max(180, Math.min(cardBottomOnScreen, MAX_DOCK));
        const delta = cardBottomOnScreen - targetDock; // > 0 when we must scroll up
        if (delta > 1) {
          contactsScrollRef.current?.scrollTo({
            y: Math.max(0, contactsScrollY.current + delta),
            animated: true,
          });
        }
        setContactPanelDockedTop(targetDock);
      });
    }, 60);
  }, [isSelectionMode, toggleContactSelection]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadContacts().finally(() => setRefreshing(false));
  }, [loadContacts]);

  // Navigation handler
  const navigateToUpgrade = useCallback(() => {
    setShowLimitModal(false);
    navigation.navigate('UnlockPremium');
  }, [navigation]);

  // Export contact handler
  const handleExportContact = useCallback(async (contact: Contact) => {
    try {
      const contactParams = new URLSearchParams({
        name: contact.name || '',
        surname: contact.surname || '',
        phone: contact.phone || '',
        email: contact.email || '',
        company: contact.company || '',
        howWeMet: contact.howWeMet || '',
        action: 'downloadContact'
      });

      const contactUrl = `${API_BASE_URL}/saveContact.html?${contactParams.toString()}`;
      
      Alert.alert(
        'Export Contact',
        `Export "${contact.name} ${contact.surname}" as a contact file?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Export', 
            onPress: async () => {
              try {
                // Set export flag to prevent auto-logout during export
                console.log('Contact export: Setting export flag to prevent auto-logout');
                AuthManager.setContactExporting(true);
                
                // Open the URL
                await Linking.openURL(contactUrl);
                
                // Show success message
                toast.success('Export Initiated', 'Contact export initiated. Check your downloads.');
              } catch (error) {
                console.error('Error opening contact export URL:', error);
                toast.error('Export Failed', 'Failed to open export page. Please try again.');
                // Clear export flag on error
                AuthManager.setContactExporting(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Export contact error:', error);
      toast.error('Export Failed', 'Failed to export contact. Please try again.');
    }
  }, []);

  // True if a scan time falls inside the CURRENT speaker session only — the
  // most recently opened window for the card, never an earlier one. Mirrors
  // EditCard.tsx's inCurrentSpeakerWindow so both surfaces agree on what counts.
  const isContactInCurrentSpeakerWindow = (createdAt: unknown, windows: any[]): boolean => {
    if (!Array.isArray(windows) || windows.length === 0) return false;
    const t = new Date(createdAt as string).getTime();
    if (isNaN(t)) return false;
    const current = windows[windows.length - 1];
    const start = new Date(current?.start).getTime();
    if (isNaN(start)) return false;
    const end = current?.end ? new Date(current.end).getTime() : Date.now();
    return t >= start && t <= end;
  };

  const csvEscape = (value: unknown): string => {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // Export everyone who scanned the currently-selected Speaker & Engagement
  // Card during its current session only (never a prior toggle-on/off cycle).
  const handleDownloadSpeakerCsv = useCallback(async () => {
    if (typeof selectedCardFilter !== 'number' || !selectedCardFilterOption?.isSpeakerEngagementCard) {
      return;
    }
    if (triggerUpsell({
      featureName: 'Speaker & Engagement Card',
      description: 'Exporting your speaker & engagement contacts is a premium feature. Upgrade to Premium to download them.',
    })) return;

    if (isDownloadingSpeakerCsv) return;
    setIsDownloadingSpeakerCsv(true);
    try {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in');

      const cardsRes = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_CARD}/${userId}`);
      if (!cardsRes.ok) throw new Error('Failed to load card');

      const cardsData = await cardsRes.json();
      const cardsArray = Array.isArray(cardsData?.cards)
        ? cardsData.cards
        : (Array.isArray(cardsData) ? cardsData : []);
      const speakerWindows = cardsArray?.[selectedCardFilter]?.speakerWindows || [];

      const speakerContacts = contacts.filter(
        (c) =>
          Number(c?.sourceCardIndex) === Number(selectedCardFilter) &&
          isContactInCurrentSpeakerWindow((c as any)?.createdAtMs ?? c?.createdAt, speakerWindows)
      );

      if (speakerContacts.length === 0) {
        Alert.alert(
          'No Contacts Yet',
          'No one scanned this card while it was set as your speaker & engagement card.'
        );
        return;
      }

      const headers = ['Name', 'Surname', 'Phone', 'Email', 'Company', 'How We Met', 'Date Saved'];
      const lines = speakerContacts.map((c) => [
        c?.name,
        c?.surname,
        c?.phone,
        c?.email,
        c?.company,
        c?.howWeMet,
        formatTimestamp(c?.createdAt),
      ].map(csvEscape).join(','));
      const csv = [headers.join(','), ...lines].join('\n');

      const fileName = `speaker-contacts-${Date.now()}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      await RNShare.open({
        url: fileUri,
        type: 'text/csv',
        filename: fileName,
        failOnCancel: false,
      });
    } catch (error: any) {
      const msg = String(error?.message || '');
      if (msg.includes('User did not share') || msg.includes('cancel')) return;
      console.error('Export speaker contacts failed:', error);
      toast.error('Export Failed', 'Could not export contacts. Please try again.');
    } finally {
      setIsDownloadingSpeakerCsv(false);
    }
  }, [contacts, selectedCardFilter, selectedCardFilterOption, isDownloadingSpeakerCsv, triggerUpsell, toast]);

  // ============= SHARE OPTIONS =============
  
  const shareOptions: ShareOption[] = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: 'whatsapp',
      color: '#25D366',
      action: async (contact?: Contact) => {
        try {
          const storedUserData = await AsyncStorage.getItem('userData');
          if (!storedUserData) {
            toast.error('Data Error', 'User data not available');
            return;
          }
          
          const userData = JSON.parse(storedUserData);
          
          let message: string;
          if (contact) {
            message = `Contact Information:\nName: ${contact.name} ${contact.surname}\nPhone: ${formatPhoneWithCountryCode(contact.phone)}${contact.email ? `\nEmail: ${contact.email}` : ''}${contact.company ? `\nCompany: ${contact.company}` : ''}\nMet at: ${contact.howWeMet}`;
          } else {
            const shareUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
            message = `Check out my digital business card! ${shareUrl}`;
          }
          
          await Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
        } catch (error) {
          toast.error('App Not Found', 'WhatsApp is not installed on your device');
        }
      }
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: 'send',
      color: '#0088cc',
      action: async (contact?: Contact) => {
        try {
          const storedUserData = await AsyncStorage.getItem('userData');
          if (!storedUserData) {
            toast.error('Data Error', 'User data not available');
            return;
          }
          
          const userData = JSON.parse(storedUserData);
          
          let message: string;
          if (contact) {
            message = `Contact Information:\nName: ${contact.name} ${contact.surname}\nPhone: ${formatPhoneWithCountryCode(contact.phone)}${contact.email ? `\nEmail: ${contact.email}` : ''}${contact.company ? `\nCompany: ${contact.company}` : ''}\nMet at: ${contact.howWeMet}`;
          } else {
            const shareUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
            message = `Check out my business card: ${shareUrl}`;
          }

          await Linking.openURL(`tg://msg?text=${encodeURIComponent(message)}`);
        } catch (error) {
          toast.error('App Not Found', 'Telegram is not installed on your device');
        }
      }
    },
    {
      id: 'email',
      name: 'Email',
      icon: 'email',
      color: '#EA4335',
      action: async (contact?: Contact) => {
        try {
          const storedUserData = await AsyncStorage.getItem('userData');
          if (!storedUserData) {
            toast.error('Data Error', 'User data not available');
            return;
          }
          
          const userData = JSON.parse(storedUserData);
          let emailUrl = '';
          
          if (contact) {
            const formattedMessage = `Hello,\n\nI wanted to share this contact information with you:\n\nName: ${contact.name} ${contact.surname}\nPhone: ${formatPhoneWithCountryCode(contact.phone)}${contact.email ? `\nEmail: ${contact.email}` : ''}${contact.company ? `\nCompany: ${contact.company}` : ''}\nMet at: ${contact.howWeMet}\n\nBest regards,\n${userData.name || ''} ${userData.surname || ''}`;
            
            emailUrl = `mailto:?subject=${encodeURIComponent(`Contact Information - ${contact.name} ${contact.surname}`)}&body=${encodeURIComponent(formattedMessage)}`;
          } else {
            const shareUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
            const formattedMessage = `Hello,\n\nI'm ${userData.name || ''} ${userData.surname || ''}${userData.company ? ` from ${userData.company}` : ''}.\n\nHere's my digital business card: ${shareUrl}\n\nBest regards,\n${userData.name || ''} ${userData.surname || ''}`;
            
            emailUrl = `mailto:?subject=${encodeURIComponent(`Digital Business Card - ${userData.name || ''} ${userData.surname || ''}`)}&body=${encodeURIComponent(formattedMessage)}`;
          }
          
          await Linking.openURL(emailUrl);
        } catch (error) {
          toast.error('Email Failed', 'Could not open email client');
        }
      }
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: 'linkedin',
      color: '#0077B5',
      action: async (contact?: Contact) => {
        try {
          const storedUserData = await AsyncStorage.getItem('userData');
          if (!storedUserData) {
            toast.error('Data Error', 'User data not available');
            return;
          }
          
          const userData = JSON.parse(storedUserData);
          let message: string;
          let url: string;
          
          if (contact) {
            message = `Contact Information:\nName: ${contact.name} ${contact.surname}\nPhone: ${formatPhoneWithCountryCode(contact.phone)}${contact.email ? `\nEmail: ${contact.email}` : ''}${contact.company ? `\nCompany: ${contact.company}` : ''}\nMet at: ${contact.howWeMet}`;
            url = '';
          } else {
            const shareUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
            message = `Check out my digital business card!`;
            url = shareUrl;
          }
          
          const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url || '')}&summary=${encodeURIComponent(message)}`;
          await Linking.openURL(linkedinUrl);
        } catch (error) {
          toast.error('LinkedIn Failed', 'Could not open LinkedIn');
        }
      }
    },
    {
      id: 'more',
      name: 'More',
      icon: 'more-horiz',
      color: '#6B7280',
      action: async (contact?: Contact) => {
        try {
          const storedUserData = await AsyncStorage.getItem('userData');
          if (!storedUserData) {
            toast.error('Data Error', 'User data not available');
            return;
          }
          
          const userData = JSON.parse(storedUserData);
          let message: string;
          let url: string;
          
          if (contact) {
            message = `Contact Information:\nName: ${contact.name} ${contact.surname}\nPhone: ${formatPhoneWithCountryCode(contact.phone)}${contact.email ? `\nEmail: ${contact.email}` : ''}${contact.company ? `\nCompany: ${contact.company}` : ''}\nMet at: ${contact.howWeMet}`;
            url = '';
          } else {
            const shareUrl = `${API_BASE_URL}/saveContact.html?userId=${userData.id}`;
            message = `Check out my digital business card!`;
            url = shareUrl;
          }
          
          await Share.share({
            message: url ? `${message}\n\n${url}` : message,
            url: url || undefined,
            title: contact ? `Contact: ${contact.name} ${contact.surname}` : 'My Digital Business Card'
          });
        } catch (error) {
          toast.error('Share Failed', 'Could not open share options');
        }
      }
    }
  ];

  // Handle platform selection for sharing
  const handlePlatformSelect = useCallback(async (platform: string) => {
    try {
      const selectedOption = shareOptions.find(opt => opt.id === platform);
      if (selectedOption) {
        await selectedOption.action(selectedContact || undefined);
      }
      
      setIsShareModalVisible(false);
      setSelectedContact(null);
    } catch (error) {
      console.error('Error sharing:', error);
      toast.error('Share Failed', 'Failed to share');
    }
  }, [selectedContact, shareOptions]);

  // ============= COMPUTED VALUES =============
  
  useEffect(() => {
    if (selectedCardFilter === 'all') {
      return;
    }

    const selectedCardStillExists = cardFilterOptions.some(
      (card) => card.cardIndex === selectedCardFilter
    );

    if (!selectedCardStillExists) {
      setSelectedCardFilter('all');
    }
  }, [cardFilterOptions, selectedCardFilter]);

  // Filter contacts based on card filter and search query
  const filteredContacts = contacts.filter(contact => {
    const matchesSelectedCard =
      selectedCardFilter === 'all' ||
      Number(contact.sourceCardIndex) === selectedCardFilter;

    if (!matchesSelectedCard) {
      return false;
    }

    const searchTerm = searchQuery.toLowerCase();
    const fullName = `${contact.name || ''} ${contact.surname || ''}`.toLowerCase();
    const phone = (contact.phone || '').toLowerCase();
    const company = (contact.company || '').toLowerCase();
    const email = (contact.email || '').toLowerCase();
    const howWeMet = (contact.howWeMet || '').toLowerCase();
    
    return fullName.includes(searchTerm) ||
           phone.includes(searchTerm) ||
           company.includes(searchTerm) ||
           email.includes(searchTerm) ||
           howWeMet.includes(searchTerm);
  });

  // Dynamic styles based on color scheme
  const dynamicStyles = {
    shareCardButton: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      backgroundColor: colorScheme,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 25,
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    shareAction: {
      backgroundColor: colorScheme,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      width: 80,
      height: '100%' as const,
    },
    upgradeButton: {
      backgroundColor: colorScheme,
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 25,
      alignSelf: 'flex-end' as const,
    },
  };

  // ============= SWIPEABLE COMPONENTS =============
  
  const RenderRightActions = useCallback((progress: any, dragX: any, contact: Contact) => {
    return (
      <TouchableOpacity 
        style={styles.deleteAction}
        onPress={() => handleDeleteContact(contact)}
      >
        <MaterialIcons name="delete" size={24} color={COLORS.white} />
      </TouchableOpacity>
    );
  }, [handleDeleteContact]);

  const RenderLeftActions = useCallback((progress: any, dragX: any, contact: Contact) => {
    return (
      <TouchableOpacity 
        style={[styles.shareAction, { backgroundColor: '#2196F3' }]}
        onPress={() => handleShare(contact)}
      >
        <MaterialIcons name="share" size={24} color={COLORS.white} />
      </TouchableOpacity>
    );
  }, [handleShare]);

  // ============= EFFECTS =============
  
  // Reset refs when contacts change
  useEffect(() => {
    swipeableRefs.current = new Map();
    return closeAllSwipeables;
  }, [contacts, closeAllSwipeables]);

  useEffect(() => {
    if (isSelectionMode) {
      closeAllSwipeables();
    }
  }, [isSelectionMode, closeAllSwipeables]);

  // Load contacts on focus
  useFocusEffect(
    useCallback(() => {
      loadContacts();
      return closeAllSwipeables;
    }, [loadContacts, closeAllSwipeables])
  );

  // ============= UPSELL MODAL =============

  const checkAndShowUpsell = useCallback(async () => {
    if (upsellEvaluatedRef.current) return;

    // 1. Loading gate
    if (isLoadingUserStatus) {
      console.log('[ContactsUpsell] Skipping - user status still loading');
      return;
    }

    // 2. User type gate — isFreeUser === false means premium; null/undefined defaults to showing
    if (isFreeUserFromPlan === false) {
      console.log('[ContactsUpsell] Skipping - user is premium');
      upsellEvaluatedRef.current = true;
      return;
    }

    upsellEvaluatedRef.current = true;

    try {
      // 3. Don't show again gate
      const dontShow = await AsyncStorage.getItem('contacts_upsell_dont_show_again');
      if (dontShow === 'true') {
        console.log('[ContactsUpsell] Skipping - dont show again is set');
        return;
      }

      // 4. All checks passed — show modal
      console.log('[ContactsUpsell] All checks passed - showing modal');
      setUpsellDontShow(false); // always unchecked on open
      setShowUpsellModal(true);
    } catch {
      console.log('[ContactsUpsell] AsyncStorage read failed - defaulting to show');
      setUpsellDontShow(false);
      setShowUpsellModal(true);
    }
  }, [isFreeUserFromPlan, isLoadingUserStatus]);

  useFocusEffect(
    useCallback(() => {
      upsellFocusedRef.current = true;
      upsellEvaluatedRef.current = false;
      checkAndShowUpsell();
      return () => { upsellFocusedRef.current = false; };
    }, [checkAndShowUpsell])
  );

  useEffect(() => {
    if (!isLoadingUserStatus && upsellFocusedRef.current && !upsellEvaluatedRef.current) {
      checkAndShowUpsell();
    }
  }, [isLoadingUserStatus, checkAndShowUpsell]);

  const dismissUpsellModal = useCallback(() => {
    if (upsellDontShow) {
      AsyncStorage.setItem('contacts_upsell_dont_show_again', 'true').catch(() => {});
    }
    setShowUpsellModal(false);
  }, [upsellDontShow]);

  const handleUpsellUnlockPremium = useCallback(() => {
    if (upsellDontShow) {
      AsyncStorage.setItem('contacts_upsell_dont_show_again', 'true').catch(() => {});
    }
    setShowUpsellModal(false);
    navigation.navigate('UnlockPremium');
  }, [navigation, upsellDontShow]);

  // ============= RENDER =============

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <Header
          title="Contacts"
          rightIcon={
            <FeatureTip
              tipKey="contacts_manual_add"
              content="Add a contact by hand — saved just like a scanned card"
              position="bottom"
              bubbleAlign="right"
              arrowAtAnchor
            >
              <TouchableOpacity
                onPress={openAddContact}
                accessibilityRole="button"
                accessibilityLabel="Add a contact manually"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="person-add-alt-1" size={24} color={COLORS.black} />
              </TouchableOpacity>
            </FeatureTip>
          }
        />

        <View style={styles.contentShell}>
        <View style={styles.contentShellInner}>
        {/* Contact Count Container - Only show for free users */}
        {remainingContacts !== 'unlimited' && (
          <View style={styles.contactCountContainer}>
            <View style={styles.contactCountIconContainer}>
              <MaterialIcons 
                name={remainingContacts === 0 ? "error-outline" : "people-outline"} 
                size={22} 
                color={remainingContacts === 0 ? COLORS.error : COLORS.primary} 
              />
            </View>
            <View style={styles.contactCountContent}>
              <Text style={[
                styles.contactCountText,
                { color: remainingContacts === 0 ? COLORS.error : COLORS.black }
              ]}>
                {remainingContacts > 0 
                  ? `${remainingContacts} free contacts remaining` 
                  : 'Contact limit reached'}
              </Text>
              <View style={styles.progressBarContainer}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: typeof remainingContacts === 'number' 
                        ? `${(remainingContacts / FREE_PLAN_CONTACT_LIMIT) * 100}%`
                        : '0%',
                      backgroundColor: remainingContacts === 5 
                        ? COLORS.error 
                        : remainingContacts === 10 
                          ? '#FFA500'
                          : COLORS.primary
                    }
                  ]} 
                />
              </View>
              {remainingContacts === 0 && (
                <TouchableOpacity 
                  onPress={navigateToUpgrade}
                  style={dynamicStyles.upgradeButton}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        
        {/* Main Contacts Container */}
        <View style={[
          styles.contactsContainer, 
          remainingContacts === 'unlimited' && styles.premiumContactsContainer,
          isSelectionMode && styles.selectionModeActiveContainer
        ]}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={24} color={COLORS.gray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search contacts"
              placeholderTextColor={COLORS.gray}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Emphasis toggle — choose whether name or company is the bold/primary line.
              Hidden while the detail panel is open so the tapped contact gets the room. */}
          {!contactPanelVisible && (
          <View style={styles.emphasisToggleRow}>
            <Text style={styles.emphasisToggleLabel}>Show by</Text>
            <View style={styles.emphasisToggleGroup}>
              <TouchableOpacity
                style={[styles.emphasisOption, emphasisField === 'name' && styles.emphasisOptionActive]}
                onPress={() => updateEmphasisField('name')}
                activeOpacity={0.8}
              >
                <Text style={[styles.emphasisOptionText, emphasisField === 'name' && styles.emphasisOptionTextActive]}>
                  Name
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emphasisOption, emphasisField === 'company' && styles.emphasisOptionActive]}
                onPress={() => updateEmphasisField('company')}
                activeOpacity={0.8}
              >
                <Text style={[styles.emphasisOptionText, emphasisField === 'company' && styles.emphasisOptionTextActive]}>
                  Company
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          )}

          {!contactPanelVisible && cardFilterOptions.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>Filter</Text>
              <FeatureTip
                tipKey="contacts_filter_bar"
                content="Filter your contacts by which card they scanned"
                position="top"
              >
                <TouchableOpacity
                  style={styles.filterDropdownTrigger}
                  onPress={() => {
                    if (triggerUpsell({ featureName: 'Contact Filter', description: 'Filter contacts by card lets you instantly find contacts from a specific card. Upgrade to Premium to use this feature.' })) return;
                    setIsCardFilterDropdownVisible((prev) => !prev);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.filterTriggerContent}>
                    {selectedCardFilterOption?.isSpeakerEngagementCard && (
                      !isFreeUser ? (
                        <FeatureTip
                          tipKey="contacts_speaker_icon"
                          content="A speaker engagement card is currently selected"
                          position="bottom"
                        >
                          <View style={styles.speakerIndicatorDot} />
                        </FeatureTip>
                      ) : (
                        <View style={styles.speakerIndicatorDot} />
                      )
                    )}
                    <Text style={styles.filterDropdownTriggerText}>
                      {selectedCardFilterLabel}
                    </Text>
                  </View>
                  <MaterialIcons
                    name={isCardFilterDropdownVisible ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                    size={24}
                    color={COLORS.gray}
                  />
                </TouchableOpacity>
              </FeatureTip>

              {/* Only visible while a Speaker & Engagement Card is the active filter */}
              {selectedCardFilterOption?.isSpeakerEngagementCard && (
                <TouchableOpacity
                  style={styles.downloadSpeakerCsvButton}
                  onPress={handleDownloadSpeakerCsv}
                  disabled={isDownloadingSpeakerCsv}
                  activeOpacity={0.8}
                >
                  {isDownloadingSpeakerCsv ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <MaterialIcons name="file-download" size={18} color={COLORS.primary} />
                  )}
                  <Text style={styles.downloadSpeakerCsvText}>Download CSV</Text>
                </TouchableOpacity>
              )}

              {isCardFilterDropdownVisible && (
                <View style={styles.filterDropdownMenu}>
                  <TouchableOpacity
                    style={styles.filterDropdownItem}
                    onPress={() => {
                      setSelectedCardFilter('all');
                      setIsCardFilterDropdownVisible(false);
                    }}
                  >
                    <Text style={styles.filterDropdownItemText}>All Cards</Text>
                    {selectedCardFilter === 'all' && (
                      <MaterialIcons name="check" size={18} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>

                  {cardFilterOptions.map((card) => {
                    const isSelected = selectedCardFilter === card.cardIndex;

                    return (
                      <TouchableOpacity
                        key={card.cardIndex}
                        style={styles.filterDropdownItem}
                        onPress={() => {
                          setSelectedCardFilter(card.cardIndex);
                          setIsCardFilterDropdownVisible(false);
                        }}
                      >
                        <View style={styles.filterDropdownItemContent}>
                          <Text
                            style={[
                              styles.filterDropdownItemText,
                              isSelected && styles.filterDropdownItemTextActive
                            ]}
                          >
                            {card.label}
                          </Text>
                          {card.isSpeakerEngagementCard && (
                            !isFreeUser && card.cardIndex === firstSpeakerCardIndex ? (
                              <FeatureTip
                                tipKey="contacts_engagement_indicator"
                                content="Speaker engagement cards track contacts from events"
                                position="right"
                              >
                                <View style={styles.speakerBadge}>
                                  <View style={styles.speakerBadgeDot} />
                                  <Text style={styles.speakerBadgeText}>Speaker</Text>
                                </View>
                              </FeatureTip>
                            ) : (
                              <View style={styles.speakerBadge}>
                                <View style={styles.speakerBadgeDot} />
                                <Text style={styles.speakerBadgeText}>Speaker</Text>
                              </View>
                            )
                          )}
                        </View>
                        {isSelected && (
                          <MaterialIcons name="check" size={18} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {!contactPanelVisible && contacts.length > 0 && (
            <View style={styles.selectionToggleRow}>
              <TouchableOpacity
                onPress={toggleSelectionMode}
                style={[
                  styles.selectionToggleButton,
                  isSelectionMode && styles.selectionToggleButtonActive
                ]}
              >
                <MaterialIcons
                  name={isSelectionMode ? 'close' : 'check-circle-outline'}
                  size={20}
                  color={isSelectionMode ? COLORS.white : COLORS.primary}
                />
                <Text
                  style={[
                    styles.selectionToggleText,
                    isSelectionMode && styles.selectionToggleTextActive
                  ]}
                >
                  {isSelectionMode ? 'Cancel Selection' : 'Select Contacts'}
                </Text>
              </TouchableOpacity>
              {isSelectionMode && (
                <Text style={styles.selectionHintText}>Tap contacts to select</Text>
              )}
            </View>
          )}

          {/* Loading State */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colorScheme} />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : filteredContacts.length === 0 ? (
            /* Empty State */
            <View style={styles.emptyStateContainer}>
              <MaterialIcons name="people" size={64} color={COLORS.gray} />
              <Text style={styles.emptyStateTitle}>
                {searchQuery || selectedCardFilter !== 'all' ? 'No contacts found' : 'No contacts yet'}
              </Text>
              <Text style={styles.emptyStateDescription}>
                {searchQuery
                  ? 'Try adjusting your search terms'
                  : selectedCardFilter !== 'all'
                    ? 'No contacts were captured from the selected card yet'
                    : 'When you share your card and they share their details back, they will appear here'}
              </Text>
              {!searchQuery && selectedCardFilter === 'all' && (
                <>
                  <FeatureTip
                    tipKey="contacts_add_button"
                    content="Contacts appear here after scanning your card"
                    position="bottom"
                  >
                    <TouchableOpacity style={dynamicStyles.shareCardButton} onPress={() => handleShare()}>
                      <MaterialIcons name="share" size={24} color={COLORS.white} />
                      <Text style={styles.shareCardButtonText}>Share my card</Text>
                    </TouchableOpacity>
                  </FeatureTip>
                  <TouchableOpacity style={styles.emptyAddManuallyButton} onPress={openAddContact}>
                    <MaterialIcons name="person-add-alt-1" size={20} color={colorScheme} />
                    <Text style={[styles.emptyAddManuallyText, { color: colorScheme }]}>Add a contact manually</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            /* Contact List */
            <View ref={listWrapperRef} style={styles.contactsListWrapper}>
            <ScrollView
              ref={contactsScrollRef}
              style={styles.contactsList}
              contentContainerStyle={{
                // While the panel is open, pad the bottom so even the last contact
                // can scroll up into the priority zone above the docked panel.
                // Otherwise keep enough room to clear the floating tab-bar pill.
                paddingBottom: contactPanelVisible ? Dimensions.get('window').height * 0.6 : 110,
              }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colorScheme]}
                  tintColor={colorScheme}
                />
              }
              onScroll={(e) => {
                const y = e.nativeEvent.contentOffset.y;
                tabBarScrollY.setValue(y);
                contactsScrollY.current = y;
              }}
              scrollEventThrottle={16}
            >
              {filteredContacts.map((contact, index) => {
                const contactKey = getContactKey(contact);
                const isSelected = selectedContactKeys.has(contactKey);
                const card = (
                  <Swipeable
                    key={contactKey}
                    ref={(el) => swipeableRefs.current.set(contactKey, el)}
                    enabled={!isSelectionMode}
                    renderRightActions={(progress, dragX) => 
                      RenderRightActions(progress, dragX, contact)
                    }
                    renderLeftActions={(progress, dragX) => 
                      RenderLeftActions(progress, dragX, contact)
                    }
                  >
                    <TouchableOpacity
                      style={[styles.contactCard, isSelected && styles.contactCardSelected]}
                      onPress={(e) => handleContactPress(contact, contactKey, e.nativeEvent.pageY, index)}
                      onLongPress={() => openCopyFieldSheet(contact)}
                      activeOpacity={0.7}
                      delayLongPress={250}
                    >
                      <View style={styles.contactLeft}>
                        {isSelectionMode && (
                          <View style={[
                            styles.selectionIndicator,
                            isSelected && styles.selectionIndicatorSelected
                          ]}>
                            {isSelected && (
                              <MaterialIcons name="check" size={16} color={COLORS.white} />
                            )}
                          </View>
                        )}
                        <LazyContactImage 
                          contact={contact}
                          style={styles.contactImage}
                        />
                        <View style={styles.contactInfo}>
                          {/* List view shows only name, company, phone and timestamp — the rest
                              (email, met-at, location) is one tap away in the detail modal.
                              The emphasis toggle controls both bold weight AND vertical order:
                              the selected field is always bold and appears first/top. */}
                          {emphasisField === 'company' && contact.company ? (
                            <>
                              {/* Prioritized field: shrink to fit rather than truncate with an ellipsis. */}
                              <Text
                                style={styles.contactPrimaryText}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.5}
                              >
                                {contact.company}
                              </Text>
                              <Text style={styles.contactSecondaryText} numberOfLines={1}>
                                {contact.name} {contact.surname}
                              </Text>
                            </>
                          ) : (
                            <>
                              {/* Prioritized field: shrink to fit rather than truncate with an ellipsis. */}
                              <Text
                                style={styles.contactPrimaryText}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.5}
                              >
                                {contact.name} {contact.surname}
                              </Text>
                              {!!contact.company && (
                                <Text style={styles.contactSecondaryText} numberOfLines={1}>
                                  {contact.company}
                                </Text>
                              )}
                            </>
                          )}
                          <View style={styles.contactSubInfo}>
                            <Text style={styles.contactPhone}>
                              {formatPhoneWithCountryCode(contact.phone)}
                            </Text>
                            <Text style={styles.contactDate}>
                              {formatTimestamp(contact.createdAt)}
                            </Text>
                          </View>
                          {contact.followUpStatus && contact.followUpStatus !== 'cancelled' && (
                            <FollowUpRow
                              contact={contact}
                              displayIndex={index}
                              contacts={contacts}
                              userId={userId}
                              onStatusChange={(updated) => {
                                setContacts((prev) =>
                                  prev.map((c) => (c === contact ? updated : c))
                                );
                              }}
                            />
                          )}
                        </View>
                        <View style={styles.contactImageSpacer} />
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                );
                // Anchor the contacts tip to the first item only.
                const item = index === 0 ? (
                  <FeatureTip
                    tipKey="contacts_list_item"
                    content="Tap contact to view more, export to device etc"
                    position="bottom"
                  >
                    {card}
                  </FeatureTip>
                ) : card;
                // Wrap in a measured View so we know each card's offset within the
                // list and can scroll the tapped one up to the dock line.
                return (
                  <View
                    key={contactKey}
                    onLayout={(e) => {
                      const { y, height } = e.nativeEvent.layout;
                      cardLayouts.current.set(contactKey, { y, height });
                    }}
                  >
                    {item}
                  </View>
                );
              })}
            </ScrollView>
            </View>
          )}
        </View>

        {/* Share Modal */}
        <Modal
          visible={isShareModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            console.log('🎯 Share modal close requested');
            setIsShareModalVisible(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  console.log('🎯 Share modal close button pressed');
                  setIsShareModalVisible(false);
                }}
              >
                <MaterialIcons name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Share via</Text>
              <View style={styles.shareOptions}>
                {shareOptions.map((option) => (
                  <TouchableOpacity
                    key={option.id}
                    style={styles.shareOption}
                    onPress={() => handlePlatformSelect(option.id)}
                  >
                     <View style={[styles.iconCircle, { backgroundColor: option.color }]}>
                       {option.id === 'whatsapp' ? (
                         <MaterialCommunityIcons name="whatsapp" size={22} color={COLORS.white} />
                       ) : option.id === 'linkedin' ? (
                         <MaterialCommunityIcons name="linkedin" size={22} color={COLORS.white} />
                       ) : (
                         <MaterialIcons name={option.icon as 'send' | 'email' | 'more-horiz'} size={22} color={COLORS.white} />
                       )}
                     </View>
                    <Text style={styles.shareOptionText} numberOfLines={1}>{option.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {/* Copy Field Action Sheet (Long-Press) */}
        <Modal
          visible={isCopyFieldSheetVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeCopyFieldSheet}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={closeCopyFieldSheet}
          >
            <TouchableOpacity
              style={styles.modalContent}
              activeOpacity={1}
              onPress={() => null}
            >
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeCopyFieldSheet}
              >
                <MaterialIcons name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>

              <Text style={styles.modalTitle}>Copy to clipboard</Text>

              {selectedContactForCopy && (
                <View style={styles.copySheetList}>
                  <TouchableOpacity
                    style={styles.copySheetRow}
                    onPress={() => copyContactField(selectedContactForCopy, 'phone')}
                  >
                    <Text style={styles.copySheetRowText}>Phone Number</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copySheetRow}
                    onPress={() => copyContactField(selectedContactForCopy, 'nameShort')}
                  >
                    <Text style={styles.copySheetRowText}>Name (short/display name)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copySheetRow}
                    onPress={() => copyContactField(selectedContactForCopy, 'email')}
                  >
                    <Text style={styles.copySheetRowText}>Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copySheetRow}
                    onPress={() => copyContactField(selectedContactForCopy, 'metAt')}
                  >
                    <Text style={styles.copySheetRowText}>Met At (location/place)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copySheetRow}
                    onPress={() => copyContactField(selectedContactForCopy, 'dateMet')}
                  >
                    <Text style={styles.copySheetRowText}>Date Met</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.copySheetRow}
                    onPress={() => copyContactField(selectedContactForCopy, 'fullName')}
                  >
                    <Text style={styles.copySheetRowText}>Full Name</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.copySheetRow, styles.copySheetCancelRow]}
                    onPress={closeCopyFieldSheet}
                  >
                    <Text style={[styles.copySheetRowText, styles.copySheetCancelText]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Contact Options Modal */}
        <Modal
          visible={isContactOptionsVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            console.log('📱 Contact options modal close requested');
            setIsContactOptionsVisible(false);
            setSelectedContactForOptions(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsContactOptionsVisible(false);
                  setSelectedContactForOptions(null);
                }}
              >
                <MaterialIcons name="close" size={24} color={COLORS.black} />
              </TouchableOpacity>

              {selectedContactForOptions && (
                <>
                  <View style={styles.selectedContactHeader}>
                    <View style={styles.modalContactImageContainer}>
                      <LazyContactImage 
                        contact={selectedContactForOptions}
                        style={styles.modalContactImage}
                      />
                    </View>
                    <Pressable
                      onPressIn={() => setPressedCopyRowId('heading_full_name')}
                      onPressOut={() => setPressedCopyRowId(null)}
                      onLongPress={() => {
                        const fullName = `${selectedContactForOptions.name || ''} ${selectedContactForOptions.surname || ''}`.trim();
                        copyToClipboard('Full name', fullName);
                        setTimeout(() => setPressedCopyRowId(null), 150);
                      }}
                      delayLongPress={200}
                      style={[
                        pressedCopyRowId === 'heading_full_name' && styles.copyRowActive,
                        styles.copyHeadingPressable,
                      ]}
                    >
                      <Text style={styles.modalContactName}>
                        {selectedContactForOptions.name} {selectedContactForOptions.surname}
                      </Text>
                    </Pressable>
                      {selectedContactForOptions.isXsCardUser && (
                        <View style={styles.xsCardUserBadge}>
                          <MaterialIcons name="verified" size={16} color={COLORS.primary} />
                          <Text style={styles.xsCardUserText}>XS Card User</Text>
                        </View>
                      )}
                  </View>

                  {/* Contact Information Section */}
                  <View style={styles.contactInfoSection}>
                    <Pressable
                      onPressIn={() => setPressedCopyRowId('row_name_short')}
                      onPressOut={() => setPressedCopyRowId(null)}
                      onLongPress={() => {
                        copyToClipboard('Name', String(selectedContactForOptions.name || '').trim());
                        setTimeout(() => setPressedCopyRowId(null), 150);
                      }}
                      delayLongPress={200}
                      style={[
                        styles.contactInfoRow,
                        pressedCopyRowId === 'row_name_short' && styles.copyRowActive,
                      ]}
                    >
                      <MaterialIcons name="person" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                      <Text style={styles.contactInfoText}>{String(selectedContactForOptions.name || '').trim()}</Text>
                    </Pressable>

                    <Pressable
                      onPressIn={() => setPressedCopyRowId('row_phone')}
                      onPressOut={() => setPressedCopyRowId(null)}
                      onPress={() => {
                        const display = formatPhoneWithCountryCode(selectedContactForOptions.phone || '');
                        const dialNumber = String(selectedContactForOptions.phone || '').replace(/[^0-9+]/g, '');
                        if (!dialNumber) return;
                        Alert.alert(
                          'Call contact',
                          `Call ${display}?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Call',
                              onPress: () => {
                                Linking.openURL(`tel:${dialNumber}`).catch(() =>
                                  Alert.alert('Unable to call', 'No phone app is available to place this call.')
                                );
                              },
                            },
                          ],
                        );
                      }}
                      onLongPress={() => {
                        copyToClipboard('Phone number', formatPhoneWithCountryCode(selectedContactForOptions.phone || ''));
                        setTimeout(() => setPressedCopyRowId(null), 150);
                      }}
                      delayLongPress={200}
                      style={[
                        styles.contactInfoRow,
                        pressedCopyRowId === 'row_phone' && styles.copyRowActive,
                      ]}
                    >
                      <MaterialIcons name="phone" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                      <Text style={styles.contactInfoText}>{formatPhoneWithCountryCode(selectedContactForOptions.phone)}</Text>
                    </Pressable>
                    
                    {selectedContactForOptions.email && (
                      <Pressable
                        onPressIn={() => setPressedCopyRowId('row_email')}
                        onPressOut={() => setPressedCopyRowId(null)}
                        onPress={() => {
                          const emailAddress = String(selectedContactForOptions.email || '').trim();
                          if (!emailAddress) return;
                          Alert.alert(
                            'Email contact',
                            `Send an email to ${emailAddress}?`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Email',
                                onPress: () => {
                                  Linking.openURL(`mailto:${emailAddress}`).catch(() =>
                                    Alert.alert('Unable to email', 'No email app is available on this device.')
                                  );
                                },
                              },
                            ],
                          );
                        }}
                        onLongPress={() => {
                          copyToClipboard('Email', String(selectedContactForOptions.email || '').trim());
                          setTimeout(() => setPressedCopyRowId(null), 150);
                        }}
                        delayLongPress={200}
                        style={[
                          styles.contactInfoRow,
                          pressedCopyRowId === 'row_email' && styles.copyRowActive,
                        ]}
                      >
                        <MaterialIcons name="email" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                        <Text style={styles.contactInfoText}>{selectedContactForOptions.email}</Text>
                      </Pressable>
                    )}
                    
                    {selectedContactForOptions.company && (
                      <Pressable
                        onPressIn={() => setPressedCopyRowId('row_company')}
                        onPressOut={() => setPressedCopyRowId(null)}
                        onLongPress={() => {
                          copyToClipboard('Company', String(selectedContactForOptions.company || '').trim());
                          setTimeout(() => setPressedCopyRowId(null), 150);
                        }}
                        delayLongPress={200}
                        style={[
                          styles.contactInfoRow,
                          pressedCopyRowId === 'row_company' && styles.copyRowActive,
                        ]}
                      >
                        <MaterialIcons name="business" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                        <Text style={styles.contactInfoText}>{selectedContactForOptions.company}</Text>
                      </Pressable>
                    )}
                    
                    <Pressable
                      onPressIn={() => setPressedCopyRowId('row_met_at')}
                      onPressOut={() => setPressedCopyRowId(null)}
                      onLongPress={() => {
                        copyToClipboard('Met at', String(selectedContactForOptions.howWeMet || '').trim());
                        setTimeout(() => setPressedCopyRowId(null), 150);
                      }}
                      delayLongPress={200}
                      style={[
                        styles.contactInfoRow,
                        pressedCopyRowId === 'row_met_at' && styles.copyRowActive,
                      ]}
                    >
                      <MaterialIcons name="place" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                      <Text style={styles.contactInfoText}>Met at: {selectedContactForOptions.howWeMet}</Text>
                    </Pressable>

                    <Pressable
                      onPressIn={() => setPressedCopyRowId('row_date_met')}
                      onPressOut={() => setPressedCopyRowId(null)}
                      onLongPress={() => {
                        copyToClipboard('Date met', formatTimestamp(selectedContactForOptions.createdAt));
                        setTimeout(() => setPressedCopyRowId(null), 150);
                      }}
                      delayLongPress={200}
                      style={[
                        styles.contactInfoRow,
                        pressedCopyRowId === 'row_date_met' && styles.copyRowActive,
                      ]}
                    >
                      <MaterialIcons name="event" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                      <Text style={styles.contactInfoText}>{formatTimestamp(selectedContactForOptions.createdAt)}</Text>
                    </Pressable>

                    {hasContactLocation(selectedContactForOptions.location) && (
                      <View>
                        <View style={styles.contactInfoRow}>
                          <MaterialCommunityIcons name="map-marker" size={20} color={COLORS.primary} style={styles.contactInfoIcon} />
                          <Text style={styles.contactInfoText}>
                            {getContactLocationLabel(selectedContactForOptions.location) ||
                              selectedContactForOptions.location.formattedAddress ||
                              'Location available'}
                          </Text>
                        </View>

                        {!!selectedContactForOptions.location.formattedAddress &&
                          getContactLocationLabel(selectedContactForOptions.location) !==
                            selectedContactForOptions.location.formattedAddress && (
                            <Text style={styles.contactLocationDetailText}>
                              {selectedContactForOptions.location.formattedAddress}
                            </Text>
                          )}

                        {(() => {
                          const capturedAt =
                            selectedContactForOptions.location.capturedAt ||
                            selectedContactForOptions.locationCapturedAt;
                          if (!capturedAt) return null;
                          const d = new Date(capturedAt);
                          if (isNaN(d.getTime())) return null;
                          const formatted = d.toLocaleDateString('en-GB', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          });
                          return (
                            <Text style={styles.contactLocationDetailText}>
                              Met on {formatted}
                            </Text>
                          );
                        })()}

                        <TouchableOpacity
                          style={styles.viewOnMapsButton}
                          onPress={() => openContactLocationInMaps(selectedContactForOptions.location!)}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="google-maps" size={18} color={COLORS.white} style={{ marginRight: 8 }} />
                          <Text style={styles.viewOnMapsButtonText}>View on Google Maps</Text>
                        </TouchableOpacity>

                        <Text style={styles.locationDisclaimer}>
                          Location captured when contact scanned your card
                        </Text>
                      </View>
                    )}

                  </View>

                  <View style={styles.contactActionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                      onPress={() => {
                        handleExportContact(selectedContactForOptions);
                        setIsContactOptionsVisible(false);
                        setSelectedContactForOptions(null);
                      }}
                    >
                      <MaterialIcons name="person-add" size={24} color={COLORS.white} />
                      <Text style={styles.actionButtonText}>Add to Phone</Text>
                    </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#2196F3' }]}
                        onPress={() => {
                          console.log('🔥 SHARE BUTTON PRESSED!');
                          console.log('🔥 selectedContactForOptions:', selectedContactForOptions ? `${selectedContactForOptions.name} ${selectedContactForOptions.surname}` : 'null');
                          console.log('🔥 Current isContactOptionsVisible:', isContactOptionsVisible);
                          console.log('🔥 Current isShareModalVisible:', isShareModalVisible);
                          
                          // Capture the contact before clearing state
                          const contactToShare = selectedContactForOptions;
                          console.log('🔥 Captured contactToShare:', contactToShare ? `${contactToShare.name} ${contactToShare.surname}` : 'null');
                          
                          // Set the pending share contact (this will trigger the useEffect when modal closes)
                          console.log('🔥 Setting pending share contact');
                          setPendingShareContact(contactToShare);
                          
                          // Close contact options modal
                          console.log('🔥 Closing contact options modal...');
                          setIsContactOptionsVisible(false);
                          setSelectedContactForOptions(null);
                          console.log('🔥 Contact options modal closed, waiting for useEffect to trigger share');
                        }}
                      >
                      <MaterialIcons name="share" size={24} color={COLORS.white} />
                      <Text style={styles.actionButtonText}>Share Contact</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#FF0000' }]}
                      onPress={() => {
                        setIsContactOptionsVisible(false);
                        setSelectedContactForOptions(null);
                        if (selectedContactForOptions) {
                          handleDeleteContact(selectedContactForOptions);
                        }
                      }}
                    >
                      <MaterialIcons name="delete" size={24} color={COLORS.white} />
                      <Text style={styles.actionButtonText}>Delete Contact</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </View>
        </Modal>

        {/* Manual add-contact uses a top-docked draggable panel (AddContactPanel),
            rendered below alongside the contact detail panel. */}

        {/* Limit Modal */}
        <Modal
          visible={showLimitModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowLimitModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Contact Limit Reached</Text>
              <Text style={styles.modalMessage}>
                You have reached the limit of {FREE_PLAN_CONTACT_LIMIT} contacts for free users. 
                Upgrade to Premium to add unlimited contacts!
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowLimitModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Maybe Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, { backgroundColor: colorScheme }]}
                  onPress={navigateToUpgrade}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {isSelectionMode && (
          <View style={styles.selectionModeBar}>
            <Text style={styles.selectionCountText}>
              {selectedContactKeys.size} selected
            </Text>
            <TouchableOpacity
              style={[
                styles.selectionDeleteButton,
                (!selectedContactKeys.size || isBulkDeleting) && styles.selectionDeleteButtonDisabled
              ]}
              disabled={!selectedContactKeys.size || isBulkDeleting}
              onPress={handleBulkDeleteConfirmation}
            >
              {isBulkDeleting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <MaterialIcons name="delete" size={20} color={COLORS.white} />
                  <Text style={styles.selectionDeleteButtonText}>Delete</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Contacts Upsell Modal */}
        <Modal
          visible={showUpsellModal}
          transparent
          animationType="fade"
          onRequestClose={dismissUpsellModal}
          statusBarTranslucent
        >
          <TouchableWithoutFeedback onPress={dismissUpsellModal}>
            <View style={styles.upsellOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.upsellCard}>
                  <TouchableOpacity
                    style={styles.upsellCloseButton}
                    onPress={dismissUpsellModal}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={22} color={COLORS.gray} />
                  </TouchableOpacity>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={{ width: '100%' }}
                    contentContainerStyle={styles.upsellScrollContent}
                  >
                    <MaterialCommunityIcons
                      name="account-network"
                      size={72}
                      color={COLORS.primary}
                      style={styles.upsellHeroIcon}
                    />
                    <Text style={styles.upsellHeadline}>Your Network is Your Net Worth</Text>
                    <Text style={styles.upsellBody}>
                      85% of opportunities in business come through people you know, not job boards, not cold emails. The professionals who grow fastest aren't the most talented, they're the most connected.
                    </Text>
                    <Text style={[styles.upsellBody, { marginTop: 10 }]}>
                      The average person needs over 200 meaningful connections to fully unlock the opportunities around them. Right now, you're building something real. Don't let your network hit a ceiling.
                    </Text>
                    <Text style={[styles.upsellBody, { marginTop: 12 }]}>
                      Ready to go further?{' '}
                      <Text style={styles.upsellLink} onPress={handleUpsellUnlockPremium}>
                        Unlock Premium
                      </Text>
                    </Text>
                    <TouchableOpacity
                      style={styles.upsellPrimaryButton}
                      onPress={handleUpsellUnlockPremium}
                      activeOpacity={0.85}
                    >
                      <MaterialIcons name="star" size={18} color={COLORS.white} style={styles.upsellBtnIcon} />
                      <Text style={styles.upsellPrimaryButtonText}>Unlock Premium</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.upsellSecondaryButton}
                      onPress={dismissUpsellModal}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.upsellSecondaryButtonText}>Maybe Later</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.upsellDontShowRow}
                      onPress={() => setUpsellDontShow((v) => !v)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: upsellDontShow }}
                      activeOpacity={0.7}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <View style={[styles.upsellCheckbox, upsellDontShow && styles.upsellCheckboxChecked]}>
                        {upsellDontShow && (
                          <MaterialIcons name="check" size={14} color={COLORS.white} />
                        )}
                      </View>
                      <Text style={styles.upsellDontShowLabel}>Don't show again</Text>
                    </TouchableOpacity>
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.upsellInfoButton}
                    onPress={() => setShowUpsellInfoModal(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="info-outline" size={14} color={COLORS.gray} style={{ marginRight: 4 }} />
                    <Text style={styles.upsellInfoText}>What does premium unlock?</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Upsell nested info modal */}
        <Modal
          visible={showUpsellInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUpsellInfoModal(false)}
          statusBarTranslucent
        >
          <TouchableWithoutFeedback onPress={() => setShowUpsellInfoModal(false)}>
            <View style={styles.upsellOverlay}>
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={[styles.upsellCard, { paddingBottom: 30 }]}>
                  <TouchableOpacity
                    style={styles.upsellCloseButton}
                    onPress={() => setShowUpsellInfoModal(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="close" size={22} color={COLORS.gray} />
                  </TouchableOpacity>
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={{ width: '100%' }}
                    contentContainerStyle={styles.upsellScrollContent}
                  >
                    <Text style={styles.upsellHeadline}>Premium Contacts</Text>
                    <Text style={styles.upsellBody}>
                      With premium, your contacts are unlimited. See who engaged with your card, when they scanned it, and how often. Filter by engagement level, get notified when a contact views your card again, and use the calendar to turn connections into appointments — all from one place.
                    </Text>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
      </View>
      </View>

      {/* Draggable contact detail panel — replaces the options popup. Scrolls through
          the full filtered list so the next contact peeks in beneath the tapped one. */}
      {contactPanelVisible && contactPanelContact && (
        <ContactDetailPanel
          contacts={filteredContacts}
          initialIndex={contactPanelIndex}
          visible={contactPanelVisible}
          dockedTop={contactPanelDockedTop}
          onClose={() => setContactPanelVisible(false)}
          onIndexChange={(index) => {
            setContactPanelIndex(index);
            const next = filteredContacts[index];
            if (next) setContactPanelContact(next);
          }}
        />
      )}

      {/* Top-docked draggable add-contact sheet — same mechanics as the contact
          detail panel, but opens all the way at the top. */}
      <AddContactPanel
        visible={isAddContactVisible}
        form={addContactForm}
        onChange={updateAddContactField}
        submitting={isAddingContact}
        onSubmit={handleAddContactSubmit}
        onClose={closeAddContact}
        accentColor={colorScheme}
      />
    </GestureHandlerRootView>
  );
}

// Complete styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contentShell: {
    flex: 1,
    marginTop: 100,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.white,
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 20,
  },
  contentShellInner: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  contactCountContainer: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginTop: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eeeeee',
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactCountIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactCountContent: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  contactCountText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarContainer: {
    width: '100%',
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  upgradeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '600',
  },
  contactsContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  premiumContactsContainer: {
    paddingTop: 8,
  },
  selectionModeActiveContainer: {
    paddingBottom: 120,
  },
  searchContainer: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: 15,
    marginTop: 10,
    borderRadius: 25,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
  },
  emphasisToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
    gap: 10,
  },
  emphasisToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
  },
  emphasisToggleGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.gray + '15',
    borderRadius: 20,
    padding: 3,
  },
  emphasisOption: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 17,
  },
  emphasisOptionActive: {
    backgroundColor: COLORS.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  emphasisOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.gray,
  },
  emphasisOptionTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  filterSection: {
    marginHorizontal: 15,
    marginTop: -4,
    marginBottom: 10,
  },
  filterSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.gray,
    marginBottom: 8,
  },
  filterDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray + '35',
    borderRadius: 25,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  filterTriggerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  filterDropdownTriggerText: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '500',
  },
  downloadSpeakerCsvButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  downloadSpeakerCsvText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  filterDropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.gray + '25',
    borderRadius: 18,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  filterDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '12',
  },
  filterDropdownItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  filterDropdownItemText: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '500',
    flexShrink: 1,
  },
  filterDropdownItemTextActive: {
    color: COLORS.primary,
  },
  speakerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#FFF4D6',
  },
  speakerBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#F4B400',
    marginRight: 6,
  },
  speakerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A5A00',
  },
  speakerIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F4B400',
    marginRight: 8,
  },
  selectionToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 15,
    marginBottom: 10,
  },
  selectionToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  selectionToggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  selectionToggleText: {
    marginLeft: 8,
    color: COLORS.primary,
    fontWeight: '600',
  },
  selectionToggleTextActive: {
    color: COLORS.white,
  },
  selectionHintText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: COLORS.gray,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  shareCardButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyAddManuallyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  emptyAddManuallyText: {
    fontSize: 15,
    fontWeight: '600',
  },
  contactsListWrapper: {
    flex: 1,
  },
  contactsList: {
    flex: 1,
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginHorizontal: 10,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.gray + '15',
  },
  contactCardSelected: {
    borderColor: COLORS.primary,
  },
  contactLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gray,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  selectionIndicatorSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  contactImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  contactImageSpacer: {
    width: 72, // matches contactImage (56) + marginRight (16)
  },
  xsCardBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  imageLoadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Primary line carries the emphasis (bold, larger) — either the person's
  // name or their company, depending on the "Show by" toggle. Centered to
  // match the reference layout.
  contactPrimaryText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.black,
    textAlign: 'center',
  },
  // Secondary line is always the smaller, regular-weight counterpart.
  contactSecondaryText: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.gray,
    textAlign: 'center',
  },
  contactSubInfo: {
    marginTop: 6,
    gap: 4,
    alignItems: 'center',
  },
  contactPhone: {
    fontSize: 15,
    color: COLORS.gray,
    textAlign: 'center',
  },
  contactEmail: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 4,
    textAlign: 'center',
  },
  contactHowWeMet: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 2,
    textAlign: 'center',
  },
  contactDate: {
    fontSize: 12,
    color: COLORS.gray + '99',
    marginTop: 4,
    textAlign: 'center',
  },
  // Geolocation — list row
  contactLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  contactLocationIcon: {
    marginRight: 4,
  },
  contactLocationText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.gray,
  },
  // Geolocation — detail modal
  contactLocationDetailText: {
    fontSize: 13,
    color: COLORS.gray,
    marginLeft: 32,
    marginTop: 2,
    lineHeight: 18,
  },
  viewOnMapsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10,
    marginLeft: 32,
    alignSelf: 'flex-start',
  },
  viewOnMapsButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  locationDisclaimer: {
    fontSize: 10,
    color: COLORS.gray,
    marginLeft: 32,
    marginTop: 8,
    fontStyle: 'italic',
  },
  deleteAction: {
    backgroundColor: '#FF0000',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  shareAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  selectionModeBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1B2B5B',
  },
  selectionCountText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  selectionDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
  },
  selectionDeleteButtonDisabled: {
    backgroundColor: '#BDBDBD',
  },
  selectionDeleteButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    padding: 30,
    borderRadius: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 60,
    elevation: 20,
    zIndex: 1001,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  shareOptions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    width: '100%',
    paddingHorizontal: 5,
  },
  shareOption: {
    alignItems: 'center',
    padding: 4,
    flex: 1,
    maxWidth: 60,
  },
  shareOptionText: {
    fontSize: 10,
    color: COLORS.black,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedContactHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 12,
  },
  modalContactImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 12,
  },
  xsCardUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${COLORS.primary}80`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
  },
  xsCardUserText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  modalContactImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  modalContactName: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: '-apple-system',
  },
  contactInfoSection: {
    width: '100%',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 8,
  },
  contactInfoIcon: {
    marginRight: 15,
    width: 24,
    textAlign: 'center',
  },
  contactInfoText: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
    flex: 1,
    fontFamily: '-apple-system',
  },
  contactActionButtons: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 25,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray,
  },
  cancelButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  copyRowActive: {
    backgroundColor: 'rgba(27, 43, 91, 0.08)',
    borderRadius: 12,
  },
  copyHeadingPressable: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  copySheetList: {
    marginTop: 8,
    width: '100%',
    gap: 10,
  },
  copySheetRow: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
  },
  copySheetRowText: {
    color: COLORS.black,
    fontSize: 16,
    fontWeight: '600',
  },
  copySheetCancelRow: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E6E6E6',
  },
  copySheetCancelText: {
    textAlign: 'center',
  },
  upsellOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999,
    elevation: 20,
  },
  upsellCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingBottom: 44,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    maxHeight: '85%' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  upsellScrollContent: {
    paddingHorizontal: 30,
    paddingTop: 30,
    paddingBottom: 8,
    alignItems: 'center' as const,
  },
  upsellCloseButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  upsellHeroIcon: {
    marginTop: 8,
    marginBottom: 16,
  },
  upsellHeadline: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: COLORS.secondary,
    marginBottom: 12,
    textAlign: 'center',
  },
  upsellBody: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  upsellLink: {
    color: COLORS.primary,
    fontWeight: '700' as const,
  },
  upsellPrimaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    marginTop: 8,
    marginBottom: 12,
  },
  upsellBtnIcon: {
    marginRight: 8,
  },
  upsellPrimaryButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700' as const,
  },
  upsellSecondaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  upsellSecondaryButtonText: {
    color: COLORS.gray,
    fontSize: 15,
    fontWeight: '500' as const,
  },
  upsellInfoButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  upsellInfoText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500' as const,
  },
  upsellDontShowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginTop: 18,
    paddingBottom: 16,
  },
  upsellCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.gray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  upsellCheckboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  upsellDontShowLabel: {
    fontSize: 12,
    color: COLORS.gray,
  },
});
