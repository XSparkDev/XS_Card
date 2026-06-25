import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface LogoPlaceholderProps {
  /** Merged onto the container — typically the same style the logo image used. */
  style?: StyleProp<ViewStyle>;
  /** Override the "LOGO" font size (defaults to 22, suited to a full card). */
  textSize?: number;
}

/**
 * Company-logo placeholder shown when no logo has been uploaded. Matches the
 * white, bordered "Add your / LOGO / here" box used in CardsScreen / AddCards /
 * EditCard / every card template preview, so the placeholder looks identical
 * everywhere a card is rendered. Pass `textSize` to scale the label for small
 * upload tiles.
 */
export default function LogoPlaceholder({ style, textSize }: LogoPlaceholderProps) {
  const scale = textSize != null ? textSize / 22 : 1;
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.smallText, { fontSize: 11 * scale }]}>Add your</Text>
      <Text style={[styles.text, { fontSize: 22 * scale }]}>LOGO</Text>
      <Text style={[styles.smallText, { fontSize: 11 * scale }]}>here</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E2E2E2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.5,
  },
  smallText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9A9A9A',
    letterSpacing: 0.5,
  },
});
