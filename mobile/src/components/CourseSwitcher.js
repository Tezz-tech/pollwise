import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import AppSheet from './AppSheet.js';
import Chip from './Chip.js';
import { ChevronIcon } from './icons.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;

/**
 * The current course title with a chevron; tapping opens the list of enrolled courses (DESIGN §6.5).
 * @param {{ courses: { slug: string, title: string, enrolment?: object | null }[], selectedSlug: string | null, onSelect: (slug: string) => void }} props
 */
export default function CourseSwitcher({ courses, selectedSlug, onSelect }) {
  const [open, setOpen] = useState(false);
  const current = courses.find((c) => c.slug === selectedSlug) ?? courses[0];
  if (!current) return null;
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Course: ${current.title}. Switch course`}
        style={styles.row}
      >
        <Text style={styles.title} numberOfLines={1}>
          {current.title}
        </Text>
        <ChevronIcon size={18} color={colors.ink600} />
      </Pressable>
      <AppSheet visible={open} onClose={() => setOpen(false)} snapPoints={['50%']}>
        <Text style={styles.sheetTitle}>Your courses</Text>
        <View style={styles.list}>
          {courses.map((course) => (
            <Pressable
              key={course.slug}
              onPress={() => {
                onSelect(course.slug);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: course.slug === current.slug }}
              style={[styles.item, course.slug === current.slug && styles.itemActive]}
            >
              <Text style={styles.itemTitle}>{course.title}</Text>
              {course.slug === current.slug ? <Chip label="Current" tone="jade" /> : null}
            </Pressable>
          ))}
        </View>
      </AppSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44 },
  title: {
    flexShrink: 1,
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
  },
  sheetTitle: { fontFamily: fonts.black, fontSize: type.h2.size, color: colors.ink900 },
  list: { gap: space.sm },
  item: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  itemActive: { borderColor: colors.jade600, backgroundColor: colors.jade100 },
  itemTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    color: colors.ink900,
  },
});
