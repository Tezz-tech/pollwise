import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;
const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
/** The tallest bar fills this height; the rest scale against it. */
const MAX_BAR = 120;
const MIN_BAR = 6;

/**
 * XP for the last seven days (DESIGN §6.9): one bar per day, springing up to its height, with the day letters under
 * the bars and the value in words for each bar (colour is not the only signal).
 * @param {{ days: { day: string, xp: number }[] }} props
 */
export default function XpChart({ days }) {
  const top = Math.max(1, ...days.map((d) => d.xp));
  return (
    <View style={styles.chart} accessibilityLabel="XP for the last seven days">
      {days.map((d, i) => (
        <Bar
          key={d.day}
          xp={d.xp}
          height={Math.max(MIN_BAR, (d.xp / top) * MAX_BAR)}
          letter={LETTERS[new Date(`${d.day}T12:00:00`).getDay()]}
          index={i}
        />
      ))}
    </View>
  );
}

function Bar({ xp, height, letter, index }) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    grow.value = reduced
      ? 1
      : withSpring(1, { damping: 18, stiffness: 160, mass: 1 + index * 0.02 });
  }, [grow, reduced, index]);
  const style = useAnimatedStyle(() => ({ height: height * grow.value }));
  return (
    <View style={styles.column} accessibilityLabel={`${letter}, ${xp} XP`}>
      <Text style={styles.value}>{xp > 0 ? xp : ''}</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, xp > 0 ? styles.barOn : styles.barOff, style]} />
      </View>
      <Text style={styles.letter}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingVertical: space.sm,
  },
  column: { flex: 1, alignItems: 'center', gap: space.xs },
  value: {
    fontFamily: fonts.heavy,
    fontSize: type.small.size - 2,
    color: colors.ink600,
    minHeight: 16,
  },
  track: { height: MAX_BAR, justifyContent: 'flex-end', width: '60%' },
  bar: { width: '100%', borderRadius: radius.sm },
  barOn: { backgroundColor: colors.jade500 },
  barOff: { backgroundColor: colors.line },
  letter: { fontFamily: fonts.heavy, fontSize: type.small.size, color: colors.ink600 },
});
