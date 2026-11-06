import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../src/components/Screen.js';
import Field from '../src/components/Field.js';
import LipButton from '../src/components/LipButton.js';
import StrengthBar from '../src/components/StrengthBar.js';
import { api } from '../src/api/client.js';
import { ApiError } from '../src/lib/api.js';
import { toast } from '../src/lib/toast.js';
import { passwordStrength, MIN_PASSWORD_LENGTH } from '../src/lib/validation.js';
import { theme } from '../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * Forgot password (SPEC §3): ask for a six-digit code, then set a new password. The first step always says the
 * same thing, so it never reveals whether an account exists.
 */
export default function Forgot() {
  const [step, setStep] = useState('identify');
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(password);

  const sendCode = async () => {
    if (identifier.trim().length < 3) {
      setErrors({ identifier: 'Enter your email or phone number.' });
      return;
    }
    setBusy(true);
    try {
      await api.request('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: { identifier: identifier.trim() },
      });
      setErrors({});
      setStep('reset');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    const next = {};
    if (!/^\d{6}$/.test(code.trim())) next.code = 'Enter the six-digit code from the message.';
    if (password.length < MIN_PASSWORD_LENGTH)
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await api.request('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: { identifier: identifier.trim(), code: code.trim(), newPassword: password },
      });
      toast.success('Password changed. Log in with your new password.');
      router.replace('/login');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_RESET_CODE')
        setErrors({ code: err.message });
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'identify') {
    return (
      <Screen
        scroll
        footer={
          <LipButton
            label={busy ? 'Sending…' : 'Send me a code'}
            onPress={sendCode}
            disabled={busy}
            testID="forgot-send"
          />
        }
      >
        <Text accessibilityRole="header" style={styles.title}>
          Forgot your password?
        </Text>
        <Text style={styles.body}>
          Enter your email or phone number. If there is an account, we will send a six-digit code.
        </Text>
        <Field
          label="Email or phone"
          value={identifier}
          onChangeText={setIdentifier}
          error={errors.identifier}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <LipButton
          label={busy ? 'Saving…' : 'Set new password'}
          onPress={reset}
          disabled={busy}
          testID="forgot-reset"
        />
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        Enter your code
      </Text>
      <Text style={styles.body}>The code is valid for 15 minutes.</Text>
      <Field
        label="Six-digit code"
        value={code}
        onChangeText={setCode}
        error={errors.code}
        keyboardType="number-pad"
        maxLength={6}
      />
      <Field
        label="New password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <StrengthBar score={password ? strength.score : 0} label={password ? strength.label : ''} />
      <View>
        <LipButton label="Send a new code" tone="ghost" onPress={() => setStep('identify')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    marginBottom: space.md,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    marginBottom: space['2xl'],
  },
});
