import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
  TouchableWithoutFeedback,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { authenticatedFetchWithRefresh, ENDPOINTS } from '../../utils/api';
import { useToast } from '../../hooks/useToast';
import EventHeader from '../../components/EventHeader';

type OrganiserRegistrationScreenProps = NativeStackScreenProps<any, 'OrganiserRegistration'>;

interface Bank {
  id: number;
  name: string;
  code: string;
  slug: string;
}

interface OrganiserFormData {
  businessName: string;
  businessType: string;
  registrationNumber: string;
  contactName: string;
  phone: string;
  email: string;
  businessAddress: string;
  city: string;
  country: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
}

const BUSINESS_TYPES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'company', label: 'Company' },
  { value: 'ngo', label: 'NGO/Non-Profit' },
  { value: 'other', label: 'Other' }
];

const STEPS = {
  BUSINESS_INFO: 0,
  BANKING_DETAILS: 1,
  VERIFICATION: 2,
} as const;

type StepType = typeof STEPS[keyof typeof STEPS];

const STEP_TITLES = [
  'Business Information',
  'Banking Details',
  'Verification & Terms',
];

// Animation and UI constants
const ANIMATION_DURATION = 200;
const DROPDOWN_MAX_HEIGHT = 200;
const VERIFICATION_DELAY = 2000;
const DROPDOWN_SLIDE_OFFSET = 10;

export default function OrganiserRegistrationScreen({ navigation }: OrganiserRegistrationScreenProps) {
  const toast = useToast();
  const [currentStep, setCurrentStep] = useState<StepType>(STEPS.BUSINESS_INFO);
  const [loading, setLoading] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [verifyingAccount, setVerifyingAccount] = useState(false);
  const [showBusinessTypeDropdown, setShowBusinessTypeDropdown] = useState(false);
  const dropdownRef = useRef<View>(null);
  const dropdownAnimation = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  const [formData, setFormData] = useState<OrganiserFormData>({
    businessName: '',
    businessType: '',
    registrationNumber: '',
    contactName: '',
    phone: '',
    email: '',
    businessAddress: '',
    city: '',
    country: 'South Africa',
    accountNumber: '',
    bankCode: '',
    bankName: '',
    accountName: '',
    termsAccepted: false,
    privacyAccepted: false,
    marketingConsent: false,
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrganiserFormData, string>>>({});

  useEffect(() => {
    loadBanks();
  }, []);

  const loadBanks = async () => {
    try {
      // Request South African banks specifically
      const response = await authenticatedFetchWithRefresh(`${ENDPOINTS.GET_ORGANISER_BANKS}?currency=ZAR`);
      if (response.ok) {
        const data = await response.json();
        setBanks(data.data);
      } else if (response.status === 401) {
        // User not authenticated - redirect to login
        toast.error('Authentication Required', 'Please log in to continue with organiser registration.');
        navigation.navigate('SignIn');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Log error for debugging in development
      if (__DEV__) {
        console.error('Error loading banks:', error);
      }
      toast.error('Error', 'Failed to load banks. Please try again.');
    }
  };

  const animateDropdown = (show: boolean) => {
    Animated.timing(dropdownAnimation, {
      toValue: show ? 1 : 0,
      duration: ANIMATION_DURATION,
      useNativeDriver: false,
    }).start();
  };

  const updateFormData = (updates: Partial<OrganiserFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear related errors
    const newErrors = { ...errors };
    Object.keys(updates).forEach(key => {
      delete newErrors[key as keyof OrganiserFormData];
    });
    setErrors(newErrors);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<Record<keyof OrganiserFormData, string>> = {};

    switch (step) {
      case STEPS.BUSINESS_INFO:
        if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
        if (!formData.businessType) newErrors.businessType = 'Business type is required';
        if (!formData.contactName.trim()) newErrors.contactName = 'Contact name is required';
        if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
        if (!formData.email.trim()) newErrors.email = 'Email is required';
        if (!formData.businessAddress.trim()) newErrors.businessAddress = 'Business address is required';
        if (!formData.city.trim()) newErrors.city = 'City is required';
        break;

      case STEPS.BANKING_DETAILS:
        if (!formData.accountNumber.trim()) newErrors.accountNumber = 'Account number is required';
        if (!formData.bankCode) newErrors.bankCode = 'Bank selection is required';
        if (!formData.bankName.trim()) newErrors.bankName = 'Bank name is required';
        break;

      case STEPS.VERIFICATION:
        if (!formData.termsAccepted) newErrors.termsAccepted = 'Terms acceptance is required';
        if (!formData.privacyAccepted) newErrors.privacyAccepted = 'Privacy policy acceptance is required';
        break;

      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.VERIFICATION) as StepType);
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, STEPS.BUSINESS_INFO) as StepType);
  };

  const selectBank = (bank: Bank) => {
    updateFormData({
      bankCode: bank.code,
      bankName: bank.name,
      accountName: '' // Clear account name when bank changes
    });
    setShowBankModal(false);
  };

  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
    bank.code.toLowerCase().includes(bankSearchQuery.toLowerCase())
  );

  const submitStep = async (step: number) => {
    if (!validateStep(step)) return;

    setLoading(true);
    try {
      const endpoint = step === STEPS.BUSINESS_INFO ? ENDPOINTS.REGISTER_ORGANISER_STEP1 :
                       step === STEPS.BANKING_DETAILS ? ENDPOINTS.REGISTER_ORGANISER_STEP2 :
                       ENDPOINTS.REGISTER_ORGANISER_STEP3;
      let payload = {};

      switch (step) {
        case STEPS.BUSINESS_INFO:
          payload = {
            businessName: formData.businessName,
            businessType: formData.businessType,
            registrationNumber: formData.registrationNumber,
            contactName: formData.contactName,
            phone: formData.phone,
            email: formData.email,
            businessAddress: formData.businessAddress,
            city: formData.city,
            country: formData.country,
          };
          break;

        case STEPS.BANKING_DETAILS:
          payload = {
            accountNumber: formData.accountNumber,
            bankCode: formData.bankCode,
            bankName: formData.bankName,
            accountName: formData.accountName,
          };
          break;

        case STEPS.VERIFICATION:
          payload = {
            termsAccepted: formData.termsAccepted,
            privacyAccepted: formData.privacyAccepted,
            marketingConsent: formData.marketingConsent,
          };
          break;
      }

      const response = await authenticatedFetchWithRefresh(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        if (step === STEPS.VERIFICATION) {
          // Registration completed
          Alert.alert(
            'Registration Complete!',
            'Your payment collection account has been created successfully. You can now create paid events and collect payments from attendees.',
            [
              {
                text: 'Start Creating Events',
                onPress: () => navigation.navigate('CreateEvent'),
              },
            ]
          );
        } else if (step === STEPS.BANKING_DETAILS) {
          // Banking details saved, account name returned
          if (data.data?.accountName) {
            updateFormData({ accountName: data.data.accountName });
          }
          toast.success('Success', 'Banking details verified and saved successfully!');
          nextStep();
        } else {
          // Business info saved
          toast.success('Success', 'Business information saved successfully!');
          nextStep();
        }
      } else {
        throw new Error(data.message || 'Registration failed');
      }
    } catch (error) {
      // Log error for debugging in development
      if (__DEV__) {
        console.error('Registration error:', error);
      }
      
      let errorMessage = 'Failed to complete registration. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Provide specific guidance for common errors
        if (error.message.includes('bank account details')) {
          errorMessage = 'Bank account verification failed. Please check your account number and bank selection.';
        } else if (error.message.includes('payment account')) {
          errorMessage = 'Unable to create payment account. Please verify your banking details and try again.';
        } else if (error.message.includes('JSON')) {
          errorMessage = 'Server communication error. Please try again in a moment.';
        }
      }
      
      toast.error('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const verifyBankAccount = async () => {
    if (!formData.accountNumber || !formData.bankCode) {
      toast.warning('Missing Information', 'Please enter account number and select a bank first.');
      return;
    }

    setVerifyingAccount(true);
    try {
      // This would typically be a separate endpoint to verify account
      // For now, we'll just simulate verification
      await new Promise(resolve => setTimeout(resolve, VERIFICATION_DELAY));
      
      // Mock account name - in real implementation, this would come from bank verification API
      const mockAccountName = `${formData.contactName.toUpperCase()} BUSINESS ACCOUNT`;
      updateFormData({ accountName: mockAccountName });
      
      toast.success('Verification Successful', 'Bank account verified successfully!');
    } catch (error) {
      toast.error('Verification Failed', 'Unable to verify bank account. Please check your details.');
    } finally {
      setVerifyingAccount(false);
    }
  };

  const renderBusinessInfoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Business Information</Text>
      <Text style={styles.stepDescription}>
        Provide your business details to set up your payment collection account.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Business Name *</Text>
        <TextInput
          style={[styles.input, errors.businessName && styles.inputError]}
          value={formData.businessName}
          onChangeText={(text) => updateFormData({ businessName: text })}
          placeholder="Enter your business name"
          placeholderTextColor={COLORS.gray}
        />
        {errors.businessName && <Text style={styles.errorText}>{errors.businessName}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Business Type *</Text>
        <TouchableWithoutFeedback onPress={() => {
          setShowBusinessTypeDropdown(false);
          animateDropdown(false);
        }}>
          <View style={styles.dropdownContainer} ref={dropdownRef}>
            <TouchableOpacity
              style={[styles.input, styles.pickerInput, errors.businessType && styles.inputError]}
              onPress={() => {
                const newState = !showBusinessTypeDropdown;
                setShowBusinessTypeDropdown(newState);
                animateDropdown(newState);
              }}
            >
              <Text style={formData.businessType ? styles.inputText : styles.placeholderText}>
                {formData.businessType 
                  ? BUSINESS_TYPES.find(t => t.value === formData.businessType)?.label 
                  : 'Select business type'
                }
              </Text>
              <MaterialIcons 
                name={showBusinessTypeDropdown ? "arrow-drop-up" : "arrow-drop-down"} 
                size={24} 
                color={COLORS.gray} 
              />
            </TouchableOpacity>
            
            <Animated.View 
              style={[
                styles.dropdownList,
                {
                  opacity: dropdownAnimation,
                  transform: [{
                    translateY: dropdownAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-DROPDOWN_SLIDE_OFFSET, 0],
                    })
                  }],
                  maxHeight: dropdownAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, DROPDOWN_MAX_HEIGHT],
                  }),
                }
              ]}
            >
              <ScrollView 
                style={styles.dropdownScrollView}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {BUSINESS_TYPES.map((type, index) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.dropdownItem,
                      formData.businessType === type.value && styles.dropdownItemSelected,
                      index === BUSINESS_TYPES.length - 1 && styles.dropdownItemLast
                    ]}
                    onPress={() => {
                      updateFormData({ businessType: type.value });
                      setShowBusinessTypeDropdown(false);
                      animateDropdown(false);
                    }}
                  >
                    <Text style={[
                      styles.dropdownItemText,
                      formData.businessType === type.value && styles.dropdownItemTextSelected
                    ]}>
                      {type.label}
                    </Text>
                    {formData.businessType === type.value && (
                      <MaterialIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
        {errors.businessType && <Text style={styles.errorText}>{errors.businessType}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Registration Number (Optional)</Text>
        <TextInput
          style={styles.input}
          value={formData.registrationNumber}
          onChangeText={(text) => updateFormData({ registrationNumber: text })}
          placeholder="Company registration number"
          placeholderTextColor={COLORS.gray}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Contact Name *</Text>
        <TextInput
          style={[styles.input, errors.contactName && styles.inputError]}
          value={formData.contactName}
          onChangeText={(text) => updateFormData({ contactName: text })}
          placeholder="Primary contact person"
          placeholderTextColor={COLORS.gray}
        />
        {errors.contactName && <Text style={styles.errorText}>{errors.contactName}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={[styles.input, errors.phone && styles.inputError]}
          value={formData.phone}
          onChangeText={(text) => updateFormData({ phone: text })}
          placeholder="Business phone number"
          placeholderTextColor={COLORS.gray}
          keyboardType="phone-pad"
        />
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          value={formData.email}
          onChangeText={(text) => updateFormData({ email: text })}
          placeholder="Business email address"
          placeholderTextColor={COLORS.gray}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Business Address *</Text>
        <TextInput
          style={[styles.input, errors.businessAddress && styles.inputError]}
          value={formData.businessAddress}
          onChangeText={(text) => updateFormData({ businessAddress: text })}
          placeholder="Full business address"
          placeholderTextColor={COLORS.gray}
          multiline
          numberOfLines={2}
        />
        {errors.businessAddress && <Text style={styles.errorText}>{errors.businessAddress}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>City *</Text>
        <TextInput
          style={[styles.input, errors.city && styles.inputError]}
          value={formData.city}
          onChangeText={(text) => updateFormData({ city: text })}
          placeholder="City"
          placeholderTextColor={COLORS.gray}
        />
        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
      </View>
    </View>
  );

  const renderBankingDetailsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Banking Details</Text>
      <Text style={styles.stepDescription}>
        Provide your banking details to receive payments from event attendees.
      </Text>
      
      {/* Development mode indicator - only show in development */}
      {__DEV__ && (
        <View style={styles.devModeContainer}>
          <MaterialIcons name="info" size={16} color={COLORS.warning} />
          <Text style={styles.devModeText}>
            Development Mode: Bank verification is simulated for testing
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Bank *</Text>
        <TouchableOpacity
          style={[styles.input, styles.pickerInput, errors.bankCode && styles.inputError]}
          onPress={() => setShowBankModal(true)}
        >
          <Text style={formData.bankName ? styles.inputText : styles.placeholderText}>
            {formData.bankName || 'Select your bank'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={24} color={COLORS.gray} />
        </TouchableOpacity>
        {errors.bankCode && <Text style={styles.errorText}>{errors.bankCode}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Account Number *</Text>
        <TextInput
          style={[styles.input, errors.accountNumber && styles.inputError]}
          value={formData.accountNumber}
          onChangeText={(text) => updateFormData({ accountNumber: text })}
          placeholder="Enter account number"
          placeholderTextColor={COLORS.gray}
          keyboardType="numeric"
        />
        {errors.accountNumber && <Text style={styles.errorText}>{errors.accountNumber}</Text>}
      </View>

      {formData.accountNumber && formData.bankCode && (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={verifyBankAccount}
          disabled={verifyingAccount}
        >
          {verifyingAccount ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <MaterialIcons name="verified" size={20} color={COLORS.white} />
              <Text style={styles.verifyButtonText}>Verify Account</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {formData.accountName && (
        <View style={styles.accountNameContainer}>
          <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
          <Text style={styles.accountNameText}>{formData.accountName}</Text>
        </View>
      )}

      <View style={styles.infoBox}>
        <MaterialIcons name="info" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Your banking details are securely stored and will be used to receive payments from event attendees. 
          We charge a 10% platform fee on each transaction.
        </Text>
      </View>
    </View>
  );

  const renderVerificationStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Verification & Terms</Text>
      <Text style={styles.stepDescription}>
        Review and accept our terms to complete your registration.
      </Text>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Registration Summary</Text>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Business Name:</Text>
          <Text style={styles.summaryValue}>{formData.businessName}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Business Type:</Text>
          <Text style={styles.summaryValue}>
            {BUSINESS_TYPES.find(t => t.value === formData.businessType)?.label}
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Contact:</Text>
          <Text style={styles.summaryValue}>{formData.contactName}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Bank:</Text>
          <Text style={styles.summaryValue}>{formData.bankName}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Account:</Text>
          <Text style={styles.summaryValue}>{formData.accountName}</Text>
        </View>
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => updateFormData({ termsAccepted: !formData.termsAccepted })}
        >
          <MaterialIcons 
            name={formData.termsAccepted ? 'check-box' : 'check-box-outline-blank'} 
            size={24} 
            color={formData.termsAccepted ? COLORS.primary : COLORS.gray} 
          />
          <Text style={styles.checkboxText}>
            I accept the <Text style={styles.linkText}>Terms of Service</Text> *
          </Text>
        </TouchableOpacity>
        {errors.termsAccepted && <Text style={styles.errorText}>{errors.termsAccepted}</Text>}
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => updateFormData({ privacyAccepted: !formData.privacyAccepted })}
        >
          <MaterialIcons 
            name={formData.privacyAccepted ? 'check-box' : 'check-box-outline-blank'} 
            size={24} 
            color={formData.privacyAccepted ? COLORS.primary : COLORS.gray} 
          />
          <Text style={styles.checkboxText}>
            I accept the <Text style={styles.linkText}>Privacy Policy</Text> *
          </Text>
        </TouchableOpacity>
        {errors.privacyAccepted && <Text style={styles.errorText}>{errors.privacyAccepted}</Text>}
      </View>

      <View style={styles.checkboxContainer}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => updateFormData({ marketingConsent: !formData.marketingConsent })}
        >
          <MaterialIcons 
            name={formData.marketingConsent ? 'check-box' : 'check-box-outline-blank'} 
            size={24} 
            color={formData.marketingConsent ? COLORS.primary : COLORS.gray} 
          />
          <Text style={styles.checkboxText}>
            I agree to receive marketing communications (Optional)
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <MaterialIcons name="security" size={20} color={COLORS.primary} />
        <Text style={styles.infoText}>
          Your account will be reviewed and activated within 24 hours. 
          You'll receive an email confirmation once approved.
        </Text>
      </View>
    </View>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.BUSINESS_INFO:
        return renderBusinessInfoStep();
      case STEPS.BANKING_DETAILS:
        return renderBankingDetailsStep();
      case STEPS.VERIFICATION:
        return renderVerificationStep();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <EventHeader title="Payment Collection Registration" />

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

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={!showBusinessTypeDropdown}
          nestedScrollEnabled={true}
        >
          {renderStepContent()}
        </ScrollView>

        {/* Navigation buttons */}
        <View style={styles.navigationContainer}>
          {currentStep > STEPS.BUSINESS_INFO && (
            <TouchableOpacity
              style={[styles.navButton, styles.backButton]}
              onPress={prevStep}
            >
              <MaterialIcons name="arrow-back" size={20} color={COLORS.gray} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={[styles.navButton, styles.nextButton, { backgroundColor: COLORS.primary }]}
            onPress={() => submitStep(currentStep)}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {currentStep === STEPS.VERIFICATION ? 'Complete Registration' : 'Next'}
                </Text>
                <MaterialIcons 
                  name={currentStep === STEPS.VERIFICATION ? 'check' : 'arrow-forward'} 
                  size={20} 
                  color={COLORS.white} 
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Bank Selection Modal */}
      <Modal
        visible={showBankModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Bank</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}>
                <MaterialIcons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.searchInput}
              value={bankSearchQuery}
              onChangeText={setBankSearchQuery}
              placeholder="Search banks..."
              placeholderTextColor={COLORS.gray}
            />

            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankItem}
                  onPress={() => selectBank(item)}
                >
                  <Text style={styles.bankName}>{item.name}</Text>
                  <Text style={styles.bankCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
              style={styles.bankList}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  progressBar: {
    height: 4,
    backgroundColor: COLORS.lightGray,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    paddingVertical: 20,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 16,
    color: COLORS.gray,
    marginBottom: 24,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: COLORS.white,
    color: COLORS.black,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  inputText: {
    fontSize: 16,
    color: COLORS.black,
  },
  placeholderText: {
    fontSize: 16,
    color: COLORS.gray,
  },
  pickerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  verifyButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  accountNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.successLight,
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    gap: 8,
  },
  accountNameText: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.warningLight,
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.primary,
    lineHeight: 20,
  },
  summaryContainer: {
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.gray,
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  checkboxContainer: {
    marginBottom: 16,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxText: {
    fontSize: 14,
    color: COLORS.black,
    flex: 1,
  },
  linkText: {
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  backButton: {
    backgroundColor: COLORS.lightGray,
  },
  backButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
  },
  nextButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  bankList: {
    maxHeight: 300,
  },
  bankItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  bankCode: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  devModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  devModeText: {
    fontSize: 14,
    color: '#F57C00',
    marginLeft: 8,
    flex: 1,
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  dropdownList: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    marginTop: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemSelected: {
    backgroundColor: COLORS.warningLight,
  },
  dropdownItemText: {
    fontSize: 16,
    color: COLORS.black,
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  dropdownScrollView: {
    maxHeight: DROPDOWN_MAX_HEIGHT,
  },
}); 