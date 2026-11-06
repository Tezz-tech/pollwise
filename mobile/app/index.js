import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, Text, View } from 'react-native';
import Tally from '../src/components/Tally.js';
import { useTheme } from '../src/hooks/useTheme.js';

/**
 * Phase 0 placeholder: proves the theme, fonts and Tally render on a device. The real splash and
 * welcome flow arrive in Phase 7.
 */
export default function Home() {
  const { colors, space, type, fonts } = useTheme();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.bg }]}>
      <View style={[styles.center, { padding: space['2xl'], gap: space.xl }]}>
        <Tally size={180} accessibilityLabel="Tally, the PollWise mascot" />
        <Text
          accessibilityRole="header"
          style={{
            color: colors.ink900,
            fontFamily: fonts.black,
            fontSize: type.display.size,
            lineHeight: type.display.line,
          }}
        >
          Poll<Text style={{ color: colors.jade600 }}>Wise</Text>
        </Text>
        <Text
          style={{
            color: colors.ink600,
            fontFamily: fonts.regular,
            fontSize: type.body.size,
            lineHeight: type.body.line,
            textAlign: 'center',
          }}
        >
          Short lessons for election day. Setup screens are coming next.
        </Text>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
