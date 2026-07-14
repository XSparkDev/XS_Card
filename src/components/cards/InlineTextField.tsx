/**
 * InlineTextField
 *
 * An invisible inline text editor. When onChange is undefined the component
 * renders a plain <Text> with zero interaction. When onChange is provided,
 * tapping the text switches it to a <TextInput> styled identically to the
 * surrounding text — no borders, no backgrounds, no icons, no visual cues.
 * Blurring (tapping away) commits the draft value and returns to <Text> mode.
 */
import React, { useRef, useState, useEffect } from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Platform, TextStyle } from 'react-native';

interface InlineTextFieldProps {
  value: string;
  onChange?: (v: string) => void;
  // Accept any style value so callers can pass `isTablet() && {...}` arrays.
  style?: any;
  numberOfLines?: number;
  ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
  placeholder?: string;
}

export default function InlineTextField({
  value,
  onChange,
  style,
  numberOfLines,
  ellipsizeMode,
  placeholder,
}: InlineTextFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<TextInput>(null);

  // Keep draft in sync with external value changes (e.g. form ↔ preview sync).
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Not editable — render a plain Text element.
  if (!onChange) {
    return (
      <Text style={style} numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode}>
        {value}
      </Text>
    );
  }

  if (editing) {
    return (
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={setDraft}
        onBlur={() => {
          setEditing(false);
          onChange(draft);
        }}
        onSubmitEditing={() => {
          setEditing(false);
          onChange(draft);
        }}
        autoFocus
        blurOnSubmit
        // Make the TextInput visually identical to the Text element it replaces.
        style={[
          style,
          styles.input,
          Platform.OS === 'android' && styles.androidReset,
        ]}
        multiline={false}
        returnKeyType="done"
        placeholder={placeholder}
      />
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => {
        setDraft(value);
        setEditing(true);
      }}
    >
      <Text style={style} numberOfLines={numberOfLines} ellipsizeMode={ellipsizeMode}>
        {value || placeholder || ''}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    // Remove default outline on web
    outlineWidth: 0,
  } as TextStyle,
  androidReset: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  } as TextStyle,
});
