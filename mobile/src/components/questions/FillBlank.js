import { useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { splitTemplate } from '../../lib/practice.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space, size } = theme;

/**
 * Fill in the blanks (DESIGN §6.8): the sentence with an input pill for each blank. The keyboard opens on the first.
 * `value` is one string per blank.
 * @param {{ template: string, blankCount: number, value: string[] | null, onChange: (values: string[]) => void, disabled?: boolean }} props
 */
export default function FillBlank({ template, blankCount, value, onChange, disabled }) {
  const pieces = splitTemplate(template);
  const values = value ?? Array.from({ length: blankCount }, () => '');
  const refs = useRef([]);

  const setAt = (i, text) => {
    const next = [...values];
    next[i] = text;
    onChange(next);
  };

  return (
    <View style={styles.sentence}>
      {pieces.map((piece, i) => (
        <View key={i} style={styles.piece}>
          {piece ? <Text style={styles.text}>{piece}</Text> : null}
          {i < pieces.length - 1 ? (
            <TextInput
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={values[i] ?? ''}
              onChangeText={(text) => setAt(i, text)}
              editable={!disabled}
              autoFocus={i === 0}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel={`Blank ${i + 1} of ${pieces.length - 1}`}
              returnKeyType={i < pieces.length - 2 ? 'next' : 'done'}
              onSubmitEditing={() => refs.current[i + 1]?.focus()}
              underlineColorAndroid="transparent"
              style={styles.input}
              placeholder="…"
              placeholderTextColor={colors.ink400}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: space.md },
  piece: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  text: {
    fontFamily: fonts.bold,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  input: {
    minWidth: size.touch * 1.6,
    minHeight: size.touch - 8,
    paddingHorizontal: space.md,
    marginHorizontal: space.xs,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.jade600,
    backgroundColor: colors.jade100,
    fontFamily: fonts.heavy,
    fontSize: type.body.size,
    color: colors.ink900,
    textAlign: 'center',
  },
});
