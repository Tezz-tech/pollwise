import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme.js';

const { colors, motion, size, radius } = theme;

/** Width of the white shine band, as a share of the track. */
const SHINE_WIDTH = 60;

/**
 * Lesson or course progress (DESIGN §3, interaction 4). The fill springs to the new value. When `shineKey`
 * changes, a white band sweeps across the filled part. Reduced motion jumps straight to the value.
 * @param {{ progress: number, shineKey?: number, accessibilityLabel?: string, height?: number }} props
 */
export default function ProgressBar({
  progress,
  shineKey = 0,
  accessibilityLabel = 'Progress',
  height = size.progressBar,
}) {
  const reduced = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const fill = useSharedValue(clamp(progress));
  const shine = useSharedValue(-SHINE_WIDTH);

  useEffect(() => {
    const target = clamp(progress);
    fill.value = reduced ? target : withSpring(target, motion.springSnappy);
  }, [progress, reduced, fill]);

  useEffect(() => {
    if (!shineKey || reduced) return;
    shine.value = -SHINE_WIDTH;
    shine.value = withDelay(
      motion.duration.fast,
      withTiming(trackWidth, { duration: motion.duration.shine, easing: Easing.out(Easing.quad) })
    );
  }, [shineKey, reduced, shine, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shine.value }],
    opacity: 0.35,
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(progress) * 100) }}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[styles.track, { height, borderRadius: radius.pill }]}
    >
      <Animated.View style={[styles.fill, { borderRadius: radius.pill }, fillStyle]}>
        <View style={styles.topStrip} />
        <Animated.View style={[styles.shine, shineStyle]} />
      </Animated.View>
    </View>
  );
}

/** @param {number} value */
function clamp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.line, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', backgroundColor: colors.jade500, overflow: 'hidden' },
  topStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.jade400,
  },
  shine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SHINE_WIDTH,
    backgroundColor: colors.white,
  },
});
