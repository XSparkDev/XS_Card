import React from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { COLORS } from '../constants/colors';
import { openAppStore } from '../services/updateCheckService';
import { VersionInfo } from '../services/updateCheckService';

interface UpdateModalProps {
  visible: boolean;
  forceUpdate: boolean;
  versionInfo: VersionInfo | null;
  onDismiss?: () => void;
}

export const UpdateModal: React.FC<UpdateModalProps> = ({
  visible,
  forceUpdate,
  versionInfo,
  onDismiss,
}) => {
  if (!versionInfo) {
    return null;
  }

  const handleUpdate = async () => {
    await openAppStore(versionInfo.updateUrl);
  };

  const handleDismiss = () => {
    if (!forceUpdate && onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={forceUpdate ? undefined : handleDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {forceUpdate ? 'Update Required' : 'Update Available'}
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.message}>
              {versionInfo.updateMessage || 
               'A new version of XS Card is available. Please update to continue.'}
            </Text>

            {versionInfo.releaseNotes && (
              <View style={styles.releaseNotesContainer}>
                <Text style={styles.releaseNotesTitle}>What's New:</Text>
                <Text style={styles.releaseNotes}>{versionInfo.releaseNotes}</Text>
              </View>
            )}

            <View style={styles.versionInfo}>
              <Text style={styles.versionText}>
                Current Version: {versionInfo.currentVersion} ({versionInfo.currentBuildNumber})
              </Text>
              <Text style={styles.versionText}>
                Latest Version: {versionInfo.latestVersion} ({versionInfo.latestBuildNumber})
              </Text>
            </View>
          </ScrollView>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.updateButton]}
              onPress={handleUpdate}
              activeOpacity={0.7}
            >
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>

            {!forceUpdate && (
              <TouchableOpacity
                style={[styles.button, styles.laterButton]}
                onPress={handleDismiss}
                activeOpacity={0.7}
              >
                <Text style={styles.laterButtonText}>Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.black,
    textAlign: 'center',
  },
  content: {
    padding: 20,
    maxHeight: 300,
  },
  message: {
    fontSize: 16,
    color: COLORS.black,
    lineHeight: 24,
    marginBottom: 16,
  },
  releaseNotesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: COLORS.lightGray,
    borderRadius: 8,
  },
  releaseNotesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.black,
    marginBottom: 8,
  },
  releaseNotes: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  versionInfo: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  versionText: {
    fontSize: 12,
    color: COLORS.gray,
    marginBottom: 4,
  },
  buttonContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  updateButton: {
    backgroundColor: COLORS.secondary,
  },
  updateButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.gray,
  },
  laterButtonText: {
    color: COLORS.gray,
    fontSize: 16,
    fontWeight: '500',
  },
});

