import { forwardRef, useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme.js';

const { colors, fonts, motion, radius, size, space, type } = theme;

/**
 * A text input with a floating label (DESIGN §6.3). The label rises when the field is focused or has text.
 * Inline errors appear under the field, and the field shakes once when an error arrives.
 * @param {{
 *   label: string,
 *   value: string,
 *   onChangeText: (text: string) => void,
 *   onBlur?: () => void,
 *   error?: string | null,
 *   prefix?: string,
 *   hint?: string,
 *   testID?: string,
 * } & import('react-native').TextInputProps} props
 */
const Field = forwardRef(function Field(
  { label, value, onChangeText, onBlur, error, prefix, hint, testID, ...rest },
  ref
) {
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const lifted = useSharedValue(value ? 1 : 0);
  const shake = useSharedValue(0);

  useEffect(() => {
    const target = focused || value ? 1 : 0;
    lifted.value = reduced ? target : withTiming(target, { duration: motion.duration.fast });
  }, [focused, value, reduced, lifted]);

  useEffect(() => {
    if (!error || reduced) return;
    const d = motion.shake.distance;
    shake.value = withSequence(
      withTiming(d, { duration: 40 }),
      withTiming(-d, { duration: 80 }),
      withTiming(d, { duration: 80 }),
      withTiming(0, { duration: 40 })
    );
  }, [error, reduced, shake]);

  const labelStyle = useAnimatedStyle(() => ({
    top: 18 - lifted.value * 14,
    fontSize: type.body.size - lifted.value * 3,
    color: lifted.value > 0.5 ? colors.jade700 : colors.ink600,
  }));
  const wrapStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const borderColor = error ? colors.coral600 : focused ? colors.jade600 : colors.line;

  return (
    <Animated.View style={[styles.wrap, wrapStyle]}>
      <View style={[styles.box, { borderColor, borderBottomWidth: focused || error ? 4 : 2 }]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <View style={styles.inputArea}>
          <Animated.Text style={[styles.label, labelStyle]} pointerEvents="none">
            {label}
          </Animated.Text>
          <TextInput
            ref={ref}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            accessibilityLabel={label}
            accessibilityHint={hint}
            testID={testID}
            underlineColorAndroid="transparent"
            style={styles.input}
            placeholderTextColor={colors.ink400}
            {...rest}
          />
        </View>
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </Animated.View>
  );
});

export default Field;

const styles = StyleSheet.create({
  wrap: { gap: space.xs, marginBottom: space.lg },
  box: {
    minHeight: size.input,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: space.lg,
  },
  prefix: {
    alignSelf: 'center',
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    color: colors.ink600,
    marginRight: space.sm,
  },
  inputArea: { flex: 1, justifyContent: 'flex-end' },
  label: { position: 'absolute', left: 0, fontFamily: fonts.bold },
  input: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    minHeight: size.input - 2,
  },
  error: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.coral700 },
  hint: { fontFamily: fonts.regular, fontSize: type.small.size, color: colors.ink600 },
});
