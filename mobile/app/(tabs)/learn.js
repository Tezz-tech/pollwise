import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import Screen from '../../src/components/Screen.js';
import Tally from '../../src/components/Tally.js';
import LipButton from '../../src/components/LipButton.js';
import Skeleton from '../../src/components/Skeleton.js';
import StatChip from '../../src/components/StatChip.js';
import ProgressRing from '../../src/components/ProgressRing.js';
import CourseSwitcher from '../../src/components/CourseSwitcher.js';
import CountdownCard from '../../src/components/CountdownCard.js';
import TipCard from '../../src/components/TipCard.js';
import PathView from '../../src/components/PathView.js';
import NodePopover from '../../src/components/NodePopover.js';
import StatSheet from '../../src/components/StatSheet.js';
import { FlameIcon } from '../../src/components/icons.js';
import {
  useStats,
  useCatalogue,
  useOutline,
  usePublicSettings,
  queryKeys,
} from '../../src/api/queries.js';
import { useCourseSelection } from '../../src/stores/courseStore.js';
import { useCelebrations } from '../../src/stores/celebrationStore.js';
import { useToasts } from '../../src/stores/toastStore.js';
import { useSession } from '../../src/stores/sessionStore.js';
import { daysUntil } from '../../src/lib/reminders.js';
import { tipForDay } from '../../src/lib/tips.js';
import { isWelcomeBack, WELCOME_BACK_KEY } from '../../src/lib/welcomeBack.js';
import { secureStorage } from '../../src/lib/storage.js';
import WelcomeBackSheet from '../../src/components/WelcomeBackSheet.js';
import { theme } from '../../src/theme/theme.js';

/** Checked once per app session, so the sheet cannot come back on every visit to the tab. */
let welcomeChecked = false;

const { colors, fonts, type, space, size } = theme;

/**
 * The Learn tab (DESIGN §6.5): the header chips, the countdown and tip cards, the course switcher and the winding
 * path. Everything on it is what the server last said; the path refreshes each time the tab is shown.
 */
export default function Learn() {
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const stats = useStats();
  const enrolled = useCatalogue({ role: 'all' });
  const settings = usePublicSettings();
  const courses = useMemo(
    () => (enrolled.data?.items ?? []).filter((c) => c.enrolment),
    [enrolled.data]
  );
  const chosen = useCourseSelection((s) => s.slug);
  const selectCourse = useCourseSelection((s) => s.select);
  const slug = courses.some((c) => c.slug === chosen) ? chosen : (courses[0]?.slug ?? null);
  const outline = useOutline(slug);
  const [popover, setPopover] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [unlocked, setUnlocked] = useState(null);
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Each visit: refresh the path and stats, and play any module unlocked since last time (DESIGN §3, interaction 8).
  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['course'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      const moments = useCelebrations.getState().takePathMoments();
      const last = moments[moments.length - 1];
      if (last?.event?.moduleId) setUnlocked(last.event.moduleId);

      // Welcome back after three days away, then remember this visit for next time.
      const nowIso = new Date().toISOString();
      secureStorage
        .get(WELCOME_BACK_KEY)
        .then((previous) => {
          if (!welcomeChecked) {
            welcomeChecked = true;
            if (isWelcomeBack(previous, new Date())) setWelcomeOpen(true);
          }
          return secureStorage.set(WELCOME_BACK_KEY, nowIso);
        })
        .catch(() => {});
    }, [queryClient])
  );

  const now = new Date();
  const days = daysUntil(settings.data?.nextElectionDate, now);
  const readiness = stats.data?.readiness?.percent ?? null;
  const continuing = Boolean(
    outline.data?.modules?.some((m) => (m.lessons ?? []).some((l) => l.completed))
  );

  const onNodePress = (row) => {
    if (row.check) {
      const params = new URLSearchParams({
        title: row.title,
        passMark: String(row.passMark ?? 70),
      });
      router.push(`/assessment/${row.id}?${params.toString()}`);
      return;
    }
    setPopover(row);
  };

  const onLockedPress = (row) => {
    useToasts
      .getState()
      .show(
        row.check
          ? 'Pass the lessons in this module to unlock the check.'
          : 'Finish the lesson before this one to unlock it.',
        'info'
      );
  };

  if (enrolled.isPending) {
    return (
      <Screen padded>
        <Skeleton height={44} />
        <Skeleton height={120} style={{ marginTop: space.lg }} />
        <Skeleton height={300} style={{ marginTop: space.lg }} />
      </Screen>
    );
  }

  if (courses.length === 0) {
    return (
      <Screen padded contentStyle={styles.empty}>
        <Tally mood="thinking" size={140} accessibilityLabel="Tally, thinking" />
        <Text accessibilityRole="header" style={styles.emptyTitle}>
          No courses yet.
        </Text>
        <Text style={styles.emptyBody}>
          Pick a course for your role and your path will appear here.
        </Text>
        <LipButton
          label="Browse courses"
          onPress={() => router.push('/courses')}
          testID="learn-browse"
        />
      </Screen>
    );
  }

  const goal = stats.data?.today?.goal ?? user?.learning?.dailyGoalXp ?? 10;
  const earned = stats.data?.today?.xp ?? 0;

  return (
    <View style={styles.page}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <StatChip
            icon={<FlameIcon size={18} color={colors.amber700} />}
            value={stats.data?.streak?.current ?? user?.learning?.streak?.current ?? 0}
            label="day streak"
            onPress={() => setSheet('streak')}
          />
          <StatChip
            value={`${stats.data?.xp ?? user?.learning?.xp ?? 0} XP`}
            label="XP total"
            tone="amber"
            onPress={() => setSheet('xp')}
          />
          <Pressable
            onPress={() => setSheet('xp')}
            accessibilityRole="button"
            accessibilityLabel={`Daily goal: ${earned} of ${goal} XP`}
            hitSlop={6}
          >
            <ProgressRing progress={goal ? earned / goal : 0} size={40} stroke={5}>
              <Text style={styles.goalText}>
                {Math.min(99, Math.round((earned / Math.max(goal, 1)) * 100))}
              </Text>
            </ProgressRing>
          </Pressable>
        </View>
      </SafeAreaView>

      <Screen padded={false} edges={['left', 'right', 'bottom']}>
        <View style={styles.stack}>
          <CourseSwitcher courses={courses} selectedSlug={slug} onSelect={selectCourse} />
          {days ? (
            <CountdownCard
              days={days}
              label={settings.data?.nextElectionLabel}
              readinessPct={readiness}
            />
          ) : null}
          <TipCard text={tipForDay(now)} />
        </View>
        {outline.isPending ? (
          <View style={styles.stack}>
            <Skeleton height={96} />
            <Skeleton height={300} style={{ marginTop: space.lg }} />
          </View>
        ) : outline.isError ? (
          <View style={styles.stack}>
            <Text style={styles.error}>{outline.error.message}</Text>
            <LipButton label="Try again" tone="secondary" onPress={() => outline.refetch()} />
          </View>
        ) : (
          <PathView
            outline={outline.data}
            onNodePress={onNodePress}
            onLockedPress={onLockedPress}
            unlockedModuleId={unlocked}
            continuing={continuing}
          />
        )}
      </Screen>

      <NodePopover
        row={popover}
        visible={Boolean(popover)}
        onClose={() => setPopover(null)}
        onStart={(row) => {
          setPopover(null);
          router.push(`/lesson/${row.id}`);
        }}
      />
      <StatSheet kind={sheet} stats={stats.data} onClose={() => setSheet(null)} />
      <WelcomeBackSheet
        visible={welcomeOpen}
        onContinue={() => setWelcomeOpen(false)}
        onClose={() => setWelcomeOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  header: { backgroundColor: colors.bg, paddingHorizontal: space['2xl'] },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    minHeight: size.touch - 8,
  },
  goalText: { fontFamily: fonts.black, fontSize: type.label.size, color: colors.ink900 },
  stack: { paddingHorizontal: space['2xl'], paddingTop: space.lg, gap: space.lg },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  emptyTitle: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    color: colors.ink900,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  error: { fontFamily: fonts.bold, fontSize: type.body.size, color: colors.ink900 },
});
