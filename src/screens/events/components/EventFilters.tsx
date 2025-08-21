import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { COLORS } from '../../../constants/colors';
import { useColorScheme } from '../../../context/ColorSchemeContext';
import { EventFilters, EVENT_CATEGORIES } from '../../../types/events';

interface EventFiltersProps {
  filters: EventFilters;
  onFiltersChange: (filters: Partial<EventFilters>) => void;
  onClose: () => void;
}

export default function EventFiltersComponent({ 
  filters, 
  onFiltersChange, 
  onClose 
}: EventFiltersProps) {
  const { colorScheme } = useColorScheme();

  const handleCategoryPress = (category: string) => {
    const newCategory = filters.category === category ? undefined : category;
    onFiltersChange({ category: newCategory });
  };

  const handleEventTypePress = (eventType: 'free' | 'paid') => {
    const newEventType = filters.eventType === eventType ? undefined : eventType;
    onFiltersChange({ eventType: newEventType });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      category: undefined,
      eventType: undefined,
      location: undefined,
    });
  };

  const hasActiveFilters = filters.category || filters.eventType || filters.location;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Filter Events</Text>
        <TouchableOpacity onPress={onClose}>
          <MaterialIcons name="close" size={24} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Event Type Filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Event Type</Text>
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filters.eventType === 'free' && { backgroundColor: colorScheme },
              ]}
              onPress={() => handleEventTypePress('free')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filters.eventType === 'free' && { color: COLORS.white },
                ]}
              >
                Free Events
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                filters.eventType === 'paid' && { backgroundColor: colorScheme },
              ]}
              onPress={() => handleEventTypePress('paid')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filters.eventType === 'paid' && { color: COLORS.white },
                ]}
              >
                Paid Events
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Filter */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <View style={styles.categoryGrid}>
            {EVENT_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  filters.category === category && { backgroundColor: colorScheme },
                ]}
                onPress={() => handleCategoryPress(category)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    filters.category === category && { color: COLORS.white },
                  ]}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <TouchableOpacity 
            style={styles.clearButton}
            onPress={clearAllFilters}
          >
            <MaterialIcons name="clear" size={20} color={COLORS.error} />
            <Text style={styles.clearButtonText}>Clear All Filters</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  content: {
    padding: 16,
    maxHeight: 400,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 12,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gray,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gray,
    marginBottom: 8,
  },
  categoryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.black,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    marginTop: 16,
    paddingTop: 16,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.error,
  },
}); 