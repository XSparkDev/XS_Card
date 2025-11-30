import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { WidgetConfig, WidgetSize } from '../../widgets/WidgetTypes';
import { COLORS } from '../../constants/colors';

export interface WidgetCardProps {
  widget: WidgetConfig;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * Widget Card Component
 * Shows an existing widget with edit and delete actions
 */
export default function WidgetCard({ widget, onEdit, onDelete }: WidgetCardProps) {
  const sizeLabel = widget.size === WidgetSize.SMALL ? 'Small (2x2)' : 'Large (4x4)';
  const themeLabel = widget.theme.charAt(0).toUpperCase() + widget.theme.slice(1);
  const lastUpdate = widget.lastUpdate
    ? new Date(widget.lastUpdate).toLocaleDateString()
    : 'Never';

  return (
    <View style={styles.container}>
      {/* Widget Info */}
      <View style={styles.infoContainer}>
        <View style={styles.iconContainer}>
          <MaterialIcons name="widgets" size={32} color={COLORS.primary} />
        </View>
        
        <View style={styles.details}>
          <Text style={styles.title}>Home Screen Widget</Text>
          <Text style={styles.subtitle}>
            Size: {sizeLabel} • Theme: {themeLabel}
          </Text>
          <Text style={styles.updateText}>
            Last updated: {lastUpdate}
          </Text>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onEdit}
        >
          <MaterialIcons name="edit" size={20} color={COLORS.primary} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={onDelete}
        >
          <MaterialIcons name="delete" size={20} color={COLORS.danger} />
          <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.dark,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    marginBottom: 2,
  },
  updateText: {
    fontSize: 12,
    color: COLORS.gray,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.lightGray,
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
    gap: 6,
  },
  deleteButton: {
    backgroundColor: '#FFE5E5',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
  deleteText: {
    color: COLORS.danger,
  },
});





