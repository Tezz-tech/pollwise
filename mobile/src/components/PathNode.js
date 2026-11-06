import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../theme/theme.js';
import { LockIcon, ShieldIcon, TickIcon } from './icons.js';
import { nodeLabel, ROW_HEIGHT } from '../lib/path.js';

const { colors, fonts, type, lip, motion, radius, size, space } = theme;

/**
 * One node on the Learn path (DESIGN §3 interaction 7). Completed: jade with a tick. Current: larger, bouncing, with a
 * START or CONTINUE tooltip. Available: white with a jade ring. Locked: grey with a lock; a tap shakes it. The check
 * node is a shield in amber.
 * @param {{
 *   row: import('../lib/path.js').NodeRow,
 *   position: number,
 *   offsetX: number,
 *   tooltip?: string,
 *   pop?: number,
 *   onPress: () => void,
 *   onLocked: () => void,
 * }} props
 */
export default function PathNode({ row, position, offsetX, tooltip, pop = 0, onPress, onLocked }) {
  const reduced = useReducedMotion();
  const current = row.state === 'current';
  const diameter = current ? size.pathNodeCurrent : size.pathNode;
  const bounce = useSharedValue(0);
  const bob = useSharedValue(0);
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);

  // The current node bounces (2 px, 1.8 s loop) and its tooltip bobs. Reduced motion keeps both still.
  useEffect(() => {
    if (!current || reduced) return undefined;
    bounce.value = withRepeat(
      withTiming(motion.idleBounce.distance, {
        duration: motion.idleBounce.period / 2,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
    bob.value = withRepeat(
      withTiming(-4, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(bounce);
      cancelAnimation(bob);
    };
  }, [current, reduced, bounce, bob]);

  // A new unlock pops the node in with a bouncy spring.
  useEffect(() => {
    if (!pop || reduced) return;
    scale.value = 0.6;
    scale.value = withSpring(1, motion.springBouncy);
  }, [pop, reduced, scale]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -bounce.value }, { translateX: shake.value }, { scale: scale.value }],
  }));
  const tipStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  const locked = row.state === 'locked';
  const fill = locked
    ? colors.line
    : row.state === 'completed' || current
      ? colors.jade600
      : colors.surface;
  const edge = locked ? colors.line : colors.jade600;
  const lipColor = locked
    ? 'transparent'
    : row.state === 'completed' || current
      ? colors.jade700
      : colors.line;
  const shieldTone = row.check;

  const onTap = () => {
    if (locked) {
      if (!reduced) {
        shake.value = withSequence(
          withTiming(motion.shake.distance, { duration: 40 }),
          withTiming(-motion.shake.distance, { duration: 80 }),
          withTiming(motion.shake.distance, { duration: 80 }),
          withTiming(0, { duration: 40 })
        );
      }
      onLocked();
      return;
    }
    onPress();
  };

  const faceFill = shieldTone && !locked ? colors.amber500 : fill;
  const faceEdge = shieldTone && !locked ? colors.amber700 : edge;

  return (
    <View style={[styles.row, { transform: [{ translateX: offsetX }] }]} pointerEvents="box-none">
      {current && tooltip ? (
        <Animated.View style={[styles.tooltip, tipStyle]}>
          <Text style={styles.tooltipText}>{tooltip}</Text>
          <View style={styles.tooltipTail} />
        </Animated.View>
      ) : null}
      <Animated.View style={bodyStyle}>
        <Pressable
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel={nodeLabel(row, position)}
          accessibilityState={{ disabled: false, selected: current }}
          style={[styles.hit, { width: diameter, height: diameter + lip.width }]}
        >
          <View
            style={[
              styles.lipLayer,
              {
                width: diameter,
                height: diameter,
                borderRadius: diameter / 2,
                backgroundColor: lipColor,
                top: lip.width,
              },
            ]}
          />
          <View
            style={[
              styles.face,
              {
                width: diameter,
                height: diameter,
                borderRadius: diameter / 2,
                backgroundColor: faceFill,
                borderColor: faceEdge,
              },
            ]}
          >
            <NodeGlyph row={row} locked={locked} />
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** The icon inside the disc. Colour is never the only signal: completed has a tick, locked a lock. */
function NodeGlyph({ row, locked }) {
  if (locked) return <LockIcon size={24} color={colors.ink400} />;
  if (row.check) {
    return row.state === 'completed' ? (
      <TickIcon size={26} color={colors.ink900} />
    ) : (
      <ShieldIcon size={28} color={colors.ink900} />
    );
  }
  if (row.state === 'completed') return <TickIcon size={26} color={colors.white} />;
  if (row.state === 'current') return <Text style={styles.playText}>▶</Text>;
  return <View style={styles.dot} />;
}

const styles = StyleSheet.create({
  row: { width: '100%', height: ROW_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.jade600 },
  hit: { alignItems: 'center' },
  lipLayer: { position: 'absolute', left: 0 },
  face: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { fontFamily: fonts.black, fontSize: type.h3.size, color: colors.white },
  tooltip: {
    position: 'absolute',
    top: -44,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.jade600,
  },
  tooltipText: {
    fontFamily: fonts.black,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    color: colors.jade700,
  },
  tooltipTail: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.jade600,
  },
});
