import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useCelebrations } from '../stores/celebrationStore.js';
import { useFeedback } from '../hooks/useFeedback.js';
import { COPY, interpolate, pickCopy } from '@pollwise/shared/copy';
import { theme } from '../theme/theme.js';
import Tally from './Tally.js';
import Confetti from './Confetti.js';
import LipButton from './LipButton.js';
import ProgressRing from './ProgressRing.js';
import CountUp from './CountUp.js';
import { FlameIcon, ShieldIcon } from './icons.js';

const { colors, fonts, radius, space, type, motion } = theme;

/**
 * Shows the next queued pop-up (DESIGN §5). One at a time, never over a lesson (the lesson pauses the queue), and
 * nothing dismisses it except its own button. Mounted once in the root layout.
 */
export default function CelebrationHost() {
  const head = useCelebrations((s) => s.queue[0]);
  const paused = useCelebrations((s) => s.paused);
  const shift = useCelebrations((s) => s.shift);
  if (!head || paused) return null;
  return <Moment key={head.id} event={head.event} onDone={shift} />;
}

/**
 * @param {{ event: { type: string, current?: number, freezes?: number, xpToday?: number, goal?: number }, onDone: () => void }} props
 */
export function Moment({ event, onDone }) {
  const reduced = useReducedMotion();
  const { sound, haptic } = useFeedback();
  const enter = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    enter.value = reduced ? 1 : withSpring(1, motion.springGentle);
    if (event.type === 'streak_extended' || event.type === 'streak_milestone') sound('streak');
    if (event.type === 'daily_goal_met' || event.type === 'course_completed') sound('pass');
    haptic(event.type === 'streak_freeze_earned' ? 'selection' : 'impactHeavy');
  }, [enter, event.type, haptic, reduced, sound]);

  const card = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: (1 - enter.value) * 40 }],
  }));
  const dim = useAnimatedStyle(() => ({ opacity: enter.value * 0.55 }));

  const copy = copyFor(event);
  const confetti = copy.confetti && !reduced;

  return (
    <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.dim, dim]} />
      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View style={[styles.card, card]}>
          <View style={styles.hero}>
            {copy.hero === 'flame' ? <FlameBurst count={event.current} reduced={reduced} /> : null}
            {copy.hero === 'shield' ? <ShieldIcon size={64} color={colors.freeze} /> : null}
            {copy.hero === 'ring' ? (
              <ProgressRing progress={1} size={96} stroke={10} color={colors.jade500}>
                <Text style={styles.ringText}>✓</Text>
              </ProgressRing>
            ) : null}
            {copy.hero === 'tally' ? (
              <Tally mood={copy.mood} size={140} accessibilityLabel="Tally cheering" />
            ) : null}
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {copy.title}
          </Text>
          <Text style={styles.body}>{copy.body}</Text>
          <LipButton label={copy.button} onPress={onDone} tone="primary" style={styles.button} />
        </Animated.View>
      </View>
      {confetti ? <Confetti runKey={1} /> : null}
    </View>
  );
}

/** A small flame that grows and a count, the streak moment (DESIGN §5). */
function FlameBurst({ count = 0, reduced }) {
  const scale = useSharedValue(reduced ? 1 : 0.4);
  useEffect(() => {
    scale.value = reduced ? 1 : withSpring(1.3, motion.springBouncy);
  }, [reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[styles.flame, style]}>
      <FlameIcon size={72} color={colors.amber500} />
      <View style={styles.flameCount}>
        <CountUp value={count} color={colors.ink900} size={28} />
      </View>
    </Animated.View>
  );
}

/**
 * The words and visual for each pop-up. Rotation picks from the copy bank (DESIGN §8).
 * @param {{ type: string, current?: number, freezes?: number, xpToday?: number, goal?: number }} event
 */
export function copyFor(event) {
  switch (event.type) {
    case 'streak_extended':
      return {
        hero: 'flame',
        title: interpolate(pickCopy(COPY.streak, 0), { n: event.current ?? 1 }),
        body: pickCopy(COPY.streak, 1),
        button: 'Continue',
      };
    case 'streak_milestone':
      return {
        hero: 'flame',
        confetti: true,
        title: interpolate(pickCopy(COPY.streak, 0), { n: event.current ?? 3 }),
        body: 'A milestone. Keep it going.',
        button: 'Continue',
      };
    case 'streak_freeze_earned':
      return {
        hero: 'shield',
        title: 'You earned a streak freeze.',
        body: 'It protects your streak if you miss a day.',
        button: 'Nice',
      };
    case 'daily_goal_met':
      return {
        hero: 'ring',
        confetti: true,
        title: 'Daily goal reached.',
        body: `${event.xpToday ?? event.goal ?? 0} XP today.`,
        button: 'Continue',
      };
    case 'module_passed':
      return {
        hero: 'tally',
        mood: 'cheer',
        confetti: true,
        title: pickCopy(COPY.pass, 0),
        body: pickCopy(COPY.pass, 1),
        button: 'Continue',
      };
    case 'course_completed':
      return {
        hero: 'tally',
        mood: 'cheer',
        confetti: true,
        title: 'Course complete.',
        body: 'Your certificate is ready.',
        button: 'Continue',
      };
    default:
      return { hero: 'tally', mood: 'happy', title: '', body: '', button: 'Continue' };
  }
}

const styles = StyleSheet.create({
  dim: { backgroundColor: colors.ink900 },
  wrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', padding: space['2xl'] },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: space['2xl'],
    alignItems: 'center',
    gap: space.md,
    borderBottomWidth: 4,
    borderColor: colors.line,
  },
  hero: { minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  title: {
    fontFamily: fonts.black,
    fontSize: type.display.size - 4,
    lineHeight: type.display.line,
    color: colors.ink900,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  button: { alignSelf: 'stretch', marginTop: space.md },
  flame: { alignItems: 'center', justifyContent: 'center' },
  flameCount: { position: 'absolute', bottom: -6 },
  ringText: { fontFamily: fonts.black, fontSize: type.h1.size, color: colors.jade700 },
});
