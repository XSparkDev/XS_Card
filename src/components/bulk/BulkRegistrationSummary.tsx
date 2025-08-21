import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { BulkRegistrationSummaryProps } from '../../types/bulkRegistration';
import { formatCurrency } from '../../utils/bulkRegistrationUtils';

const BulkRegistrationSummary: React.FC<BulkRegistrationSummaryProps> = ({
  event,
  quantity,
  attendeeDetails,
  totalCost,
  onConfirm,
  onBack,
  loading = false,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Review & Confirm</Text>
        <Text style={styles.subtitle}>
          Please review your bulk registration details before proceeding
        </Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Event Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Event Details</Text>
          </View>
          <View style={styles.eventCard}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDate}>
              {new Date(event.date).toLocaleDateString()} at {event.time}
            </Text>
            <Text style={styles.eventLocation}>
              {event.location.venue}, {event.location.address}, {event.location.city}
            </Text>
          </View>
        </View>

        {/* Registration Summary */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="confirmation-number" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Registration Summary</Text>
          </View>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Number of Tickets:</Text>
              <Text style={styles.summaryValue}>{quantity}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Price per Ticket:</Text>
              <Text style={styles.summaryValue}>{formatCurrency(event.ticketPrice || 0)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Cost:</Text>
              <Text style={styles.totalValue}>{formatCurrency(totalCost)}</Text>
            </View>
          </View>
        </View>

        {/* Attendee List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="people" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Attendee List</Text>
          </View>
          <View style={styles.attendeeList}>
            {attendeeDetails.map((attendee, index) => (
              <View key={index} style={styles.attendeeItem}>
                <View style={styles.attendeeNumber}>
                  <Text style={styles.attendeeNumberText}>{index + 1}</Text>
                </View>
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeName}>{attendee.name}</Text>
                  <Text style={styles.attendeeEmail}>{attendee.email}</Text>
                  {attendee.phone && (
                    <Text style={styles.attendeePhone}>{attendee.phone}</Text>
                  )}
                </View>
                <MaterialIcons name="check-circle" size={20} color={COLORS.success} />
              </View>
            ))}
          </View>
        </View>

        {/* Important Information */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <MaterialIcons name="info" size={20} color={COLORS.primary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Important Information</Text>
              <Text style={styles.infoText}>
                • Each attendee will receive their own ticket with a unique QR code{'\n'}
                • Tickets will be sent to the email addresses provided{'\n'}
                • Payment is required to complete the registration{'\n'}
                • You can manage all tickets from your events dashboard
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={onBack}
          disabled={loading}
        >
          <MaterialIcons name="arrow-back" size={20} color={COLORS.gray} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.confirmButton, loading && styles.buttonDisabled]}
          onPress={onConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <MaterialIcons name="payment" size={20} color={COLORS.white} />
              <Text style={styles.confirmButtonText}>Proceed to Payment</Text>
            </>
          )}
        </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.gray,
    lineHeight: 22,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.black,
    marginLeft: 8,
  },
  eventCard: {
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 8,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  eventDate: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 2,
  },
  eventLocation: {
    fontSize: 14,
    color: COLORS.gray,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    padding: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: COLORS.gray,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    marginTop: 8,
    paddingTop: 16,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  attendeeList: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.lightGray,
    borderRadius: 8,
    overflow: 'hidden',
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 2,
  },
  attendeeEmail: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 2,
  },
  attendeePhone: {
    fontSize: 14,
    color: COLORS.gray,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.warningLight,
    padding: 16,
    borderRadius: 8,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.primary,
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    backgroundColor: COLORS.white,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  backButton: {
    flex: 1,
    backgroundColor: COLORS.lightGray,
    marginRight: 8,
  },
  backButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default BulkRegistrationSummary; 