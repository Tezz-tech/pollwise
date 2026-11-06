import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, radius, space } = theme;

/**
 * A header chip with an icon and a number (streak, XP). Tapping opens its detail (DESIGN §6.5). The number is read by
 * screen readers with its name, so the colour is never the only cue.
 * @param {{ icon: import('react').ReactNode, value: number | string, label: string, tone?: 'amber' | 'jade', onPress?: () => void }} props
 */
export default function StatChip({ icon, value, label, tone = 'amber', onPress }) {
  const fill = tone === 'jade' ? colors.jade100 : colors.amber100;
  const text = tone === 'jade' ? colors.jade700 : colors.ink900;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${value} ${label}`}
      hitSlop={6}
      style={[styles.chip, { backgroundColor: fill }]}
    >
      <View style={styles.icon}>{icon}</View>
      <Text style={[styles.value, { color: text }]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  icon: { alignItems: 'center', justifyContent: 'center' },
  value: {
    fontFamily: fonts.black,
    fontSize: type.small.size + 2,
    lineHeight: type.small.line + 2,
  },
});
