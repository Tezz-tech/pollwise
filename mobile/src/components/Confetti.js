import { useEffect, useMemo } from 'react';
import { Dimensions, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { confettiColors } from '@pollwise/shared/tokens';
import { theme } from '../theme/theme.js';

const { motion } = theme;

/** Android before API 30 counts as low-end here: a cheap heuristic, so the burst never drops frames there. */
export function particleCount() {
  if (Platform.OS === 'android' && Number(Platform.Version) < 30) return 24;
  return 60;
}

/**
 * A one-off burst of brand-coloured particles (DESIGN §3, interaction 9). Used only for module pass, course
 * complete, daily goal and streak milestones. Reduced motion draws nothing.
 * Change `runKey` to fire it again.
 * @param {{ runKey: number, count?: number }} props
 */
export default function Confetti({ runKey, count }) {
  const reduced = useReducedMotion();
  const total = count ?? particleCount();
  const particles = useMemo(() => buildParticles(total), [total]);
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((particle) => (
        <Particle key={particle.id} particle={particle} runKey={runKey} />
      ))}
    </View>
  );
}

function Particle({ particle, runKey }) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!runKey) return;
    t.value = 0;
    t.value = withDelay(
      particle.delay,
      withTiming(1, { duration: motion.duration.confetti, easing: Easing.in(Easing.quad) })
    );
  }, [runKey, particle.delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.9 ? 1 : (1 - t.value) * 10,
    transform: [
      { translateX: particle.drift * t.value },
      { translateY: -40 + (particle.height + 80) * t.value },
      { rotate: `${particle.spin * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: particle.x,
          width: particle.size,
          height: particle.size * 0.45,
          backgroundColor: particle.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

/** @param {number} total */
function buildParticles(total) {
  const { width, height } = Dimensions.get('window');
  const colors = confettiColors.length ? confettiColors : ['#23A46E'];
  return Array.from({ length: total }, (_, id) => ({
    id,
    x: Math.random() * width,
    size: 8 + Math.random() * 6,
    color: colors[id % colors.length],
    drift: (Math.random() - 0.5) * 120,
    spin: (Math.random() - 0.5) * 720,
    delay: Math.random() * 180,
    height,
  }));
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0 },
});
