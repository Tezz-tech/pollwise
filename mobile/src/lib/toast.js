import { useToasts } from '../stores/toastStore.js';

/**
 * Show a banner from anywhere, including outside React (for example after an API call in an event handler).
 */
export const toast = {
  info: (message) => useToasts.getState().show(message, 'info'),
  success: (message) => useToasts.getState().show(message, 'success'),
  error: (message) => useToasts.getState().show(message, 'warn'),
};
