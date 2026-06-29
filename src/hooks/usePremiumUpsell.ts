/**
 * usePremiumUpsell — THE single, canonical free-vs-premium gate for the app.
 *
 * Reads the authoritative plan from AuthContext (the single source of truth,
 * resolved from the backend) via the derived `isFreeUser`, and exposes the
 * loading gate so callers never evaluate premium UI before the plan is known.
 *
 *   isPremium            — true only for an explicitly premium plan (fail-closed)
 *   isLoadingUserStatus  — true until the backend plan has resolved; gate UI on this
 *   triggerUpsell(config)— free user → show modal + return true (block);
 *                          premium → return false (proceed)
 */

import { useAuth } from '../context/AuthContext';
import { premiumUpsellService, UpsellConfig } from '../utils/premiumUpsell';

export function usePremiumUpsell() {
  const { user, isFreeUser, isLoadingUserStatus } = useAuth();

  // Canonical, fail-closed value from the single source of truth.
  const isPremium = !isFreeUser;

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

  return { triggerUpsell, isPremium, isFreeUser, isLoadingUserStatus, plan };
}
