import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { BulkRegistrationModalProps, BulkRegistrationState, ValidationState } from '../../types/bulkRegistration';
import { 
  calculateBulkRegistrationCost, 
  generateInitialAttendeeDetails,
  getBulkRegistrationSteps,
  canBulkRegister 
} from '../../utils/bulkRegistrationUtils';
import { createBulkRegistration } from '../../services/bulkRegistrationService';
import QuantitySelector from './QuantitySelector';
import AttendeeForm from './AttendeeForm';
import BulkRegistrationSummary from './BulkRegistrationSummary';
import { useToast } from '../../hooks/useToast';

const BulkRegistrationModal: React.FC<BulkRegistrationModalProps> = ({
  visible,
  onClose,
  event,
  onSuccess,
}) => {
  const toast = useToast();
  const [state, setState] = useState<BulkRegistrationState>({
    quantity: 2,
    attendeeDetails: generateInitialAttendeeDetails(2),
    currentStep: 'quantity',
    validation: {
      quantity: true,
      attendees: [],
      overall: false,
      errors: [],
    },
    cost: 0,
    loading: false,
    error: null,
    event,
  });

  // Track if user has interacted with quantity selection
  const [hasInteractedWithQuantity, setHasInteractedWithQuantity] = useState(false);

  const steps = getBulkRegistrationSteps(state.currentStep);

  useEffect(() => {
    // Recalculate cost when quantity changes
    const newCost = calculateBulkRegistrationCost(event, state.quantity);
    setState(prev => ({ ...prev, cost: newCost }));
  }, [state.quantity, event]);

  useEffect(() => {
    // Update attendee details when quantity changes
    if (state.attendeeDetails.length !== state.quantity) {
      const newAttendeeDetails = generateInitialAttendeeDetails(state.quantity);
      setState(prev => ({ ...prev, attendeeDetails: newAttendeeDetails }));
    }
  }, [state.quantity]);

  const handleQuantityChange = (quantity: number) => {
    setState(prev => ({ ...prev, quantity }));
    setHasInteractedWithQuantity(true);
  };

  const handleAttendeeDetailsChange = (attendeeDetails: any[]) => {
    setState(prev => ({ ...prev, attendeeDetails }));
  };

  const handleValidationChange = (validation: ValidationState) => {
    setState(prev => ({ ...prev, validation }));
  };

  const nextStep = () => {
    const currentStepIndex = steps.findIndex(step => step.id === state.currentStep);
    const nextStepIndex = currentStepIndex + 1;
    
    if (nextStepIndex < steps.length) {
      const nextStep = steps[nextStepIndex];
      setState(prev => ({ ...prev, currentStep: nextStep.id }));
    }
  };

  const prevStep = () => {
    const currentStepIndex = steps.findIndex(step => step.id === state.currentStep);
    const prevStepIndex = currentStepIndex - 1;
    
    if (prevStepIndex >= 0) {
      const prevStep = steps[prevStepIndex];
      setState(prev => ({ ...prev, currentStep: prevStep.id }));
    }
  };

  const handleConfirmRegistration = async () => {
    if (!state.validation.overall) {
      toast.error('Validation Error', 'Please fix all errors before proceeding.');
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await createBulkRegistration(event.id, {
        quantity: state.quantity,
        attendeeDetails: state.attendeeDetails,
      });

      if (response.success) {
        if (response.data.paymentUrl) {
          // Redirect to payment
          // This would typically open a WebView or external browser
          Alert.alert(
            'Payment Required',
            'You will be redirected to complete payment for your bulk registration.',
            [
              {
                text: 'OK',
                onPress: () => {
                  onSuccess?.(response.data.bulkRegistrationId);
                  onClose();
                },
              },
            ]
          );
        } else {
          // Free event - registration completed
          Alert.alert(
            'Registration Complete!',
            `Successfully registered ${state.quantity} people for ${event.title}`,
            [
              {
                text: 'View Tickets',
                onPress: () => {
                  onSuccess?.(response.data.bulkRegistrationId);
                  onClose();
                },
              },
            ]
          );
        }
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Bulk registration error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setState(prev => ({ ...prev, error: errorMessage }));
      toast.error('Registration Failed', errorMessage);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const renderStepContent = () => {
    switch (state.currentStep) {
      case 'quantity':
        return (
          <QuantitySelector
            quantity={state.quantity}
            onQuantityChange={handleQuantityChange}
            ticketPrice={event.ticketPrice || 0}
            eventCapacity={event.maxAttendees}
            currentRegistrations={event.currentAttendees}
          />
        );

      case 'details':
        return (
          <AttendeeForm
            quantity={state.quantity}
            attendeeDetails={state.attendeeDetails}
            onAttendeeDetailsChange={handleAttendeeDetailsChange}
            onValidationChange={handleValidationChange}
          />
        );

      case 'review':
        return (
          <BulkRegistrationSummary
            event={event}
            quantity={state.quantity}
            attendeeDetails={state.attendeeDetails}
            totalCost={state.cost}
            onConfirm={handleConfirmRegistration}
            onBack={prevStep}
            loading={state.loading}
          />
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (state.currentStep) {
      case 'quantity':
        return state.quantity >= 2 && state.quantity <= 50;
      case 'details':
        return state.validation.overall;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  if (!canBulkRegister(event)) {
    return (
      <Modal visible={visible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Bulk Registration Not Available</Text>
              <TouchableOpacity onPress={onClose}>
                <MaterialIcons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <View style={styles.errorContent}>
              <MaterialIcons name="error" size={48} color={COLORS.error} />
              <Text style={styles.errorTitle}>Bulk Registration Disabled</Text>
              <Text style={styles.errorText}>
                This event does not support bulk registrations or there are not enough available spots.
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButton}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color={COLORS.gray} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Bulk Registration</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Progress Steps */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              {steps.map((step, index) => {
                // Custom step completion logic
                let isComplete = false;
                if (step.id === 'quantity') {
                  isComplete = hasInteractedWithQuantity && state.currentStep !== 'quantity';
                } else {
                  isComplete = steps.findIndex(s => s.id === state.currentStep) > index;
                }

                return (
                  <View key={step.id} style={styles.stepContainer}>
                    <View
                      style={[
                        styles.stepIndicator,
                        step.isActive && styles.stepActive,
                        isComplete && styles.stepComplete,
                      ]}
                    >
                      {isComplete ? (
                        <MaterialIcons name="check" size={16} color={COLORS.white} />
                      ) : (
                        <Text style={styles.stepNumber}>{index + 1}</Text>
                      )}
                    </View>
                    <Text style={[styles.stepTitle, step.isActive && styles.stepTitleActive]}>
                      {step.title}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Content */}
          <ScrollView 
            style={styles.content}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {renderStepContent()}
          </ScrollView>

          {/* Navigation */}
          {state.currentStep !== 'review' && (
            <View style={styles.navigationContainer}>
              {state.currentStep !== 'quantity' && (
                <TouchableOpacity style={styles.navButton} onPress={prevStep}>
                  <MaterialIcons name="arrow-back" size={20} color={COLORS.gray} />
                  <Text style={styles.navButtonText}>Back</Text>
                </TouchableOpacity>
              )}

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={[styles.navButton, styles.nextButton, !canProceed() && styles.buttonDisabled]}
                onPress={nextStep}
                disabled={!canProceed()}
              >
                <Text style={styles.nextButtonText}>Next</Text>
                <MaterialIcons name="arrow-forward" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          )}

          {/* Loading Overlay */}
          {state.loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={COLORS.primary} />
              <Text style={styles.loadingText}>Processing registration...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    width: '95%',
    maxWidth: 500,
    minHeight: 300, // Ensure modal is tall enough
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  placeholder: {
    width: 32,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    flex: 1,
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepActive: {
    backgroundColor: COLORS.primary,
  },
  stepComplete: {
    backgroundColor: COLORS.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.gray,
  },
  stepTitle: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
  },
  stepTitleActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  content: {
    // flex: 1, // REMOVE THIS LINE
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  quantityStepContainer: {
    padding: 20,
  },
  quantityHeader: {
    marginBottom: 20,
  },
  quantityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
  },
  quantitySubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  quantityButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  decrementButton: {
    backgroundColor: COLORS.error,
  },
  incrementButton: {
    backgroundColor: COLORS.success,
  },
  buttonDisabled: {
    backgroundColor: COLORS.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  quantityDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  quantityNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  quantityLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  costContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.warningLight,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  costAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  capacityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  capacityText: {
    fontSize: 14,
    color: COLORS.success,
    marginLeft: 8,
    flex: 1,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.lightGray,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: COLORS.primary,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  navButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.gray,
  },
  errorContent: {
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.error,
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default BulkRegistrationModal; 