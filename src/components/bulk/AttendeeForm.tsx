import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { AttendeeFormProps, AttendeeDetail } from '../../types/bulkRegistration';
import { validateAttendeeDetails } from '../../utils/bulkRegistrationUtils';

const AttendeeForm: React.FC<AttendeeFormProps> = ({
  quantity,
  attendeeDetails,
  onAttendeeDetailsChange,
  onValidationChange,
}) => {
  useEffect(() => {
    // Validate attendee details whenever they change
    const validation = validateAttendeeDetails(attendeeDetails);
    const attendeeValidations = attendeeDetails.map((attendee, index) => {
      const hasName = attendee.name.trim().length > 0;
      const hasEmail = attendee.email.trim().length > 0;
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email);
      return hasName && hasEmail && isValidEmail;
    });

    onValidationChange({
      quantity: true,
      attendees: attendeeValidations,
      overall: validation.valid,
      errors: validation.errors,
    });
  }, [attendeeDetails]); // Removed onValidationChange from dependencies

  const updateAttendee = (index: number, field: keyof AttendeeDetail, value: string) => {
    const updatedDetails = [...attendeeDetails];
    updatedDetails[index] = {
      ...updatedDetails[index],
      [field]: value,
    };
    onAttendeeDetailsChange(updatedDetails);
  };

  const clearAllFields = () => {
    Alert.alert(
      'Clear All Fields',
      'Are you sure you want to clear all attendee details?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            const clearedDetails = attendeeDetails.map(() => ({
              name: '',
              email: '',
              phone: '',
            }));
            onAttendeeDetailsChange(clearedDetails);
          },
        },
      ]
    );
  };

  const copyFromFirst = () => {
    if (attendeeDetails.length === 0 || !attendeeDetails[0].name) {
      Alert.alert('No Data', 'Please fill in the first attendee details first.');
      return;
    }

    const firstAttendee = attendeeDetails[0];
    const updatedDetails = attendeeDetails.map((attendee, index) => {
      if (index === 0) return attendee; // Keep first attendee as is
      return {
        ...attendee,
        name: `${firstAttendee.name} ${index + 1}`,
        email: `${firstAttendee.email.split('@')[0]}+${index + 1}@${firstAttendee.email.split('@')[1]}`,
        phone: firstAttendee.phone,
      };
    });
    onAttendeeDetailsChange(updatedDetails);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendee Details</Text>
        <Text style={styles.subtitle}>
          Enter information for each person you're registering
        </Text>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={clearAllFields}>
          <MaterialIcons name="clear-all" size={20} color={COLORS.error} />
          <Text style={[styles.actionButtonText, { color: COLORS.error }]}>
            Clear All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={copyFromFirst}>
          <MaterialIcons name="content-copy" size={20} color={COLORS.primary} />
          <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
            Copy from First
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {attendeeDetails.map((attendee, index) => (
          <View key={index} style={styles.attendeeCard}>
            <View style={styles.attendeeHeader}>
              <View style={styles.attendeeNumber}>
                <Text style={styles.attendeeNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.attendeeTitle}>Attendee {index + 1}</Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={[
                  styles.input,
                  !attendee.name.trim() && styles.inputError
                ]}
                value={attendee.name}
                onChangeText={(text) => updateAttendee(index, 'name', text)}
                placeholder="Enter full name"
                placeholderTextColor={COLORS.gray}
                autoCapitalize="words"
              />
              {!attendee.name.trim() && (
                <Text style={styles.errorText}>Name is required</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={[
                  styles.input,
                  (!attendee.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email)) && styles.inputError
                ]}
                value={attendee.email}
                onChangeText={(text) => updateAttendee(index, 'email', text)}
                placeholder="Enter email address"
                placeholderTextColor={COLORS.gray}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!attendee.email.trim() && (
                <Text style={styles.errorText}>Email is required</Text>
              )}
              {attendee.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(attendee.email) && (
                <Text style={styles.errorText}>Invalid email format</Text>
              )}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number (Optional)</Text>
              <TextInput
                style={styles.input}
                value={attendee.phone}
                onChangeText={(text) => updateAttendee(index, 'phone', text)}
                placeholder="Enter phone number"
                placeholderTextColor={COLORS.gray}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.infoContainer}>
        <MaterialIcons name="info" size={16} color={COLORS.gray} />
        <Text style={styles.infoText}>
          Each attendee will receive their own ticket with a unique QR code. 
          Make sure email addresses are correct as tickets will be sent there.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: COLORS.lightGray,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  attendeeCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  attendeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  attendeeNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  attendeeNumberText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  attendeeTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 6,
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
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 4,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.lightGray,
    padding: 16,
    margin: 20,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});

export default AttendeeForm; 