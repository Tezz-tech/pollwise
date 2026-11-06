/**
 * Sound and haptics (DESIGN §4). Sounds are preloaded once; playing one is a seek and a play, so it never
 * waits on the network or the disk. Both respect the learner's settings and the iOS silent switch.
 */
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/** Each file is under 25 KB (scripts/make-sounds.js). */
const FILES = {
  correct: require('../../assets/sounds/correct.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  pass: require('../../assets/sounds/pass.wav'),
  streak: require('../../assets/sounds/streak.wav'),
  unlock: require('../../assets/sounds/unlock.wav'),
  tap: require('../../assets/sounds/tap.wav'),
};

/** @type {Record<string, import('expo-audio').AudioPlayer> | null} */
let players = null;

/** Call once at launch. If audio cannot start, the app still works without sound. */
export async function initFeedback() {
  try {
    // playsInSilentMode false: the iOS silent switch mutes sound, as DESIGN §4 asks.
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
    players = Object.fromEntries(
      Object.entries(FILES).map(([name, source]) => [name, createAudioPlayer(source)])
    );
  } catch {
    players = null;
  }
}

/**
 * @param {keyof typeof FILES} name
 * @param {boolean} enabled the learner's sound setting
 */
export function playSound(name, enabled) {
  if (!enabled || !players) return;
  const player = players[name];
  if (!player) return;
  player.seekTo(0);
  player.play();
}

/** Haptic kinds mapped from DESIGN §4. */
export const HAPTIC_KINDS = Object.freeze([
  'selection',
  'impactLight',
  'success',
  'warning',
  'impactHeavy',
]);

/**
 * @param {(typeof HAPTIC_KINDS)[number]} kind
 * @param {boolean} enabled the learner's haptics setting
 */
export function haptic(kind, enabled) {
  if (!enabled) return;
  switch (kind) {
    case 'selection':
      Haptics.selectionAsync();
      return;
    case 'impactLight':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'success':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case 'warning':
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    case 'impactHeavy':
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    default:
  }
}
