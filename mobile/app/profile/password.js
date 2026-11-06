import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import Screen from '../../src/components/Screen.js';
import Field from '../../src/components/Field.js';
import LipButton from '../../src/components/LipButton.js';
import StrengthBar from '../../src/components/StrengthBar.js';
import { api } from '../../src/api/client.js';
import { ApiError } from '../../src/lib/api.js';
import { toast } from '../../src/lib/toast.js';
import { useSession } from '../../src/stores/sessionStore.js';
import { passwordStrength, MIN_PASSWORD_LENGTH } from '../../src/lib/validation.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * Change password (DESIGN §6.10). The server ends every session when the password changes, so the phone signs out
 * and the learner logs in again with the new one.
 */
export default function ChangePassword() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const strength = passwordStrength(next);

  const save = async () => {
    const problems = {};
    if (!current) problems.current = 'Enter your current password.';
    if (next.length < MIN_PASSWORD_LENGTH)
      problems.next = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (repeat !== next) problems.repeat = 'The two new passwords do not match.';
    setErrors(problems);
    if (Object.keys(problems).length) return;

    setBusy(true);
    try {
      await api.request('/me/password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      useSession.getState().signOut();
      toast.success('Password changed. Log in with your new password.');
      router.replace('/login');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'INVALID_CREDENTIALS')
        setErrors({ current: err.message });
      else if (err instanceof ApiError && err.code === 'VALIDATION_FAILED')
        setErrors({ next: err.message });
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      padded
      footer={
        <LipButton
          label={busy ? 'Saving…' : 'Change password'}
          onPress={save}
          disabled={busy}
          testID="password-save"
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Change password
        </Text>
        <Field
          label="Current password"
          value={current}
          onChangeText={setCurrent}
          error={errors.current}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />
        <Field
          label="New password"
          value={next}
          onChangeText={setNext}
          error={errors.next}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <StrengthBar score={next ? strength.score : 0} label={next ? strength.label : ''} />
        <Field
          label="Repeat new password"
          value={repeat}
          onChangeText={setRepeat}
          error={errors.repeat}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={styles.note}>You will be signed out on every device after you change it.</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.sm, paddingBottom: space['2xl'] },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    marginBottom: space.md,
  },
  note: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
});
