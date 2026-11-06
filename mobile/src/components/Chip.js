import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme.js';

const { colors, radius, type, fonts, space } = theme;

/** Tone → fill, text and border. Text pairings follow DESIGN §2 (no white text on light tints). */
const TONES = Object.freeze({
  amber: { fill: colors.amber100, text: colors.ink900, border: colors.amber500 },
  jade: { fill: colors.jade100, text: colors.jade700, border: colors.jade600 },
  sky: { fill: colors.sky100, text: colors.sky600, border: colors.sky600 },
  neutral: { fill: colors.surface, text: colors.ink600, border: colors.line },
});

/**
 * A small tag or header chip (streak, XP, role filter). Pass `onPress` to make it a control.
 * @param {{ label: string, tone?: keyof typeof TONES, icon?: import('react').ReactNode, selected?: boolean, onPress?: () => void, accessibilityLabel?: string }} props
 */
export default function Chip({
  label,
  tone = 'neutral',
  icon,
  selected = false,
  onPress,
  accessibilityLabel,
}) {
  const palette = TONES[tone];
  const body = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.jade600 : palette.fill,
          borderColor: selected ? colors.jade600 : palette.border,
        },
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: selected ? colors.white : palette.text }]}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={8}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    lineHeight: type.label.line,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
  },
});
