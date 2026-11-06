import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { theme } from '../theme/theme.js';
import { TickIcon } from './icons.js';
import { useFeedback } from '../hooks/useFeedback.js';

const { colors, motion, radius, type, fonts, space } = theme;

/** How the tile looks: neutral, selected, or revealed as right or wrong (DESIGN §3, interaction 2–3). */
const STATES = Object.freeze({
  idle: { face: colors.surface, border: colors.line },
  selected: { face: colors.jade100, border: colors.jade600 },
  correct: { face: colors.jade100, border: colors.jade600 },
  wrong: { face: colors.coral100, border: colors.coral600 },
});

/**
 * One answer choice. Selected: border and lip go jade, fill goes jade tint, tile scales 0.97 → 1. A wrong
 * answer shakes three times (skipped for reduced motion). `multi` shows a checkbox, otherwise a radio.
 * @param {{
 *   label: string,
 *   selected?: boolean,
 *   state?: keyof typeof STATES,
 *   multi?: boolean,
 *   disabled?: boolean,
 *   shakeKey?: number,
 *   onPress?: () => void,
 *   testID?: string,
 * }} props
 */
export default function OptionTile({
  label,
  selected = false,
  state,
  multi = false,
  disabled = false,
  shakeKey = 0,
  onPress,
  testID,
}) {
  const reduced = useReducedMotion();
  const { haptic } = useFeedback();
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  const tone = STATES[state ?? (selected ? 'selected' : 'idle')];

  useEffect(() => {
    if (!selected || reduced) return;
    scale.value = withSequence(
      withTiming(0.97, { duration: motion.duration.fast / 2 }),
      withSpring(1, motion.springSnappy)
    );
  }, [selected, reduced, scale]);

  useEffect(() => {
    if (!shakeKey || reduced) return;
    const d = motion.shake.distance;
    shake.value = withSequence(
      withTiming(d, { duration: 40 }),
      withTiming(-d, { duration: 80 }),
      withTiming(d, { duration: 80 }),
      withTiming(-d, { duration: 80 }),
      withTiming(0, { duration: 40 })
    );
  }, [shakeKey, reduced, shake]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shake.value }],
  }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={() => {
          if (disabled || !onPress) return;
          haptic('selection');
          onPress();
        }}
        disabled={disabled}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: selected, disabled }}
        accessibilityLabel={label}
        testID={testID}
        style={[styles.tile, { backgroundColor: tone.face, borderColor: tone.border }]}
      >
        <View
          style={[
            styles.mark,
            multi ? styles.box : styles.dot,
            selected && { borderColor: tone.border, backgroundColor: tone.border },
          ]}
        >
          {selected && multi ? <TickIcon size={14} color={colors.white} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: {
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.md,
  },
  mark: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  dot: { borderRadius: radius.pill },
  box: { borderRadius: 6 },
  label: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
});
