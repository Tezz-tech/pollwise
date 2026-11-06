import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space, size } = theme;

/**
 * Ordering (DESIGN §6.8). The up and down buttons are the accessible way to reorder, and they are the only way in this
 * version; drag with a grip handle comes with the gesture work in Phase 9. `value` is the list of item ids in order;
 * when it is not set yet, the server's order is used.
 * @param {{ items: { id: string, text: string }[], value: string[] | null, onChange: (ids: string[]) => void, disabled?: boolean }} props
 */
export default function Ordering({ items, value, onChange, disabled }) {
  const order = value ?? items.map((i) => i.id);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <View style={styles.list}>
      {order.map((id, index) => (
        <View key={id} style={styles.row}>
          <Text style={styles.position} accessibilityLabel={`Position ${index + 1}`}>
            {index + 1}
          </Text>
          <Text style={styles.text}>{byId[id]?.text}</Text>
          <View style={styles.buttons}>
            <Pressable
              onPress={() => move(index, -1)}
              disabled={disabled || index === 0}
              accessibilityRole="button"
              accessibilityLabel={`Move ${byId[id]?.text} up`}
              style={[styles.step, (disabled || index === 0) && styles.stepOff]}
            >
              <Text style={styles.stepText}>▲</Text>
            </Pressable>
            <Pressable
              onPress={() => move(index, 1)}
              disabled={disabled || index === order.length - 1}
              accessibilityRole="button"
              accessibilityLabel={`Move ${byId[id]?.text} down`}
              style={[styles.step, (disabled || index === order.length - 1) && styles.stepOff]}
            >
              <Text style={styles.stepText}>▼</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.sm },
  row: {
    minHeight: size.touch,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: colors.line,
    paddingLeft: space.md,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  position: {
    width: 24,
    textAlign: 'center',
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    color: colors.jade700,
  },
  text: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  buttons: { flexDirection: 'column', gap: space.xs },
  step: {
    width: size.touch - 8,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.jade100,
  },
  stepOff: { backgroundColor: colors.line },
  stepText: { fontSize: type.small.size, color: colors.jade700 },
});
