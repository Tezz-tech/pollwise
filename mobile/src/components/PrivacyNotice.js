import { Linking, StyleSheet, Text, View } from 'react-native';
import AppSheet from './AppSheet.js';
import LipButton from './LipButton.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * "Before you start" (SECURITY §11). Says what PollWise keeps and why, and links to the privacy policy when the
 * client has published one. It cannot be dismissed by tapping outside: the learner chooses Continue.
 * @param {{ visible: boolean, policyUrl: string | null, onContinue: () => void }} props
 */
export default function PrivacyNotice({ visible, policyUrl, onContinue }) {
  return (
    <AppSheet visible={visible} onClose={onContinue} snapPoints={['62%']}>
      <View style={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Before you start
        </Text>
        <Text style={styles.text}>
          PollWise keeps your name, email, phone number, state, area and role so that your learning
          and certificates are yours. It keeps your lesson progress and results to show your
          readiness. We do not sell your information or show ads.
        </Text>
        <Text style={styles.text}>
          You can change your details, download your certificates, or ask for your account to be
          removed from your profile at any time.
        </Text>
        {policyUrl ? (
          <LipButton
            label="Read the privacy policy"
            tone="ghost"
            onPress={() => Linking.openURL(policyUrl)}
          />
        ) : null}
        <LipButton label="Continue" onPress={onContinue} testID="privacy-continue" />
      </View>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
  },
});
