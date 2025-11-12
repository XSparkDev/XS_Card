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
  Dimensions 
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  plan: 'free' | 'premium';
  colorScheme?: string;
}

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
    return (
      <View ref={viewRef} style={style} onLayout={handleLayout}>
        <Image 
          source={require('../../../assets/images/profile.png')} 
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
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Plan and limits
  const [remainingContacts, setRemainingContacts] = useState<number | 'unlimited'>(FREE_PLAN_CONTACT_LIMIT);
  
  // Modal states
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isContactOptionsVisible, setIsContactOptionsVisible] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  // Selected items
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedContactForOptions, setSelectedContactForOptions] = useState<Contact | null>(null);
  const [selectedContactIndex, setSelectedContactIndex] = useState<number>(-1);
  const [pendingShareContact, setPendingShareContact] = useState<Contact | null>(null);
  
  // Toast
  const toast = useToast();
  
  // Swipeable refs
  const swipeableRefs = useRef<Map<number, Swipeable | null>>(new Map());

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

      // Process contacts with null safety
      const contactList = Array.isArray(contactData?.contactList) ? contactData.contactList : [];
      setContacts(contactList);

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

      // Set remaining contacts based on plan
      if (userData.plan === 'free') {
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
  const handleDeleteContact = useCallback(async (index: number) => {
    const swipeableToDelete = swipeableRefs.current.get(index);
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

                const response = await authenticatedFetchWithRefresh(
                  `${ENDPOINTS.DELETE_CONTACT}/${userId}/contact/${index}`,
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
                updatedContacts.splice(index, 1);
                setContacts(updatedContacts);
                
                // Update remaining contacts count
                if (typeof remainingContacts === 'number') {
                  setRemainingContacts(remainingContacts + 1);
                }
                
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
  }, [contacts, remainingContacts]);


  // Contact press handler
  const handleContactPress = useCallback((contact: Contact, index: number) => {
    console.log('📱 Contact pressed:', `${contact.name} ${contact.surname}`, 'index:', index);
    console.log('📱 Setting contact options modal visible');
    setSelectedContactForOptions(contact);
    setSelectedContactIndex(index);
    setIsContactOptionsVisible(true);
    console.log('📱 Contact options modal should now be visible');
  }, []);

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
  
  // Filter contacts based on search query (name, phone, company, email, howWeMet)
  const filteredContacts = contacts.filter(contact => {
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
  
  const RenderRightActions = useCallback((progress: any, dragX: any, index: number) => {
    return (
      <TouchableOpacity 
        style={styles.deleteAction}
        onPress={() => handleDeleteContact(index)}
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
          remainingContacts === 'unlimited' && styles.premiumContactsContainer
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
                {searchQuery ? 'No contacts found' : 'No contacts yet'}
              </Text>
              <Text style={styles.emptyStateDescription}>
                {searchQuery 
                  ? 'Try adjusting your search terms'
                  : 'When you share your card and they share their details back, they will appear here'
                }
              </Text>
              {!searchQuery && (
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
              {filteredContacts.map((contact, index) => (
                <Swipeable
                  key={`${contact.name}-${contact.surname}-${index}`}
                  ref={(el) => swipeableRefs.current.set(index, el)}
                  renderRightActions={(progress, dragX) => 
                    RenderRightActions(progress, dragX, index)
                  }
                  renderLeftActions={(progress, dragX) => 
                    RenderLeftActions(progress, dragX, contact)
                  }
                >
                  <TouchableOpacity 
                    style={styles.contactCard}
                    onPress={() => handleContactPress(contact, index)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contactLeft}>
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
              ))}
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

        {/* Contact Options Modal */}
        <Modal
          visible={isContactOptionsVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            console.log('📱 Contact options modal close requested');
            setIsContactOptionsVisible(false);
            setSelectedContactForOptions(null);
            setSelectedContactIndex(-1);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setIsContactOptionsVisible(false);
                  setSelectedContactForOptions(null);
                  setSelectedContactIndex(-1);
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
                    <Text style={styles.modalContactName}>
                      {selectedContactForOptions.name} {selectedContactForOptions.surname}
                    </Text>
                      {selectedContactForOptions.isXsCardUser && (
                        <View style={styles.xsCardUserBadge}>
                          <MaterialIcons name="verified" size={16} color={COLORS.primary} />
                          <Text style={styles.xsCardUserText}>XS Card User</Text>
                        </View>
                      )}
                  </View>

                  {/* Contact Information Section */}
                  <View style={styles.contactInfoSection}>
                    <View style={styles.contactInfoRow}>
                      <MaterialIcons name="phone" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                      <Text style={styles.contactInfoText}>{formatPhoneWithCountryCode(selectedContactForOptions.phone)}</Text>
                    </View>
                    
                    {selectedContactForOptions.email && (
                      <View style={styles.contactInfoRow}>
                        <MaterialIcons name="email" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                        <Text style={styles.contactInfoText}>{selectedContactForOptions.email}</Text>
                      </View>
                    )}
                    
                    {selectedContactForOptions.company && (
                      <View style={styles.contactInfoRow}>
                        <MaterialIcons name="business" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                        <Text style={styles.contactInfoText}>{selectedContactForOptions.company}</Text>
                      </View>
                    )}
                    
                    <View style={styles.contactInfoRow}>
                      <MaterialIcons name="place" size={20} color="#1B2B5B" style={styles.contactInfoIcon} />
                      <Text style={styles.contactInfoText}>Met at: {selectedContactForOptions.howWeMet}</Text>
                    </View>
                    
                  </View>

                  <View style={styles.contactActionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
                      onPress={() => {
                        handleExportContact(selectedContactForOptions);
                        setIsContactOptionsVisible(false);
                        setSelectedContactForOptions(null);
                        setSelectedContactIndex(-1);
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
                          setSelectedContactIndex(-1);
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
                        setSelectedContactIndex(-1);
                        handleDeleteContact(selectedContactIndex);
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
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
