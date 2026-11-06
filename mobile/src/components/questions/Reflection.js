import { StyleSheet, Text, TextInput, View } from 'react-native';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space } = theme;

/**
 * A written reflection (DESIGN §6.8). Nothing is marked; the note under the box says so, which keeps the answer honest.
 * @param {{ value: string, onChange: (text: string) => void, disabled?: boolean }} props
 */
export default function Reflection({ value, onChange, disabled }) {
  return (
    <View style={styles.wrap}>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!disabled}
        multiline
        maxLength={2000}
        placeholder="Write it in your own words."
        placeholderTextColor={colors.ink400}
        accessibilityLabel="Your reflection"
        underlineColorAndroid="transparent"
        textAlignVertical="top"
        style={styles.input}
      />
      <Text style={styles.note}>
        This one isn't marked. Write what you would do, then continue.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  input: {
    minHeight: 160,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: space.lg,
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  note: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
});
