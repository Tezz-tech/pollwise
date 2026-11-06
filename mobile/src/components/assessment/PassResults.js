import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Tally from '../Tally.js';
import Confetti from '../Confetti.js';
import ProgressRing from '../ProgressRing.js';
import CountUp from '../CountUp.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;
/** Gap between XP rows counting up, in ms (DESIGN §6.8). */
const ROW_STEP_MS = 450;

/**
 * The pass screen (DESIGN §6.8): the score ring counts up to the score, confetti, Tally cheers, "You passed!", and the
 * XP rows count up one after another. Continue goes to the path, where the next module unlocks.
 * @param {{ score: number, passMark: number, rows: { label: string, amount: number }[], onContinue: () => void }} props
 */
export default function PassResults({ score, passMark, rows, onContinue }) {
  const reduced = useReducedMotion();
  const { sound, haptic } = useFeedback();
  const [shown, setShown] = useState(reduced ? rows.length : 0);
  const pop = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    sound('pass');
    haptic('impactHeavy');
    pop.value = reduced ? 1 : withSpring(1);
    if (reduced) return undefined;
    const timers = rows.map((_, i) => setTimeout(() => setShown(i + 1), 500 + i * ROW_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [pop, reduced, rows, sound, haptic]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.92 + pop.value * 0.08 }],
  }));

  return (
    <Screen
      scroll
      padded
      footer={<LipButton label="Continue" onPress={onContinue} testID="assessment-continue" />}
    >
      <Animated.View style={[styles.centre, style]}>
        <ProgressRing progress={score / 100} size={150} stroke={12} color={colors.jade500}>
          <CountUp value={Math.round(score)} suffix="%" color={colors.ink900} size={34} />
        </ProgressRing>
        <Tally mood="cheer" size={120} accessibilityLabel="Tally cheering" />
        <Text accessibilityRole="header" style={styles.title}>
          You passed!
        </Text>
        <Text style={styles.body}>You needed {passMark}%. The next module is open.</Text>
      </Animated.View>
      <View style={styles.rows}>
        {rows.map((row, i) => (
          <View
            key={row.label}
            style={[styles.row, i >= shown && styles.hidden]}
            accessibilityLabel={`${row.label}, plus ${row.amount} XP`}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowAmount}>+{i < shown ? row.amount : 0} XP</Text>
          </View>
        ))}
      </View>
      <Confetti runKey={1} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', gap: space.lg, marginTop: space.lg },
  title: {
    fontFamily: fonts.black,
    fontSize: type.display.size,
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
  rows: { gap: space.sm, marginTop: space['2xl'] },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.jade100,
    borderRadius: radius.md,
    padding: space.lg,
  },
  hidden: { opacity: 0.35 },
  rowLabel: { fontFamily: fonts.heavy, fontSize: type.body.size, color: colors.jade700 },
  rowAmount: { fontFamily: fonts.black, fontSize: type.body.size, color: colors.amber700 },
});
