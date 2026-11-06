import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnection } from '../stores/connectionStore.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * "You're offline. We'll save your progress when you're back." (DESIGN §6.11). Shown while the last request got no
 * response. Progress already queued is counted, so the learner knows it is safe.
 */
export default function OfflineBanner() {
  const offline = useConnection((s) => s.offline);
  const queued = useConnection((s) => s.queued);
  if (!offline) return null;
  const message =
    queued > 0
      ? `You're offline. ${queued} ${queued === 1 ? 'change is' : 'changes are'} saved and will be sent when you're back.`
      : "You're offline. We'll save your progress when you're back.";
  return (
    <SafeAreaView edges={['top']} pointerEvents="none" style={styles.wrap}>
      <View style={styles.banner} accessibilityLiveRegion="polite" accessibilityRole="alert">
        <Text style={styles.text}>{message}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40 },
  banner: {
    backgroundColor: colors.ink900,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  text: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    lineHeight: type.small.line,
    color: colors.white,
    textAlign: 'center',
  },
});
