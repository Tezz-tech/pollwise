import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import Screen from '../../src/components/Screen.js';
import Field from '../../src/components/Field.js';
import LipButton from '../../src/components/LipButton.js';
import ChoiceRow from '../../src/components/profile/ChoiceRow.js';
import { api } from '../../src/api/client.js';
import { useSession } from '../../src/stores/sessionStore.js';
import { toast } from '../../src/lib/toast.js';
import { PERSONNEL_ROLES } from '@pollwise/shared/constants';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * Edit profile (DESIGN §6.10): name, ward, polling unit and role. To change state or area, the learner goes back
 * through the About you questions, so the same rules apply.
 */
export default function EditProfile() {
  const user = useSession((s) => s.user);
  const updateUser = useSession((s) => s.updateUser);
  const [name, setName] = useState(user?.name ?? '');
  const [ward, setWard] = useState(user?.profile?.ward ?? '');
  const [unit, setUnit] = useState(user?.profile?.pollingUnit ?? '');
  const [role, setRole] = useState(user?.profile?.personnelRole ?? null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (name.trim().length < 1) {
      setError('Enter your name.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.request('/me', { method: 'PATCH', body: { name: name.trim() } });
      // Only the fields the learner filled in are sent: the server's schema takes text, not null, for these.
      const profile = {
        ...(ward.trim() ? { ward: ward.trim() } : {}),
        ...(unit.trim() ? { pollingUnit: unit.trim() } : {}),
        ...(role ? { personnelRole: role } : {}),
      };
      if (Object.keys(profile).length)
        await api.request('/me/profile', { method: 'PATCH', body: profile });
      const me = await api.request('/me');
      updateUser(me);
      toast.success('Profile saved.');
      router.back();
    } catch (err) {
      toast.error(err.message);
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
          label={busy ? 'Saving…' : 'Save changes'}
          onPress={save}
          disabled={busy}
          testID="profile-save"
        />
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <Text accessibilityRole="header" style={styles.title}>
          Edit profile
        </Text>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          error={error}
          autoComplete="name"
        />
        <Field label="Ward" value={ward} onChangeText={setWard} autoCapitalize="words" />
        <Field label="Polling unit" value={unit} onChangeText={setUnit} autoCapitalize="words" />
        <ChoiceRow
          label="Your role"
          options={Object.entries(PERSONNEL_ROLES).map(([key, label]) => ({ key, label }))}
          value={role}
          onChange={setRole}
        />
        <LipButton
          label="Change state or area"
          tone="ghost"
          onPress={() => router.push('/onboarding/1')}
        />
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
});
