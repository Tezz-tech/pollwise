import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * The tip of the day (DESIGN §5): sky tint, dismissible. Dismissal lasts for this session only, so the tip comes back
 * on the next launch.
 * @param {{ text: string }} props
 */
export default function TipCard({ text }) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <View style={styles.card} accessibilityRole="summary">
      <Text style={styles.label}>Tip of the day</Text>
      <Text style={styles.body}>{text}</Text>
      <Pressable
        onPress={() => setHidden(true)}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        hitSlop={10}
        style={styles.dismiss}
      >
        <Text style={styles.dismissText}>Got it</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.sky100,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.xs,
    borderLeftWidth: 4,
    borderLeftColor: colors.sky600,
  },
  label: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.sky600,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  dismiss: { alignSelf: 'flex-end', minHeight: 32, justifyContent: 'center' },
  dismissText: { fontFamily: fonts.heavy, fontSize: type.small.size, color: colors.sky600 },
});
