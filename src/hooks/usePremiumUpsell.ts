/**
 * usePremiumUpsell hook
 *
 * Returns:
 *   isPremium   — true for premium / enterprise users
 *   triggerUpsell(config) — shows toast + popup for free users;
 *                           does nothing and returns false for premium users.
 *                           Returns true if the upsell was triggered (i.e. user is free).
 *
 * The plan is read from AuthContext so it stays in sync with the live user
 * object without extra AsyncStorage calls.
 */

import { useAuth } from '../context/AuthContext';
import { premiumUpsellService, UpsellConfig } from '../utils/premiumUpsell';

export function usePremiumUpsell() {
  const { user } = useAuth();
  const plan = user?.plan ?? 'free';
  const isPremium = plan === 'premium' || plan === 'enterprise';

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

  return { triggerUpsell, isPremium, plan };
}
