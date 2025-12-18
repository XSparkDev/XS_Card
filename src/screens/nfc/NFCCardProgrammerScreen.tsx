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
  Animated,
  Dimensions,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { COLORS } from '../../constants/colors';
import Header from '../../components/Header';
import NFCWriteProgress from '../../components/nfc/NFCWriteProgress';
import NFCService from '../../services/nfcService';
import { useToast } from '../../hooks/useToast';
import NfcManager, { NfcEvents } from 'react-native-nfc-manager';

const { width } = Dimensions.get('window');

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
  const [writeStatus, setWriteStatus] = useState<string>('');
  const [writeAttempt, setWriteAttempt] = useState<number>(1);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [cardTapped, setCardTapped] = useState(false);
  const [lastTapTime, setLastTapTime] = useState<number>(0);
  const [hasShownInitialPopup, setHasShownInitialPopup] = useState(false);

  useEffect(() => {
    checkNFCAvailability();
  }, []);

  useEffect(() => {
    if (writing) {
      // Pulse animation during write
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [writing]);

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

    // Show initial popup on first attempt
    if (!hasShownInitialPopup && writeAttempt === 1) {
      setHasShownInitialPopup(true);
      Alert.alert(
        'New Cards Need Setup',
        'New cards may need a few quick taps to complete setup. Each tap helps prepare the card for writes.\n\nPlace the card on the back of your NFC enabled device when prompted. You’ll feel a vibration or hear a chirp when the device reads it. Lift the card and tap again until the setup is finished.',        
        [{ text: 'Got it', onPress: () => startWrite() }]
      );
      return;
    }

    startWrite();
  };

  const startWrite = async () => {
    // Reset states for new attempt
    setWriting(true);
    setWriteProgress(15);
    setWriteError(null);
    setWriteSuccess(false);
    setWriteDuration(undefined);
    setCardTapped(false);
    
    // Show step number
    const currentStep = writeAttempt;
    
    // Simple, user-friendly status - show instruction based on attempt
    if (currentStep === 1) {
      setWriteStatus('Hold card steady');
    } else {
      setWriteStatus('Remove card and put it back');
    }

    // Progress callback - just update progress bar, no detailed messages
    const progressCallback = (status: { attempt: number; message: string; progress?: number }) => {
      // Only update progress bar, keep status message simple
      if (status.progress !== undefined) {
        setWriteProgress(status.progress);
      }
      
      // Update status to show "Remove card and put it back" after first attempt
      if (currentStep > 1) {
        setWriteStatus('Remove card and put it back');
      }
    };
    
    try {
      // Write URL to tag
      console.log('[NFC Programmer] Writing card:', { userId, cardIndex: selectedCardIndex, step: currentStep });
      const result = await NFCService.writeUrl(userId, selectedCardIndex, 0, progressCallback);

      if (result.success) {
        setWriteProgress(100);
        setWriteSuccess(true);
        setWriteDuration(result.duration);
        setWriteStatus('Card programmed successfully!');
        
        toast.success(
          'Card Programmed!',
          `Your NFC card is ready to use`
        );

        // Return to cards screen after delay
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        // Don't show technical errors - just reset and wait for next tap
        setWriteProgress(0);
        setWriteError(null);
        setWriteStatus('Remove card and put it back');
        
        // Increment step for next try
        setWriteAttempt(currentStep + 1);
        
        // Keep status visible after writing stops
        setTimeout(() => {
          setWriteStatus('Remove card and put it back');
        }, 100);
        
        // Simple toast - no technical details
        if (currentStep < 4) {
          toast.info(
            'Continue',
            'Remove the card, then tap "Program NFC Card" again'
          );
        } else {
          toast.info(
            'Keep trying',
            'Remove the card, then tap "Program NFC Card" again'
          );
        }
      }
    } catch (error: any) {
      console.error('[NFC Programmer] Write error:', error);
      
      // Don't show technical errors - just reset and wait for next tap
      setWriteProgress(0);
      setWriteError(null);
      setWriteStatus('Remove card and put it back');
      
      // Increment step for next try
      setWriteAttempt(currentStep + 1);
      
      // Keep status visible after writing stops
      setTimeout(() => {
        setWriteStatus('Remove card and put it back');
      }, 100);
      
      // Simple toast - no technical details
      if (currentStep < 4) {
        toast.info(
          'Continue',
          'Remove the card, then tap "Program NFC Card" again'
        );
      } else {
        toast.info(
          'Keep trying',
          'Remove the card, then tap "Program NFC Card" again'
        );
      }
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

  const getFriendlyErrorMessage = (error: any): string => {
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    // Log technical error for debugging
    console.error('[NFC Programmer] Technical error:', errorMessage);
    
    // Convert technical errors to user-friendly messages
    if (errorMessage.includes('java.io') || 
        errorMessage.includes('IOException') ||
        errorMessage.includes('IO error')) {
      return 'Oops! Your card couldn\'t be written. Please try again.';
    }
    
    if (errorMessage.includes('unsupported tag') || 
        errorMessage.includes('Unsupported tag') ||
        errorMessage.includes('unsupported tag api')) {
      return 'This card type is not supported or needs formatting. The app will try to format it automatically.';
    }
    
    if (errorMessage.includes('unable to format') || 
        errorMessage.includes('format') && errorMessage.includes('fail')) {
      return 'The card couldn\'t be formatted. It may be locked or incompatible. Please try a different card.';
    }
    
    if (errorMessage.includes('locked') || errorMessage.includes('Locked')) {
      return 'This card is locked and cannot be written to. Please use a different card.';
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return 'The card wasn\'t detected in time. Please hold it steady and try again.';
    }
    
    if (errorMessage.includes('tag') && errorMessage.includes('size')) {
      return 'The NFC card is too small for this data. Please use a different card.';
    }
    
    if (errorMessage.includes('not enabled') || errorMessage.includes('disabled')) {
      return 'NFC is not enabled. Please enable NFC in your device settings.';
    }
    
    if (errorMessage.includes('cancel') || errorMessage.includes('cancelled')) {
      return 'Write operation was cancelled.';
    }
    
    // Generic friendly message for any other error
    return 'Oops! Your card couldn\'t be written. Please try again.';
  };

  const handleInfoPress = async () => {
    try {
      // Get device info for better search results
      let deviceInfo = 'NFC location on phone';
      
      if (Platform.OS === 'android') {
        // Try to get device manufacturer/brand if available
        const constants = (Platform as any).constants;
        if (constants) {
          const manufacturer = constants.Manufacturer || '';
          const brand = constants.Brand || '';
          const model = constants.Model || '';
          if (manufacturer || brand || model) {
            deviceInfo = `${manufacturer} ${brand} ${model} NFC location`.trim();
          }
        }
      } else {
        deviceInfo = 'iPhone NFC location';
      }
      
      const searchQuery = encodeURIComponent(deviceInfo);
      const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;
      
      const canOpen = await Linking.canOpenURL(googleSearchUrl);
      if (canOpen) {
        await Linking.openURL(googleSearchUrl);
      } else {
        Alert.alert('Error', 'Unable to open browser');
      }
    } catch (error) {
      console.error('[NFC Info] Error opening search:', error);
      Alert.alert('Error', 'Unable to open search');
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Program NFC Card" />

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {/* Card Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="credit-card" size={24} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Select Card to Program</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cardSelector}
            contentContainerStyle={styles.cardSelectorContent}
          >
            {cards.map((card, index) => {
              const isSelected = selectedCardIndex === index;
              const cardColor = card.colorScheme || COLORS.primary;
              
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.cardOption,
                    isSelected && styles.cardOptionSelected,
                    isSelected && { borderColor: cardColor },
                  ]}
                  onPress={() => !writing && setSelectedCardIndex(index)}
                  disabled={writing}
                  activeOpacity={0.7}
                >
                  {isSelected && (
                    <View style={[styles.selectedIndicator, { backgroundColor: cardColor }]}>
                      <MaterialIcons name="check-circle" size={20} color={COLORS.white} />
                    </View>
                  )}
                  <View style={styles.cardOptionContent}>
                    <View style={[styles.cardColorBar, { backgroundColor: cardColor }]} />
                    <Text style={styles.cardName} numberOfLines={1}>
                      {card.name} {card.surname}
                    </Text>
                    <Text style={styles.cardCompany} numberOfLines={1}>
                      {card.company || 'No Company'}
                    </Text>
                    {card.occupation && (
                      <Text style={styles.cardOccupation} numberOfLines={1}>
                        {card.occupation}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>


        {/* Write Progress */}
        <View style={styles.progressSection}>
          <View style={styles.instructionsHeader}>
            <Text style={styles.instructionsTitle}>Instructions</Text>
            <TouchableOpacity 
              onPress={handleInfoPress}
              style={styles.infoButton}
              activeOpacity={0.7}
            >
              <MaterialIcons name="info" size={20} color={COLORS.primary} />
              <Text style={styles.infoButtonLabel}>Where's my NFC module?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.instructionsBox}>
            <Text style={styles.instructionsText}>
            {writeError 
              ? 'Remove the card completely, then tap "Program NFC Card" again'
              : 'Place your NFC card against the back of your device. Hold it steady until the progress bar completes.'}
            </Text>
          </View>
          <NFCWriteProgress
            progress={writeProgress}
            isWriting={writing}
            error={writeError}
            success={writeSuccess}
            duration={writeDuration}
            status={writeStatus}
            attempt={writeAttempt}
          />
        </View>
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
            activeOpacity={0.8}
          >
            {writing ? (
              <>
                <MaterialIcons name="nfc" size={22} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Writing...</Text>
              </>
            ) : (
              <>
                <MaterialIcons name="nfc" size={22} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Program NFC Card</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {writeSuccess && (
          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={24} color={COLORS.success} />
            <Text style={styles.successText}>Card Programmed Successfully!</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleCancel}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>
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
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: Platform.OS === 'android' ? 120 : 100,
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrapper: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  cardSelector: {
    marginHorizontal: -20,
  },
  cardSelectorContent: {
    paddingHorizontal: 20,
  },
  cardOption: {
    width: width * 0.7,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.border,
    marginRight: 12,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardOptionSelected: {
    borderWidth: 3,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  cardColorBar: {
    height: 4,
    width: '100%',
  },
  cardOptionContent: {
    padding: 16,
  },
  cardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 8,
    marginBottom: 4,
  },
  cardCompany: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 4,
  },
  cardOccupation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  instructionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
  },
  infoButtonLabel: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '500',
  },
  instructionsBox: {
    backgroundColor: COLORS.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  instructionsText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  actionContainer: {
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: COLORS.successLight,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.success,
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
});

