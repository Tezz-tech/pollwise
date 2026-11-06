import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme } from '../theme/theme.js';
import { useFeedback } from '../hooks/useFeedback.js';

const { colors, lip, motion, radius, size, type, fonts, space } = theme;

/** Tone → face colour, lip colour and label colour (DESIGN §2, §3 interaction 1). */
export const TONES = Object.freeze({
  primary: { face: colors.jade600, lip: colors.jade700, label: colors.white },
  secondary: { face: colors.surface, lip: colors.line, label: colors.jade700 },
  coral: { face: colors.coral600, lip: colors.coral700, label: colors.white },
  amber: { face: colors.amber500, lip: colors.amber700, label: colors.ink900 },
  ghost: { face: 'transparent', lip: 'transparent', label: colors.jade700 },
});

/**
 * The chunky button with a solid lip. Pressing moves the face down over the lip, on the UI thread, with a light
 * haptic. Disabled: grey face, no lip, no haptic.
 * @param {{
 *   label: string,
 *   onPress: () => void,
 *   tone?: keyof typeof TONES,
 *   disabled?: boolean,
 *   haptics?: boolean,
 *   accessibilityLabel?: string,
 *   testID?: string,
 *   style?: import('react-native').ViewStyle,
 * }} props
 */
export default function LipButton({
  label,
  onPress,
  tone = 'primary',
  disabled = false,
  haptics = true,
  accessibilityLabel,
  testID,
  style,
}) {
  const reduced = useReducedMotion();
  const { haptic } = useFeedback();
  const pressed = useSharedValue(0);
  const palette = disabled
    ? { face: colors.line, lip: 'transparent', label: colors.ink400 }
    : TONES[tone];

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? 0 : pressed.value * lip.width }],
    opacity: reduced ? 1 - pressed.value * 0.1 : 1,
  }));

  const onIn = () => {
    if (disabled) return;
    pressed.value = reduced ? 1 : withSpring(1, motion.springSnappy);
    if (haptics) haptic('impactLight');
  };
  const onOut = () => {
    pressed.value = reduced ? 0 : withSpring(0, motion.springSnappy);
  };

  return (
    <View style={[styles.wrap, style]}>
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={disabled ? undefined : onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        testID={testID}
        style={styles.pressable}
      >
        <View
          style={[StyleSheet.absoluteFill, styles.lipLayer, { backgroundColor: palette.lip }]}
        />
        <Animated.View style={[styles.face, { backgroundColor: palette.face }, faceStyle]}>
          <Text style={[styles.label, { color: palette.label }]}>{label}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: size.button + lip.width, minWidth: size.touch },
  pressable: { flex: 1 },
  lipLayer: { borderRadius: radius.md },
  face: {
    minHeight: size.button,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  label: {
    fontFamily: fonts.heavy,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
  },
});
