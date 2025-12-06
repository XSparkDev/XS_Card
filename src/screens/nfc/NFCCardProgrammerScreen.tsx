/**
 * NFCCardProgrammerScreen
 * 
 * Screen for programming NFC cards with user's contact information
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import NFCWriteProgress from '../../components/nfc/NFCWriteProgress';
import NFCService from '../../services/nfcService';
import { useToast } from '../../hooks/useToast';

type RootStackParamList = {
  NFCCardProgrammer: { cards: any[]; userId: string };
  Cards: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface RouteParams {
  cards: any[];
  userId: string;
}

export default function NFCCardProgrammerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute();
  const params = route.params as RouteParams;
  const toast = useToast();

  const { cards, userId } = params;

  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [writing, setWriting] = useState(false);
  const [writeProgress, setWriteProgress] = useState(0);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState(false);
  const [writeDuration, setWriteDuration] = useState<number | undefined>(undefined);
  const [nfcAvailable, setNfcAvailable] = useState(false);

  useEffect(() => {
    checkNFCAvailability();
  }, []);

  const checkNFCAvailability = async () => {
    const available = await NFCService.isAvailable();
    setNfcAvailable(available);

    if (!available && Platform.OS === 'android') {
      Alert.alert(
        'NFC Not Available',
        'NFC is not enabled on your device. Please enable NFC in your settings to program cards.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'OK' },
        ]
      );
    }
  };

  const handleWrite = async () => {
    if (writing) return;
    if (!nfcAvailable) {
      Alert.alert(
        'NFC Not Available',
        'Please enable NFC in your device settings to continue.'
      );
      return;
    }

    setWriting(true);
    setWriteProgress(0);
    setWriteError(null);
    setWriteSuccess(false);
    setWriteDuration(undefined);

    try {
      // Simulate progress
      setWriteProgress(25);

      // Write URL to tag
      console.log('[NFC Programmer] Writing card:', { userId, cardIndex: selectedCardIndex });
      const result = await NFCService.writeUrl(userId, selectedCardIndex);

      if (result.success) {
        setWriteProgress(100);
        setWriteSuccess(true);
        setWriteDuration(result.duration);

        toast.success(
          'Card Programmed!',
          `NFC card written successfully in ${result.duration}ms`
        );

        // Return to cards screen after delay
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        throw new Error(result.error || 'Write failed');
      }
    } catch (error: any) {
      console.error('[NFC Programmer] Write error:', error);
      setWriteError(error.message || 'Failed to write NFC card');
      setWriteProgress(0);
      toast.error('Write Failed', error.message || 'Failed to write NFC card');
    } finally {
      setWriting(false);
    }
  };

  const handleCancel = async () => {
    if (writing) {
      await NFCService.cancel();
      setWriting(false);
      setWriteProgress(0);
      toast.info('Cancelled', 'NFC write operation cancelled');
    } else {
      navigation.goBack();
    }
  };

  const selectedCard = cards[selectedCardIndex];

  return (
    <View style={styles.container}>
      <Header title="Program NFC Card" />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Card Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Card to Program</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cardSelector}
          >
            {cards.map((card, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.cardOption,
                  selectedCardIndex === index && styles.cardOptionSelected,
                ]}
                onPress={() => !writing && setSelectedCardIndex(index)}
                disabled={writing}
              >
                <Text style={styles.cardName}>
                  {card.name} {card.surname}
                </Text>
                <Text style={styles.cardCompany}>{card.company || 'No Company'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Selected Card Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Card Information</Text>
          <View style={styles.cardInfo}>
            <Text style={styles.cardInfoText}>
              Name: {selectedCard.name} {selectedCard.surname}
            </Text>
            <Text style={styles.cardInfoText}>Email: {selectedCard.email}</Text>
            <Text style={styles.cardInfoText}>Company: {selectedCard.company || 'N/A'}</Text>
            <Text style={styles.cardInfoText}>Occupation: {selectedCard.occupation || 'N/A'}</Text>
          </View>
        </View>

        {/* Write Progress */}
        <NFCWriteProgress
          progress={writeProgress}
          isWriting={writing}
          error={writeError}
          success={writeSuccess}
          duration={writeDuration}
        />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        {!writeSuccess && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.primaryButton,
              (!nfcAvailable || writing) && styles.actionButtonDisabled,
            ]}
            onPress={handleWrite}
            disabled={!nfcAvailable || writing}
          >
            <MaterialIcons name="nfc" size={20} color={COLORS.white} />
            <Text style={styles.actionButtonText}>
              {writing ? 'Writing...' : 'Program Card'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleCancel}
        >
          <MaterialIcons name="close" size={20} color={COLORS.white} />
          <Text style={styles.actionButtonText}>
            {writing ? 'Cancel' : writeSuccess ? 'Done' : 'Close'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    padding: 20,
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
  cardSelector: {
    flexDirection: 'row',
  },
  cardOption: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.background,
    marginRight: 12,
    minWidth: 150,
  },
  cardOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: `${COLORS.primary}10`,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: COLORS.gray,
  },
  cardInfo: {
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  cardInfoText: {
    fontSize: 14,
    color: COLORS.black,
    marginBottom: 8,
  },
  actionContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: COLORS.secondary,
  },
});

