import React from 'react';
import { StyleSheet, View } from 'react-native';
import { COLORS } from '../../constants/colors';
import AdminHeader from '../../components/AdminHeader';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { AdminTabParamList } from '../../types';

type SettingsNavigationProp = BottomTabNavigationProp<AdminTabParamList, 'Settings'>;

export default function Settings() {
  return (
    <View style={styles.container}>
      <AdminHeader title="Settings" />
      <View style={styles.content}>
        {/* Add settings content here */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
    marginTop: 120,
    padding: 20,
  },
});
