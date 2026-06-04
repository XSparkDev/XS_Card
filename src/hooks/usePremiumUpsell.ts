/**
 * usePremiumUpsell hook
 *
 * THE single, canonical free-vs-premium check for the whole app.
 * Every upsell trigger AND every premium indicator icon must go through this
 * hook (via `isPremium`) so the condition can never drift between files.
 *
 * Returns:
 *   isPremium   — true for premium / enterprise users
 *   triggerUpsell(config) — shows toast + popup for free users;
 *                           does nothing and returns false for premium users.
 *                           Returns true if the upsell was triggered (i.e. user is free).
 *
 * Plan source of truth:
 *   The plan can live in two places that occasionally drift:
 *     1. AuthContext `user.plan`         — set at login
 *     2. AsyncStorage `userData.plan`    — updated on upgrade (UnlockPremium)
 *                                          and by the Header's backend sync
 *   When a user upgrades, only AsyncStorage is updated, so AuthContext lags and
 *   would otherwise wrongly treat a premium user as free. We therefore consider
 *   BOTH sources and FAIL OPEN: if either source says premium, the user is
 *   premium. The comparison is also case-insensitive so backend casing variants
 *   ('Premium', 'PREMIUM') are handled.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { premiumUpsellService, UpsellConfig } from '../utils/premiumUpsell';

/** Normalise any backend/stored plan value to a lowercase, trimmed string. */
const normalizePlan = (plan?: string | null): string =>
  String(plan ?? '').trim().toLowerCase();

/** A plan grants premium access if it is premium, enterprise (or admin). */
const planIsPremium = (plan?: string | null): boolean => {
  const p = normalizePlan(plan);
  return p === 'premium' || p === 'enterprise' || p === 'admin';
};

export function usePremiumUpsell() {
  const { user } = useAuth();
  const [storedPlan, setStoredPlan] = useState<string | null>(null);

  // Keep the AsyncStorage plan in sync. Re-read whenever the AuthContext plan
  // changes (e.g. after login) so the two sources converge. The cleanup guard
  // prevents a state update on an unmounted component.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem('userData')
      .then((raw) => {
        if (!active || !raw) return;
        try {
          setStoredPlan(JSON.parse(raw)?.plan ?? null);
        } catch {
          /* ignore malformed cache */
        }
      })
      .catch(() => {
        /* ignore storage errors — fall back to AuthContext plan */
      });
    return () => {
      active = false;
    };
  }, [user?.plan]);

  // Premium if EITHER source indicates premium (fail open toward access so a
  // premium user is never wrongly blocked while one source is stale).
  const isPremium = planIsPremium(user?.plan) || planIsPremium(storedPlan);

  /**
   * Gate a premium feature.
   * @returns true  — user is free, upsell was shown, the action should be blocked
   * @returns false — user is premium, proceed normally
   */
  const triggerUpsell = (config: UpsellConfig): boolean => {
    if (isPremium) return false;
    premiumUpsellService.trigger(config);
    return true; // blocked
  };

  const plan = normalizePlan(user?.plan) || normalizePlan(storedPlan) || 'free';

  return { triggerUpsell, isPremium, plan };
}
