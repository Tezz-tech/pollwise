import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Card from './Card.js';
import ProgressRing from './ProgressRing.js';
import Chip from './Chip.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * A course in the Courses list (DESIGN §6.6): 16:9 cover, title, summary, "6 modules · 45 min", and a progress ring when
 * enrolled or a Required tag.
 * @param {{ course: object, onPress: () => void }} props
 */
export default function CourseCard({ course, onPress }) {
  const enrolled = Boolean(course.enrolment);
  const progress =
    enrolled && course.moduleCount ? course.enrolment.passedModules / course.moduleCount : 0;
  const meta = [
    course.moduleCount
      ? `${course.moduleCount} ${course.moduleCount === 1 ? 'module' : 'modules'}`
      : null,
    course.estimatedMinutes ? `${course.estimatedMinutes} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${course.title}. ${meta}`}
    >
      <Card raised style={styles.card}>
        {course.coverImage?.url ? (
          <Image
            source={{ uri: course.coverImage.url }}
            style={styles.cover}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View style={[styles.cover, styles.coverBlank]} />
        )}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {course.title}
            </Text>
            {enrolled ? (
              <ProgressRing progress={progress} size={44} stroke={5}>
                <Text style={styles.ringText}>{Math.round(progress * 100)}%</Text>
              </ProgressRing>
            ) : course.isRequired ? (
              <Chip label="Required" tone="amber" />
            ) : null}
          </View>
          {course.summary ? (
            <Text style={styles.summary} numberOfLines={2}>
              {course.summary}
            </Text>
          ) : null}
          {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden', marginBottom: space.lg },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  coverBlank: { backgroundColor: colors.jade100 },
  body: { padding: space.lg, gap: space.xs },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: {
    flex: 1,
    fontFamily: fonts.black,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  summary: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.ink600,
  },
  meta: {
    fontFamily: fonts.heavy,
    fontSize: type.small.size,
    color: colors.jade700,
    marginTop: space.xs,
  },
  ringText: { fontFamily: fonts.black, fontSize: type.label.size, color: colors.ink900 },
});
