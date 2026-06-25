/**
 * Global Montserrat font
 *
 * Applies Montserrat as the app-wide default font for every <Text> and
 * <TextInput>, mapping each element's fontWeight to the matching Montserrat
 * variant so bold/semibold text keeps its weight (React Native does not
 * synthesize weights for custom fonts).
 *
 * Elements that already set an explicit `fontFamily` (e.g. the card templates,
 * which use their own typefaces by design) are left untouched.
 *
 * Call applyGlobalMontserrat() once at startup, and make sure the Montserrat
 * fonts are loaded (via useFonts) before rendering app content.
 */
import React from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';

export const MONTSERRAT_FONTS = {
  Montserrat_400Regular: require('@expo-google-fonts/montserrat/Montserrat_400Regular.ttf'),
  Montserrat_500Medium: require('@expo-google-fonts/montserrat/Montserrat_500Medium.ttf'),
  Montserrat_600SemiBold: require('@expo-google-fonts/montserrat/Montserrat_600SemiBold.ttf'),
  Montserrat_700Bold: require('@expo-google-fonts/montserrat/Montserrat_700Bold.ttf'),
};

const familyForWeight = (weight?: string | number): string => {
  switch (String(weight ?? 'normal')) {
    case '500':
      return 'Montserrat_500Medium';
    case '600':
      return 'Montserrat_600SemiBold';
    case '700':
    case '800':
    case '900':
    case 'bold':
      return 'Montserrat_700Bold';
    default:
      return 'Montserrat_400Regular';
  }
};

let applied = false;

export function applyGlobalMontserrat(): void {
  if (applied) return;
  applied = true;

  for (const Component of [Text, TextInput] as any[]) {
    const originalRender = Component.render;
    if (typeof originalRender !== 'function') continue;

    Component.render = function patchedRender(...args: any[]) {
      const element = originalRender.apply(this, args);
      if (!element || !element.props) return element;

      const flattened = StyleSheet.flatten(element.props.style) || {};
      // Respect any element that intentionally sets its own font family.
      if (flattened.fontFamily) return element;

      const fontFamily = familyForWeight(flattened.fontWeight);
      // Inject Montserrat first so the element's own style still wins for
      // everything except fontFamily.
      return React.cloneElement(element, {
        style: [{ fontFamily }, element.props.style],
      });
    };
  }
}
