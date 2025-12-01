import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  WidgetSize,
  WidgetTheme,
  WidgetDisplayMode,
  WidgetUpdateFrequency,
  WidgetConfig,
  WidgetData,
} from '../../widgets/WidgetTypes';
import { COLORS } from '../../constants/colors';
import DeviceMockupContainer from './DeviceMockupContainer';

export interface WidgetConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (config: Partial<WidgetConfig>) => Promise<void>;
  cardData: Partial<WidgetData>;
  existingConfig?: Partial<WidgetConfig>;
}

/**
 * Widget Configuration Modal
 * Full-screen modal for configuring widget settings with live preview
 */
export default function WidgetConfigModal({
  visible,
  onClose,
  onSave,
  cardData,
  existingConfig,
}: WidgetConfigModalProps) {
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<Partial<WidgetConfig>>({
    size: WidgetSize.LARGE,
    theme: WidgetTheme.CUSTOM,
    displayMode: WidgetDisplayMode.HYBRID,
    updateFrequency: WidgetUpdateFrequency.ON_CHANGE,
    showProfileImage: true,
    showCompanyLogo: true,
    showQRCode: true,
    showSocialLinks: true,
    ...existingConfig,
  });

  const [saving, setSaving] = useState(false);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const chevronRotation = useRef(new Animated.Value(0)).current;

  // Reset config when modal opens
  useEffect(() => {
    if (visible) {
      setConfig({
        size: WidgetSize.LARGE,
        theme: WidgetTheme.CUSTOM,
        displayMode: WidgetDisplayMode.HYBRID,
        updateFrequency: WidgetUpdateFrequency.ON_CHANGE,
        showProfileImage: true,
        showCompanyLogo: true,
        showQRCode: true,
        showSocialLinks: true,
        ...existingConfig,
      });
      // Reset preview state
      setPreviewExpanded(false);
      chevronRotation.setValue(0);
    }
  }, [visible, existingConfig, chevronRotation]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(config);
      onClose();
    } catch (error) {
      console.error('Error saving widget config:', error);
      Alert.alert('Error', 'Failed to save widget configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<WidgetConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const togglePreview = () => {
    const toValue = previewExpanded ? 0 : 1;
    setPreviewExpanded(!previewExpanded);
    
    Animated.timing(chevronRotation, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const chevronRotate = chevronRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configure Widget</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={styles.saveButton}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Preview Section - Collapsible */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={togglePreview}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Preview</Text>
              <Animated.View style={{ transform: [{ rotate: chevronRotate }] }}>
                <MaterialIcons
                  name="expand-more"
                  size={24}
                  color={COLORS.gray}
                />
              </Animated.View>
            </TouchableOpacity>
            
            {previewExpanded && (
              <View style={styles.previewContainerWrapper}>
                <View style={styles.previewContainer}>
                  <DeviceMockupContainer
                    config={config}
                    data={cardData}
                    size={config.size || WidgetSize.LARGE}
                    onSizeChange={(size) => updateConfig({ size })}
                  />
                </View>
              </View>
            )}
          </View>

          {/* Display Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display Options</Text>
            
            <View style={styles.optionRow}>
              <View style={styles.optionLabel}>
                <MaterialIcons name="account-circle" size={20} color={COLORS.gray} />
                <Text style={styles.optionText}>Show Profile Image</Text>
              </View>
              <Switch
                value={config.showProfileImage}
                onValueChange={(value) => updateConfig({ showProfileImage: value })}
                trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
                thumbColor="white"
              />
            </View>

            <View style={styles.optionRow}>
              <View style={styles.optionLabel}>
                <MaterialIcons name="business" size={20} color={COLORS.gray} />
                <Text style={styles.optionText}>Show Company Logo</Text>
              </View>
              <Switch
                value={config.showCompanyLogo}
                onValueChange={(value) => updateConfig({ showCompanyLogo: value })}
                trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
                thumbColor="white"
              />
            </View>

            <View style={styles.optionRow}>
              <View style={styles.optionLabel}>
                <MaterialIcons name="qr-code" size={20} color={COLORS.gray} />
                <Text style={styles.optionText}>Show QR Code</Text>
              </View>
              <Switch
                value={config.showQRCode}
                onValueChange={(value) => updateConfig({ showQRCode: value })}
                trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
                thumbColor="white"
              />
            </View>

            <View style={styles.optionRow}>
              <View style={styles.optionLabel}>
                <MaterialIcons name="link" size={20} color={COLORS.gray} />
                <Text style={styles.optionText}>Show Social Links</Text>
              </View>
              <Switch
                value={config.showSocialLinks}
                onValueChange={(value) => updateConfig({ showSocialLinks: value })}
                trackColor={{ false: COLORS.lightGray, true: COLORS.primary }}
                thumbColor="white"
              />
            </View>
          </View>

          {/* Theme Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Theme</Text>
            <View style={styles.buttonGroup}>
              {Object.values(WidgetTheme).map((theme) => (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.button,
                    config.theme === theme && styles.buttonActive,
                  ]}
                  onPress={() => updateConfig({ theme })}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      config.theme === theme && styles.buttonTextActive,
                    ]}
                  >
                    {theme.charAt(0).toUpperCase() + theme.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Display Mode */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Display Mode</Text>
            <View style={styles.buttonGroup}>
              {Object.values(WidgetDisplayMode).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.button,
                    config.displayMode === mode && styles.buttonActive,
                  ]}
                  onPress={() => updateConfig({ displayMode: mode })}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      config.displayMode === mode && styles.buttonTextActive,
                    ]}
                  >
                    {mode.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Update Frequency */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Update Frequency</Text>
            <View style={styles.buttonGroup}>
              {Object.values(WidgetUpdateFrequency).map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[
                    styles.button,
                    config.updateFrequency === freq && styles.buttonActive,
                  ]}
                  onPress={() => updateConfig({ updateFrequency: freq })}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      config.updateFrequency === freq && styles.buttonTextActive,
                    ]}
                  >
                    {freq.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    minWidth: 60,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
  },
  previewContainerWrapper: {
    marginTop: 12,
  },
  previewContainer: {
    height: 750,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  optionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionText: {
    fontSize: 15,
    color: COLORS.dark,
  },
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.lightGray,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  buttonActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  buttonText: {
    fontSize: 14,
    color: COLORS.gray,
    fontWeight: '600',
  },
  buttonTextActive: {
    color: COLORS.primary,
  },
});





