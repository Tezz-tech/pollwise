import { StyleSheet, Text, View } from 'react-native';
import OptionTile from '../OptionTile.js';
import { theme } from '../../theme/theme.js';

const { fonts, type, colors, space } = theme;

/**
 * Several answers (DESIGN §6.8): checkboxes and "Select all that apply". Tapping toggles an option.
 * @param {{ options: { id: string, text: string }[], value: string[], onChange: (ids: string[]) => void, disabled?: boolean }} props
 */
export default function MultiChoice({ options, value, onChange, disabled }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <View>
      <Text style={styles.hint}>Select all that apply</Text>
      {options.map((option) => (
        <OptionTile
          key={option.id}
          label={option.text}
          multi
          selected={value.includes(option.id)}
          disabled={disabled}
          onPress={() => toggle(option.id)}
          testID={`option-${option.id}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.ink600,
    marginBottom: space.sm,
  },
});
