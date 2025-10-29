import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Modal, FlatList, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

// Country data with flags and codes (most common countries)
const COUNTRIES = [
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', name: 'Austria', flag: '🇦🇹' },
  { code: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: '+420', name: 'Czech Republic', flag: '🇨🇿' },
  { code: '+36', name: 'Hungary', flag: '🇭🇺' },
  { code: '+40', name: 'Romania', flag: '🇷🇴' },
  { code: '+359', name: 'Bulgaria', flag: '🇧🇬' },
  { code: '+385', name: 'Croatia', flag: '🇭🇷' },
  { code: '+386', name: 'Slovenia', flag: '🇸🇮' },
  { code: '+421', name: 'Slovakia', flag: '🇸🇰' },
  { code: '+370', name: 'Lithuania', flag: '🇱🇹' },
  { code: '+371', name: 'Latvia', flag: '🇱🇻' },
  { code: '+372', name: 'Estonia', flag: '🇪🇪' },
  { code: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: '+353', name: 'Ireland', flag: '🇮🇪' },
  { code: '+354', name: 'Iceland', flag: '🇮🇸' },
  { code: '+352', name: 'Luxembourg', flag: '🇱🇺' },
  { code: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: '+380', name: 'Ukraine', flag: '🇺🇦' },
  { code: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: '+98', name: 'Iran', flag: '🇮🇷' },
  { code: '+972', name: 'Israel', flag: '🇮🇱' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: '+51', name: 'Peru', flag: '🇵🇪' },
  { code: '+64', name: 'New Zealand', flag: '🇳🇿' },
];

interface PhoneNumberInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onCountryCodeChange: (countryCode: string) => void;
  placeholder?: string;
  error?: string;
  style?: any;
}

export default function PhoneNumberInput({ 
  value, 
  onChangeText, 
  onCountryCodeChange, 
  placeholder = "Phone number",
  error,
  style 
}: PhoneNumberInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.code === '+27') || COUNTRIES[0]); // Default to South Africa
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Phone validation function
  const validatePhone = (phoneNumber: string) => {
    // Remove all non-digit characters for validation
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid phone number (7-15 digits)
    const phoneRegex = /^\d{7,15}$/;
    return phoneRegex.test(cleanPhone);
  };

  // Real-time phone validation
  const handlePhoneChange = (text: string) => {
    // Only allow digits, spaces, hyphens, and parentheses
    let cleanedText = text.replace(/[^\d\s\-\(\)]/g, '');
    
    // Remove leading zeros
    cleanedText = cleanedText.replace(/^0+/, '');
    
    onChangeText(cleanedText);
  };

  // Handle country selection
  const handleCountrySelect = (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country);
    onCountryCodeChange(country.code);
    setShowCountryModal(false);
    setCountrySearch('');
  };

  // Parse existing phone number to extract country code and number
  const parseExistingPhone = (phone: string) => {
    if (!phone) return { countryCode: '+27', number: '' };
    
    // If phone starts with +, try to find matching country code
    if (phone.startsWith('+')) {
      // Find the longest matching country code
      const sortedCountries = COUNTRIES.sort((a, b) => b.code.length - a.code.length);
      for (const country of sortedCountries) {
        if (phone.startsWith(country.code)) {
          return {
            countryCode: country.code,
            number: phone.substring(country.code.length)
          };
        }
      }
    }
    
    // Default to South Africa if no match found
    return { countryCode: '+27', number: phone };
  };

  // Initialize country code from existing phone number
  React.useEffect(() => {
    if (value) {
      const { countryCode } = parseExistingPhone(value);
      const country = COUNTRIES.find(c => c.code === countryCode);
      if (country) {
        setSelectedCountry(country);
        onCountryCodeChange(countryCode);
      }
    }
  }, []);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.phoneContainer}>
        <TouchableOpacity 
          style={[styles.countryCodeButton, error ? styles.inputError : null]}
          onPress={() => setShowCountryModal(true)}
        >
          <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
          <Text style={styles.countryCodeText}>{selectedCountry.code}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={20} color="#666" />
        </TouchableOpacity>
        <TextInput
          style={[styles.phoneInput, error ? styles.inputError : null]}
          placeholder={placeholder}
          value={value}
          onChangeText={handlePhoneChange}
          keyboardType="phone-pad"
          placeholderTextColor="#999"
          maxLength={15}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* Country Selection Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity 
                onPress={() => setShowCountryModal(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Search countries..."
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholderTextColor="#999"
            />
            
            <FlatList
              data={COUNTRIES.filter(country => 
                country.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
                country.code.includes(countrySearch)
              )}
              keyExtractor={(item, index) => `${item.code}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryItem}
                  onPress={() => {
                    handleCountrySelect(item);
                    setCountrySearch('');
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <View style={styles.countryItemInfo}>
                    <Text style={styles.countryItemName}>{item.name}</Text>
                    <Text style={styles.countryItemCode}>{item.code}</Text>
                  </View>
                  {selectedCountry.code === item.code && selectedCountry.name === item.name && (
                    <MaterialIcons name="check" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
              style={styles.countryList}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 15,
  },
  phoneContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 15,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  countryFlag: {
    fontSize: 18,
    marginRight: 8,
  },
  countryCodeText: {
    fontSize: 16,
    color: '#333',
    marginRight: 5,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: 'red',
    borderWidth: 1,
  },
  errorText: {
    color: 'red',
    fontSize: 12,
    marginTop: -10,
    marginBottom: 10,
    marginLeft: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 15,
  },
  countryList: {
    maxHeight: 300,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  countryItemFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  countryItemInfo: {
    flex: 1,
  },
  countryItemName: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  countryItemCode: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});
