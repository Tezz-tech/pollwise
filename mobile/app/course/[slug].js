import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useQueryClient } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import Skeleton from '../../src/components/Skeleton.js';
import Chip from '../../src/components/Chip.js';
import { LockIcon, TickIcon } from '../../src/components/icons.js';
import { api } from '../../src/api/client.js';
import { useOutline, queryKeys } from '../../src/api/queries.js';
import { useCourseSelection } from '../../src/stores/courseStore.js';
import { toast } from '../../src/lib/toast.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * A course's page (DESIGN §6.6): hero, description, the module list with lock state, and one big button: Start course
 * the first time, Continue after.
 */
export default function CourseDetail() {
  const { slug } = useLocalSearchParams();
  const outline = useOutline(String(slug));
  const queryClient = useQueryClient();
  const select = useCourseSelection((s) => s.select);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    const course = outline.data?.course;
    if (!course) return;
    setBusy(true);
    try {
      if (!outline.data.enrolled)
        await api.request(`/courses/${course.id}/enroll`, { method: 'POST' });
      select(course.slug);
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      router.replace('/learn');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (outline.isPending) {
    return (
      <Screen padded>
        <Skeleton height={180} />
        <Skeleton height={28} width="70%" style={{ marginTop: space.lg }} />
        <Skeleton height={80} style={{ marginTop: space.md }} />
      </Screen>
    );
  }
  if (outline.isError) {
    return (
      <Screen
        padded
        footer={
          <LipButton label="Back to courses" tone="secondary" onPress={() => router.back()} />
        }
      >
        <Text style={styles.body}>{outline.error.message}</Text>
      </Screen>
    );
  }

  const { course, enrolled, modules } = outline.data;
  const meta = [
    `${modules.length} ${modules.length === 1 ? 'module' : 'modules'}`,
    course.estimatedMinutes ? `${course.estimatedMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen
      padded={false}
      footer={
        <View style={styles.footer}>
          <LipButton
            label={busy ? 'Opening…' : enrolled ? 'Continue' : 'Start course'}
            onPress={start}
            disabled={busy}
            testID="course-start"
          />
          <LipButton label="Back to courses" tone="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {course.coverImage?.url ? (
          <Image
            source={{ uri: course.coverImage.url }}
            style={styles.hero}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.hero, styles.heroBlank]} />
        )}
        <Text accessibilityRole="header" style={styles.title}>
          {course.title}
        </Text>
        {course.summary ? <Text style={styles.body}>{course.summary}</Text> : null}
        <View style={styles.chips}>
          {course.isRequired ? <Chip label="Required" tone="amber" /> : null}
          {meta ? <Chip label={meta} tone="neutral" /> : null}
        </View>

        <Text style={styles.heading}>In this course</Text>
        {modules.map((mod, i) => (
          <View key={mod.id} style={[styles.module, mod.locked && styles.moduleLocked]}>
            <View style={styles.moduleHead}>
              <Text style={[styles.moduleTitle, mod.locked && styles.lockedText]}>
                {i + 1}. {mod.title}
              </Text>
              {mod.locked ? <LockIcon size={18} color={colors.ink400} /> : null}
            </View>
            <Text style={styles.moduleMeta}>
              {(mod.lessons ?? []).length} {(mod.lessons ?? []).length === 1 ? 'lesson' : 'lessons'}
              {mod.assessment ? ' · check' : ''}
              {mod.assessment?.passed ? ' · passed' : ''}
            </Text>
            {(mod.lessons ?? []).map((lesson) => (
              <View key={lesson.id} style={styles.lessonRow}>
                {lesson.completed ? (
                  <TickIcon size={14} color={colors.jade600} />
                ) : (
                  <View style={styles.bullet} />
                )}
                <Text
                  style={[styles.lessonTitle, lesson.locked && styles.lockedText]}
                  numberOfLines={1}
                >
                  {lesson.title}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space['2xl'], paddingBottom: space['3xl'], gap: space.md },
  hero: { width: '100%', aspectRatio: 16 / 9, borderRadius: radius.lg, marginTop: space.lg },
  heroBlank: { backgroundColor: colors.jade100 },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    marginTop: space.sm,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  heading: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    color: colors.ink900,
    marginTop: space.lg,
  },
  module: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.xs,
  },
  moduleLocked: { backgroundColor: colors.bg },
  moduleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  moduleTitle: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  moduleMeta: { fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink600 },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    minHeight: 24,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.ink400,
    marginHorizontal: 4,
  },
  lessonTitle: { flex: 1, fontFamily: fonts.bold, fontSize: type.small.size, color: colors.ink900 },
  lockedText: { color: colors.ink400 },
  footer: { gap: space.sm },
});
