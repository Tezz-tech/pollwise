import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * Four segments that fill and change colour as a password gets stronger (DESIGN §6.3). The words beside them say
 * the same thing, so colour is never the only signal (DESIGN §9).
 * @param {{ score: number, label: string }} props score 0–4
 */
export default function StrengthBar({ score, label }) {
  const tone = score <= 1 ? colors.coral600 : score === 2 ? colors.amber500 : colors.jade500;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Password strength"
      accessibilityValue={{ min: 0, max: 4, now: score }}
      style={styles.row}
    >
      <View style={styles.segments}>
        {[1, 2, 3, 4].map((segment) => (
          <View
            key={segment}
            style={[styles.segment, { backgroundColor: segment <= score ? tone : colors.line }]}
          />
        ))}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
    marginTop: -space.sm,
  },
  segments: { flex: 1, flexDirection: 'row', gap: space.xs },
  segment: { flex: 1, height: 6, borderRadius: radius.pill },
  label: { width: 84, fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
});
