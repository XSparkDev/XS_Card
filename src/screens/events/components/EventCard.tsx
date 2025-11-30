import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { useColorScheme } from '../../../context/ColorSchemeContext';
import { Event } from '../../../types/events';

interface EventCardProps {
  event: Event;
  onPress: () => void;
}

export default function EventCard({ event, onPress }: EventCardProps) {
  const { colorScheme } = useColorScheme();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Format date with better error handling
  const formatDate = (dateString: string, isoDateString?: string) => {
    try {
      if (!dateString && !isoDateString) {
        return 'Date TBD';
      }

      const rawDate = isoDateString || dateString;
      if (!rawDate) {
        return 'Date TBD';
      }

      // Check if it's already a formatted string (contains "at")
      if (rawDate.includes(' at ')) {
        return rawDate; // Return as-is if already formatted
      }

      let date: Date;
      
      // Prefer ISO string if available (more reliable for parsing)
      if (isoDateString) {
        date = new Date(isoDateString);
      } else {
        // Try to parse the formatted date string
        date = new Date(dateString);
      }

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.error('Invalid date string:', { dateString, isoDateString });
        return rawDate; // Return original string if we can't parse it
      }

      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if it's today or tomorrow
      if (date.toDateString() === today.toDateString()) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else if (date.toDateString() === tomorrow.toDateString()) {
        return `Tomorrow, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      } else {
        return date.toLocaleDateString([], { 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error('Error formatting date:', error, 'Date strings:', { dateString, isoDateString });
      return dateString || 'Invalid date';
    }
  };

  // Format price
  const formatPrice = () => {
    if (event.eventType === 'free') {
      return 'FREE';
    }
    return `R${event.ticketPrice}`;
  };

  // Get category icon
  const getCategoryIcon = (category: string) => {
    const iconMap: { [key: string]: keyof typeof MaterialIcons.glyphMap } = {
      tech: 'computer',
      business: 'business',
      social: 'people',
      sports: 'sports-soccer',
      arts: 'palette',
      education: 'school',
      networking: 'network-check',
      entertainment: 'local-movies',
      health: 'favorite',
      other: 'event',
    };
    return iconMap[category] || 'event';
  };

  // Get all event images count
  const getTotalImagesCount = () => {
    let count = 0;
    if (event.bannerImage) count++;
    if (event.images && event.images.length > 0) {
      // Count unique images (avoid duplicates)
      const uniqueImages = event.images.filter(img => img !== event.bannerImage);
      count += uniqueImages.length;
    }
    return count;
  };

  // Get availability status with capacity warning
  const getAvailabilityStatus = () => {
    if (event.maxAttendees === -1) {
      return { 
        text: `${event.currentAttendees} attending`, 
        color: COLORS.gray,
        showProgress: false,
        capacity: 0
      };
    }
    
    const spotsLeft = event.maxAttendees - event.currentAttendees;
    const capacityPercentage = (event.currentAttendees / event.maxAttendees) * 100;
    
    if (spotsLeft === 0) {
      return { 
        text: 'SOLD OUT', 
        color: COLORS.error,
        showProgress: true,
        capacity: 100,
        progressColor: COLORS.error
      };
    } else if (capacityPercentage >= 90) {
      return { 
        text: `${spotsLeft} spots left`, 
        color: '#FF5722',
        showProgress: true,
        capacity: capacityPercentage,
        progressColor: '#FF5722'
      };
    } else if (capacityPercentage >= 75) {
      return { 
        text: `${spotsLeft} spots left`, 
        color: '#FF8C00',
        showProgress: true,
        capacity: capacityPercentage,
        progressColor: '#FF8C00'
      };
    } else if (capacityPercentage >= 50) {
      return { 
        text: `${event.currentAttendees}/${event.maxAttendees} attending`, 
        color: '#FFA500',
        showProgress: true,
        capacity: capacityPercentage,
        progressColor: '#4CAF50'
      };
    } else {
      return { 
        text: `${event.currentAttendees}/${event.maxAttendees} attending`, 
        color: COLORS.gray,
        showProgress: false,
        capacity: capacityPercentage
      };
    }
  };

  const availability = getAvailabilityStatus();
  const totalImages = getTotalImagesCount();

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.9}
    >
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        {/* Event Image */}
        <View style={styles.imageContainer}>
          {event.bannerImage || (event.images && event.images.length > 0) ? (
            <>
              <Image
                source={{ 
                  uri: event.bannerImage || event.images?.[0] || ''
                }}
                style={styles.eventImage}
                resizeMode="cover"
              />
              {totalImages > 1 && (
                <View style={styles.imageCountBadge}>
                  <MaterialIcons name="photo-library" size={12} color={COLORS.white} />
                  <Text style={styles.imageCountText}>{totalImages}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.eventImage, styles.imagePlaceholder]}>
              <MaterialIcons name="event" size={32} color={COLORS.gray} />
            </View>
          )}
        </View>

        {/* Event Content */}
        <View style={styles.content}>
          {/* Title and Category */}
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {event.category.charAt(0).toUpperCase() + event.category.slice(1)}
              </Text>
            </View>
          </View>

          {/* Date and Time */}
          <View style={styles.dateRow}>
            <MaterialIcons name="schedule" size={16} color={COLORS.gray} />
            <Text style={styles.dateText}>{formatDate(event.eventDate, event.eventDateISO)}</Text>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={16} color={COLORS.gray} />
            <Text style={styles.locationText} numberOfLines={1}>
              {event.location.venue}, {event.location.city}
            </Text>
          </View>

          {/* Organizer */}
          <View style={styles.organizerRow}>
            <MaterialIcons name="person" size={16} color={COLORS.gray} />
            <Text style={styles.organizerText} numberOfLines={1}>
              by {event.organizerInfo.name}
            </Text>
          </View>

          {/* Availability */}
          <View style={styles.availabilityRow}>
            <MaterialIcons name="people" size={16} color={availability.color} />
            <Text style={[styles.availabilityText, { color: availability.color }]}>
              {availability.text}
            </Text>
          </View>

          {/* Capacity Progress Bar */}
          {availability.showProgress && (
            <View style={styles.capacityProgressContainer}>
              <View style={styles.capacityProgressBackground}>
                <View 
                  style={[
                    styles.capacityProgressFill, 
                    { 
                      width: `${availability.capacity}%`,
                      backgroundColor: availability.progressColor || '#4CAF50'
                    }
                  ]} 
                />
              </View>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
  },
  imageContainer: {
    position: 'relative',
    height: 180,
    backgroundColor: COLORS.background, // subtle grey backdrop
  },
  eventImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  content: {
    height: 180,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginRight: 8,
  },
  categoryBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  organizerText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imageCountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.background,
  },
  imageCountText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  capacityProgressContainer: {
    height: 12,
    backgroundColor: COLORS.background,
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 6,
  },
  capacityProgressBackground: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 6,
  },
  capacityProgressFill: {
    height: '100%',
    borderRadius: 6,
  },
}); 