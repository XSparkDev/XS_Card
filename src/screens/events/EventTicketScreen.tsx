import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  Dimensions,
  ActivityIndicator,
  Platform,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAuth } from '../../context/AuthContext';
import { getMyTicketForEvent, generateQRCodeForTicket } from '../../services/eventService';
import { Event, EventTicket, QRCodeData } from '../../types/events';
import { COLORS } from '../../constants/colors';
import * as ScreenCapture from 'expo-screen-capture';
import { BlurView } from 'expo-blur';
import { generateAndEmailTicketPDF, shareTicketInfo } from '../../services/ticketService';
import { formatInstanceDate } from '../../utils/eventsRecurrence';

interface EventTicketScreenProps {
  route: {
    params: {
      event: Event;
      ticket?: EventTicket;
    };
  };
}

const { width } = Dimensions.get('window');
const QR_SIZE = Math.min(width * 0.7, 280);

export const EventTicketScreen: React.FC = () => {
  const route = useRoute() as EventTicketScreenProps['route'];
  const navigation = useNavigation();
  const { user } = useAuth();
  const { event, ticket: initialTicket } = route.params;

  const [ticket, setTicket] = useState<EventTicket | null>(initialTicket || null);
  const [allTickets, setAllTickets] = useState<EventTicket[]>([]);
  const [selectedTicketIndex, setSelectedTicketIndex] = useState(0);
  const [qrData, setQrData] = useState<string>('');
  const [qrVerificationToken, setQrVerificationToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generatingQR, setGeneratingQR] = useState(false);
  const [valueModalVisible, setValueModalVisible] = useState(false);
  const [brightness, setBrightness] = useState(1.0);
  // QR reveal control (iOS only). On Android it is shown by default.
  const [showQR, setShowQR] = useState(Platform.OS !== 'ios');
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isCaptured, setIsCaptured] = useState(false);
  const [emailingPDF, setEmailingPDF] = useState(false);

  useEffect(() => {
    loadTicketData();
    // Prevent system screenshots on Android; iOS will still allow but we’ll detect
    ScreenCapture.preventScreenCaptureAsync().catch(err => console.warn('ScreenCapture prevent failed', err));

    // Listener for screenshots (fires after a snapshot is taken)
    const subScreenshot = ScreenCapture.addScreenshotListener(() => {
      setIsCaptured(true);
      setShowQR(false); // immediately hide QR
      // Hide overlay after a short delay
      setTimeout(() => setIsCaptured(false), 3000);
    });

    // Listener for active screen recording – iOS doesn’t expose blocking; we detect via polling API if available
    // @ts-ignore - addScreenCaptureListener exists at runtime on Android; ignore TS if typings missing
    const subRecording = (ScreenCapture as any).addScreenCaptureListener
      ? (ScreenCapture as any).addScreenCaptureListener(({ isCaptured }: { isCaptured: boolean }) => {
          setIsCaptured(isCaptured);
          if (isCaptured) setShowQR(false);
        })
      : { remove: () => {} };

    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
      subScreenshot.remove();
      subRecording && subRecording.remove && subRecording.remove();
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    };
  }, []);

  const loadTicketData = async () => {
    if (!user) return;

    // Always fetch fresh ticket data from API, don't rely on route params
    setLoading(true);
    try {
      console.log('[EventTicketScreen] Loading ticket for event:', event.id);
      console.log('[EventTicketScreen] User ID:', user.uid);
      
      const response = await getMyTicketForEvent(event.id);
      console.log('[EventTicketScreen] Ticket response:', response);
      
      if (response && response.success) {
        // Handle multiple tickets for recurring events
        if (response.tickets && response.tickets.length > 1) {
          console.log('[EventTicketScreen] Multiple tickets found:', response.tickets.length);
          setAllTickets(response.tickets);
          setTicket(response.tickets[0]); // Show first ticket by default
          setSelectedTicketIndex(0);
        } else if (response.ticket) {
          console.log('[EventTicketScreen] Single ticket found:', response.ticket.id);
          setAllTickets([response.ticket]);
          setTicket(response.ticket);
          setSelectedTicketIndex(0);
        } else {
          console.log('[EventTicketScreen] No ticket found or invalid response');
          console.log('[EventTicketScreen] Response details:', JSON.stringify(response, null, 2));
          
          // More specific error message based on response
          const errorMessage = response?.message || 'You are not registered for this event or no ticket was found.';
          Alert.alert('No Ticket Found', errorMessage);
        }
      } else {
        console.log('[EventTicketScreen] No ticket found or invalid response');
        console.log('[EventTicketScreen] Response details:', JSON.stringify(response, null, 2));
        
        // More specific error message based on response
        const errorMessage = response?.message || 'You are not registered for this event or no ticket was found.';
        Alert.alert('No Ticket Found', errorMessage);
      }
    } catch (error: any) {
      console.error('[EventTicketScreen] Error loading ticket:', error);
      Alert.alert('Error', 'Failed to load ticket information: ' + (error?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async () => {
    if (!ticket || !user) {
      console.log('[EventTicketScreen] Missing ticket or user:', { ticket: !!ticket, user: !!user });
      return;
    }

    if (!ticket.id) {
      console.error('[EventTicketScreen] Ticket ID is missing:', ticket);
      Alert.alert('Error', 'Ticket ID is missing. Please reload the screen.');
      return;
    }

    if (!user.uid) {
      console.error('[EventTicketScreen] User ID is missing:', user);
      Alert.alert('Error', 'User authentication error. Please log out and log back in.');
      return;
    }

    console.log('[EventTicketScreen] Generating QR code for ticket:', ticket.id);
    console.log('[EventTicketScreen] Event ID:', event.id);
    console.log('[EventTicketScreen] User ID:', user.uid);
    console.log('[EventTicketScreen] Full ticket object:', JSON.stringify(ticket, null, 2));
    
    setGeneratingQR(true);
    try {
      const response = await generateQRCodeForTicket(ticket.id);
      console.log('[EventTicketScreen] QR generation response:', response);
      
      if (response.success) {
        // Store the verification token and create QR data object for display
        setQrVerificationToken(response.verificationToken);
        
        // Create the QR data object that matches what the backend expects for scanning
        const qrDataObj: QRCodeData = {
          eventId: event.id,
          userId: user.uid,
          ticketId: ticket.id,
          verificationToken: response.verificationToken,
          timestamp: Date.now(),
          type: 'event_checkin',
          version: '1.0'
        };
        
        // Validate QR data before setting it
        if (!qrDataObj.eventId || !qrDataObj.userId || !qrDataObj.ticketId || !qrDataObj.verificationToken) {
          console.error('[EventTicketScreen] Invalid QR data object:', qrDataObj);
          Alert.alert('Error', 'Failed to create valid QR code. Please try again.');
          return;
        }
        
        console.log('[EventTicketScreen] Generated QR data:', JSON.stringify(qrDataObj, null, 2));
        setQrData(JSON.stringify(qrDataObj));
        
        // Update ticket with QR generation status
        setTicket(prev => prev ? {
          ...prev,
          qrGenerated: true,
          qrGeneratedAt: new Date().toISOString()
        } : null);
      } else {
        console.error('[EventTicketScreen] QR generation failed:', response);
        Alert.alert('Error', response.message || 'Failed to generate QR code');
      }
    } catch (error: any) {
      console.error('[EventTicketScreen] Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code: ' + (error.message || 'Unknown error'));
    } finally {
      setGeneratingQR(false);
    }
  };

  const shareTicket = async () => {
    if (!ticket) return;
    
    try {
      await shareTicketInfo(event, ticket);
    } catch (error) {
      console.error('Error sharing ticket:', error);
    }
  };

  const handleEmailPDF = async () => {
    if (!ticket || !qrData) {
      Alert.alert('Error', 'Please generate your QR code first before emailing the ticket.');
      return;
    }

    setEmailingPDF(true);
    try {
      const result = await generateAndEmailTicketPDF(event, ticket, qrData);
      
      if (result.success) {
        Alert.alert(
          'Success',
          result.message,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Error',
          result.message || 'Failed to send PDF ticket. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error emailing PDF ticket:', error);
      Alert.alert(
        'Error',
        'Failed to send PDF ticket. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setEmailingPDF(false);
    }
  };

  const increaseBrightness = () => {
    setBrightness(1.0);
    // TODO: Implement actual screen brightness control if needed
  };

  const formatDate = (dateString: string, isoDateString?: string) => {
    try {
      let date: Date;
      
      // Use ISO string if available (more reliable)
      if (isoDateString) {
        date = new Date(isoDateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.error('Invalid date string:', { dateString, isoDateString });
        return 'Invalid date';
      }

      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const formatTime = (dateString: string, isoDateString?: string) => {
    try {
      let date: Date;
      
      // Use ISO string if available (more reliable)
      if (isoDateString) {
        date = new Date(isoDateString);
      } else {
        date = new Date(dateString);
      }

      if (isNaN(date.getTime())) {
        console.error('Invalid time string:', { dateString, isoDateString });
        return 'Invalid time';
      }

      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Invalid time';
    }
  };

  const revealQR = () => {
    setShowQR(true);
    // clear any existing timer
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    // auto hide after 5 seconds for iOS only
    if (Platform.OS === 'ios') {
      revealTimerRef.current = setTimeout(() => setShowQR(false), 5000);
    }
  };

  const switchTicket = (index: number) => {
    if (allTickets[index]) {
      setSelectedTicketIndex(index);
      setTicket(allTickets[index]);
      // Clear QR when switching tickets
      setQrData('');
      setQrVerificationToken('');
      setShowQR(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading ticket...</Text>
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error-outline" size={48} color="#FF6B6B" />
        <Text style={styles.errorTitle}>Ticket Not Found</Text>
        <Text style={styles.errorText}>
          You don't have a ticket for this event or it may have been cancelled.
        </Text>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Ticket</Text>
          <TouchableOpacity 
            onPress={handleEmailPDF}
            disabled={emailingPDF || !qrData}
            style={{ opacity: emailingPDF || !qrData ? 0.5 : 1 }}
          >
            {emailingPDF ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <MaterialIcons name="email" size={24} color={COLORS.primary} />
            )}
          </TouchableOpacity>
      </View>

      {/* Ticket Selector for Multiple Tickets (Recurring Events) */}
      {allTickets.length > 1 && (
        <View style={styles.ticketSelectorContainer}>
          <Text style={styles.ticketSelectorTitle}>Select Ticket ({allTickets.length} total)</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.ticketSelectorScroll}
            contentContainerStyle={styles.ticketSelectorContent}
          >
            {allTickets.map((t, index) => {
              const isSelected = index === selectedTicketIndex;
              const instanceId = (t as any).instanceId;
              const dateStr = instanceId ? instanceId.split('_')[1] : null;
              
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.ticketSelectorItem,
                    isSelected && styles.ticketSelectorItemSelected
                  ]}
                  onPress={() => switchTicket(index)}
                >
                  <MaterialIcons 
                    name={isSelected ? "check-circle" : "radio-button-unchecked"} 
                    size={20} 
                    color={isSelected ? COLORS.primary : COLORS.gray} 
                  />
                  <Text style={[
                    styles.ticketSelectorText,
                    isSelected && styles.ticketSelectorTextSelected
                  ]}>
                    {dateStr ? formatInstanceDate(instanceId) : `Ticket ${index + 1}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Ticket Card */}
      <View style={styles.ticketCard}>
        {/* Event Info */}
        <View style={styles.eventInfo}>
            <View style={styles.eventHeaderRow}>
          <Text style={styles.eventTitle}>{event.title}</Text>
              <Image source={require('../../../assets/images/xslogo.png')} style={styles.brandLogo} />
            </View>
          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <MaterialIcons name="event" size={20} color="#666" />
              <Text style={styles.detailText}>
                {(() => {
                  // For recurring events, show instance-specific date if available
                  const instanceId = (ticket as any)?.instanceId;
                  if (instanceId) {
                    const dateStr = instanceId.split('_')[1];
                    if (dateStr) {
                      return formatInstanceDate(instanceId);
                    }
                  }
                  return formatDate(event.eventDate, event.eventDateISO);
                })()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="access-time" size={20} color="#666" />
              <Text style={styles.detailText}>
                {(() => {
                  // For recurring events, show instance-specific time if available
                  const instanceId = (ticket as any)?.instanceId;
                  if (instanceId && event.isRecurring && event.recurrencePattern) {
                    return event.recurrencePattern.startTime || formatTime(event.eventDate, event.eventDateISO);
                  }
                  return formatTime(event.eventDate, event.eventDateISO);
                })()}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="location-on" size={20} color="#666" />
              <Text style={styles.detailText}>
                {event.location.venue}, {event.location.city}
              </Text>
            </View>
          </View>
        </View>

        {/* QR Code Section */}
        <View style={styles.qrSection}>
          {qrData ? (
            <>
              <Text style={styles.qrTitle}>Your Entry QR Code</Text>
              <View style={styles.qrContainer}>
                <QRCode
                  value={qrData}
                  size={QR_SIZE}
                  backgroundColor="white"
                  color="black"
                />
                  {Platform.OS === 'ios' && !showQR && (
                    <BlurView intensity={60} tint="dark" style={styles.qrBlurOverlay}>
                      <TouchableOpacity style={styles.revealButton} onPress={revealQR}>
                        <MaterialIcons name="visibility" size={28} color={COLORS.white} />
                        <Text style={styles.revealText}>Show QR</Text>
                      </TouchableOpacity>
                    </BlurView>
                  )}
              </View>
              <Text style={styles.qrInstructions}>
                Show this QR code to the event organizer for check-in
              </Text>
              
              {/* QR Actions */}
              <View style={styles.qrActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={increaseBrightness}
                >
                    <MaterialIcons name="brightness-high" size={20} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Brighten</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={generateQRCode}
                  disabled={generatingQR}
                >
                    <MaterialIcons name="refresh" size={20} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
              
              {/* Ticket Actions */}
              <View style={styles.ticketActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={shareTicket}
                >
                    <MaterialIcons name="share" size={20} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                  onPress={handleEmailPDF}
                  disabled={emailingPDF}
                >
                  {emailingPDF ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <MaterialIcons name="email" size={20} color={COLORS.white} />
                  )}
                  <Text style={[styles.actionButtonText, { color: COLORS.white }]}>
                    {emailingPDF ? 'Sending...' : 'Email PDF'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.generateQRSection}>
              <MaterialIcons name="qr-code" size={64} color="#DDD" />
              <Text style={styles.generateQRTitle}>Generate QR Code</Text>
              <Text style={styles.generateQRText}>
                Create your QR code to enable quick check-in at the event
              </Text>
              <TouchableOpacity 
                style={[styles.generateButton, generatingQR && styles.generateButtonDisabled]}
                onPress={generateQRCode}
                disabled={generatingQR}
              >
                {generatingQR ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                    <MaterialIcons name="qr-code-scanner" size={20} color={COLORS.white} />
                )}
                <Text style={styles.generateButtonText}>
                  {generatingQR ? 'Generating...' : 'Generate QR Code'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Ticket Details */}
        <View style={styles.ticketDetails}>
          <Text style={styles.sectionTitle}>Ticket Information</Text>
          
          <View style={styles.ticketInfoRow}>
            <Text style={styles.ticketLabel}>Ticket ID:</Text>
            <Text style={styles.ticketValue}>{ticket.id}</Text>
          </View>
          
          <View style={styles.ticketInfoRow}>
            <Text style={styles.ticketLabel}>Registration Date:</Text>
            <Text style={styles.ticketValue}>
              {new Date(ticket.createdAt).toLocaleDateString()}
            </Text>
          </View>
          
          <View style={styles.ticketInfoRow}>
            <Text style={styles.ticketLabel}>Status:</Text>
            <View style={[styles.statusBadge, getStatusBadgeStyle(ticket.status)]}>
              <Text style={[styles.statusText, getStatusTextStyle(ticket.status)]}>
                {ticket.status.toUpperCase()}
              </Text>
            </View>
          </View>

          {ticket.checkedIn && (
            <View style={styles.checkedInInfo}>
              <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
              <Text style={styles.checkedInText}>
                Checked in at {new Date(ticket.checkedInAt!).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

          {/* XSCard Branding removed; logo now in header row */}
      </View>

      {/* Important Notes */}
      <View style={styles.notesSection}>
        <Text style={styles.notesTitle}>Important Notes</Text>
        <Text style={styles.notesText}>
          • Keep this QR code safe and don't share it with others
        </Text>
        <Text style={styles.notesText}>
          • You can regenerate the QR code if needed
        </Text>
        <Text style={styles.notesText}>
          • Arrive at the venue 15 minutes before the event starts
        </Text>
        <Text style={styles.notesText}>
          • Contact the organizer if you have any issues
        </Text>
      </View>
    </ScrollView>

      {isCaptured && (
        <BlurView intensity={70} tint="dark" style={styles.captureOverlay}>
          <MaterialIcons name="visibility-off" size={48} color={COLORS.white} />
          <Text style={styles.captureText}>Screen capture detected</Text>
        </BlurView>
      )}

      {/* Ticket Value Modal */}
      <Modal
        visible={valueModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setValueModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialIcons name="download" size={36} color={COLORS.primary} />
            <Text style={styles.modalTitle}>Ticket Value</Text>
            <Text style={styles.modalText}>This ticket is valued at R3.</Text>
            <TouchableOpacity style={styles.modalButton} onPress={() => setValueModalVisible(false)}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStatusBadgeStyle = (status: string) => {
  switch (status) {
    case 'confirmed':
      return styles.statusConfirmed;
    case 'cancelled':
      return styles.statusCancelled;
    case 'pending':
      return styles.statusPending;
    default:
      return styles.statusDefault;
  }
};

const getStatusTextStyle = (status: string) => {
  switch (status) {
    case 'confirmed':
      return styles.statusTextConfirmed;
    case 'cancelled':
      return styles.statusTextCancelled;
    case 'pending':
      return styles.statusTextPending;
    default:
      return styles.statusTextDefault;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  contentContainer: {
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    // Add safe-area aware top padding similar to other screens
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 16 : 40,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  ticketCard: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  eventInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  eventHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  eventDetails: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
  qrSection: {
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  qrContainer: {
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 16,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  qrActions: {
    flexDirection: 'row',
    gap: 16,
  },
  ticketActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  generateQRSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  generateQRTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  generateQRText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 40, // pill shape
  },
  generateButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  ticketDetails: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  ticketInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  ticketLabel: {
    fontSize: 16,
    color: '#666',
  },
  ticketValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusConfirmed: {
    backgroundColor: '#E8F5E8',
  },
  statusTextConfirmed: {
    color: '#4CAF50',
  },
  statusCancelled: {
    backgroundColor: '#FFE8E8',
  },
  statusTextCancelled: {
    color: '#F44336',
  },
  statusPending: {
    backgroundColor: '#FFF3E0',
  },
  statusTextPending: {
    color: '#FF9800',
  },
  statusDefault: {
    backgroundColor: '#F0F0F0',
  },
  statusTextDefault: {
    color: '#666',
  },
  checkedInInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#E8F5E8',
    borderRadius: 8,
  },
  checkedInText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  notesSection: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginTop: 0,
    padding: 20,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  notesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 4,
  },
  brandLogo: {
    width: 64,
    height: 64,
    resizeMode: 'contain',
    marginLeft: 8,
  },
  /* Modal styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginTop: 12,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: COLORS.gray,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 40,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  modalButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  qrBlurOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  revealButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  revealText: {
    marginTop: 8,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
  },
  captureOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: {
    marginTop: 12,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  ticketSelectorContainer: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  ticketSelectorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 12,
  },
  ticketSelectorScroll: {
    flexGrow: 0,
  },
  ticketSelectorContent: {
    paddingRight: 16,
  },
  ticketSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    borderWidth: 1.5,
    borderColor: COLORS.background,
    gap: 8,
  },
  ticketSelectorItemSelected: {
    backgroundColor: '#E3F2FD',
    borderColor: COLORS.primary,
  },
  ticketSelectorText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.gray,
  },
  ticketSelectorTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default EventTicketScreen;
