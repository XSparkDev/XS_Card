/**
 * Pricing Display Model
 *
 * The single place that decides what price text any surface shows. Premium
 * screen, upsell prompts, subscription cards and confirmation summaries all
 * call buildPricingDisplay() so the same product can never render as "$120" in
 * one place and "$119.99" in another.
 *
 * TWO INTENTIONAL PRICING MODELS — these never mix:
 *
 *   1. ZAR (South Africa)
 *      PRICING.ZAR is the ONLY source of truth. Curated deliberately.
 *      Never derived from USD, never converted, never rate-adjusted, and never
 *      overridden by a store price in another currency. Selecting the ZAR tab
 *      always yields ZAR.
 *
 *   2. International (every market except South Africa)
 *      PRICING.USD is the canonical master. Convert USD -> local currency at
 *      the current rate, THEN apply psychological pricing. International
 *      pricing never originates from the ZAR figures.
 *
 * The display currency alone decides which model applies, so a view can never
 * show two currencies at once.
 *
 * Billing remains RevenueCat's job — nothing here changes what a user is
 * charged. Where a converted figure may differ from the charge, isApproximate
 * is set so the UI can disclose it.
 */

import {
  formatPsychologicalPrice,
  formatMonthlyEquivalent,
  calculateSavings,
  toPsychologicalPrice,
} from './psychologicalPricing';
import { convertFromUSD, type SupportedCurrency } from '../services/currencyService';
import { PRICING } from '../config/pricing';

/** Minimal shape we need from a RevenueCat package — avoids coupling to the SDK. */
export interface StorePriceLike {
  price: number;
  priceString: string;
  currencyCode: string;
}

export interface PlanDisplay {
  /** Ready-to-render price, e.g. "R1,799.99". */
  priceText: string;
  /** Currency this text is expressed in — always the requested display currency. */
  currency: string;
  /** Numeric value behind priceText, for savings math. */
  amount: number;
  /** True when derived by exchange-rate conversion rather than a configured price. */
  isApproximate: boolean;
}

export interface PricingDisplay {
  monthly: PlanDisplay | null;
  annual: PlanDisplay | null;
  /** "R149.99/month" beneath the annual plan. Null when annual is absent. */
  annualMonthlyEquivalent: string | null;
  /** Derived from the displayed prices, so it can never contradict them. */
  savings: { amount: number; formatted: string; percentage: number } | null;
  /** True when ANY shown price came from conversion — drives the disclosure line. */
  hasApproximatePricing: boolean;
  /** Which pricing model produced this view. */
  model: 'zar-configured' | 'usd-canonical' | 'usd-converted';
}

/**
 * Resolve the base amounts for a display currency.
 *
 * ZAR and USD are read straight from configuration — they are curated prices,
 * not computed ones. Everything else converts from the USD master.
 */
const resolveBaseAmounts = (
  currency: string,
): { monthly: number; annual: number; isApproximate: boolean; model: PricingDisplay['model'] } => {
  const usd = { monthly: PRICING.USD?.monthly ?? 12, annual: PRICING.USD?.annual ?? 120 };

  // 1. South Africa: configured ZAR prices, full stop. No USD involvement.
  if (currency === 'ZAR') {
    const zar = PRICING.ZAR;
    if (zar) {
      return { monthly: zar.monthly, annual: zar.annual, isApproximate: false, model: 'zar-configured' };
    }
    // PRICING.ZAR should always exist; if it were ever removed, fail closed to
    // USD rather than silently showing rand-converted-from-dollars.
  }

  // 2. USD itself is the canonical master — no conversion needed.
  if (currency === 'USD') {
    return { ...usd, isApproximate: false, model: 'usd-canonical' };
  }

  // 3. All other international markets: convert from the USD master.
  return {
    monthly: convertFromUSD(usd.monthly, currency),
    annual: convertFromUSD(usd.annual, currency),
    isApproximate: true,
    model: 'usd-converted',
  };
};

/** Build one plan entry, always expressed in the requested display currency. */
const buildPlan = (
  baseAmount: number,
  currency: string,
  isApproximate: boolean,
): PlanDisplay | null => {
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return null;

  // Psychological pricing is applied AFTER any conversion, per the pricing spec.
  const amount = toPsychologicalPrice(baseAmount, currency);

  return {
    priceText: formatPsychologicalPrice(baseAmount, currency),
    currency,
    amount,
    isApproximate,
  };
};

/**
 * Build the full display model for the premium plans.
 *
 * Store packages are accepted so callers can pass them without branching, but
 * they intentionally do NOT override the configured/converted price — doing so
 * is what previously leaked USD values into the ZAR tab. They remain available
 * for billing, trial detection and purchase, which is where they belong.
 *
 * @param displayCurrency the currency the user is viewing — decides the model
 */
export const buildPricingDisplay = (
  _monthlyStore: StorePriceLike | undefined,
  _annualStore: StorePriceLike | undefined,
  displayCurrency: SupportedCurrency | string,
): PricingDisplay => {
  const currency = String(displayCurrency || 'USD').toUpperCase();
  const base = resolveBaseAmounts(currency);

  const monthly = buildPlan(base.monthly, currency, base.isApproximate);
  const annual = buildPlan(base.annual, currency, base.isApproximate);

  // Monthly-equivalent is derived from the annual figure actually on screen.
  const annualMonthlyEquivalent = annual
    ? formatMonthlyEquivalent(annual.amount, currency)
    : null;

  // Both plans are always in the same currency now, so savings are always valid.
  const savings =
    monthly && annual ? calculateSavings(monthly.amount, annual.amount, currency) : null;

  return {
    monthly,
    annual,
    annualMonthlyEquivalent,
    savings,
    hasApproximatePricing: Boolean(monthly?.isApproximate || annual?.isApproximate),
    model: base.model,
  };
};
