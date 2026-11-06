import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COPY, pickCopy } from '@pollwise/shared/copy';
import LipButton from '../LipButton.js';
import Tally from '../Tally.js';
import { CrossIcon, TickIcon } from '../icons.js';
import { useFeedback } from '../../hooks/useFeedback.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, radius, space, motion } = theme;

/**
 * The feedback after Check (DESIGN §3, interaction 3). Correct: jade tint, a tick, "Nice work!", a chime and a light
 * success buzz, Tally nodding. Not quite: coral tint, a cross, the explanation and, when the server sent it, the right
 * answer, a soft thud and a warning buzz. Words always accompany the colour.
 * @param {{
 *   result: { correct: boolean | null, explanation?: string | null, correctAnswerText?: string | null },
 *   index: number,
 *   onContinue: () => void,
 *   continueLabel?: string,
 * }} props
 */
export default function FeedbackSheet({ result, index, onContinue, continueLabel = 'Continue' }) {
  const reduced = useReducedMotion();
  const { sound, haptic } = useFeedback();
  const rise = useSharedValue(reduced ? 1 : 0);
  const correct = result.correct === true;
  const reflection = result.correct === null;

  useEffect(() => {
    rise.value = reduced ? 1 : withSpring(1, motion.springGentle);
    if (reflection) return;
    if (correct) {
      sound('correct');
      haptic('success');
    } else {
      sound('wrong');
      haptic('warning');
    }
  }, [correct, haptic, reduced, reflection, rise, sound]);

  const style = useAnimatedStyle(() => ({
    opacity: withTiming(rise.value, { duration: motion.duration.fast }),
    transform: [{ translateY: (1 - rise.value) * 280 }],
  }));

  if (reflection) {
    return null;
  }

  const tone = correct
    ? { fill: colors.jade100, title: colors.jade700, edge: colors.jade600 }
    : { fill: colors.coral100, title: colors.coral700, edge: colors.coral600 };
  const title = correct ? pickCopy(COPY.correct, index) : pickCopy(COPY.notQuite, index);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityViewIsModal
      style={[styles.sheet, { backgroundColor: tone.fill, borderTopColor: tone.edge }, style]}
    >
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: tone.edge }]}>
          {correct ? (
            <TickIcon size={20} color={colors.white} />
          ) : (
            <CrossIcon size={20} color={colors.white} />
          )}
        </View>
        <Text accessibilityRole="header" style={[styles.title, { color: tone.title }]}>
          {title}
        </Text>
        <Tally
          mood={correct ? 'cheer' : 'thinking'}
          size={56}
          accessibilityLabel={correct ? 'Tally nodding' : 'Tally thinking'}
          animate={!reduced}
        />
      </View>
      {result.explanation ? <Text style={styles.body}>{result.explanation}</Text> : null}
      {!correct && result.correctAnswerText ? (
        <Text style={styles.body}>
          <Text style={styles.bold}>The answer: </Text>
          {result.correctAnswerText}
        </Text>
      ) : null}
      <LipButton
        label={correct ? continueLabel : 'Got it'}
        tone={correct ? 'primary' : 'coral'}
        onPress={onContinue}
        testID="feedback-continue"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: 4,
    padding: space['2xl'],
    paddingBottom: space['3xl'],
    gap: space.md,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontFamily: fonts.black, fontSize: type.h2.size, lineHeight: type.h2.line },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  bold: { fontFamily: fonts.heavy },
});
