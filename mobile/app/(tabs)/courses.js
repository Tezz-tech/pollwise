import { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Screen from '../../src/components/Screen.js';
import Field from '../../src/components/Field.js';
import Chip from '../../src/components/Chip.js';
import Skeleton from '../../src/components/Skeleton.js';
import Tally from '../../src/components/Tally.js';
import CourseCard from '../../src/components/CourseCard.js';
import { useCatalogue } from '../../src/api/queries.js';
import { PERSONNEL_ROLES } from '@pollwise/shared/constants';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/** Role filters (DESIGN §6.6): "For you" is the learner's own role and is selected by default. */
const ROLE_CHIPS = [
  { key: 'you', label: 'For you', role: undefined },
  { key: 'all', label: 'All', role: 'all' },
  ...Object.entries(PERSONNEL_ROLES).map(([value, label]) => ({ key: value, label, role: value })),
];

/**
 * The Courses tab: search, role chips, and a single column of course cards. Search waits briefly after typing so each
 * keystroke is not a request.
 */
export default function Courses() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [chip, setChip] = useState('you');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const role = ROLE_CHIPS.find((c) => c.key === chip)?.role;
  const catalogue = useCatalogue({ role, q: debounced });
  const items = catalogue.data?.items ?? [];

  return (
    <Screen padded={false} edges={['top', 'left', 'right']}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>
          Courses
        </Text>
        <Field
          label="Search courses"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {ROLE_CHIPS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              tone="jade"
              selected={chip === c.key}
              onPress={() => setChip(c.key)}
            />
          ))}
        </ScrollView>
      </View>

      {catalogue.isPending ? (
        <View style={styles.pad}>
          <Skeleton height={200} />
          <Skeleton height={200} style={{ marginTop: space.lg }} />
        </View>
      ) : catalogue.isError ? (
        <View style={styles.centre}>
          <Text style={styles.body}>{catalogue.error.message}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.centre}>
          <Tally mood="thinking" size={120} accessibilityLabel="Tally, thinking" />
          <Text style={styles.body}>No courses yet for your role. Check back soon.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CourseCard course={item} onPress={() => router.push(`/course/${item.slug}`)} />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space['2xl'], paddingTop: space.lg, gap: space.md },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
  },
  chips: { gap: space.sm, paddingBottom: space.md },
  pad: { paddingHorizontal: space['2xl'], paddingTop: space.lg },
  list: { paddingHorizontal: space['2xl'], paddingTop: space.sm, paddingBottom: space['5xl'] },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    paddingHorizontal: space['2xl'],
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
});
