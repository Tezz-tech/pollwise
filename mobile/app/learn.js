import { Text, StyleSheet } from 'react-native';
import Screen from '../src/components/Screen.js';
import Tally from '../src/components/Tally.js';
import { theme } from '../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/** Placeholder until the Learn path arrives (Phase 8). Signed-in learners land here after their first lesson. */
export default function Learn() {
  return (
    <Screen padded contentStyle={styles.centre}>
      <Tally mood="happy" size={160} accessibilityLabel="Tally, the PollWise mascot" />
      <Text accessibilityRole="header" style={styles.title}>
        Your learning path is next.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { alignItems: 'center', justifyContent: 'center', gap: space['2xl'] },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    color: colors.ink900,
    textAlign: 'center',
  },
});
