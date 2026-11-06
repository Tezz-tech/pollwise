import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import LipButton from './LipButton.js';
import Tally from './Tally.js';
import Confetti from './Confetti.js';
import { useFeedback } from '../hooks/useFeedback.js';
import { theme } from '../theme/theme.js';

const { colors, fonts, type, space, radius, motion } = theme;

/**
 * The course-complete reveal (DESIGN §5): the certificate card flips in, a diagonal shine passes over it, confetti
 * falls and Tally cheers. Two buttons: view the certificate, or go back to learning. Reduced motion shows the card
 * straight away with no flip, shine or confetti.
 * @param {{ certificateId: string | null, onView: (id: string) => void, onDone: () => void }} props
 */
export default function CertificateReveal({ certificateId, onView, onDone }) {
  const reduced = useReducedMotion();
  const { sound, haptic } = useFeedback();
  const flip = useSharedValue(reduced ? 1 : 0);
  const shine = useSharedValue(-260);

  useEffect(() => {
    sound('pass');
    haptic('impactHeavy');
    if (reduced) return;
    flip.value = withSpring(1, motion.springGentle);
    shine.value = withDelay(
      500,
      withTiming(320, { duration: motion.duration.shine * 2, easing: Easing.inOut(Easing.quad) })
    );
  }, [flip, shine, reduced, sound, haptic]);

  // Rotating about the vertical axis from edge-on to flat is the flip.
  const card = useAnimatedStyle(() => ({
    opacity: flip.value,
    transform: [{ perspective: 800 }, { rotateY: `${(1 - flip.value) * 90}deg` }],
  }));
  const sheen = useAnimatedStyle(() => ({
    transform: [{ translateX: shine.value }, { rotate: '20deg' }],
  }));

  return (
    <View style={styles.wrap} accessibilityViewIsModal>
      <Animated.View style={[styles.card, card]}>
        <View style={styles.sheenClip} pointerEvents="none">
          <Animated.View style={[styles.sheen, sheen]} />
        </View>
        <Tally mood="cheer" size={110} accessibilityLabel="Tally cheering" />
        <Text accessibilityRole="header" style={styles.title}>
          Course complete.
        </Text>
        <Text style={styles.body}>
          Your certificate is ready. You can download it or share the check link.
        </Text>
        <View style={styles.actions}>
          <LipButton
            label="View certificate"
            onPress={() => {
              onDone();
              if (certificateId) onView(certificateId);
            }}
            testID="certificate-view"
          />
          <LipButton label="Back to learning" tone="secondary" onPress={onDone} />
        </View>
      </Animated.View>
      <Confetti runKey={1} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: space['2xl'],
    backgroundColor: 'rgba(19, 50, 42, 0.55)',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderBottomWidth: 4,
    borderColor: colors.line,
    padding: space['2xl'],
    alignItems: 'center',
    gap: space.md,
    overflow: 'hidden',
  },
  sheenClip: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  sheen: {
    position: 'absolute',
    top: -80,
    bottom: -80,
    width: 60,
    backgroundColor: colors.white,
    opacity: 0.35,
  },
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
  actions: { alignSelf: 'stretch', gap: space.sm, marginTop: space.md },
});
