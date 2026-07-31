/**
 * Psychological Pricing Formatter
 *
 * Turns raw amounts — whether they came from a store price or a currency
 * conversion — into prices that read as deliberate product pricing rather than
 * arithmetic output.
 *
 *   12      -> 11.99          120     -> 119.99
 *   1800    -> 1799.99        2184.76 -> 2199.99
 *   119.99  -> 119.99         (already a charm price; left alone)
 *
 * This module is display-only. It never touches billing amounts — the store
 * (Apple / Google via RevenueCat) remains the sole authority on what a user is
 * actually charged. See currencyService.ts for where the two are kept apart.
 */

/** Currencies conventionally priced without minor units (¥100, not ¥99.99). */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'CLP', 'ISK', 'HUF', 'TWD', 'UGX', 'XAF', 'XOF',
]);

/** Symbols for the currencies we present. Falls back to the ISO code. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  ZAR: 'R',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  CAD: 'C$',
  NZD: 'NZ$',
  INR: '₹',
  NGN: '₦',
  KES: 'KSh',
  JPY: '¥',
  BRL: 'R$',
  AED: 'AED ',
  CHF: 'CHF ',
  SEK: 'kr ',
};

export const getCurrencySymbol = (currencyCode: string): string =>
  CURRENCY_SYMBOLS[currencyCode.toUpperCase()] ?? `${currencyCode.toUpperCase()} `;

export const isZeroDecimalCurrency = (currencyCode: string): boolean =>
  ZERO_DECIMAL_CURRENCIES.has(currencyCode.toUpperCase());

/**
 * True when an amount already ends in a charm value (.99, .95, .90, .49) and so
 * was clearly priced on purpose. Re-rounding these would move a deliberate
 * 119.99 to some other number for no reason, so we leave them exactly as-is.
 */
export const isAlreadyCharmPriced = (amount: number): boolean => {
  const cents = Math.round((amount % 1) * 100);
  return cents === 99 || cents === 95 || cents === 90 || cents === 49;
};

/**
 * Pick the rounding step for an amount. Larger prices round to coarser
 * boundaries so a converted R2,184.76 lands on R2,199.99 rather than an
 * equally-odd-looking R2,184.99.
 */
const roundingStepFor = (amount: number): number => {
  const a = Math.abs(amount);
  if (a < 100) return 1;
  if (a < 1000) return 10;
  if (a < 10000) return 100;
  return 1000;
};

/**
 * Core rule: land on (multiple of step) - 0.01.
 *
 * We round the amount to the NEAREST step boundary, then drop one cent. Nearest
 * rather than up, so a conversion never inflates the price more than half a
 * step — important because the user may ultimately be billed the underlying
 * amount by the store.
 */
export const toPsychologicalPrice = (amount: number, currencyCode = 'USD'): number => {
  if (!Number.isFinite(amount) || amount <= 0) return 0;

  // Zero-decimal currencies have no cents to shave; round to a clean boundary.
  if (isZeroDecimalCurrency(currencyCode)) {
    const step = roundingStepFor(amount);
    return Math.max(step, Math.round(amount / step) * step);
  }

  // Respect prices that are already charm-priced (12.99, 119.99, 1799.99...).
  if (isAlreadyCharmPriced(amount)) return amount;

  const step = roundingStepFor(amount);
  const rounded = Math.round(amount / step) * step;

  // Never round a positive price down to zero or below.
  const floorBoundary = Math.max(rounded, step);
  return Number((floorBoundary - 0.01).toFixed(2));
};

/**
 * Group the integer part with thousands separators: 1799.99 -> "1,799.99".
 * Uses a manual grouping rather than toLocaleString so output is identical
 * across iOS and Android JS engines (Hermes' Intl support varies by build).
 */
const groupThousands = (value: string): string =>
  value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Format an already-psychological amount for display.
 * 1799.99 + ZAR -> "R1,799.99"
 */
export const formatPrice = (amount: number, currencyCode = 'USD'): string => {
  const symbol = getCurrencySymbol(currencyCode);
  const decimals = isZeroDecimalCurrency(currencyCode) ? 0 : 2;
  const [whole, fraction] = amount.toFixed(decimals).split('.');
  const grouped = groupThousands(whole);
  return fraction ? `${symbol}${grouped}.${fraction}` : `${symbol}${grouped}`;
};

/**
 * The function nearly every caller wants: apply the pricing rules, then format.
 *
 *   formatPsychologicalPrice(12,   'USD') -> "$11.99"
 *   formatPsychologicalPrice(120,  'USD') -> "$119.99"
 *   formatPsychologicalPrice(1800, 'ZAR') -> "R1,799.99"
 */
export const formatPsychologicalPrice = (amount: number, currencyCode = 'USD'): string =>
  formatPrice(toPsychologicalPrice(amount, currencyCode), currencyCode);

/**
 * Per-month figure shown beneath an annual plan. Derived from the annual price
 * so the two always tell a consistent story, then charm-priced in its own right.
 */
export const formatMonthlyEquivalent = (
  annualAmount: number,
  currencyCode = 'USD',
): string => `${formatPsychologicalPrice(annualAmount / 12, currencyCode)}/month`;

/**
 * Savings between paying monthly for a year and paying annually.
 *
 * Computed from the SAME displayed figures the plan cards show, so the badge can
 * never contradict the prices next to it — the previous hardcoded "Save R119.99"
 * against a real R119.89 gap is exactly what this prevents. Returns null when
 * there is no saving, so callers can hide the badge instead of showing "Save R0".
 */
export const calculateSavings = (
  monthlyAmount: number,
  annualAmount: number,
  currencyCode = 'USD',
): { amount: number; formatted: string; percentage: number } | null => {
  const displayedMonthly = toPsychologicalPrice(monthlyAmount, currencyCode);
  const displayedAnnual = toPsychologicalPrice(annualAmount, currencyCode);

  const yearAtMonthlyRate = displayedMonthly * 12;
  const saved = yearAtMonthlyRate - displayedAnnual;
  if (saved <= 0) return null;

  return {
    amount: saved,
    // Exact saving, not charm-priced — this is a factual claim, not a price.
    formatted: formatPrice(Number(saved.toFixed(2)), currencyCode),
    percentage: Math.round((saved / yearAtMonthlyRate) * 100),
  };
};
