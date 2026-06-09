/**
 * PremiumUpsell service
 *
 * A pure-JS singleton — no React dependency — that notifies any subscribed
 * React component (PremiumUpsellProvider) so it can render the upsell modal.
 *
 * The modal alone is the upsell UI — there is no toast. The modal stays visible
 * until the user explicitly taps "Maybe Later", "Unlock Premium", the backdrop,
 * or (Android) the hardware back button.
 *
 * Usage from a component:
 *   const { triggerUpsell } = usePremiumUpsell();
 *   triggerUpsell({ featureName: 'Dashboard' });
 *
 * Usage outside React (e.g. navigation guards):
 *   premiumUpsellService.trigger({ featureName: 'Dashboard' });
 */

export interface UpsellConfig {
  /** Short label used in toasts/analytics, e.g. "Dashboard" */
  featureName: string;
  /** Feature explanation paragraph — shown in the nested "How does this work?" modal */
  description?: string;
  /** MaterialCommunityIcons glyph name for the hero icon (e.g. 'chart-bar', 'calendar-clock') */
  icon?: string;
  /** Static main-body copy. If omitted, the modal shows the dynamic contacts sentence. */
  bodyText?: string;
}

type UpsellListener = (config: UpsellConfig) => void;

class PremiumUpsellService {
  private listeners: UpsellListener[] = [];

  /** Subscribe a listener — returns an unsubscribe function */
  subscribe(listener: UpsellListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Fire the upsell flow: notify the subscribed provider to render the modal.
   * Call this only after you have confirmed the user is NOT premium.
   */
  trigger(config: UpsellConfig): void {
    this.listeners.forEach(l => l(config));
  }
}

export const premiumUpsellService = new PremiumUpsellService();
