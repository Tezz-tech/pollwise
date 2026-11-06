import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * A row of choices, one selected (daily goal, reminder time). Each choice is a tappable pill with its text, so the
 * selection is never shown by colour alone.
 * @param {{ label: string, options: { key: string, label: string, hint?: string }[], value: string | null, onChange: (key: string) => void, disabled?: boolean }} props
 */
export default function ChoiceRow({ label, options, value, onChange, disabled = false }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = option.key === value;
          return (
            <Pressable
              key={option.key}
              onPress={() => onChange(option.key)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={option.hint ? `${option.label}, ${option.hint}` : option.label}
              style={[styles.option, selected && styles.optionOn]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  label: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.ink600,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  option: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.jade600, backgroundColor: colors.jade100 },
  optionText: { fontFamily: fonts.heavy, fontSize: type.small.size, color: colors.ink900 },
  optionTextOn: { color: colors.jade700 },
});
