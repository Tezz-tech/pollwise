import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space, motion } = theme;

/**
 * "3 in a row" (DESIGN §3, interaction 5): an amber chip above the progress bar once three answers in a row are right.
 * It pops in, and its number ticks up on each further correct answer. It disappears on a miss.
 * @param {{ streak: number }} props
 */
export default function ComboChip({ streak }) {
  const reduced = useReducedMotion();
  const show = useSharedValue(0);
  const pop = useSharedValue(1);
  const active = streak >= 3;

  useEffect(() => {
    show.value = reduced ? (active ? 1 : 0) : withSpring(active ? 1 : 0, motion.springBouncy);
    if (active && !reduced)
      pop.value = withSequence(
        withTiming(1.12, { duration: 90 }),
        withTiming(1, { duration: 120 })
      );
  }, [active, reduced, show, pop, streak]);

  const style = useAnimatedStyle(() => ({
    opacity: show.value,
    transform: [{ scale: show.value * pop.value }],
  }));

  return (
    <Animated.View
      style={[styles.chip, style]}
      accessibilityLiveRegion="polite"
      pointerEvents="none"
    >
      <Text style={styles.text}>{streak} in a row</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.amber500,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderBottomWidth: 3,
    borderBottomColor: colors.amber700,
  },
  text: {
    fontFamily: fonts.black,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.ink900,
  },
});
