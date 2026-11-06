import { Tabs } from 'expo-router';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type } = theme;

/**
 * The two learner tabs for now: Learn and Courses. Progress and Profile arrive with Phase 9 (DESIGN §6.9, §6.10).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.jade600,
        tabBarInactiveTintColor: colors.ink600,
        tabBarLabelStyle: { fontFamily: fonts.heavy, fontSize: type.small.size },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen
        name="learn"
        options={{ title: 'Learn', tabBarAccessibilityLabel: 'Learn tab' }}
      />
      <Tabs.Screen
        name="courses"
        options={{ title: 'Courses', tabBarAccessibilityLabel: 'Courses tab' }}
      />
    </Tabs>
  );
}
