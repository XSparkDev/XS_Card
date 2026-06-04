/**
 * PremiumUpsell service
 *
 * A pure-JS singleton — no React dependency — that:
 *   1. Fires a toast via toastService
 *   2. Notifies any subscribed React component (PremiumUpsellProvider)
 *      so it can render the popup modal
 *
 * Usage from a component:
 *   const { triggerUpsell } = usePremiumUpsell();
 *   triggerUpsell({ featureName: 'Dashboard' });
 *
 * Usage outside React (e.g. navigation guards):
 *   premiumUpsellService.trigger({ featureName: 'Dashboard' });
 */

import { toastService } from '../hooks/useToast';

export interface UpsellConfig {
  /** Short label used in the toast and popup headline, e.g. "Dashboard" */
  featureName: string;
  /** Optional longer description shown in the popup body */
  description?: string;
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
   * Fire the upsell flow: toast immediately, popup after a short delay.
   *
   * iOS/Android native presentation queues cannot handle two Modal components
   * changing visibility in the same JS render cycle. The toast mounts its own
   * Modal (in ToastProvider); the upsell popup mounts another Modal
   * (in PremiumUpsellProvider). If both are triggered synchronously the native
   * layer deadlocks and the app freezes. Delaying the popup listener by one
   * native frame (100ms) lets the toast Modal fully present first.
   *
   * Call this only after you have confirmed the user is NOT premium.
   */
  trigger(config: UpsellConfig): void {
    toastService.info(
      'Premium Feature',
      `Unlock Premium to access ${config.featureName}`,
    );
    // Delay modal so it doesn't race the toast Modal on the native presentation queue
    setTimeout(() => {
      this.listeners.forEach(l => l(config));
    }, 100);
  }
}

export const premiumUpsellService = new PremiumUpsellService();
