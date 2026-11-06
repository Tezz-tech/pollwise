import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { toast } from '../src/lib/toast.js';
import Screen from '../src/components/Screen.js';
import Field from '../src/components/Field.js';
import LipButton from '../src/components/LipButton.js';
import StrengthBar from '../src/components/StrengthBar.js';
import { api } from '../src/api/client.js';
import { ApiError } from '../src/lib/api.js';
import { useSession } from '../src/stores/sessionStore.js';
import {
  normaliseNigerianPhone,
  passwordStrength,
  looksLikeEmail,
  MIN_PASSWORD_LENGTH,
} from '../src/lib/validation.js';
import { theme } from '../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/** Sign up (SPEC §3 step 3). Access code only when the organisation mode requires it. */
export default function SignUp() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    accessCode: '',
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => api.request('/settings/public', { auth: false }),
    staleTime: 300_000,
  });
  const needsCode = settings.data?.registrationMode === 'access_code';
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Enter your full name.';
    if (!looksLikeEmail(form.email)) next.email = 'Enter a valid email address.';
    const phone = normaliseNigerianPhone(form.phone);
    if (!phone) next.phone = 'Enter a Nigerian mobile number, like 0803 000 0000.';
    if (form.password.length < MIN_PASSWORD_LENGTH)
      next.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
    if (needsCode && !form.accessCode.trim())
      next.accessCode = 'Enter the access code from your organisation.';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const session = await api.request('/auth/register', {
        method: 'POST',
        auth: false,
        body: {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          phone,
          password: form.password,
          ...(needsCode ? { accessCode: form.accessCode.trim() } : {}),
        },
      });
      useSession.getState().startSession(session);
      router.replace('/onboarding/1');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : null;
      if (code === 'EMAIL_IN_USE')
        setErrors({ email: 'An account with this email already exists.' });
      else if (code === 'PHONE_IN_USE')
        setErrors({ phone: 'An account with this phone number already exists.' });
      else if (code === 'INVALID_ACCESS_CODE')
        setErrors({ accessCode: 'That access code is not right.' });
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      footer={
        <LipButton
          label={busy ? 'Creating your account…' : 'Create account'}
          onPress={submit}
          disabled={busy}
          testID="signup-submit"
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Create your account
        </Text>
        <Field
          label="Full name"
          value={form.name}
          onChangeText={set('name')}
          error={errors.name}
          autoComplete="name"
          textContentType="name"
        />
        <Field
          label="Email"
          value={form.email}
          onChangeText={set('email')}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label="Phone number"
          prefix="+234"
          value={form.phone}
          onChangeText={set('phone')}
          error={errors.phone}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        <Field
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          error={errors.password}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters. Mix letters, numbers and a symbol.`}
        />
        <StrengthBar
          score={form.password ? strength.score : 0}
          label={form.password ? strength.label : ''}
        />
        {needsCode ? (
          <Field
            label="Organisation access code"
            value={form.accessCode}
            onChangeText={set('accessCode')}
            error={errors.accessCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: 0, paddingBottom: space.lg },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    marginBottom: space['2xl'],
  },
});
