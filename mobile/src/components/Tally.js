import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect } from 'react-native-svg';
import { colors, motion } from '@pollwise/shared/tokens';

/*
 * Tally, the PollWise mascot (DESIGN §2, §3 interaction 10). The geometry is the one in brand/svg/tally-happy.svg,
 * split into layers so each part can move: eyes blink and look, arms raise, the body squashes on landing. Every
 * colour comes from the tokens. Tally is never sad (CLAUDE.md rule 9).
 */

const VIEW = { w: 640, h: 780 };
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

/** Arm angles in degrees, measured from the shoulder. 22 is the resting pose; cheer lifts both arms overhead. */
const REST_LEFT = 22;
const REST_RIGHT = -22;

/** Per-mood pose. `look` moves the pupils (px in viewBox units); `mouth` picks the smile. */
const MOODS = Object.freeze({
  happy: { look: { x: 0, y: 0 }, mouth: 'smile', left: REST_LEFT, right: REST_RIGHT },
  cheer: { look: { x: 0, y: -6 }, mouth: 'big', left: REST_LEFT + 150, right: REST_RIGHT - 150 },
  thinking: { look: { x: 16, y: -14 }, mouth: 'flat', left: REST_LEFT, right: REST_RIGHT },
  wave: { look: { x: 0, y: 0 }, mouth: 'smile', left: REST_LEFT, right: 'wave' },
});

/**
 * @param {{
 *   mood?: 'happy' | 'cheer' | 'thinking' | 'wave',
 *   size?: number,
 *   accessibilityLabel?: string,
 *   animate?: boolean,
 * }} props
 */
export default function Tally({
  mood = 'happy',
  size = 160,
  accessibilityLabel = 'Tally, the PollWise mascot',
  animate = true,
}) {
  const reduced = useReducedMotion();
  const live = animate && !reduced;
  const pose = MOODS[mood] ?? MOODS.happy;
  const s = size / VIEW.w;
  const height = VIEW.h * s;

  const blink = useSharedValue(1); // 1 open, ~0.08 closed
  const lookX = useSharedValue(pose.look.x);
  const lookY = useSharedValue(pose.look.y);
  const armL = useSharedValue(pose.left);
  // 'wave' is a motion, not an angle: the arm starts at rest and the effect below takes it from there.
  const armR = useSharedValue(typeof pose.right === 'number' ? pose.right : REST_RIGHT);
  const squash = useSharedValue(1);

  // Pupils and arms move to the mood's pose.
  useEffect(() => {
    if (!live) {
      lookX.value = pose.look.x;
      lookY.value = pose.look.y;
      armL.value = pose.left;
      armR.value = typeof pose.right === 'number' ? pose.right : REST_RIGHT;
      return;
    }
    lookX.value = withSpring(pose.look.x, motion.springSnappy);
    lookY.value = withSpring(pose.look.y, motion.springSnappy);
    armL.value = withSpring(pose.left, motion.springBouncy);
    if (typeof pose.right === 'number') {
      armR.value = withSpring(pose.right, motion.springBouncy);
    } else {
      armR.value = withRepeat(
        withSequence(withTiming(-120, { duration: 320 }), withTiming(-70, { duration: 320 })),
        -1,
        true
      );
    }
  }, [mood, live, pose, lookX, lookY, armL, armR]);

  // Squash on landing: a quick flatten, a bounce, then settle.
  useEffect(() => {
    if (!live) return;
    squash.value = withSequence(
      withTiming(0.9, { duration: 90 }),
      withSpring(1.04, motion.springBouncy),
      withSpring(1, motion.springSnappy)
    );
  }, [mood, live, squash]);

  // Blink every 3–6 seconds, at a random gap (DESIGN §3, motion.blink). The timer is JS; the blink is UI-thread.
  useEffect(() => {
    if (!live) return undefined;
    let timer;
    const schedule = () => {
      const gap = motion.blink.minGap + Math.random() * (motion.blink.maxGap - motion.blink.minGap);
      timer = setTimeout(() => {
        blink.value = withSequence(
          withTiming(0.08, { duration: 70 }),
          withTiming(1, { duration: 110 })
        );
        schedule();
      }, gap);
    };
    schedule();
    return () => {
      clearTimeout(timer);
      cancelAnimation(blink);
    };
  }, [live, blink]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: squash.value }, { scaleX: 2 - squash.value }],
  }));

  const armLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armL.value}deg` }],
  }));
  const armRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armR.value}deg` }],
  }));

  const whiteL = useAnimatedProps(() => ({ ry: 54 * blink.value }));
  const whiteR = useAnimatedProps(() => ({ ry: 54 * blink.value }));
  const pupilL = useAnimatedProps(() => ({
    cx: 268 + lookX.value,
    cy: 482 + lookY.value,
    ry: 25 * blink.value,
  }));
  const pupilR = useAnimatedProps(() => ({
    cx: 384 + lookX.value,
    cy: 482 + lookY.value,
    ry: 25 * blink.value,
  }));
  const shineL = useAnimatedProps(() => ({
    cx: 277 + lookX.value,
    cy: 471 + lookY.value,
    ry: 8 * blink.value,
  }));
  const shineR = useAnimatedProps(() => ({
    cx: 393 + lookX.value,
    cy: 471 + lookY.value,
    ry: 8 * blink.value,
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width: size, height }}
    >
      {/* Arms sit behind the body, each rotating about its shoulder. */}
      <Animated.View
        style={[StyleSheet.absoluteFill, armLStyle, { transformOrigin: [156 * s, 440 * s] }]}
      >
        <Svg width={size} height={height} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
          <Rect x={127} y={440} width={58} height={150} rx={29} fill={colors.jade600} />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[StyleSheet.absoluteFill, armRStyle, { transformOrigin: [484 * s, 440 * s] }]}
      >
        <Svg width={size} height={height} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
          <Rect x={455} y={440} width={58} height={150} rx={29} fill={colors.jade600} />
        </Svg>
      </Animated.View>

      <Animated.View
        style={[StyleSheet.absoluteFill, bodyStyle, { transformOrigin: [320 * s, height] }]}
      >
        <Svg width={size} height={height} viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}>
          <Defs>
            <ClipPath id="pw-slot">
              <Rect x={0} y={0} width={640} height={286} />
            </ClipPath>
          </Defs>
          <Ellipse cx={320} cy={752} rx={190} ry={16} fill={colors.ink900} opacity={0.1} />
          <Rect x={206} y={684} width={92} height={58} rx={29} fill={colors.jade700} />
          <Rect x={342} y={684} width={92} height={58} rx={29} fill={colors.jade700} />
          <Rect x={140} y={330} width={360} height={370} rx={64} fill={colors.jade600} />
          <Rect x={140} y={330} width={360} height={344} rx={64} fill={colors.jade500} />
          <Rect x={110} y={236} width={420} height={112} rx={44} fill={colors.jade600} />
          <Rect x={110} y={236} width={420} height={90} rx={44} fill={colors.jade400} />
          <Rect x={220} y={268} width={200} height={34} rx={17} fill={colors.ink900} />
          <G clipPath="url(#pw-slot)">
            <G transform="rotate(-9 320 160)">
              <Rect x={232} y={44} width={176} height={236} rx={28} fill={colors.amber500} />
              <Path
                d="M279 158 L314 193 L367 126"
                fill="none"
                stroke={colors.ink900}
                strokeWidth={32}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </G>
          </G>
          <Ellipse cx={206} cy={552} rx={27} ry={16} fill={colors.cheek} opacity={0.85} />
          <Ellipse cx={434} cy={552} rx={27} ry={16} fill={colors.cheek} opacity={0.85} />
          <AnimatedEllipse cx={262} cy={470} rx={44} fill={colors.white} animatedProps={whiteL} />
          <AnimatedEllipse cx={378} cy={470} rx={44} fill={colors.white} animatedProps={whiteR} />
          <AnimatedEllipse rx={25} fill={colors.ink900} animatedProps={pupilL} />
          <AnimatedEllipse rx={25} fill={colors.ink900} animatedProps={pupilR} />
          <AnimatedEllipse rx={8} fill={colors.white} animatedProps={shineL} />
          <AnimatedEllipse rx={8} fill={colors.white} animatedProps={shineR} />
          <Mouth kind={pose.mouth} />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** The three mouths: a smile, a bigger cheer smile, and a flat line for thinking. Never a frown. */
function Mouth({ kind }) {
  if (kind === 'flat') {
    return (
      <Path
        d="M300 556 Q320 560 340 556"
        fill="none"
        stroke={colors.ink900}
        strokeWidth={17}
        strokeLinecap="round"
      />
    );
  }
  if (kind === 'big') {
    return (
      <Path
        d="M282 548 Q320 600 358 548"
        fill="none"
        stroke={colors.ink900}
        strokeWidth={17}
        strokeLinecap="round"
      />
    );
  }
  return (
    <Path
      d="M288 550 Q320 586 352 550"
      fill="none"
      stroke={colors.ink900}
      strokeWidth={17}
      strokeLinecap="round"
    />
  );
}
