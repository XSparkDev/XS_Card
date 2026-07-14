import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AsYouType, parsePhoneNumber as libParse, CountryCode } from 'libphonenumber-js';
import { COLORS } from '../constants/colors';

// ─── Country list (ISO2, dialCode, name, flag) ───────────────────────────────

interface CountryEntry {
  iso2: CountryCode;
  dialCode: string;
  name: string;
  flag: string;
}

export const PHONE_COUNTRIES: CountryEntry[] = [
  { iso2: 'ZA', dialCode: '27',  name: 'South Africa',      flag: '🇿🇦' },
  { iso2: 'US', dialCode: '1',   name: 'United States',     flag: '🇺🇸' },
  { iso2: 'CA', dialCode: '1',   name: 'Canada',            flag: '🇨🇦' },
  { iso2: 'GB', dialCode: '44',  name: 'United Kingdom',    flag: '🇬🇧' },
  { iso2: 'AU', dialCode: '61',  name: 'Australia',         flag: '🇦🇺' },
  { iso2: 'NZ', dialCode: '64',  name: 'New Zealand',       flag: '🇳🇿' },
  { iso2: 'IN', dialCode: '91',  name: 'India',             flag: '🇮🇳' },
  { iso2: 'CN', dialCode: '86',  name: 'China',             flag: '🇨🇳' },
  { iso2: 'JP', dialCode: '81',  name: 'Japan',             flag: '🇯🇵' },
  { iso2: 'KR', dialCode: '82',  name: 'South Korea',       flag: '🇰🇷' },
  { iso2: 'SG', dialCode: '65',  name: 'Singapore',         flag: '🇸🇬' },
  { iso2: 'MY', dialCode: '60',  name: 'Malaysia',          flag: '🇲🇾' },
  { iso2: 'TH', dialCode: '66',  name: 'Thailand',          flag: '🇹🇭' },
  { iso2: 'VN', dialCode: '84',  name: 'Vietnam',           flag: '🇻🇳' },
  { iso2: 'PH', dialCode: '63',  name: 'Philippines',       flag: '🇵🇭' },
  { iso2: 'ID', dialCode: '62',  name: 'Indonesia',         flag: '🇮🇩' },
  { iso2: 'BD', dialCode: '880', name: 'Bangladesh',        flag: '🇧🇩' },
  { iso2: 'PK', dialCode: '92',  name: 'Pakistan',          flag: '🇵🇰' },
  { iso2: 'LK', dialCode: '94',  name: 'Sri Lanka',         flag: '🇱🇰' },
  { iso2: 'DE', dialCode: '49',  name: 'Germany',           flag: '🇩🇪' },
  { iso2: 'FR', dialCode: '33',  name: 'France',            flag: '🇫🇷' },
  { iso2: 'IT', dialCode: '39',  name: 'Italy',             flag: '🇮🇹' },
  { iso2: 'ES', dialCode: '34',  name: 'Spain',             flag: '🇪🇸' },
  { iso2: 'PT', dialCode: '351', name: 'Portugal',          flag: '🇵🇹' },
  { iso2: 'NL', dialCode: '31',  name: 'Netherlands',       flag: '🇳🇱' },
  { iso2: 'BE', dialCode: '32',  name: 'Belgium',           flag: '🇧🇪' },
  { iso2: 'CH', dialCode: '41',  name: 'Switzerland',       flag: '🇨🇭' },
  { iso2: 'AT', dialCode: '43',  name: 'Austria',           flag: '🇦🇹' },
  { iso2: 'SE', dialCode: '46',  name: 'Sweden',            flag: '🇸🇪' },
  { iso2: 'NO', dialCode: '47',  name: 'Norway',            flag: '🇳🇴' },
  { iso2: 'DK', dialCode: '45',  name: 'Denmark',           flag: '🇩🇰' },
  { iso2: 'FI', dialCode: '358', name: 'Finland',           flag: '🇫🇮' },
  { iso2: 'IE', dialCode: '353', name: 'Ireland',           flag: '🇮🇪' },
  { iso2: 'IS', dialCode: '354', name: 'Iceland',           flag: '🇮🇸' },
  { iso2: 'LU', dialCode: '352', name: 'Luxembourg',        flag: '🇱🇺' },
  { iso2: 'PL', dialCode: '48',  name: 'Poland',            flag: '🇵🇱' },
  { iso2: 'CZ', dialCode: '420', name: 'Czech Republic',    flag: '🇨🇿' },
  { iso2: 'SK', dialCode: '421', name: 'Slovakia',          flag: '🇸🇰' },
  { iso2: 'HU', dialCode: '36',  name: 'Hungary',           flag: '🇭🇺' },
  { iso2: 'RO', dialCode: '40',  name: 'Romania',           flag: '🇷🇴' },
  { iso2: 'BG', dialCode: '359', name: 'Bulgaria',          flag: '🇧🇬' },
  { iso2: 'HR', dialCode: '385', name: 'Croatia',           flag: '🇭🇷' },
  { iso2: 'SI', dialCode: '386', name: 'Slovenia',          flag: '🇸🇮' },
  { iso2: 'LT', dialCode: '370', name: 'Lithuania',         flag: '🇱🇹' },
  { iso2: 'LV', dialCode: '371', name: 'Latvia',            flag: '🇱🇻' },
  { iso2: 'EE', dialCode: '372', name: 'Estonia',           flag: '🇪🇪' },
  { iso2: 'GR', dialCode: '30',  name: 'Greece',            flag: '🇬🇷' },
  { iso2: 'RU', dialCode: '7',   name: 'Russia',            flag: '🇷🇺' },
  { iso2: 'UA', dialCode: '380', name: 'Ukraine',           flag: '🇺🇦' },
  { iso2: 'TR', dialCode: '90',  name: 'Turkey',            flag: '🇹🇷' },
  { iso2: 'IL', dialCode: '972', name: 'Israel',            flag: '🇮🇱' },
  { iso2: 'SA', dialCode: '966', name: 'Saudi Arabia',      flag: '🇸🇦' },
  { iso2: 'AE', dialCode: '971', name: 'UAE',               flag: '🇦🇪' },
  { iso2: 'QA', dialCode: '974', name: 'Qatar',             flag: '🇶🇦' },
  { iso2: 'KW', dialCode: '965', name: 'Kuwait',            flag: '🇰🇼' },
  { iso2: 'BH', dialCode: '973', name: 'Bahrain',           flag: '🇧🇭' },
  { iso2: 'OM', dialCode: '968', name: 'Oman',              flag: '🇴🇲' },
  { iso2: 'JO', dialCode: '962', name: 'Jordan',            flag: '🇯🇴' },
  { iso2: 'LB', dialCode: '961', name: 'Lebanon',           flag: '🇱🇧' },
  { iso2: 'IR', dialCode: '98',  name: 'Iran',              flag: '🇮🇷' },
  { iso2: 'EG', dialCode: '20',  name: 'Egypt',             flag: '🇪🇬' },
  { iso2: 'NG', dialCode: '234', name: 'Nigeria',           flag: '🇳🇬' },
  { iso2: 'KE', dialCode: '254', name: 'Kenya',             flag: '🇰🇪' },
  { iso2: 'GH', dialCode: '233', name: 'Ghana',             flag: '🇬🇭' },
  { iso2: 'TZ', dialCode: '255', name: 'Tanzania',          flag: '🇹🇿' },
  { iso2: 'UG', dialCode: '256', name: 'Uganda',            flag: '🇺🇬' },
  { iso2: 'ET', dialCode: '251', name: 'Ethiopia',          flag: '🇪🇹' },
  { iso2: 'ZW', dialCode: '263', name: 'Zimbabwe',          flag: '🇿🇼' },
  { iso2: 'ZM', dialCode: '260', name: 'Zambia',            flag: '🇿🇲' },
  { iso2: 'MZ', dialCode: '258', name: 'Mozambique',        flag: '🇲🇿' },
  { iso2: 'BW', dialCode: '267', name: 'Botswana',          flag: '🇧🇼' },
  { iso2: 'NA', dialCode: '264', name: 'Namibia',           flag: '🇳🇦' },
  { iso2: 'SZ', dialCode: '268', name: 'Eswatini',         flag: '🇸🇿' },
  { iso2: 'LS', dialCode: '266', name: 'Lesotho',           flag: '🇱🇸' },
  { iso2: 'MG', dialCode: '261', name: 'Madagascar',        flag: '🇲🇬' },
  { iso2: 'MU', dialCode: '230', name: 'Mauritius',         flag: '🇲🇺' },
  { iso2: 'MX', dialCode: '52',  name: 'Mexico',            flag: '🇲🇽' },
  { iso2: 'BR', dialCode: '55',  name: 'Brazil',            flag: '🇧🇷' },
  { iso2: 'AR', dialCode: '54',  name: 'Argentina',         flag: '🇦🇷' },
  { iso2: 'CL', dialCode: '56',  name: 'Chile',             flag: '🇨🇱' },
  { iso2: 'CO', dialCode: '57',  name: 'Colombia',          flag: '🇨🇴' },
  { iso2: 'PE', dialCode: '51',  name: 'Peru',              flag: '🇵🇪' },
  { iso2: 'VE', dialCode: '58',  name: 'Venezuela',         flag: '🇻🇪' },
  { iso2: 'EC', dialCode: '593', name: 'Ecuador',           flag: '🇪🇨' },
  { iso2: 'UY', dialCode: '598', name: 'Uruguay',           flag: '🇺🇾' },
];

const DEFAULT_COUNTRY = PHONE_COUNTRIES[0]; // South Africa

function byIso2(iso2: string): CountryEntry {
  return PHONE_COUNTRIES.find(c => c.iso2 === iso2) ?? DEFAULT_COUNTRY;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format digits as-you-type for a given country. */
function formatAsYouType(digits: string, iso2: CountryCode): string {
  if (!digits) return '';
  return new AsYouType(iso2).input(digits) || digits;
}

/** Try to produce an E.164 string from raw digits + country. Returns partial if invalid. */
function toE164(digits: string, country: CountryEntry): string {
  if (!digits) return '';
  try {
    const parsed = libParse('+' + country.dialCode + digits, country.iso2);
    if (parsed?.isValid()) return parsed.format('E.164');
  } catch {}
  return '+' + country.dialCode + digits;
}

/** Parse an incoming E.164 value and return { country, displayValue }. */
function parseE164(e164: string): { country: CountryEntry; displayValue: string } | null {
  if (!e164) return null;
  try {
    const parsed = libParse(e164);
    if (parsed) {
      const country = PHONE_COUNTRIES.find(c => c.iso2 === (parsed.country as string));
      if (country) {
        return { country, displayValue: parsed.formatNational() };
      }
    }
  } catch {}
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface PhoneNumberInputProps {
  /** Current E.164 value (e.g. "+27829299292") or empty string. */
  e164Value: string;
  /** Called with E.164 (or best-effort "+dialCode+digits") on every change. */
  onChange: (e164: string) => void;
  /** ISO2 country code to pre-select when no e164Value is provided. Default: 'ZA'. */
  initialCountry?: string;
  placeholder?: string;
  error?: string;
  style?: any;
  disabled?: boolean;
  /**
   * Visual style variant:
   *   'outlined' — white bg, 1px border, borderRadius 12 (AddContactPanel default)
   *   'filled'   — #F5F5F5 bg, no border, borderRadius 25 (AddCards / EditCard / CompleteProfile)
   */
  variant?: 'outlined' | 'filled';
}

export default function PhoneNumberInput({
  e164Value,
  onChange,
  initialCountry = 'ZA',
  placeholder = 'Phone number',
  error,
  style,
  disabled = false,
  variant = 'outlined',
}: PhoneNumberInputProps) {
  const [country, setCountry] = useState<CountryEntry>(() => byIso2(initialCountry));
  const [displayValue, setDisplayValue] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  // Track whether we've done the initial sync so we don't re-parse on every render.
  const initialised = useRef(false);

  // Sync from e164Value prop (only on mount or when it changes externally).
  useEffect(() => {
    if (!e164Value) {
      if (!initialised.current) initialised.current = true;
      return;
    }
    const result = parseE164(e164Value);
    if (result) {
      setCountry(result.country);
      setDisplayValue(result.displayValue);
    } else {
      // Unrecognised format — show as-is stripped of country code
      setDisplayValue(e164Value.replace(/^\+\d{1,4}/, '').trim());
    }
    initialised.current = true;
  }, [e164Value]);

  const handleTextChange = useCallback(
    (text: string) => {
      // Handle paste of a full international number (starts with +).
      if (text.startsWith('+')) {
        const result = parseE164(text);
        if (result) {
          setCountry(result.country);
          setDisplayValue(result.displayValue);
          try {
            const parsed = libParse(text);
            if (parsed?.isValid()) {
              onChange(parsed.format('E.164'));
              return;
            }
          } catch {}
        }
      }

      // Normal typing: keep only digits.
      const digits = text.replace(/\D/g, '');
      const formatted = formatAsYouType(digits, country.iso2);
      setDisplayValue(formatted);
      onChange(toE164(digits, country));
    },
    [country, onChange],
  );

  const handleCountrySelect = useCallback(
    (next: CountryEntry) => {
      setCountry(next);
      setShowModal(false);
      setSearch('');

      // Re-derive display and E.164 for current digits under the new country.
      const digits = displayValue.replace(/\D/g, '');
      const formatted = formatAsYouType(digits, next.iso2);
      setDisplayValue(formatted);
      onChange(toE164(digits, next));
    },
    [displayValue, onChange],
  );

  const filtered = PHONE_COUNTRIES.filter(
    c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.startsWith(search.replace('+', '')),
  );

  const isFilled = variant === 'filled';
  const rowStyle = isFilled ? styles.rowFilled : styles.rowOutlined;
  const rowErrorStyle = isFilled ? styles.rowFilledError : styles.rowError;
  const btnStyle = isFilled ? styles.countryBtnFilled : styles.countryBtnOutlined;
  const dialStyle = isFilled ? styles.dialCodeFilled : styles.dialCode;
  const textInputStyle = isFilled ? styles.inputFilled : styles.inputOutlined;

  return (
    <View style={[styles.wrapper, isFilled && styles.wrapperFilled, style]}>
      {/* ── Input row ── */}
      <View style={[rowStyle, error ? rowErrorStyle : null, disabled && styles.disabledRow]}>
        <TouchableOpacity
          style={btnStyle}
          onPress={() => !disabled && setShowModal(true)}
          disabled={disabled}
          accessibilityLabel={`Country: ${country.name}, dial code +${country.dialCode}`}
          accessibilityRole="button"
        >
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={dialStyle}>+{country.dialCode}</Text>
          <MaterialIcons name="keyboard-arrow-down" size={16} color={COLORS.gray} />
        </TouchableOpacity>

        <View style={isFilled ? styles.dividerFilled : styles.divider} />

        <TextInput
          style={textInputStyle}
          value={displayValue}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.gray}
          keyboardType="phone-pad"
          editable={!disabled}
          accessibilityLabel="Phone number"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {/* ── Country picker modal ── */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => { setShowModal(false); setSearch(''); }}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => { setShowModal(false); setSearch(''); }}
                style={styles.closeBtn}
                accessibilityLabel="Close"
              >
                <MaterialIcons name="close" size={24} color={COLORS.gray} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
              <MaterialIcons name="search" size={20} color={COLORS.gray} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or code…"
                placeholderTextColor={COLORS.gray}
                value={search}
                onChangeText={setSearch}
                autoFocus
                accessibilityLabel="Search countries"
              />
            </View>

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={item => item.iso2}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = country.iso2 === item.iso2;
                return (
                  <TouchableOpacity
                    style={[styles.countryRow, selected && styles.countryRowSelected]}
                    onPress={() => handleCountrySelect(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} +${item.dialCode}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.itemFlag}>{item.flag}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={[styles.itemName, selected && styles.itemNameSelected]}>
                        {item.name}
                      </Text>
                      <Text style={styles.itemCode}>+{item.dialCode}</Text>
                    </View>
                    {selected && (
                      <MaterialIcons name="check" size={20} color={COLORS.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },
  wrapperFilled: {
    marginBottom: 15,
  },

  // ── outlined variant (AddContactPanel) ──
  rowOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  rowError: {
    borderColor: COLORS.primary,
    borderWidth: 1,
  },
  countryBtnOutlined: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    gap: 4,
  },
  dialCode: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '500',
    minWidth: 32,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
  },
  inputOutlined: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    color: COLORS.black,
  },

  // ── filled variant (AddCards / EditCard / CompleteProfile) ──
  rowFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    overflow: 'hidden',
  },
  rowFilledError: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  countryBtnFilled: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 15,
    paddingRight: 10,
    paddingVertical: 15,
    gap: 4,
  },
  dialCodeFilled: {
    fontSize: 16,
    color: COLORS.black,
    fontWeight: '500',
    minWidth: 36,
  },
  dividerFilled: {
    width: 1,
    height: 22,
    backgroundColor: '#DCDCDC',
  },
  inputFilled: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
    color: COLORS.black,
  },

  // ── shared ──
  disabledRow: {
    opacity: 0.5,
  },
  flag: {
    fontSize: 18,
  },
  errorText: {
    color: COLORS.primary,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  // Modal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.black,
  },
  closeBtn: {
    padding: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: '#F9F9F9',
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.black,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  countryRowSelected: {
    backgroundColor: '#FFF5F7',
  },
  itemFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    color: COLORS.black,
    fontWeight: '500',
  },
  itemNameSelected: {
    color: COLORS.primary,
  },
  itemCode: {
    fontSize: 13,
    color: COLORS.gray,
    marginTop: 1,
  },
});
