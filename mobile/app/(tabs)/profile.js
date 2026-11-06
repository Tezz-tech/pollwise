import { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import Card from '../../src/components/Card.js';
import LipButton from '../../src/components/LipButton.js';
import AppSheet from '../../src/components/AppSheet.js';
import ChoiceRow from '../../src/components/profile/ChoiceRow.js';
import { api } from '../../src/api/client.js';
import { useSession } from '../../src/stores/sessionStore.js';
import { usePrefs } from '../../src/stores/prefsStore.js';
import { usePublicSettings, useStats } from '../../src/api/queries.js';
import { DAILY_GOAL_CHOICES, REMINDER_CHOICES } from '../../src/lib/onboarding.js';
import { PERSONNEL_ROLES } from '@pollwise/shared/constants';
import { ensureReminderPermission, syncReminders } from '../../src/lib/notifications.js';
import { daysUntil } from '../../src/lib/reminders.js';
import { toast } from '../../src/lib/toast.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, radius, size } = theme;

/**
 * The Profile tab (DESIGN §6.10): who the learner is, their settings, and the account actions. Settings save straight
 * away and take effect at once; the server keeps the account copy.
 */
export default function Profile() {
  const user = useSession((s) => s.user);
  const updateUser = useSession((s) => s.updateUser);
  const prefs = usePrefs();
  const stats = useStats();
  const settings = usePublicSettings();
  const states = useQuery({
    queryKey: ['geo', 'states'],
    queryFn: () => api.request('/geo/states', { auth: false }),
    staleTime: Infinity,
  });
  const lgas = useQuery({
    queryKey: ['geo', 'lgas', user?.profile?.stateCode],
    queryFn: () => api.request(`/geo/states/${user.profile.stateCode}/lgas`, { auth: false }),
    enabled: Boolean(user?.profile?.stateCode),
    staleTime: Infinity,
  });
  const [about, setAbout] = useState(false);
  const [busy, setBusy] = useState(false);

  const stateName = states.data?.find((s) => s.code === user?.profile?.stateCode)?.name;
  const lgaName = lgas.data?.find((a) => a.code === user?.profile?.lgaCode)?.name;
  const roleName = user?.profile?.personnelRole
    ? PERSONNEL_ROLES[user.profile.personnelRole]
    : null;
  const initials = (user?.name ?? '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

  /** Save one setting to the server, then keep the local copy in step. */
  const save = async (body, localPatch) => {
    try {
      await api.request('/me', { method: 'PATCH', body });
      if (localPatch) updateUser(localPatch);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const chooseGoal = (key) => {
    const xp = Number(key);
    usePrefs.getState().setPrefs({ dailyGoalXp: xp });
    save({ dailyGoalXp: xp }, { learning: { ...user?.learning, dailyGoalXp: xp } });
  };

  const chooseReminder = async (key) => {
    const hhmm = key === 'none' ? null : key;
    usePrefs.getState().setPrefs({ reminderTime: hhmm });
    await save({ reminderTime: hhmm }, { learning: { ...user?.learning, reminderTime: hhmm } });
    try {
      if (hhmm && !(await ensureReminderPermission())) {
        toast.info('Reminders need notification permission. Allow it in your phone settings.');
        return;
      }
      await syncReminders({
        hhmm,
        learnedToday: (stats.data?.today?.xp ?? 0) > 0,
        daysToElection: daysUntil(settings.data?.nextElectionDate, new Date()),
      });
    } catch {
      toast.error('Reminders could not be updated. Try again.');
    }
  };

  const setSound = (sound) => {
    usePrefs.getState().setPrefs({ sound });
    save({ prefs: { sound } }, { prefs: { ...user?.prefs, sound } });
  };
  const setHaptics = (haptics) => {
    usePrefs.getState().setPrefs({ haptics });
    save({ prefs: { haptics } }, { prefs: { ...user?.prefs, haptics } });
  };

  const logOut = async () => {
    setBusy(true);
    try {
      const refreshToken = useSession.getState().refreshToken;
      if (refreshToken)
        await api.request('/auth/logout', { method: 'POST', auth: false, body: { refreshToken } });
    } catch {
      // Signing out locally still happens below, even when the server cannot be reached.
    }
    useSession.getState().signOut();
    router.replace('/welcome');
    setBusy(false);
  };

  /** Deleting is a request: the server ends every session now and removes the account after a grace period. */
  const deleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'You will be signed out now. Your account is removed after seven days.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you sure?',
              'Your progress and certificates will be removed after seven days.',
              [
                { text: 'No', style: 'cancel' },
                {
                  text: 'Delete my account',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await api.request('/me', { method: 'DELETE' });
                      useSession.getState().signOut();
                      toast.success('Your account is scheduled for deletion.');
                      router.replace('/welcome');
                    } catch (err) {
                      toast.error(err.message);
                    }
                  },
                },
              ]
            ),
        },
      ]
    );
  };

  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          Profile
        </Text>

        <Card style={styles.identity}>
          <View style={styles.avatar} accessibilityLabel="Your initials">
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{user?.name}</Text>
            {roleName ? <Text style={styles.caption}>{roleName}</Text> : null}
            {stateName ? (
              <Text style={styles.caption}>{[stateName, lgaName].filter(Boolean).join(' · ')}</Text>
            ) : null}
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.heading}>Learning</Text>
          <ChoiceRow
            label="Daily goal"
            options={DAILY_GOAL_CHOICES.map((c) => ({
              key: String(c.xp),
              label: `${c.label} · ${c.xp} XP`,
            }))}
            value={String(prefs.dailyGoalXp)}
            onChange={chooseGoal}
          />
          <ChoiceRow
            label="Reminder"
            options={REMINDER_CHOICES.map((c) => ({ key: c.hhmm ?? 'none', label: c.hint }))}
            value={prefs.reminderTime ?? 'none'}
            onChange={chooseReminder}
          />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.heading}>Feedback</Text>
          <SwitchRow label="Sound" value={prefs.sound} onChange={setSound} />
          <SwitchRow label="Vibration" value={prefs.haptics} onChange={setHaptics} />
        </Card>

        <Card style={styles.section}>
          <Text style={styles.heading}>Account</Text>
          <LinkRow label="Edit profile" onPress={() => router.push('/profile/edit')} />
          <LinkRow label="Change password" onPress={() => router.push('/profile/password')} />
          {settings.data?.privacyPolicyUrl ? (
            <LinkRow
              label="Privacy policy"
              onPress={() => Linking.openURL(settings.data.privacyPolicyUrl)}
            />
          ) : null}
          {settings.data?.supportEmail ? (
            <LinkRow
              label="Contact support"
              onPress={() => Linking.openURL(`mailto:${settings.data.supportEmail}`)}
            />
          ) : null}
          <LinkRow label="About PollWise" onPress={() => setAbout(true)} />
        </Card>

        <LipButton
          label="Log out"
          tone="secondary"
          onPress={logOut}
          disabled={busy}
          testID="profile-logout"
        />
        <Pressable onPress={deleteAccount} accessibilityRole="button" style={styles.danger}>
          <Text style={styles.dangerText}>Delete my account</Text>
        </Pressable>
      </ScrollView>

      <AppSheet visible={about} onClose={() => setAbout(false)} snapPoints={['60%']}>
        <Text accessibilityRole="header" style={styles.heading}>
          About PollWise
        </Text>
        <ScrollView>
          <Text style={styles.body}>
            {settings.data?.aboutText ??
              'PollWise helps election personnel learn their job, one short lesson at a time.'}
          </Text>
        </ScrollView>
      </AppSheet>
    </Screen>
  );
}

function SwitchRow({ label, value, onChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: colors.line, true: colors.jade500 }}
        thumbColor={colors.white}
      />
    </View>
  );
}

function LinkRow({ label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.linkRow}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space['2xl'],
    paddingTop: space.lg,
    paddingBottom: space['5xl'],
    gap: space.lg,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.jade600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.black, fontSize: type.h2.size, color: colors.white },
  identityText: { flex: 1, gap: space.xs },
  name: { fontFamily: fonts.black, fontSize: type.h3.size, color: colors.ink900 },
  caption: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
  section: { gap: space.md },
  heading: { fontFamily: fonts.black, fontSize: type.h3.size, color: colors.ink900 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.touch,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.touch,
  },
  rowLabel: { fontFamily: fonts.bold, fontSize: type.body.size, color: colors.ink900 },
  chevron: { fontFamily: fonts.black, fontSize: type.h2.size, color: colors.ink400 },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
    paddingBottom: space['2xl'],
  },
  danger: { alignItems: 'center', minHeight: size.touch, justifyContent: 'center' },
  dangerText: { fontFamily: fonts.heavy, fontSize: type.body.size, color: colors.coral700 },
});
