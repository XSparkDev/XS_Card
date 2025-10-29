import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Header from '../components/Header';
import { getWidgetPreferences, toggleWidgetPreference } from '../utils/widgetUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WidgetDataService from '../services/WidgetDataService';

type NavigationProp = NativeStackNavigationProp<any>;

interface CardData {
  index: number;
  name: string;
  surname: string;
  company: string;
  colorScheme: string;
  jobTitle?: string;
}

export default function WidgetSettingsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [widgetPreferences, setWidgetPreferences] = useState<{ [key: number]: boolean }>({});
  const [userCards, setUserCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWidgetData();
  }, []);

  const loadWidgetData = async () => {
    try {
      setLoading(true);
      
      // Load widget preferences
      const preferences = await getWidgetPreferences();
      setWidgetPreferences(preferences);
      
      // Load user cards from storage
      const cardsData = await AsyncStorage.getItem('userCards');
      if (cardsData) {
        const cards = JSON.parse(cardsData);
        setUserCards(cards);
      }
    } catch (error) {
      console.error('Error loading widget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleWidget = async (cardIndex: number) => {
    try {
      const newValue = !widgetPreferences[cardIndex];
      await toggleWidgetPreference(cardIndex, newValue);
      setWidgetPreferences(prev => ({
        ...prev,
        [cardIndex]: newValue
      }));
      
      // Update actual widgets on home screen
      await WidgetDataService.onWidgetPreferencesChange();
      
    } catch (error) {
      console.error('Error toggling widget:', error);
      Alert.alert('Error', 'Failed to update widget preference');
    }
  };

  const handleRefreshWidgets = async () => {
    try {
      await WidgetDataService.refreshAllWidgets();
      Alert.alert('Success', 'Widgets refreshed successfully! Check your home screen.');
    } catch (error) {
      console.error('Error refreshing widgets:', error);
      Alert.alert('Error', 'Failed to refresh widgets. Make sure you have widgets added to your home screen.');
    }
  };

  const renderCardWidgetToggle = (card: CardData) => {
    const isEnabled = widgetPreferences[card.index] || false;
    
    return (
      <View key={card.index} style={styles.cardItem}>
        <View style={styles.cardInfo}>
          <View style={[styles.cardColor, { backgroundColor: card.colorScheme }]} />
          <View style={styles.cardDetails}>
            <Text style={styles.cardName}>
              {card.name} {card.surname}
            </Text>
            <Text style={styles.cardCompany}>{card.company}</Text>
          </View>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={() => handleToggleWidget(card.index)}
          trackColor={{ false: COLORS.lightGray, true: COLORS.secondary }}
          thumbColor={isEnabled ? COLORS.white : COLORS.gray}
        />
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Widget Settings" />
        <View style={styles.loadingContainer}>
          <Text>Loading widget settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Widget Settings" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Home Screen Widgets</Text>
          <Text style={styles.sectionDescription}>
            Enable widgets for your cards to display them on your home screen
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Cards</Text>
          {userCards.length > 0 ? (
            userCards.map(renderCardWidgetToggle)
          ) : (
            <View style={styles.noCards}>
              <MaterialIcons name="widgets" size={48} color={COLORS.gray} />
              <Text style={styles.noCardsText}>No cards found</Text>
              <Text style={styles.noCardsSubtext}>
                Create a card first to enable widgets
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preview & Testing</Text>
          <TouchableOpacity
            style={styles.previewButton}
            onPress={() => navigation.navigate('WidgetPreview')}
          >
            <MaterialIcons name="preview" size={20} color={COLORS.white} />
            <Text style={styles.previewButtonText}>Preview Widgets on Home Screen</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.previewButton, { backgroundColor: COLORS.secondary }]}
            onPress={handleRefreshWidgets}
          >
            <MaterialIcons name="refresh" size={20} color={COLORS.white} />
            <Text style={styles.previewButtonText}>Refresh All Widgets</Text>
          </TouchableOpacity>
          
          <Text style={styles.previewDescription}>
            Preview widgets or refresh them on your actual home screen
          </Text>
        </View>

        <View style={styles.bottomSpacing} />
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
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  cardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cardColor: {
    width: 12,
    height: 40,
    borderRadius: 6,
    marginRight: 16,
  },
  cardDetails: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.black,
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: COLORS.gray,
  },
  noCards: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCardsText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.gray,
    marginTop: 16,
  },
  noCardsSubtext: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  bottomSpacing: {
    height: 100,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginBottom: 12,
  },
  previewButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  previewDescription: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    textAlign: 'center',
  },
});
