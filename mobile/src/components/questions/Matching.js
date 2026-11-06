import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chartColors } from '@pollwise/shared/tokens';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space } = theme;

/**
 * Matching (DESIGN §6.8): two columns of chips. Tap a left item, then a right item, to pair them. Each pair takes its
 * own colour, and a connecting bar shows which is which. Tap a paired chip to undo the pair. `value` is
 * { [leftId]: rightId }.
 * @param {{ leftItems: { id: string, text: string }[], rightItems: { id: string, text: string }[], value: Record<string, string>, onChange: (v: Record<string, string>) => void, disabled?: boolean }} props
 */
export default function Matching({ leftItems, rightItems, value, onChange, disabled }) {
  const [activeLeft, setActiveLeft] = useState(null);
  const colourFor = (leftId) =>
    chartColors[leftItems.findIndex((l) => l.id === leftId) % chartColors.length];
  const pairedLeftOf = (rightId) => Object.keys(value).find((l) => value[l] === rightId);

  const tapLeft = (id) => {
    if (disabled) return;
    if (value[id]) {
      onChange(without(value, id));
      setActiveLeft(null);
      return;
    }
    setActiveLeft(activeLeft === id ? null : id);
  };

  const tapRight = (id) => {
    if (disabled) return;
    const owner = pairedLeftOf(id);
    if (owner) {
      onChange(without(value, owner));
      return;
    }
    if (activeLeft) {
      onChange({ ...value, [activeLeft]: id });
      setActiveLeft(null);
    }
  };

  return (
    <View style={styles.columns}>
      <View style={styles.column}>
        {leftItems.map((item) => {
          const paired = Boolean(value[item.id]);
          const tint = paired ? colourFor(item.id) : null;
          const active = activeLeft === item.id;
          return (
            <Chip
              key={item.id}
              text={item.text}
              accessibilityLabel={`${item.text}${paired ? ', paired' : ''}`}
              onPress={() => tapLeft(item.id)}
              selected={active}
              tint={tint}
            />
          );
        })}
      </View>
      <View style={styles.column}>
        {rightItems.map((item) => {
          const owner = pairedLeftOf(item.id);
          return (
            <Chip
              key={item.id}
              text={item.text}
              accessibilityLabel={`${item.text}${owner ? ', paired' : ''}`}
              onPress={() => tapRight(item.id)}
              selected={false}
              tint={owner ? colourFor(owner) : null}
            />
          );
        })}
      </View>
    </View>
  );
}

function Chip({ text, onPress, selected, tint, accessibilityLabel }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.chip,
        {
          borderColor: tint ?? (selected ? colors.jade600 : colors.line),
          backgroundColor: tint ? colors.surface : selected ? colors.jade100 : colors.surface,
          borderLeftWidth: tint ? 6 : 2,
        },
      ]}
    >
      <Text style={styles.chipText}>{text}</Text>
    </Pressable>
  );
}

/** @param {Record<string, string>} map @param {string} key */
function without(map, key) {
  const next = { ...map };
  delete next[key];
  return next;
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: space.md },
  column: { flex: 1, gap: space.sm },
  chip: {
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderBottomWidth: 4,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.ink900,
  },
});
