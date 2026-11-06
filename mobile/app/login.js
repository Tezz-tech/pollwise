import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen.js';
import Field from '../src/components/Field.js';
import LipButton from '../src/components/LipButton.js';
import { api } from '../src/api/client.js';
import { ApiError } from '../src/lib/api.js';
import { toast } from '../src/lib/toast.js';
import { useSession } from '../src/stores/sessionStore.js';
import { isOnboarded } from '../src/lib/onboarding.js';
import { theme } from '../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/** Log in with email or phone (SPEC §3). */
export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = {};
    if (identifier.trim().length < 3) next.identifier = 'Enter your email or phone number.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const session = await api.request('/auth/login', {
        method: 'POST',
        auth: false,
        body: { identifier: identifier.trim(), password },
      });
      useSession.getState().startSession(session);
      router.replace(isOnboarded(session.user) ? '/learn' : '/onboarding/1');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS') {
        setErrors({ password: err.message });
      } else {
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <View style={styles.footer}>
          <LipButton
            label={busy ? 'Logging in…' : 'Log in'}
            onPress={submit}
            disabled={busy}
            testID="login-submit"
          />
          <LipButton
            label="Forgot password?"
            tone="ghost"
            onPress={() => router.push('/forgot')}
            testID="login-forgot"
          />
        </View>
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        Welcome back
      </Text>
      <Field
        label="Email or phone"
        value={identifier}
        onChangeText={setIdentifier}
        error={errors.identifier}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="username"
        textContentType="username"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        textContentType="password"
      />
      <Text style={styles.note}>
        Your progress is saved to your account, so you can pick up on any phone.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    marginBottom: space['2xl'],
  },
  footer: { gap: space.sm },
  note: {
    fontFamily: fonts.regular,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.ink600,
    marginTop: space.sm,
  },
});
