import { Tabs } from 'expo-router';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type } = theme;

/**
 * The four learner tabs (DESIGN §6): Learn, Courses, Progress and Profile.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.jade600,
        tabBarInactiveTintColor: colors.ink600,
        tabBarLabelStyle: { fontFamily: fonts.heavy, fontSize: type.small.size - 1 },
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
      <Tabs.Screen
        name="progress"
        options={{ title: 'Progress', tabBarAccessibilityLabel: 'Progress tab' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarAccessibilityLabel: 'Profile tab' }}
      />
    </Tabs>
  );
}
