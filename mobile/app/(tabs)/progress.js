import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import Card from '../../src/components/Card.js';
import Skeleton from '../../src/components/Skeleton.js';
import ProgressRing from '../../src/components/ProgressRing.js';
import CountUp from '../../src/components/CountUp.js';
import Chip from '../../src/components/Chip.js';
import XpChart from '../../src/components/progress/XpChart.js';
import { FlameIcon, ShieldIcon } from '../../src/components/icons.js';
import { useStats, useCatalogue } from '../../src/api/queries.js';
import { api } from '../../src/api/client.js';
import { certificateDate } from '../../src/lib/certificates.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * The Progress tab (DESIGN §6.9): the streak card, the seven-day XP chart, readiness, courses in progress, and the
 * certificates grid. Everything comes from the server; nothing is worked out on the phone.
 */
export default function Progress() {
  const stats = useStats();
  const catalogue = useCatalogue({ role: 'all' });
  const certificates = useQuery({
    queryKey: ['me', 'certificates'],
    queryFn: () => api.request('/me/certificates'),
  });
  const inProgress = (catalogue.data?.items ?? []).filter(
    (c) => c.enrolment && c.enrolment.status !== 'completed'
  );

  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="header" style={styles.title}>
          Progress
        </Text>

        {stats.isPending ? (
          <Skeleton height={160} />
        ) : (
          <Card style={styles.streak}>
            <View style={styles.streakTop}>
              <FlameIcon size={44} color={colors.amber500} />
              <View>
                <CountUp
                  value={stats.data.streak?.current ?? 0}
                  suffix=" days"
                  color={colors.ink900}
                  size={34}
                />
                <Text style={styles.caption}>
                  Longest {stats.data.streak?.longest ?? 0} · Freezes{' '}
                  {stats.data.streak?.freezes ?? 0}
                </Text>
              </View>
              {(stats.data.streak?.freezes ?? 0) > 0 ? (
                <ShieldIcon size={28} color={colors.freeze} />
              ) : null}
            </View>
            <View style={styles.week} accessibilityLabel="The last seven days">
              {(stats.data.activity7d ?? []).map((d) => (
                <View key={d.day} style={[styles.dayDot, d.xp > 0 && styles.dayDotOn]} />
              ))}
            </View>
          </Card>
        )}

        <Card style={styles.section}>
          <Text style={styles.heading}>XP this week</Text>
          {stats.isPending ? (
            <Skeleton height={150} />
          ) : (
            <XpChart days={stats.data.activity7d ?? []} />
          )}
          {!stats.isPending ? (
            <Text style={styles.caption}>Total {stats.data.xp ?? 0} XP</Text>
          ) : null}
        </Card>

        {!stats.isPending ? (
          <Card style={styles.readiness}>
            <ProgressRing
              progress={(stats.data.readiness?.percent ?? 0) / 100}
              size={84}
              stroke={9}
              color={colors.jade500}
            >
              <Text style={styles.ringText}>
                {stats.data.readiness ? `${stats.data.readiness.percent}%` : '–'}
              </Text>
            </ProgressRing>
            <View style={styles.readinessText}>
              <Text style={styles.heading}>Readiness</Text>
              <Text style={styles.caption}>
                {stats.data.readiness
                  ? `${stats.data.readiness.completed} of ${stats.data.readiness.required} required courses complete.`
                  : 'Readiness appears once your role has required courses.'}
              </Text>
            </View>
          </Card>
        ) : null}

        <Text style={styles.heading}>Courses in progress</Text>
        {catalogue.isPending ? (
          <Skeleton height={64} />
        ) : inProgress.length === 0 ? (
          <Text style={styles.caption}>No course in progress. Start one from the Courses tab.</Text>
        ) : (
          inProgress.map((course) => (
            <Pressable
              key={course.id}
              onPress={() => router.push(`/course/${course.slug}`)}
              accessibilityRole="button"
              accessibilityLabel={`${course.title}, open`}
            >
              <Card style={styles.courseRow}>
                <Text style={styles.courseTitle} numberOfLines={2}>
                  {course.title}
                </Text>
                <Chip
                  label={`${course.enrolment.passedModules} of ${course.moduleCount} modules`}
                  tone="jade"
                />
              </Card>
            </Pressable>
          ))
        )}

        <Text style={styles.heading}>Certificates</Text>
        {certificates.isPending ? (
          <Skeleton height={120} />
        ) : (certificates.data?.items ?? []).length === 0 ? (
          <Text style={styles.caption}>Certificates appear here when you finish a course.</Text>
        ) : (
          <View style={styles.grid}>
            {certificates.data.items.map((cert) => (
              <Pressable
                key={cert.id}
                onPress={() => router.push(`/certificate/${cert.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Certificate for ${cert.courseTitle}, issued ${certificateDate(cert.issuedAt)}`}
                style={styles.tile}
              >
                <Text style={styles.tileKicker}>Certificate</Text>
                <Text style={styles.tileTitle} numberOfLines={3}>
                  {cert.courseTitle}
                </Text>
                <Text style={styles.caption}>{certificateDate(cert.issuedAt)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
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
  heading: {
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  caption: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.ink600,
  },
  streak: { gap: space.md },
  streakTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDot: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.line },
  dayDotOn: { backgroundColor: colors.jade500 },
  section: { gap: space.sm },
  readiness: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  readinessText: { flex: 1, gap: space.xs },
  ringText: { fontFamily: fonts.black, fontSize: type.small.size, color: colors.ink900 },
  courseRow: { gap: space.sm },
  courseTitle: { fontFamily: fonts.black, fontSize: type.body.size, color: colors.ink900 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomWidth: 4,
    padding: space.lg,
    gap: space.xs,
    minHeight: 130,
  },
  tileKicker: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.amber700,
  },
  tileTitle: { fontFamily: fonts.black, fontSize: type.small.size + 2, color: colors.ink900 },
});
