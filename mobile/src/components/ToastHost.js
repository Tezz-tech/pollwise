import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../theme/theme.js';
import { useToasts } from '../stores/toastStore.js';

const { colors, radius, type, fonts, space, motion } = theme;

const TONES = Object.freeze({
  info: { fill: colors.sky100, text: colors.ink900, border: colors.sky600 },
  success: { fill: colors.jade100, text: colors.jade700, border: colors.jade600 },
  warn: { fill: colors.amber100, text: colors.ink900, border: colors.amber500 },
});

/**
 * Mounted once in the root layout. Shows the current toast from the toast store as a banner that slides down,
 * then hides after a short pause. Screen readers get it as a live status.
 */
export default function ToastHost() {
  const current = useToasts((s) => s.current);
  const clear = useToasts((s) => s.clear);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const y = useSharedValue(-120);

  useEffect(() => {
    if (!current) return undefined;
    const out = reduced ? 0 : motion.duration.base;
    y.value = reduced ? 0 : withSpring(0, motion.springGentle);
    // The timer runs on the JS thread; only the slide-out animation runs on the UI thread.
    const hide = setTimeout(() => {
      y.value = withTiming(-120, { duration: out });
      setTimeout(clear, out);
    }, 2600);
    return () => clearTimeout(hide);
  }, [current, reduced, y, clear]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  if (!current) return null;
  const tone = TONES[current.tone] ?? TONES.info;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { top: insets.top + space.sm }, style]}
    >
      <View style={[styles.toast, { backgroundColor: tone.fill, borderColor: tone.border }]}>
        <Text style={[styles.text, { color: tone.text }]}>{current.message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 50 },
  toast: {
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  text: { fontFamily: fonts.bold, fontSize: type.small.size, lineHeight: type.small.line },
});
