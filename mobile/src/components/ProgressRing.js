import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../theme/theme.js';

const { colors, motion } = theme;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * A circular progress ring for course cards, the daily goal and readiness (DESIGN §6.5, §6.9). The arc springs
 * to its value on the UI thread. `children` sit in the centre.
 * @param {{ progress: number, size?: number, stroke?: number, color?: string, track?: string, children?: import('react').ReactNode, accessibilityLabel?: string }} props
 */
export default function ProgressRing({
  progress,
  size = 56,
  stroke = 6,
  color = colors.jade500,
  track = colors.line,
  children,
  accessibilityLabel = 'Progress',
}) {
  const reduced = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const shown = useSharedValue(clamp(progress));

  useEffect(() => {
    const target = clamp(progress);
    shown.value = reduced ? target : withSpring(target, motion.springGentle);
  }, [progress, reduced, shown]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - shown.value),
  }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamp(progress) * 100) }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
          animatedProps={animatedProps}
        />
      </Svg>
      <View style={styles.centre}>{children}</View>
    </View>
  );
}

/** @param {number} value */
function clamp(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

const styles = StyleSheet.create({
  centre: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
});
