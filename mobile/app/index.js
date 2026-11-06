import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Tally from '../src/components/Tally.js';
import Screen from '../src/components/Screen.js';
import { useSession } from '../src/stores/sessionStore.js';
import { theme } from '../src/theme/theme.js';
import { isOnboarded } from '../src/lib/onboarding.js';

const { colors, fonts, type, space, motion } = theme;
/** The splash lasts at most this long, even when the session is ready sooner (DESIGN §6.1). */
const SPLASH_MS = 900;

/**
 * Splash and router (SPEC §3 steps 1, 6). Tally drops in and waves while the stored session is checked, then the
 * learner goes to welcome, onboarding or their learning path.
 */
export default function Index() {
  const status = useSession((s) => s.status);
  const user = useSession((s) => s.user);
  const [minimumElapsed, setMinimumElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinimumElapsed(true), SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  if (status === 'booting' || !minimumElapsed) return <Splash />;
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  if (!isOnboarded(user)) return <Redirect href="/onboarding/1" />;
  return <Redirect href="/learn" />;
}

function Splash() {
  const reduced = useReducedMotion();
  const drop = useSharedValue(reduced ? 0 : -260);

  useEffect(() => {
    drop.value = reduced ? 0 : withDelay(120, withSpring(0, motion.springBouncy));
  }, [drop, reduced]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: drop.value }] }));

  return (
    <Screen padded={false} contentStyle={styles.splash}>
      <Animated.View style={style}>
        <View style={styles.disc}>
          <Tally mood="wave" size={150} accessibilityLabel="Tally, the PollWise mascot" />
        </View>
      </Animated.View>
      <Text accessibilityRole="header" style={styles.wordmark}>
        Poll<Text style={styles.wordmarkAccent}>Wise</Text>
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  splash: {
    backgroundColor: colors.jade600,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space['2xl'],
  },
  disc: { backgroundColor: colors.white, borderRadius: 999, padding: space.lg },
  wordmark: {
    fontFamily: fonts.black,
    fontSize: type.display.size,
    lineHeight: type.display.line,
    color: colors.white,
  },
  wordmarkAccent: { color: colors.jade400 },
});
