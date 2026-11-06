import { useCallback } from 'react';
import { usePrefs } from '../stores/prefsStore.js';
import { haptic, playSound } from '../lib/feedback.js';

/**
 * Sound and haptics that respect the learner's settings. Components call `sound('correct')` or
 * `haptic('impactLight')` and never check the settings themselves.
 */
export function useFeedback() {
  const sound = usePrefs((s) => s.sound);
  const haptics = usePrefs((s) => s.haptics);
  return {
    sound: useCallback((name) => playSound(name, sound), [sound]),
    haptic: useCallback((kind) => haptic(kind, haptics), [haptics]),
  };
}
