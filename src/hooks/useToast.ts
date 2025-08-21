import { useRef } from 'react';
import { EventNotificationToastManager } from '../components/EventNotificationToast';

export interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export interface ToastMessage {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
  timestamp: number;
}

class ToastService {
  private listeners: ((toast: ToastMessage) => void)[] = [];
  private toastId = 0;

  subscribe(listener: (toast: ToastMessage) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  show(title: string, message?: string, options: ToastOptions = {}) {
    const toast: ToastMessage = {
      id: `toast_${++this.toastId}`,
      title,
      message,
      type: options.type || 'info',
      duration: options.duration || 4000,
      timestamp: Date.now(),
    };

    this.listeners.forEach(listener => listener(toast));
  }

  success(title: string, message?: string, duration?: number) {
    this.show(title, message, { type: 'success', duration });
  }

  error(title: string, message?: string, duration?: number) {
    this.show(title, message, { type: 'error', duration });
  }

  warning(title: string, message?: string, duration?: number) {
    this.show(title, message, { type: 'warning', duration });
  }

  info(title: string, message?: string, duration?: number) {
    this.show(title, message, { type: 'info', duration });
  }
}

export const toastService = new ToastService();

export function useToast() {
  return {
    show: toastService.show.bind(toastService),
    success: toastService.success.bind(toastService),
    error: toastService.error.bind(toastService),
    warning: toastService.warning.bind(toastService),
    info: toastService.info.bind(toastService),
  };
}
