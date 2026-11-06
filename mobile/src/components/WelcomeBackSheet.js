import { StyleSheet, Text, View } from 'react-native';
import AppSheet from './AppSheet.js';
import LipButton from './LipButton.js';
import Tally from './Tally.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * "Good to see you. Pick up where you left off?" (DESIGN §5). Warm, never guilty: no count of days missed.
 * @param {{ visible: boolean, onContinue: () => void, onClose: () => void }} props
 */
export default function WelcomeBackSheet({ visible, onContinue, onClose }) {
  return (
    <AppSheet visible={visible} onClose={onClose} snapPoints={['44%']}>
      <View style={styles.body}>
        <Tally mood="wave" size={96} accessibilityLabel="Tally waving" />
        <Text accessibilityRole="header" style={styles.title}>
          Good to see you.
        </Text>
        <Text style={styles.text}>Pick up where you left off?</Text>
        <LipButton label="Continue lesson" onPress={onContinue} testID="welcome-back-continue" />
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: space.md },
  title: { fontFamily: fonts.black, fontSize: type.h1.size, color: colors.ink900 },
  text: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    color: colors.ink600,
    textAlign: 'center',
  },
});
