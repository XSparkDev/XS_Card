/**
 * usePremiumUpsell — THE single, canonical free-vs-premium gate for the app.
 *
 * Every upsell trigger and every premium indicator icon uses this hook, which
 * delegates to the one shared `isFreeUser()` utility in utils/userPlan. No
 * other file may contain an inline plan comparison.
 *
 * Plan field: user.plan (string) from AuthContext.
 *   free value    : 'free'                              → blocked
 *   premium values: 'premium' | 'enterprise' | 'admin'  → allowed
 *
 * FAIL OPEN: if user / user.plan is null, undefined, or still loading, the user
 * is treated as PREMIUM (allowed). A user is only blocked when their plan is
 * EXPLICITLY 'free'. This prevents premium users ever being blocked by a stale
 * or not-yet-loaded plan value.
 */

import { useAuth } from '../context/AuthContext';
import { isFreeUser } from '../utils/userPlan';
import { premiumUpsellService, UpsellConfig } from '../utils/premiumUpsell';

export function usePremiumUpsell() {
  const { user } = useAuth();

  // Single shared, fail-open check.
  const isPremium = !isFreeUser(user);

  /**
   * Gate a premium feature.
   * @returns true  — user is free; upsell was shown; caller should abort.
   * @returns false — user is premium; proceed normally.
   */
  const triggerUpsell = (config: UpsellConfig): boolean => {
    if (isPremium) return false;
    premiumUpsellService.trigger(config);
    return true;
  };

  const plan = String(user?.plan ?? 'free').trim().toLowerCase() || 'free';

  return { triggerUpsell, isPremium, plan };
}
