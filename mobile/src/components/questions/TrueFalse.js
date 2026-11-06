import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CrossIcon, TickIcon } from '../icons.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space } = theme;

/**
 * True or false (DESIGN §6.8): two large side-by-side tiles, each with a tick or a cross and its word, so the meaning
 * never rests on colour alone.
 * @param {{ value: boolean | undefined, onChange: (v: boolean) => void, disabled?: boolean }} props
 */
export default function TrueFalse({ value, onChange, disabled }) {
  return (
    <View style={styles.row}>
      <Tile
        label="True"
        selected={value === true}
        disabled={disabled}
        onPress={() => onChange(true)}
        tone="jade"
      />
      <Tile
        label="False"
        selected={value === false}
        disabled={disabled}
        onPress={() => onChange(false)}
        tone="coral"
      />
    </View>
  );
}

function Tile({ label, selected, disabled, onPress, tone }) {
  const accent = tone === 'jade' ? colors.jade600 : colors.coral600;
  const tint = tone === 'jade' ? colors.jade100 : colors.coral100;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      style={[
        styles.tile,
        {
          borderColor: selected ? accent : colors.line,
          backgroundColor: selected ? tint : colors.surface,
        },
      ]}
    >
      {tone === 'jade' ? (
        <TickIcon size={34} color={accent} />
      ) : (
        <CrossIcon size={34} color={accent} />
      )}
      <Text style={[styles.label, { color: selected ? accent : colors.ink900 }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1,
    minHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderBottomWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  label: { fontFamily: fonts.black, fontSize: type.h3.size },
});
