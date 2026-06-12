import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface LogoPlaceholderProps {
  /** Merged onto the container — typically the same style the logo image used. */
  style?: StyleProp<ViewStyle>;
  /** Override the "LOGO" font size (defaults to 48, suited to a full card). */
  textSize?: number;
}

/**
 * Company-logo placeholder shown when no logo has been uploaded. Matches the grey
 * "LOGO" box used in CardsScreen / AddCards / the template-1 preview, so the
 * placeholder looks identical everywhere a card is rendered. Pass `textSize` to
 * shrink the label for small upload tiles.
 */
export default function LogoPlaceholder({ style, textSize }: LogoPlaceholderProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.text, textSize != null && { fontSize: textSize }]}>LOGO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#d3d3d3',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    textShadowColor: 'rgba(255, 255, 255, 0.6)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
});
