import { StyleSheet, Text, View } from 'react-native';
import SingleChoice from './SingleChoice.js';
import MultiChoice from './MultiChoice.js';
import TrueFalse from './TrueFalse.js';
import Matching from './Matching.js';
import Ordering from './Ordering.js';
import FillBlank from './FillBlank.js';
import Reflection from './Reflection.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * One question on the screen: the prompt, then the answer component for its type (DESIGN §6.8). Practice and assessments
 * both use it. `value` is the component's own state; `onChange` sends it back up.
 * @param {{ question: object, value: any, onChange: (value: any) => void, disabled?: boolean, shakeKey?: number, reveal?: object | null }} props
 */
export default function QuestionView({
  question,
  value,
  onChange,
  disabled = false,
  shakeKey = 0,
  reveal = null,
}) {
  return (
    <View style={styles.wrap}>
      <Text accessibilityRole="header" style={styles.prompt}>
        {question.prompt}
      </Text>
      <Answer
        question={question}
        value={value}
        onChange={onChange}
        disabled={disabled}
        shakeKey={shakeKey}
        reveal={reveal}
      />
    </View>
  );
}

function Answer({ question, value, onChange, disabled, shakeKey, reveal }) {
  switch (question.type) {
    case 'single_choice':
      return (
        <SingleChoice
          options={question.options}
          value={value}
          onChange={onChange}
          disabled={disabled}
          shakeKey={shakeKey}
          reveal={reveal}
        />
      );
    case 'multi_choice':
      return (
        <MultiChoice
          options={question.options}
          value={value ?? []}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'true_false':
      return <TrueFalse value={value} onChange={onChange} disabled={disabled} />;
    case 'matching':
      return (
        <Matching
          leftItems={question.leftItems}
          rightItems={question.rightItems}
          value={value ?? {}}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'ordering':
      return (
        <Ordering items={question.items} value={value} onChange={onChange} disabled={disabled} />
      );
    case 'fill_blank':
      return (
        <FillBlank
          template={question.template}
          blankCount={question.blankCount}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
    case 'reflection':
      return <Reflection value={value ?? ''} onChange={onChange} disabled={disabled} />;
    default:
      return <Text style={styles.note}>This question type is not supported in this version.</Text>;
  }
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  prompt: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
  },
  note: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
});
