import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Tally from '../Tally.js';
import CountUp from '../CountUp.js';
import { COPY, pickCopy } from '@pollwise/shared/copy';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space } = theme;

/**
 * "Lesson done." (DESIGN §6.7, §5): Tally cheers, the XP counts up, one button back to the path. When the completion
 * could not be sent (offline), it says so instead of showing XP the server has not confirmed.
 * @param {{ title: string, xp: number, queued: boolean, onContinue: () => void }} props
 */
export default function LessonComplete({ title, xp, queued, onContinue }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    pop.value = reduced ? 1 : withSpring(1);
  }, [pop, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.92 + pop.value * 0.08 }],
  }));

  return (
    <Screen
      padded
      footer={<LipButton label="Continue" onPress={onContinue} testID="lesson-done-continue" />}
    >
      <Animated.View style={[styles.centre, style]}>
        <Tally mood="cheer" size={180} accessibilityLabel="Tally cheering" />
        <Text accessibilityRole="header" style={styles.title}>
          {pickCopy(COPY.lessonComplete, 0)}
        </Text>
        <Text style={styles.body}>{title}</Text>
        {queued ? (
          <Text style={styles.body}>Saved. We will send it when you are back online.</Text>
        ) : (
          <View style={styles.xpRow} accessibilityLabel={`Plus ${xp} XP`}>
            <Text style={styles.plus}>+</Text>
            <CountUp value={xp} suffix=" XP" color={colors.amber700} size={40} />
          </View>
        )}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
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
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  plus: { fontFamily: fonts.black, fontSize: 40, color: colors.amber700 },
});
