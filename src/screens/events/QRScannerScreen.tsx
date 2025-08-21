import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Vibration,
  Dimensions,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Camera, CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../../context/AuthContext';
import { checkInAttendee, validateQRCode } from '../../services/eventService';
import { useToast } from '../../hooks/useToast';
import { Event, QRCodeData, CheckInResponse } from '../../types/events';
import { RootStackParamList } from '../../types';
import { COLORS } from '../../constants/colors';

interface QRScannerScreenProps {
  route: {
    params: {
      event: Event;
    };
  };
}

type QRScannerNavigationProp = StackNavigationProp<RootStackParamList, 'QRScanner'>;

const { width, height } = Dimensions.get('window');
const SCAN_AREA_SIZE = Math.min(width * 0.7, 300);

export const QRScannerScreen: React.FC = () => {
  const route = useRoute() as QRScannerScreenProps['route'];
  const navigation = useNavigation<QRScannerNavigationProp>();
  const { user } = useAuth();
  const { success, error: showError } = useToast();
  const { event } = route.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanned, setLastScanned] = useState<string>('');
  const [flashMode, setFlashMode] = useState<'off' | 'on'>('off');
  const [successModal, setSuccessModal] = useState(false);
  const [checkedInAttendee, setCheckedInAttendee] = useState<CheckInResponse | null>(null);

  const cameraRef = useRef<CameraView>(null);
  const scanTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  useEffect(() => {
    return () => {
      if (scanTimeout.current) {
        clearTimeout(scanTimeout.current);
      }
    };
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (!isScanning || isProcessing || data === lastScanned) {
      return;
    }

    setIsScanning(false);
    setIsProcessing(true);
    setLastScanned(data);

    try {
      // Vibrate on scan
      Vibration.vibrate(100);

      // Parse QR code data
      let qrData: QRCodeData;
      try {
        qrData = JSON.parse(data);
        console.log('[QRScanner] Parsed QR data:', JSON.stringify(qrData, null, 2));
      } catch (error) {
        console.error('[QRScanner] QR parsing failed:', error);
        console.error('[QRScanner] Raw QR data:', data);
        throw new Error('Invalid QR code format');
      }

      // Validate QR code structure
      if (!qrData.eventId || !qrData.userId || !qrData.ticketId || !qrData.verificationToken || qrData.type !== 'event_checkin') {
        console.error('QR Validation Failed - Missing fields:', {
          eventId: !!qrData.eventId,
          userId: !!qrData.userId,
          ticketId: !!qrData.ticketId,
          verificationToken: !!qrData.verificationToken,
          type: qrData.type
        });
        throw new Error('Invalid ticket QR code - missing required fields');
      }

      // Check if QR code is for this event
      if (qrData.eventId !== event.id) {
        throw new Error('This ticket is for a different event');
      }

      // Perform check-in
      const response = await checkInAttendee(qrData);
      
      if (response.success) {
        setCheckedInAttendee(response);
        setSuccessModal(true);
        success(`${response.userData?.name || 'Attendee'} successfully checked in!`);
        
        // Vibrate success pattern
        Vibration.vibrate([100, 100, 100]);
      } else {
        throw new Error(response.message || 'Check-in failed');
      }

    } catch (error: any) {
      console.error('QR Scan Error:', error);
      showError(error.message || 'Failed to process QR code');
      
      // Vibrate error pattern
      Vibration.vibrate([100, 50, 100, 50, 100]);
    } finally {
      setIsProcessing(false);
      
      // Resume scanning after delay
      scanTimeout.current = setTimeout(() => {
        setIsScanning(true);
        setLastScanned('');
      }, 2000);
    }
  };

  const toggleFlash = () => {
    setFlashMode(flashMode === 'off' ? 'on' : 'off');
  };

  const closeSuccessModal = () => {
    setSuccessModal(false);
    setCheckedInAttendee(null);
    setIsScanning(true);
  };

  const goToCheckInDashboard = () => {
    navigation.navigate('CheckInDashboard', { event });
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialIcons name="camera-alt" size={80} color={COLORS.gray} />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionText}>
          Please allow camera access to scan QR codes for event check-in.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="close" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <Text style={styles.headerSubtitle}>{event.title}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={goToCheckInDashboard}>
          <MaterialIcons name="dashboard" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flashMode}
          onBarcodeScanned={isScanning ? handleBarCodeScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          {/* Scan Area Overlay */}
          <View style={styles.overlay}>
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              
              {isProcessing && (
                <View style={styles.processingOverlay}>
                  <ActivityIndicator size="large" color="white" />
                  <Text style={styles.processingText}>Processing...</Text>
                </View>
              )}
            </View>
          </View>
        </CameraView>
      </View>

      {/* Instructions */}
      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>
          {isScanning ? 'Position QR code within the frame' : 'Scanning paused'}
        </Text>
        <Text style={styles.instructionText}>
          The QR code will be automatically scanned and processed
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={toggleFlash}>
          <MaterialIcons 
            name={flashMode === 'on' ? 'flash-on' : 'flash-off'} 
            size={24} 
            color="white" 
          />
          <Text style={styles.controlText}>Flash</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.controlButton, !isScanning && styles.controlButtonActive]} 
          onPress={() => setIsScanning(!isScanning)}
        >
          <MaterialIcons 
            name={isScanning ? 'pause' : 'play-arrow'} 
            size={24} 
            color="white" 
          />
          <Text style={styles.controlText}>
            {isScanning ? 'Pause' : 'Resume'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Success Modal */}
      <Modal
        visible={successModal}
        transparent
        animationType="fade"
        onRequestClose={closeSuccessModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MaterialIcons name="check-circle" size={60} color={COLORS.success} />
            <Text style={styles.modalTitle}>Check-in Successful!</Text>
            
            {checkedInAttendee?.userData && (
              <>
                <Text style={styles.modalName}>{checkedInAttendee.userData.name}</Text>
                <Text style={styles.modalEmail}>{checkedInAttendee.userData.email}</Text>
                {checkedInAttendee.userData.company && (
                  <Text style={styles.modalCompany}>{checkedInAttendee.userData.company}</Text>
                )}
              </>
            )}
            
            <Text style={styles.modalTime}>
              Checked in at {new Date(checkedInAttendee?.checkedInAt || '').toLocaleTimeString()}
            </Text>
            
            <TouchableOpacity style={styles.modalButton} onPress={closeSuccessModal}>
              <Text style={styles.modalButtonText}>Continue Scanning</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: 'white',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: 'white',
    fontSize: 16,
    marginTop: 10,
  },
  instructions: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
  },
  instructionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  instructionText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  controlButton: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    minWidth: 80,
  },
  controlButtonActive: {
    backgroundColor: COLORS.primary,
  },
  controlText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 20,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 30,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingText: {
    color: COLORS.text,
    fontSize: 16,
    marginTop: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  modalEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 5,
    textAlign: 'center',
  },
  modalCompany: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  modalTime: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 15,
    marginBottom: 25,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default QRScannerScreen;
