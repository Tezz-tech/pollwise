import { StyleSheet, Text, View } from 'react-native';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Card from '../Card.js';
import { ShieldIcon } from '../icons.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * The start of a module check (DESIGN §6.8): shield, the module, the pass mark in plain words, and Start.
 * @param {{ title: string, passMark: number | null, busy: boolean, onStart: () => void, onBack: () => void, resuming?: boolean }} props
 */
export default function AssessmentIntro({
  title,
  passMark,
  busy,
  onStart,
  onBack,
  resuming = false,
}) {
  return (
    <Screen
      padded
      footer={
        <View style={styles.footer}>
          <LipButton
            label={busy ? 'Opening…' : resuming ? 'Continue check' : 'Start check'}
            onPress={onStart}
            disabled={busy}
            testID="assessment-start"
          />
          <LipButton label="Not now" tone="ghost" onPress={onBack} />
        </View>
      }
    >
      <Card style={styles.card}>
        <View style={styles.badge}>
          <ShieldIcon size={48} color={colors.ink900} />
        </View>
        <Text accessibilityRole="header" style={styles.kicker}>
          Module check
        </Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>
          You need {passMark ?? 70}% to pass. Passing unlocks the next module.
        </Text>
        <Text style={styles.body}>You can try again if you do not pass the first time.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: space.md, padding: space['2xl'], marginTop: space['2xl'] },
  badge: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: colors.amber100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.ink600,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  footer: { gap: space.sm },
});
