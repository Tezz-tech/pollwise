import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme.js';

const { colors, radius } = theme;

/**
 * A grey placeholder shape with a soft moving highlight. Used instead of a spinner on full screens
 * (DESIGN §6.11). Reduced motion keeps the shape and drops the movement.
 * @param {{ width?: number | string, height?: number, round?: boolean, style?: import('react-native').ViewStyle }} props
 */
export default function Skeleton({ width = '100%', height = 16, round = false, style }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-1);

  useEffect(() => {
    if (reduced) return undefined;
    x.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      false
    );
    return () => cancelAnimation(x);
  }, [reduced, x]);

  const highlight = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * 240 }],
  }));

  return (
    <View
      accessibilityLabel="Loading"
      style={[styles.base, { width, height, borderRadius: round ? radius.pill : radius.sm }, style]}
    >
      {reduced ? null : <Animated.View style={[styles.highlight, highlight]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: colors.line, overflow: 'hidden' },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: -120,
    width: 120,
    backgroundColor: colors.white,
    opacity: 0.45,
  },
});
