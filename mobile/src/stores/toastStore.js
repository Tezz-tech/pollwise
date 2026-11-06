import { create } from 'zustand';

/** A short banner message. One at a time; a new one replaces the old one. */
export const useToasts = create((set) => ({
  /** @type {{ id: number, message: string, tone: 'info' | 'success' | 'warn' } | null} */
  current: null,
  show(message, tone = 'info') {
    set({ current: { id: Date.now(), message, tone } });
  },
  clear() {
    set({ current: null });
  },
}));
