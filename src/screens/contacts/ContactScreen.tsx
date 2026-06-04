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
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';

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

// Constants
const FREE_PLAN_CONTACT_LIMIT = 20;
const DEFAULT_COUNTRY_CODE = '+27'; // South Africa

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
  company?: string;
  isSpeakerEngagementCard?: boolean;
}

const isSpeakerCardEnabled = (value: unknown): boolean => {
  return value === true || value === 'true';
};

const buildCardFilterOptions = (cards: UserCardRecord[]): UserCardFilterOption[] => {
  const companyUsage = new Map<string, number>();

  cards.forEach((card, index) => {
    const companyName = (card.company || '').trim() || `Card ${index + 1}`;
    companyUsage.set(companyName, (companyUsage.get(companyName) || 0) + 1);
  });

  const duplicateTracker = new Map<string, number>();

  return cards.map((card, index) => {
    const companyName = (card.company || '').trim() || `Card ${index + 1}`;
    const occurrence = (duplicateTracker.get(companyName) || 0) + 1;
    duplicateTracker.set(companyName, occurrence);
    const needsSuffix = (companyUsage.get(companyName) || 0) > 1;

    return {
      cardIndex: index,
      company: companyName,
      label: needsSuffix ? `${companyName} (Card ${index + 1})` : companyName,
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

// Main Component
export default function ContactsScreen() {
  // Navigation
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colorScheme } = useColorScheme();
  
  // Core state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const { triggerUpsell } = usePremiumUpsell();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userPlan, setUserPlan] = useState<UserPlan>('free');
  const [cardFilterOptions, setCardFilterOptions] = useState<UserCardFilterOption[]>([]);
  const [selectedCardFilter, setSelectedCardFilter] = useState<number | 'all'>('all');
  const [isCardFilterDropdownVisible, setIsCardFilterDropdownVisible] = useState(false);
  
  // Plan and limits
  const [remainingContacts, setRemainingContacts] = useState<number | 'unlimited'>(FREE_PLAN_CONTACT_LIMIT);
  
  // Modal states
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isContactOptionsVisible, setIsContactOptionsVisible] = useState(false);
  const [isCopyFieldSheetVisible, setIsCopyFieldSheetVisible] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  // Selected items
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactForOptions, setSelectedContactForOptions] = useState<Contact | null>(null);
  const [selectedContactForCopy, setSelectedContactForCopy] = useState<Contact | null>(null);
  const [pendingShareContact, setPendingShareContact] = useState<Contact | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContactKeys, setSelectedContactKeys] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [pressedCopyRowId, setPressedCopyRowId] = useState<string | null>(null);

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

  const hasAdvancedFeatures = getPlanLimits(userPlan).hasAdvancedFeatures;
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
  const handleContactPress = useCallback((contact: Contact) => {
    if (isSelectionMode) {
      toggleContactSelection(contact);
      return;
    }
    console.log('📱 Contact pressed:', `${contact.name} ${contact.surname}`);
    console.log('📱 Setting contact options modal visible');
    setSelectedContactForOptions(contact);
    setIsContactOptionsVisible(true);
    console.log('📱 Contact options modal should now be visible');
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

  // ============= RENDER =============

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <Header title="Contacts" />
        
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

          {cardFilterOptions.length > 0 && (
            <View style={styles.filterSection}>
              <Text style={styles.filterSectionLabel}>Filter</Text>
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
                    <View style={styles.speakerIndicatorDot} />
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
                            <View style={styles.speakerBadge}>
                              <View style={styles.speakerBadgeDot} />
                              <Text style={styles.speakerBadgeText}>Speaker</Text>
                            </View>
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

          {contacts.length > 0 && (
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
                <TouchableOpacity style={dynamicStyles.shareCardButton} onPress={() => handleShare()}>
                  <MaterialIcons name="share" size={24} color={COLORS.white} />
                  <Text style={styles.shareCardButtonText}>Share my card</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            /* Contact List */
            <ScrollView 
              style={styles.contactsList}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[colorScheme]}
                  tintColor={colorScheme}
                />
              }
              onScroll={() => {
                // Trigger visibility checks on scroll
                setTimeout(() => {
                  // This will trigger visibility checks for all LazyContactImage components
                }, 100);
              }}
              scrollEventThrottle={200}
            >
              {filteredContacts.map((contact) => {
                const contactKey = getContactKey(contact);
                const isSelected = selectedContactKeys.has(contactKey);
                return (
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
                      onPress={() => handleContactPress(contact)}
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
                          <Text style={styles.contactName}>
                            {contact.name} {contact.surname}
                          </Text>
                          <View style={styles.contactSubInfo}>
                            <Text style={styles.contactPhone}>
                              {formatPhoneWithCountryCode(contact.phone)}
                            </Text>
                            {contact.email && (
                              <Text style={styles.contactEmail}>
                                {contact.email}
                              </Text>
                            )}
                            {contact.company && (
                              <Text style={styles.contactCompany}>
                                {contact.company}
                              </Text>
                            )}
                            <Text style={styles.contactHowWeMet}>
                              Met at: {contact.howWeMet}
                            </Text>
                            <Text style={styles.contactDate}>
                              {formatTimestamp(contact.createdAt)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                );
              })}
            </ScrollView>
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
      </View>
    </GestureHandlerRootView>
  );
}

// Complete styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contactCountContainer: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginHorizontal: 15,
    marginTop: 120,
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
    paddingTop: 120,
  },
  selectionModeActiveContainer: {
    paddingBottom: 90,
  },
  searchContainer: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    margin: 15,
    marginTop: 10,
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.black,
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
    borderRadius: 10,
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
  filterDropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.gray + '25',
    borderRadius: 12,
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
  contactsList: {
    flex: 1,
  },
  contactCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    margin: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 0,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.gray + '20',
  },
  contactCardSelected: {
    borderColor: COLORS.primary,
  },
  contactLeft: {
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
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
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
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  contactSubInfo: {
    marginTop: 4,
    gap: 2,
  },
  contactPhone: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 4,
  },
  contactEmail: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 4,
  },
  contactCompany: {
    fontSize: 14,
    color: COLORS.gray,
  },
  contactHowWeMet: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: 2,
  },
  contactDate: {
    fontSize: 12,
    color: COLORS.gray,
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
});
