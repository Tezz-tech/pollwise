import { StyleSheet, Text, View } from 'react-native';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Tally from '../Tally.js';
import Card from '../Card.js';
import ProgressRing from '../ProgressRing.js';
import { COPY, interpolate } from '@pollwise/shared/copy';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * The not-yet screen (DESIGN §6.8): thinking Tally (never sad), the pass mark in words, the questions missed, and two
 * ways on: review the lessons, or try again with a fresh set of questions.
 * @param {{ score: number, passMark: number, missed: string[], onTryAgain: () => void, onReview: () => void, busy: boolean }} props
 */
export default function NotYetResults({ score, passMark, missed, onTryAgain, onReview, busy }) {
  return (
    <Screen
      scroll
      padded
      footer={
        <View style={styles.footer}>
          <LipButton
            label={busy ? 'Starting…' : 'Try again'}
            onPress={onTryAgain}
            disabled={busy}
            testID="assessment-retry"
          />
          <LipButton
            label="Review lessons"
            tone="secondary"
            onPress={onReview}
            testID="assessment-review"
          />
        </View>
      }
    >
      <View style={styles.centre}>
        <ProgressRing progress={score / 100} size={120} stroke={10} color={colors.amber500}>
          <Text style={styles.score}>{Math.round(score)}%</Text>
        </ProgressRing>
        <Tally mood="thinking" size={110} accessibilityLabel="Tally, thinking" />
        <Text accessibilityRole="header" style={styles.title}>
          Not yet.
        </Text>
        <Text style={styles.body}>{interpolate(COPY.notYet[0], { passMark })}</Text>
      </View>
      {missed.length ? (
        <Card style={styles.missed}>
          <Text style={styles.heading}>Questions to look at again</Text>
          {missed.map((prompt, i) => (
            <Text key={i} style={styles.item}>
              • {prompt}
            </Text>
          ))}
        </Card>
      ) : (
        <Text style={styles.body}>Go back over the lessons in this module, then try again.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { gap: space.sm },
  centre: { alignItems: 'center', gap: space.lg, marginTop: space.lg },
  score: { fontFamily: fonts.black, fontSize: type.h2.size, color: colors.ink900 },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
    marginVertical: space.md,
  },
  missed: { gap: space.sm, marginTop: space.lg },
  heading: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.ink600,
  },
  item: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
});
