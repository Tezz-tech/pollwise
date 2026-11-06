import { useEffect } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme.js';

const { colors, fonts, motion } = theme;
const AnimatedText = Animated.createAnimatedComponent(TextInput);

/**
 * A whole number that rolls up to its value over 700 ms, then pops once (DESIGN §3, interaction 6). The
 * number is drawn on the UI thread. Reduced motion jumps to the final value.
 * @param {{ value: number, suffix?: string, style?: import('react-native').TextStyle, color?: string, size?: number }} props
 */
export default function CountUp({ value, suffix = '', style, color = colors.ink900, size = 32 }) {
  const reduced = useReducedMotion();
  const shown = useSharedValue(0);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      shown.value = value;
      return;
    }
    shown.value = withTiming(value, {
      duration: motion.duration.countUp,
      easing: Easing.out(Easing.cubic),
    });
    pop.value = withSequence(withTiming(1.12, { duration: 120 }), withTiming(1, { duration: 160 }));
  }, [value, reduced, shown, pop]);

  // Plain integers only: locale formatting is not available on the UI runtime.
  const animatedProps = useAnimatedProps(() => ({
    text: `${Math.round(shown.value)}${suffix}`,
  }));
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <Animated.View style={[styles.wrap, popStyle]}>
      <AnimatedText
        underlineColorAndroid="transparent"
        editable={false}
        defaultValue={`${Math.round(value)}${suffix}`}
        animatedProps={animatedProps}
        accessibilityRole="text"
        style={[
          styles.number,
          { color, fontSize: size, lineHeight: Math.round(size * 1.2) },
          style,
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start' },
  number: { fontFamily: fonts.black, padding: 0 },
});
