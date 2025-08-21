import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
  Image,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback } from 'react';

import { COLORS } from '../../constants/colors';
import EventHeader from '../../components/EventHeader';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import {
  CreateEventData,
  EVENT_CATEGORIES,
  EventCategory,
  EventLocation,
} from '../../types/events';
import { getUserPlan, getPlanLimits } from '../../utils/userPlan';

type NavigationProp = NativeStackNavigationProp<any>;

// Form steps
const STEPS = {
  BASIC_INFO: 0,
  DETAILS: 1,
  LOCATION: 2,
  MEDIA: 3,
  REVIEW: 4,
} as const;

const STEP_TITLES = [
  'Basic Information',
  'Event Details', 
  'Location & Venue',
  'Images & Media',
  'Review & Publish',
];

export default function CreateEventScreen() {
  const navigation = useNavigation<NavigationProp>();
  const toast = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<number>(STEPS.BASIC_INFO);
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState<CreateEventData>({
    title: '',
    description: '',
    eventDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    endDate: '',
    location: {
      venue: '',
      address: '',
      city: '',
      country: 'South Africa',
    },
    category: 'other' as EventCategory,
    eventType: 'free' as 'free' | 'paid', // Paid events temporarily disabled
    ticketPrice: 0,
    maxAttendees: 0,
    visibility: 'public' as 'public' | 'private' | 'invite-only',
    images: [],
    tags: [],
    allowBulkRegistrations: true, // Enable by default for testing
  });

  // UI state - Updated for Android compatibility
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // User plan for image limits
  const [userPlan, setUserPlan] = useState<string>('free');
  const [maxImages, setMaxImages] = useState<number>(1);
  // Check if user is registered as event organiser
  const [isOrganiser, setIsOrganiser] = useState<boolean>(false);
  const [checkingOrganiserStatus, setCheckingOrganiserStatus] = useState<boolean>(false);
  const [lastStatusCheck, setLastStatusCheck] = useState<number>(0);

    // Check user plan on component mount
  useEffect(() => {
    const checkUserPlan = async () => {
      const plan = await getUserPlan();
      const limits = getPlanLimits(plan);
      setUserPlan(plan);
      setMaxImages(limits.maxImages);
    };
    checkUserPlan();
  }, []);

  // Check organiser status function with debouncing
  const checkOrganiserStatus = useCallback(async (force: boolean = false) => {
    // Debounce: Don't check if we checked less than 5 seconds ago (unless forced)
    const now = Date.now();
    if (!force && (now - lastStatusCheck) < 5000) {
      console.log('Skipping organiser status check - too soon since last check');
      return;
    }
    
    setLastStatusCheck(now);
    setCheckingOrganiserStatus(true);
    
    try {
      const response = await authenticatedFetchWithRefresh(ENDPOINTS.GET_ORGANISER_STATUS);
      if (response.ok) {
        const data = await response.json();
        console.log('Organiser status response:', data);
        const isActiveOrganiser = data.success && data.data?.status === 'active';
        setIsOrganiser(isActiveOrganiser);
        
        // Only show success message if this was a manual refresh
        if (isActiveOrganiser && force) {
          console.log('User is now an active organiser');
        }
      } else {
        console.log('Failed to check organiser status:', response.status);
        if (response.status === 404) {
          console.log('Organiser endpoint not found - user is not registered as organiser');
          // Don't show error toast for 404 - it just means user isn't an organiser
        }
        setIsOrganiser(false);
      }
    } catch (error) {
      console.error('Error checking organiser status:', error);
      if (error instanceof Error && error.message?.includes('fetch')) {
        // Only show network error toast if this was a manual refresh
        if (force) {
          toast.warning('Network Error', 'Unable to connect to server. Please check your network connection and ensure the backend is running.');
        }
      }
      setIsOrganiser(false);
    } finally {
      setCheckingOrganiserStatus(false);
    }
  }, [toast, lastStatusCheck]);

  // Check organiser status when screen is focused (including when returning from registration)
  useFocusEffect(
    useCallback(() => {
      checkOrganiserStatus();
    }, [checkOrganiserStatus])
  );

  // Step validation
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case STEPS.BASIC_INFO:
        if (!formData.title.trim()) newErrors.title = 'Event title is required';
        if (!formData.description.trim()) newErrors.description = 'Event description is required';
        if (!formData.eventDate) newErrors.eventDate = 'Event date is required';
        break;

      case STEPS.DETAILS:
        if (formData.eventType === 'paid' && formData.ticketPrice <= 0) {
          newErrors.ticketPrice = 'Ticket price must be greater than 0 for paid events';
        }
        if (formData.maxAttendees < 0) {
          newErrors.maxAttendees = 'Maximum attendees cannot be negative (0 = unlimited)';
        }
        break;

      case STEPS.LOCATION:
        if (!formData.location.venue.trim()) newErrors.venue = 'Venue is required';
        if (!formData.location.city.trim()) newErrors.city = 'City is required';
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Navigation helpers
  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.REVIEW));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, STEPS.BASIC_INFO));
  };

  // Form handlers
  const updateFormData = (updates: Partial<CreateEventData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      delete newErrors[key];
    });
    setErrors(newErrors);
  };

  const updateLocation = (updates: Partial<EventLocation>) => {
    setFormData(prev => ({
      ...prev,
      location: { ...prev.location, ...updates }
    }));
  };

  // Date handlers - Updated for Android compatibility
  const showDatePickerHandler = () => {
    setTempDate(new Date(formData.eventDate));
    setShowDatePicker(true);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      
      if (event.type === 'set' && selectedDate) {
        setTempDate(selectedDate);
        // On Android, show time picker after date selection
        setTimeout(() => {
          setShowTimePicker(true);
        }, 100);
      }
    } else {
      // iOS - datetime mode works fine, close picker after selection
    setShowDatePicker(false);
    if (selectedDate) {
      updateFormData({ eventDate: selectedDate.toISOString() });
    }
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    
    if (event.type === 'set' && selectedTime) {
      // Combine the date from tempDate with time from selectedTime
      const combinedDateTime = new Date(tempDate);
      combinedDateTime.setHours(selectedTime.getHours());
      combinedDateTime.setMinutes(selectedTime.getMinutes());
      combinedDateTime.setSeconds(0);
      combinedDateTime.setMilliseconds(0);
      
      updateFormData({ eventDate: combinedDateTime.toISOString() });
    }
  };

  // Image handling
  const pickImages = async () => {
    try {
      // Check user plan limits
      const userPlan = await getUserPlan();
      const planLimits = getPlanLimits(userPlan);
      const maxImages = planLimits.maxImages;
      
      // Check if user has reached their limit
      if (selectedImages.length >= maxImages) {
        if (userPlan === 'free') {
          toast.warning('Image Limit Reached', 'Free users can upload 1 image. Upgrade to Premium for up to 5 images.');
        } else {
          toast.warning('Image Limit Reached', `You can upload up to ${maxImages} images with your current plan.`);
        }
        return;
      }

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        toast.warning('Permission needed', 'Please grant permission to access your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: userPlan !== 'free', // Only allow multiple selection for non-free users
        quality: 0.8,
        aspect: [16, 9],
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        const availableSlots = maxImages - selectedImages.length;
        const imagesToAdd = newImages.slice(0, availableSlots);
        
        if (newImages.length > availableSlots) {
          toast.warning('Image Limit', `Only ${availableSlots} more images can be added with your current plan.`);
        }
        
        setSelectedImages(prev => [...prev, ...imagesToAdd]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      toast.error('Error', 'Failed to pick images. Please try again.');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Tag management
  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags?.includes(tag)) {
      updateFormData({ 
        tags: [...(formData.tags || []), tag] 
      });
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateFormData({ 
      tags: formData.tags?.filter(tag => tag !== tagToRemove) || []
    });
  };

  // Event creation
  const createEvent = async () => {
    try {
      setLoading(true);

      // Final validation
      if (!validateStep(STEPS.BASIC_INFO) || !validateStep(STEPS.DETAILS) || !validateStep(STEPS.LOCATION)) {
        toast.warning('Validation Error', 'Please fix the errors before creating the event.');
        return;
      }
      
      // Check if trying to create a paid event without being an organiser
      if (formData.eventType === 'paid' && formData.ticketPrice > 0 && !isOrganiser) {
        toast.warning(
          'Organiser Registration Required', 
          'You must register to collect payments to create paid events.'
        );
        return;
      }

      // --------------------------
      // Prepare payload (FormData for images + fields)
      // --------------------------

      const payload = new FormData();

      // Append basic string / numeric fields (all must be strings in FormData)
      payload.append('title', formData.title);
      payload.append('description', formData.description);
      payload.append('eventDate', formData.eventDate);
      if (formData.endDate) payload.append('endDate', formData.endDate);
      payload.append('category', formData.category);
      payload.append('eventType', formData.eventType);
      payload.append('ticketPrice', formData.ticketPrice.toString());
      payload.append('maxAttendees', formData.maxAttendees.toString());
      payload.append('visibility', formData.visibility);
      payload.append('allowBulkRegistrations', formData.allowBulkRegistrations?.toString() || 'true');

      // Location & tags as JSON strings for backend parsing
      payload.append('location', JSON.stringify(formData.location));
      payload.append('tags', JSON.stringify(formData.tags || []));

      // Images   – first image ➜ bannerImage, rest ➜ eventImages[]
      if (selectedImages.length > 0) {
        const bannerUri = selectedImages[0];
        const bannerName = bannerUri.split('/').pop() || `banner_${Date.now()}.jpg`;
        payload.append('bannerImage', {
          uri: bannerUri,
          name: bannerName,
          type: 'image/jpeg',
        } as any);

        selectedImages.slice(1).forEach((uri, idx) => {
          const name = uri.split('/').pop() || `image_${idx}_${Date.now()}.jpg`;
          payload.append('eventImages', {
            uri,
            name,
            type: 'image/jpeg',
          } as any);
        });
      }

      console.log('[CreateEvent] Submitting FormData with fields:', Array.from(payload.keys()));

      const response = await authenticatedFetchWithRefresh(ENDPOINTS.CREATE_EVENT, {
        method: 'POST',
        body: payload,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to create event: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        Alert.alert(
          'Event Created!',
          'Your event has been created successfully. You can publish it now or save it as a draft.',
          [
            {
              text: 'Save as Draft',
              onPress: () => navigation.goBack(),
            },
            {
              text: 'Publish Now',
              onPress: () => publishEvent(result.event.id),
            },
          ]
        );
      } else {
        throw new Error(result.message || 'Failed to create event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error(
        'Creation Failed',
        error instanceof Error ? error.message : 'Failed to create event. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const publishEvent = async (eventId: string) => {
    try {
      const response = await authenticatedFetchWithRefresh(
        ENDPOINTS.PUBLISH_EVENT.replace(':eventId', eventId),
        { method: 'POST' }
      );

      if (response.ok) {
        toast.success('Success!', 'Your event has been published and is now visible to users.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error publishing event:', error);
      toast.warning('Published as Draft', 'Event created but could not be published. You can publish it later from your events.');
      navigation.goBack();
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.BASIC_INFO:
        return renderBasicInfoStep();
      case STEPS.DETAILS:
        return renderDetailsStep();
      case STEPS.LOCATION:
        return renderLocationStep();
      case STEPS.MEDIA:
        return renderMediaStep();
      case STEPS.REVIEW:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const renderBasicInfoStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Let's start with the basics</Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Title *</Text>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          value={formData.title}
          onChangeText={(text) => updateFormData({ title: text })}
          placeholder="Enter your event title"
          placeholderTextColor={COLORS.gray}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Description *</Text>
        <TextInput
          style={[styles.textArea, errors.description && styles.inputError]}
          value={formData.description}
          onChangeText={(text) => updateFormData({ description: text })}
          placeholder="Describe your event..."
          placeholderTextColor={COLORS.gray}
          multiline
          numberOfLines={4}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {EVENT_CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.categoryChip,
                formData.category === category && { backgroundColor: COLORS.primary }
              ]}
              onPress={() => updateFormData({ category })}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  formData.category === category && { color: COLORS.white }
                ]}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Date & Time *</Text>
        <TouchableOpacity
          style={[styles.input, styles.dateInput, errors.eventDate && styles.inputError]}
          onPress={showDatePickerHandler}
        >
          <Text style={styles.dateText}>
            {new Date(formData.eventDate).toLocaleString()}
          </Text>
          <MaterialIcons name="schedule" size={20} color={COLORS.gray} />
        </TouchableOpacity>
        {errors.eventDate && <Text style={styles.errorText}>{errors.eventDate}</Text>}
      </View>

      {/* Date Picker - Cross Platform */}
      {showDatePicker && (
        <DateTimePicker
          value={tempDate}
          mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
          display="default"
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {/* Time Picker - Android Only */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={tempDate}
          mode="time"
          display="default"
          onChange={handleTimeChange}
          is24Hour={true}
        />
      )}
    </View>
  );

  const renderDetailsStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Event Details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Type</Text>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[
              styles.segmentButton,
              formData.eventType === 'free' && { backgroundColor: COLORS.primary }
            ]}
            onPress={() => updateFormData({ eventType: 'free', ticketPrice: 0 })}
          >
            <Text
              style={[
                styles.segmentText,
                formData.eventType === 'free' && { color: COLORS.white }
              ]}
            >
              Free
            </Text>
          </TouchableOpacity>
          {/* Paid events temporarily disabled */}
          <TouchableOpacity
            style={[
              styles.segmentButton,
              formData.eventType === 'paid' && { backgroundColor: COLORS.primary },
              { opacity: 0.5, backgroundColor: COLORS.gray + '20' }
            ]}
            onPress={() => updateFormData({ eventType: 'paid' })}
            disabled={true}
          >
            <Text
              style={[
                styles.segmentText,
                formData.eventType === 'paid' && { color: COLORS.white },
                { color: COLORS.gray }
              ]}
            >
              Paid (Disabled)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {formData.eventType === 'paid' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ticket Price (R) *</Text>
            <TextInput
              style={[styles.input, errors.ticketPrice && styles.inputError]}
              value={formData.ticketPrice.toString()}
              onChangeText={(text) => updateFormData({ ticketPrice: parseInt(text) || 0 })}
              placeholder="0"
              placeholderTextColor={COLORS.gray}
              keyboardType="numeric"
            />
            {errors.ticketPrice && <Text style={styles.errorText}>{errors.ticketPrice}</Text>}
          </View>
          
          {checkingOrganiserStatus ? (
            <View style={styles.organiserInfoContainer}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.organiserInfoText}>
                Checking organiser status...
              </Text>
            </View>
          ) : !isOrganiser && (
            <View style={styles.organiserInfoContainer}>
              <MaterialIcons name="info-outline" size={24} color={COLORS.primary} />
              <Text style={styles.organiserInfoText}>
                To create paid events, you must register to collect payments from attendees.
              </Text>
              <View style={styles.organiserButtonContainer}>
                <TouchableOpacity 
                  style={styles.organiserButton}
                  onPress={() => {
                    navigation.navigate('OrganiserRegistration');
                    // Refresh organiser status when user returns
                    const unsubscribe = navigation.addListener('focus', () => {
                      checkOrganiserStatus();
                      unsubscribe();
                    });
                  }}
                >
                  <Text style={styles.organiserButtonText}>Register for Payment Collection</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={() => checkOrganiserStatus(true)}
                  disabled={checkingOrganiserStatus}
                >
                  <MaterialIcons name="refresh" size={16} color={COLORS.primary} />
                  <Text style={styles.refreshButtonText}>Refresh Status</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Maximum Attendees</Text>
        <TextInput
          style={[styles.input, errors.maxAttendees && styles.inputError]}
          value={formData.maxAttendees.toString()}
          onChangeText={(text) => {
            const parsed = parseInt(text);
            // Allow empty string (will be 0) or valid numbers
            if (text === '' || !isNaN(parsed)) {
              updateFormData({ maxAttendees: parsed || 0 });
            }
          }}
          placeholder="0 (unlimited)"
          placeholderTextColor={COLORS.gray}
          keyboardType="numeric"
        />
        {errors.maxAttendees && <Text style={styles.errorText}>{errors.maxAttendees}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Bulk Registration</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>
            Allow users to register multiple people at once
          </Text>
          <Switch
            value={formData.allowBulkRegistrations || false}
            onValueChange={(value) => updateFormData({ allowBulkRegistrations: value })}
            trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
            thumbColor={COLORS.white}
          />
        </View>
        <Text style={styles.helpText}>
          When enabled, attendees can register 2-50 people in a single transaction
        </Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Event Visibility</Text>
        <View style={styles.visibilityOptions}>
          {(['public', 'private', 'invite-only'] as const).map((visibility) => (
            <TouchableOpacity
              key={visibility}
              style={[
                styles.visibilityOption,
                formData.visibility === visibility && { backgroundColor: COLORS.primary },
                visibility === 'invite-only' && styles.disabledVisibilityOption
              ]}
              onPress={() => {
                if (visibility !== 'invite-only') {
                  updateFormData({ visibility });
                }
              }}
              disabled={visibility === 'invite-only'}
            >
              <MaterialIcons 
                name={
                  visibility === 'public' ? 'public' : 
                  visibility === 'private' ? 'lock' : 'mail'
                } 
                size={20} 
                color={
                  visibility === 'invite-only' 
                    ? COLORS.gray + '60'
                    : formData.visibility === visibility 
                      ? COLORS.white 
                      : COLORS.gray
                } 
              />
              <Text
                style={[
                  styles.visibilityText,
                  formData.visibility === visibility && { color: COLORS.white },
                  visibility === 'invite-only' && { 
                    color: COLORS.gray + '60',
                    fontStyle: 'italic'
                  }
                ]}
              >
                {visibility.charAt(0).toUpperCase() + visibility.slice(1).replace('-', ' ')}
                {visibility === 'invite-only' && ' (Coming Soon)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Tags</Text>
        <View style={styles.tagInputContainer}>
          <TextInput
            style={styles.tagInput}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder="Add tags..."
            placeholderTextColor={COLORS.gray}
            onSubmitEditing={addTag}
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
            <MaterialIcons name="add" size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        {formData.tags && formData.tags.length > 0 && (
          <View style={styles.tagContainer}>
            {formData.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)}>
                  <MaterialIcons name="close" size={16} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  const renderLocationStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Where will it happen?</Text>
      <Text style={styles.stepSubtitle}>Please provide the venue and city for your event</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Venue Name *</Text>
        <TextInput
          style={[styles.input, errors.venue && styles.inputError]}
          value={formData.location.venue}
          onChangeText={(text) => updateLocation({ venue: text })}
          placeholder="Enter venue name (required)"
          placeholderTextColor={COLORS.gray}
        />
        {errors.venue && <Text style={styles.errorText}>{errors.venue}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Street Address</Text>
        <TextInput
          style={styles.input}
          value={formData.location.address}
          onChangeText={(text) => updateLocation({ address: text })}
          placeholder="Street address (optional)"
          placeholderTextColor={COLORS.gray}
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>City *</Text>
        <TextInput
          style={[styles.input, errors.city && styles.inputError]}
          value={formData.location.city}
          onChangeText={(text) => updateLocation({ city: text })}
          placeholder="Enter city name (required)"
          placeholderTextColor={COLORS.gray}
        />
        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Country</Text>
        <TextInput
          style={styles.input}
          value={formData.location.country}
          onChangeText={(text) => updateLocation({ country: text })}
          placeholder="Country (optional)"
          placeholderTextColor={COLORS.gray}
        />
      </View>
    </View>
  );

  const renderMediaStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add some visuals</Text>
      <Text style={styles.stepSubtitle}>Images help attract more attendees to your event</Text>

      <TouchableOpacity style={styles.imagePickerButton} onPress={pickImages}>
        <MaterialIcons name="add-photo-alternate" size={48} color={COLORS.primary} />
        <Text style={[styles.imagePickerText, { color: COLORS.primary }]}>
          Add Event Images
        </Text>
        <Text style={styles.imagePickerSubtext}>
          {userPlan === 'free' 
            ? 'Free users: 1 image (first image will be the banner)'
            : `Select up to ${maxImages} images (first image will be the banner)`
          }
        </Text>
      </TouchableOpacity>

      {selectedImages.length > 0 && (
        <View style={styles.imageGrid}>
          {selectedImages.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image source={{ uri: image }} style={styles.eventImage} />
              {index === 0 && (
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerText}>Banner</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => removeImage(index)}
              >
                <MaterialIcons name="close" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderReviewStep = () => (
    <ScrollView style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review Your Event</Text>
      <Text style={styles.stepSubtitle}>Make sure everything looks good before creating</Text>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Basic Information</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Title:</Text>
          <Text style={styles.reviewValue}>{formData.title}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Category:</Text>
          <Text style={styles.reviewValue}>{formData.category}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Date:</Text>
          <Text style={styles.reviewValue}>
            {new Date(formData.eventDate).toLocaleString()}
          </Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Event Details</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Type:</Text>
          <Text style={styles.reviewValue}>
            {formData.eventType === 'free' ? 'Free' : `Paid - R${formData.ticketPrice}`}
          </Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Max Attendees:</Text>
          <Text style={styles.reviewValue}>{formData.maxAttendees === 0 ? 'Unlimited' : formData.maxAttendees}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Visibility:</Text>
          <Text style={styles.reviewValue}>{formData.visibility}</Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Location</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Venue:</Text>
          <Text style={styles.reviewValue}>{formData.location.venue}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Address:</Text>
          <Text style={styles.reviewValue}>
            {formData.location.address}, {formData.location.city}, {formData.location.country}
          </Text>
        </View>
      </View>

      {formData.tags && formData.tags.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Tags</Text>
          <View style={styles.tagContainer}>
            {formData.tags.map((tag, index) => (
              <View key={index} style={styles.reviewTag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {selectedImages.length > 0 && (
        <View style={styles.reviewSection}>
          <Text style={styles.reviewSectionTitle}>Images ({selectedImages.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {selectedImages.map((image, index) => (
              <Image key={index} source={{ uri: image }} style={styles.reviewImage} />
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <EventHeader title="Create Event" />

      {/* Progress indicator */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${((currentStep + 1) / Object.keys(STEPS).length) * 100}%`,
                backgroundColor: COLORS.primary 
              }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          Step {currentStep + 1} of {Object.keys(STEPS).length}: {STEP_TITLES[currentStep]}
        </Text>
      </View>

      {/* Step content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderStepContent()}
      </ScrollView>

      {/* Navigation buttons */}
      <View style={styles.navigationContainer}>
        {currentStep > STEPS.BASIC_INFO && (
          <TouchableOpacity
            style={[styles.navButton, styles.backButton]}
            onPress={prevStep}
          >
            <MaterialIcons name="arrow-back" size={20} color={COLORS.gray} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }} />

        {currentStep < STEPS.REVIEW ? (
          <TouchableOpacity
            style={[styles.navButton, styles.nextButton, { backgroundColor: COLORS.primary }]}
            onPress={nextStep}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, styles.createButton, { backgroundColor: COLORS.primary }]}
            onPress={createEvent}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.createButtonText}>Create Event</Text>
                <MaterialIcons name="check" size={20} color={COLORS.white} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.background,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepContent: {
    paddingBottom: 100, // Account for navigation buttons
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  textArea: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.black,
    backgroundColor: COLORS.white,
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginTop: 4,
  },
  categoryScroll: {
    marginTop: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipText: {
    fontSize: 14,
    color: COLORS.black,
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: COLORS.black,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  visibilityOptions: {
    gap: 8,
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    gap: 12,
  },
  visibilityText: {
    fontSize: 16,
    color: COLORS.black,
  },
  disabledVisibilityOption: {
    opacity: 0.6,
    backgroundColor: COLORS.background,
  },
  tagInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.black,
  },
  addTagButton: {
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  tagText: {
    fontSize: 14,
    color: COLORS.black,
  },
  imagePickerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  imagePickerText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  imagePickerSubtext: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
    textAlign: 'center',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  imageContainer: {
    position: 'relative',
    width: '48%',
    aspectRatio: 16 / 9,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  bannerBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  bannerText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    padding: 4,
  },
  reviewSection: {
    marginBottom: 24,
  },
  reviewSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 12,
  },
  reviewItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 16,
    color: COLORS.gray,
    width: 100,
  },
  reviewValue: {
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
  },
  reviewTag: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reviewImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  backButton: {
    backgroundColor: COLORS.background,
  },
  backButtonText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  createButton: {
    backgroundColor: COLORS.primary,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  organiserInfoContainer: {
    flexDirection: 'column',
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#d0e8ff',
    gap: 12,
  },
  organiserInfoText: {
    fontSize: 14,
    color: COLORS.black,
    lineHeight: 20,
  },
  organiserButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  organiserButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  organiserButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
    marginLeft: 12,
  },
  refreshButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    marginLeft: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
    marginRight: 16,
  },
  helpText: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
    lineHeight: 18,
  },
}); 