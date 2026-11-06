import { create } from 'zustand';

/**
 * Whether the last request reached the server, and how many writes are waiting to be sent (DESIGN §6.11).
 * There is no network-state library in the approved stack, so "offline" is inferred from requests that got no
 * response, and cleared by the next one that does.
 */
export const useConnection = create((set) => ({
  offline: false,
  queued: 0,
  setOffline(offline) {
    set({ offline });
  },
  setQueued(queued) {
    set({ queued });
  },
}));
