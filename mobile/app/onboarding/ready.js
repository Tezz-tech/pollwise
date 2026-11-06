import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import Tally from '../../src/components/Tally.js';
import Confetti from '../../src/components/Confetti.js';
import { api } from '../../src/api/client.js';
import { openRecommendedLesson } from '../../src/lib/startLesson.js';
import { toast } from '../../src/lib/toast.js';
import { useSession } from '../../src/stores/sessionStore.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * "You're all set" (SPEC §3 step 5). A celebration, then straight into lesson 1 of the recommended course.
 */
export default function Ready() {
  const user = useSession((s) => s.user);
  const [busy, setBusy] = useState(false);
  const [confettiKey, setConfettiKey] = useState(0);
  const firstName = (user?.name ?? '').split(' ')[0] || 'there';

  useEffect(() => {
    setConfettiKey(1);
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      const lessonId = await openRecommendedLesson(api, user?.profile?.personnelRole);
      if (lessonId) router.replace(`/lesson/${lessonId}`);
      else router.replace('/learn');
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <Screen
      footer={
        <LipButton
          label={busy ? 'Opening your lesson…' : 'Start your first lesson'}
          onPress={start}
          disabled={busy}
          testID="ready-start"
        />
      }
    >
      <View style={styles.centre}>
        <Tally mood="cheer" size={200} accessibilityLabel="Tally cheering" />
        <Text accessibilityRole="header" style={styles.title}>
          You're all set, {firstName}.
        </Text>
        <Text style={styles.body}>Your first lesson is ready. It takes about five minutes.</Text>
      </View>
      <Confetti runKey={confettiKey} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space['2xl'] },
  title: {
    fontFamily: fonts.black,
    fontSize: type.display.size,
    lineHeight: type.display.line,
    color: colors.ink900,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
});
