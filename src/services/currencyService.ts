/**
 * Currency Service — regional display currency + conversion
 *
 * Responsibility split, which the rest of the pricing code depends on:
 *
 *   BILLING price  = whatever RevenueCat/Apple/Google charges. Never computed
 *                    here, never converted, never rounded. Source of truth.
 *   DISPLAY price  = what we show in marketing surfaces. May be converted and
 *                    charm-priced (see utils/psychologicalPricing).
 *
 * Conversion is a FALLBACK ONLY. When the store returns a real localised price
 * we display that price — so display and checkout agree and no disclosure is
 * needed. We only convert when the store gives us nothing for the user's
 * region, and callers must label that result as approximate.
 *
 * Everything here is defensive: no function throws, all of them degrade to a
 * usable value, and nothing blocks the purchase path.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Supported currencies
// ---------------------------------------------------------------------------

/**
 * Currencies we are willing to DISPLAY. Adding one here is safe — it only
 * affects presentation. It does not create a store product or change billing.
 */
export const SUPPORTED_CURRENCIES = [
  'USD', 'ZAR', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD',
  'INR', 'NGN', 'KES', 'JPY', 'BRL', 'AED', 'CHF', 'SEK',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export const isSupportedCurrency = (code?: string | null): code is SupportedCurrency =>
  !!code && (SUPPORTED_CURRENCIES as readonly string[]).includes(code.toUpperCase());

/** Country -> display currency. Only the store regions we actually care about. */
const COUNTRY_TO_CURRENCY: Record<string, SupportedCurrency> = {
  ZA: 'ZAR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
  IN: 'INR', NG: 'NGN', KE: 'KES', JP: 'JPY', BR: 'BRL', AE: 'AED',
  CH: 'CHF', SE: 'SEK',
  // Eurozone
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR',
};

/**
 * Baseline USD rates, bundled so the app is useful offline and on first launch.
 * Deliberately approximate — these only ever drive the *fallback* display path,
 * and the result is charm-priced and labelled approximate before a user sees it.
 * Refreshed at runtime by refreshExchangeRates() when a source is configured.
 */
const BASELINE_RATES_PER_USD: Record<SupportedCurrency, number> = {
  USD: 1, ZAR: 18.0, EUR: 0.92, GBP: 0.79, AUD: 1.52, CAD: 1.36,
  NZD: 1.64, INR: 83.0, NGN: 1550.0, KES: 129.0, JPY: 157.0,
  BRL: 5.4, AED: 3.67, CHF: 0.88, SEK: 10.5,
};

const RATES_CACHE_KEY = '@xscard/exchange_rates_v1';
const CURRENCY_PREFERENCE_KEY = '@xscard/currency_preference_v1';
const RATES_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type RatesCache = { rates: Record<string, number>; fetchedAt: number };

let inMemoryRates: Record<string, number> = { ...BASELINE_RATES_PER_USD };
let ratesLoaded = false;

// ---------------------------------------------------------------------------
// Region detection
// ---------------------------------------------------------------------------

/**
 * Device REGION (not language). react-native-localize reads the OS region
 * setting, so an Afrikaans speaker living in London resolves to GB, not ZA —
 * which the old `locale.includes('af')` check got wrong.
 */
const getDeviceCountry = (): string | null => {
  try {
    const RNLocalize = require('react-native-localize');
    const country = RNLocalize?.getCountry?.();
    return typeof country === 'string' && country.length === 2 ? country.toUpperCase() : null;
  } catch {
    return null;
  }
};

/** Device's own currency preference, used before falling back to USD. */
const getDeviceCurrency = (): string | null => {
  try {
    const RNLocalize = require('react-native-localize');
    const currencies = RNLocalize?.getCurrencies?.();
    return Array.isArray(currencies) && currencies.length ? String(currencies[0]).toUpperCase() : null;
  } catch {
    return null;
  }
};

/**
 * Resolve the currency to display, in the priority order the spec requires.
 *
 * @param storeCurrencyCode currencyCode from a RevenueCat product, if loaded.
 *   This is the strongest signal available: the store already decided what
 *   currency this account is billed in, which beats any device setting.
 */
export const detectDisplayCurrency = (storeCurrencyCode?: string | null): {
  currency: SupportedCurrency;
  source: 'store' | 'device-region' | 'device-currency' | 'fallback';
} => {
  // 1. Store billing currency — authoritative, and display will match checkout.
  if (isSupportedCurrency(storeCurrencyCode)) {
    return { currency: storeCurrencyCode.toUpperCase() as SupportedCurrency, source: 'store' };
  }

  // 2. Device region setting.
  const country = getDeviceCountry();
  if (country && COUNTRY_TO_CURRENCY[country]) {
    return { currency: COUNTRY_TO_CURRENCY[country], source: 'device-region' };
  }

  // 3. Device currency preference.
  const deviceCurrency = getDeviceCurrency();
  if (isSupportedCurrency(deviceCurrency)) {
    return { currency: deviceCurrency.toUpperCase() as SupportedCurrency, source: 'device-currency' };
  }

  // 4. Safe fallback.
  return { currency: 'USD', source: 'fallback' };
};

// ---------------------------------------------------------------------------
// Exchange rates
// ---------------------------------------------------------------------------

/** Load cached rates into memory. Safe to call repeatedly; never throws. */
export const loadCachedRates = async (): Promise<void> => {
  if (ratesLoaded) return;
  ratesLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return;
    const cached: RatesCache = JSON.parse(raw);
    if (cached?.rates && typeof cached.fetchedAt === 'number') {
      // Merge over the baseline so a partial cache can't remove currencies.
      inMemoryRates = { ...BASELINE_RATES_PER_USD, ...cached.rates };
    }
  } catch {
    // Corrupt cache is not worth surfacing — baseline rates remain in place.
  }
};

export const areRatesStale = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(RATES_CACHE_KEY);
    if (!raw) return true;
    const cached: RatesCache = JSON.parse(raw);
    return Date.now() - cached.fetchedAt > RATES_TTL_MS;
  } catch {
    return true;
  }
};

/**
 * Refresh rates from a caller-supplied fetcher and cache them.
 *
 * The fetcher is injected rather than hardcoding a provider, so no new network
 * dependency is introduced and the app works unchanged if it is never called.
 * Returns true only when fresh rates were stored.
 */
export const refreshExchangeRates = async (
  fetcher: () => Promise<Record<string, number>>,
): Promise<boolean> => {
  try {
    const fresh = await fetcher();
    if (!fresh || typeof fresh !== 'object') return false;

    // Only accept sane, positive numeric rates for currencies we support.
    const sanitised: Record<string, number> = {};
    for (const [code, rate] of Object.entries(fresh)) {
      const upper = code.toUpperCase();
      if (isSupportedCurrency(upper) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0) {
        sanitised[upper] = rate;
      }
    }
    if (Object.keys(sanitised).length === 0) return false;

    inMemoryRates = { ...BASELINE_RATES_PER_USD, ...sanitised };
    ratesLoaded = true;
    await AsyncStorage.setItem(
      RATES_CACHE_KEY,
      JSON.stringify({ rates: sanitised, fetchedAt: Date.now() } as RatesCache),
    );
    return true;
  } catch {
    // Offline or provider down: keep whatever rates we already have.
    return false;
  }
};

/** Current USD-based rate for a currency. Always returns a usable number. */
export const getRate = (currency: string): number => {
  const rate = inMemoryRates[currency.toUpperCase()];
  return typeof rate === 'number' && rate > 0 ? rate : 1;
};

/**
 * Convert a USD base amount into another currency.
 * Raw arithmetic only — callers pass the result through the psychological
 * pricing formatter before showing it to anyone.
 */
export const convertFromUSD = (usdAmount: number, targetCurrency: string): number => {
  if (!Number.isFinite(usdAmount) || usdAmount <= 0) return 0;
  const target = targetCurrency.toUpperCase();
  if (target === 'USD') return usdAmount;
  return usdAmount * getRate(target);
};

// ---------------------------------------------------------------------------
// User preference (manual override of the detected currency)
// ---------------------------------------------------------------------------

export const saveCurrencyPreference = async (currency: string): Promise<void> => {
  try {
    if (isSupportedCurrency(currency)) {
      await AsyncStorage.setItem(CURRENCY_PREFERENCE_KEY, currency.toUpperCase());
    }
  } catch {
    // Preference is a convenience; failing to persist it must not break the UI.
  }
};

export const getCurrencyPreference = async (): Promise<SupportedCurrency | null> => {
  try {
    const stored = await AsyncStorage.getItem(CURRENCY_PREFERENCE_KEY);
    return isSupportedCurrency(stored) ? (stored.toUpperCase() as SupportedCurrency) : null;
  } catch {
    return null;
  }
};

export const clearCurrencyPreference = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CURRENCY_PREFERENCE_KEY);
  } catch {
    /* no-op */
  }
};

/**
 * Resolve the currency to display: an explicit user choice wins, otherwise we
 * detect. Call once on mount of any pricing surface.
 */
export const resolveDisplayCurrency = async (
  storeCurrencyCode?: string | null,
): Promise<{ currency: SupportedCurrency; source: string; isManual: boolean }> => {
  await loadCachedRates();

  const preference = await getCurrencyPreference();
  if (preference) return { currency: preference, source: 'user-preference', isManual: true };

  const detected = detectDisplayCurrency(storeCurrencyCode);
  return { ...detected, isManual: false };
};
