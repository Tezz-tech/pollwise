import { useEffect, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import Field from '../../src/components/Field.js';
import LipButton from '../../src/components/LipButton.js';
import OptionTile from '../../src/components/OptionTile.js';
import ProgressBar from '../../src/components/ProgressBar.js';
import Tally from '../../src/components/Tally.js';
import Skeleton from '../../src/components/Skeleton.js';
import { api } from '../../src/api/client.js';
import { toast } from '../../src/lib/toast.js';
import { useSession } from '../../src/stores/sessionStore.js';
import { usePrefs } from '../../src/stores/prefsStore.js';
import {
  ONBOARDING_STEPS,
  DAILY_GOAL_CHOICES,
  REMINDER_CHOICES,
  firstUnansweredStep,
} from '../../src/lib/onboarding.js';
import { PERSONNEL_ROLES } from '@pollwise/shared/constants';
import { ensureReminderPermission, syncReminders } from '../../src/lib/notifications.js';
import { daysUntil } from '../../src/lib/reminders.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, size } = theme;
/** Auto-advance after an answer (DESIGN §6.4). */
const ADVANCE_MS = 300;

/**
 * The six "About you" questions, one per screen (SPEC §3 step 4). Each answer is saved to the server straight away,
 * then the screen advances on its own.
 */
export default function Onboarding() {
  const { step: raw } = useLocalSearchParams();
  const number = Math.min(Math.max(Number(raw) || 1, 1), ONBOARDING_STEPS.length);
  const user = useSession((s) => s.user);
  const stepName = ONBOARDING_STEPS[number - 1];

  // Jumping ahead (for example from a deep link) sends the learner to the first question they have not answered.
  useEffect(() => {
    const first = firstUnansweredStep(user);
    // Only the required questions (state, area, role) can block a step. Ward, goal and reminder are optional or
    // have defaults, so moving past the ward must never send the learner back to it.
    if (first <= 3 && number > first) router.replace(`/onboarding/${first}`);
  }, [number, user]);

  const next = () => {
    if (number < ONBOARDING_STEPS.length) router.replace(`/onboarding/${number + 1}`);
    else router.replace('/onboarding/ready');
  };

  return (
    <Screen padded contentStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (number > 1 ? router.replace(`/onboarding/${number - 1}`) : router.back())}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={12}
          style={styles.back}
        >
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={styles.progress}>
          <ProgressBar
            progress={number / ONBOARDING_STEPS.length}
            shineKey={number}
            accessibilityLabel={`Question ${number} of ${ONBOARDING_STEPS.length}`}
          />
        </View>
      </View>
      {stepName === 'state' ? <StateStep onNext={next} /> : null}
      {stepName === 'lga' ? <LgaStep onNext={next} /> : null}
      {stepName === 'role' ? <RoleStep onNext={next} /> : null}
      {stepName === 'ward' ? <WardStep onNext={next} /> : null}
      {stepName === 'goal' ? <GoalStep onNext={next} /> : null}
      {stepName === 'reminder' ? <ReminderStep onNext={next} /> : null}
    </Screen>
  );
}

function Question({ title, children, mood = 'happy' }) {
  return (
    <View style={styles.question}>
      <View style={styles.questionHead}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Tally mood={mood} size={64} accessibilityLabel="Tally" animate={false} />
      </View>
      {children}
    </View>
  );
}

/** Answer and advance: save, then move on after a short pause so the selection is seen. */
function useSave() {
  const [busy, setBusy] = useState(false);
  const save = async (fn, after) => {
    setBusy(true);
    try {
      await fn();
      // Keep the local profile in step with the server, so the next question sees the answer just given.
      const me = await api.request('/me');
      useSession.setState({ user: me });
      setTimeout(after, ADVANCE_MS);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, save };
}

function StateStep({ onNext }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const { busy, save } = useSave();
  const states = useQuery({
    queryKey: ['geo', 'states'],
    queryFn: loadNonEmpty('/geo/states'),
    staleTime: Infinity,
  });
  const items = useFilter(states.data ?? [], query);

  return (
    <Question title="Which state will you serve in?">
      <Field label="Search states" value={query} onChangeText={setQuery} autoCapitalize="words" />
      {states.isPending ? <Skeleton height={48} /> : null}
      {states.isError ? (
        <ListProblem
          message="We could not load the states. Check your connection."
          onRetry={() => states.refetch()}
        />
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.code}
        style={styles.list}
        renderItem={({ item }) => (
          <OptionTile
            label={item.name}
            selected={picked === item.code}
            disabled={busy}
            onPress={() => {
              setPicked(item.code);
              save(
                () =>
                  api.request('/me/profile', { method: 'PATCH', body: { stateCode: item.code } }),
                onNext
              );
            }}
          />
        )}
      />
    </Question>
  );
}

function LgaStep({ onNext }) {
  const stateCode = useSession((s) => s.user?.profile?.stateCode);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(null);
  const { busy, save } = useSave();
  const lgas = useQuery({
    queryKey: ['geo', 'lgas', stateCode],
    queryFn: loadNonEmpty(`/geo/states/${stateCode}/lgas`),
    enabled: Boolean(stateCode),
    staleTime: Infinity,
  });
  const items = useFilter(lgas.data ?? [], query);

  return (
    <Question title="Which local government area?">
      <Field label="Search areas" value={query} onChangeText={setQuery} autoCapitalize="words" />
      {lgas.isPending ? <Skeleton height={48} /> : null}
      {lgas.isError ? (
        <ListProblem
          message="We could not load the areas for this state. Check your connection."
          onRetry={() => lgas.refetch()}
        />
      ) : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.code}
        style={styles.list}
        renderItem={({ item }) => (
          <OptionTile
            label={item.name}
            selected={picked === item.code}
            disabled={busy}
            onPress={() => {
              setPicked(item.code);
              save(
                () => api.request('/me/profile', { method: 'PATCH', body: { lgaCode: item.code } }),
                onNext
              );
            }}
          />
        )}
      />
    </Question>
  );
}

function RoleStep({ onNext }) {
  const [picked, setPicked] = useState(null);
  const { busy, save } = useSave();
  return (
    <Question title="What will your role be?" mood="thinking">
      {Object.entries(PERSONNEL_ROLES).map(([value, label]) => (
        <OptionTile
          key={value}
          label={label}
          selected={picked === value}
          disabled={busy}
          onPress={() => {
            setPicked(value);
            save(
              () => api.request('/me/profile', { method: 'PATCH', body: { personnelRole: value } }),
              onNext
            );
          }}
        />
      ))}
    </Question>
  );
}

function WardStep({ onNext }) {
  const [ward, setWard] = useState('');
  const [unit, setUnit] = useState('');
  const [busy, setBusy] = useState(false);
  const finish = async (skip) => {
    setBusy(true);
    try {
      const body = skip
        ? {}
        : {
            ...(ward.trim() ? { ward: ward.trim() } : {}),
            ...(unit.trim() ? { pollingUnit: unit.trim() } : {}),
          };
      if (Object.keys(body).length) await api.request('/me/profile', { method: 'PATCH', body });
      onNext();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Question title="Your ward and polling unit" mood="happy">
      <Text style={styles.hint}>Optional. You can add these later in your profile.</Text>
      <Field label="Ward" value={ward} onChangeText={setWard} autoCapitalize="words" />
      <Field label="Polling unit" value={unit} onChangeText={setUnit} autoCapitalize="words" />
      <LipButton
        label={busy ? 'Saving…' : 'Continue'}
        onPress={() => finish(false)}
        disabled={busy}
      />
      <LipButton label="Skip for now" tone="ghost" onPress={() => finish(true)} disabled={busy} />
    </Question>
  );
}

function GoalStep({ onNext }) {
  const setPrefs = usePrefs((s) => s.setPrefs);
  const [picked, setPicked] = useState(null);
  const { busy, save } = useSave();
  return (
    <Question title="How much a day?" mood="cheer">
      {DAILY_GOAL_CHOICES.map((choice) => (
        <OptionTile
          key={choice.xp}
          label={`${choice.label} · ${choice.hint}`}
          selected={picked === choice.xp}
          disabled={busy}
          onPress={() => {
            setPicked(choice.xp);
            setPrefs({ dailyGoalXp: choice.xp });
            save(
              () => api.request('/me', { method: 'PATCH', body: { dailyGoalXp: choice.xp } }),
              onNext
            );
          }}
        />
      ))}
    </Question>
  );
}

function ReminderStep({ onNext }) {
  const setPrefs = usePrefs((s) => s.setPrefs);
  const updateUser = useSession((s) => s.updateUser);
  const [picked, setPicked] = useState(undefined);
  const { busy, save } = useSave();
  const settings = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => api.request('/settings/public', { auth: false }),
    staleTime: 300_000,
  });

  const choose = (choice) => {
    setPicked(choice.hhmm);
    save(async () => {
      await api.request('/me', { method: 'PATCH', body: { reminderTime: choice.hhmm } });
      setPrefs({ reminderTime: choice.hhmm });
      updateUser({
        learning: { ...useSession.getState().user?.learning, reminderTime: choice.hhmm },
      });
      if (choice.hhmm && (await ensureReminderPermission())) {
        await syncReminders({
          hhmm: choice.hhmm,
          learnedToday: false,
          daysToElection: daysUntil(settings.data?.nextElectionDate, new Date()),
        });
      }
    }, onNext);
  };

  return (
    <Question title="When should Tally remind you?" mood="wave">
      {REMINDER_CHOICES.map((choice) => (
        <OptionTile
          key={choice.label}
          label={`${choice.label} · ${choice.hint}`}
          selected={picked === choice.hhmm}
          disabled={busy}
          onPress={() => choose(choice)}
        />
      ))}
    </Question>
  );
}

/** A message and a retry button for a list that did not load (never a silent empty box). */
function ListProblem({ message, onRetry }) {
  return (
    <View style={{ gap: space.sm, paddingVertical: space.sm }}>
      <Text style={{ fontFamily: fonts.bold, fontSize: type.body.size, color: colors.ink900 }}>
        {message}
      </Text>
      <LipButton label="Try again" tone="secondary" onPress={onRetry} testID="list-retry" />
    </View>
  );
}

/**
 * Load a list that must not be empty. An empty answer counts as a failure, so it is never kept in the cache as
 * the answer and is tried again. This matters when the server has no data yet.
 */
function loadNonEmpty(path) {
  return async () => {
    const data = await api.request(path, { auth: false });
    if (!Array.isArray(data) || data.length === 0)
      throw new Error('The list is not available yet.');
    return data;
  };
}

/** A case-insensitive filter over a list of {name, code}. */
function useFilter(list, query) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((item) => item.name.toLowerCase().includes(q));
  }, [list, query]);
}

const styles = StyleSheet.create({
  content: { gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.sm },
  back: { minWidth: size.touch, minHeight: size.touch, justifyContent: 'center' },
  backText: { fontFamily: fonts.bold, fontSize: type.body.size, color: colors.jade700 },
  progress: { flex: 1 },
  question: { flex: 1, gap: space.md },
  questionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
  },
  list: { flex: 1 },
  hint: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
});
