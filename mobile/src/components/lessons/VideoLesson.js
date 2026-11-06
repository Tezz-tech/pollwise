import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import Card from '../Card.js';
import { api, offlineQueue } from '../../api/client.js';
import { useConnection } from '../../stores/connectionStore.js';
import { useCelebrations } from '../../stores/celebrationStore.js';
import { useToasts } from '../../stores/toastStore.js';
import { xpFrom } from '../../lib/lessonRules.js';
import { theme } from '../../theme/theme.js';

const { colors, fonts, type, space, radius } = theme;
/** A heartbeat every 10 seconds of play (SPEC §7). */
export const HEARTBEAT_MS = 10_000;
/** How often the key points are checked against the playhead. */
const POSITION_MS = 2_000;

/**
 * A YouTube lesson (DESIGN §6.7, SPEC §7). The server decides how much real watching counts; this only reports where
 * the player is. Key points reveal at 25, 50 and 75%. Continue unlocks when the server says the video is complete.
 * @param {{
 *   lesson: { id: string, title: string, video: { youtubeId: string, durationSec: number, keyPoints: string[] } },
 *   progress: { lastPositionSec?: number, status?: string },
 *   completed: boolean,
 *   onCompleted: (xp: number) => void,
 *   onFinished: () => void,
 *   topBar: (progress: number) => import('react').ReactNode,
 * }} props
 */
export default function VideoLesson({
  lesson,
  progress,
  completed,
  onCompleted,
  onFinished,
  onLeave,
  topBar,
}) {
  const reduced = useReducedMotion();
  const playerRef = useRef(null);
  const offline = useConnection((s) => s.offline);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [position, setPosition] = useState(progress.lastPositionSec ?? 0);
  const duration = lesson.video.durationSec || 0;
  const keyPoints = lesson.video.keyPoints ?? [];
  const fraction = duration ? Math.min(1, position / duration) : 0;

  // Key point i shows once the playhead passes (i+1)/(n+1): 25%, 50%, 75% for three points.
  const shown = useMemo(
    () => keyPoints.filter((_, i) => fraction >= (i + 1) / (keyPoints.length + 1)).length,
    [keyPoints, fraction]
  );

  // Report the playhead every 10 s while playing, and once more when it stops.
  useEffect(() => {
    if (!playing || completed) return undefined;
    const beat = setInterval(() => sendHeartbeat(), HEARTBEAT_MS);
    return () => clearInterval(beat);
  }, [playing, completed]);

  // Keep the key points in step with the playhead while the video plays.
  useEffect(() => {
    if (!playing) return undefined;
    const tick = setInterval(async () => {
      try {
        const time = await playerRef.current?.getCurrentTime();
        if (typeof time === 'number') setPosition(time);
      } catch {
        // The player is busy or gone; the next tick tries again.
      }
    }, POSITION_MS);
    return () => clearInterval(tick);
  }, [playing]);

  const sendHeartbeat = async () => {
    let time = position;
    try {
      const current = await playerRef.current?.getCurrentTime();
      if (typeof current === 'number') time = current;
    } catch {
      return;
    }
    const body = { positionSec: Math.floor(time), durationSec: duration };
    try {
      const result = await api.request(`/lessons/${lesson.id}/heartbeat`, { method: 'POST', body });
      if (result.completed) {
        const { inline } = useCelebrations.getState().push(result.events);
        onCompleted(xpFrom(inline));
        useToasts.getState().show(`+${xpFrom(inline)} XP`, 'success');
      }
    } catch (err) {
      if (err?.isNetwork) {
        // Keep the latest position only: a newer heartbeat replaces an older one for the same lesson.
        await offlineQueue.enqueue({
          key: `heartbeat:${lesson.id}`,
          kind: 'heartbeat',
          path: `/lessons/${lesson.id}/heartbeat`,
          method: 'POST',
          body,
        });
        useConnection.getState().setQueued((await offlineQueue.list()).length);
      }
    }
  };

  const onState = (state) => {
    if (state === 'playing') setPlaying(true);
    if (state === 'paused' || state === 'ended') {
      setPlaying(false);
      sendHeartbeat();
    }
  };

  const onReady = () => {
    const resume = progress.lastPositionSec ?? 0;
    // Resume where the learner left off, unless it was almost the end.
    if (resume > 5 && (!duration || resume < duration - 5)) playerRef.current?.seekTo(resume, true);
  };

  if (offline || failed) {
    return (
      <Screen
        padded
        footer={<LipButton label="Back to learning" tone="secondary" onPress={onLeave} />}
      >
        {topBar(fraction)}
        <Card style={styles.offlineCard}>
          <Text style={styles.offlineTitle}>This video needs internet.</Text>
          <Text style={styles.body}>Connect and try again. Your place is saved.</Text>
          {failed ? (
            <LipButton
              label="Try again"
              tone="primary"
              onPress={() => setFailed(false)}
              style={{ marginTop: space.md }}
            />
          ) : null}
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        completed ? (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(220)}>
            <LipButton label="Continue" onPress={onFinished} testID="video-continue" />
          </Animated.View>
        ) : (
          <LipButton label="Watch to continue" disabled onPress={() => {}} testID="video-locked" />
        )
      }
    >
      {topBar(fraction)}
      <Text style={styles.title}>{lesson.title}</Text>
      <View style={styles.player}>
        <YoutubeIframe
          ref={playerRef}
          videoId={lesson.video.youtubeId}
          height={220}
          play={false}
          onChangeState={onState}
          onReady={onReady}
          onError={() => setFailed(true)}
          initialPlayerParams={{ rel: false, modestbranding: true, preventFullScreen: false }}
        />
      </View>
      <Text style={styles.caption}>Turn on captions in YouTube if you need them.</Text>

      {keyPoints.length ? (
        <View style={styles.keyPoints} accessibilityLabel="Key points">
          <Text style={styles.heading}>Key points</Text>
          {keyPoints.map((point, i) => (
            <Card key={i} style={[styles.point, i >= shown && styles.pointHidden]}>
              <Text style={styles.pointText}>
                {i + 1}. {i < shown ? point : 'Keep watching to reveal this point.'}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
    marginTop: space.md,
  },
  player: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: space.md,
    backgroundColor: colors.ink900,
  },
  caption: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.ink600,
    marginTop: space.sm,
  },
  keyPoints: { gap: space.sm, marginTop: space.lg },
  heading: {
    fontFamily: fonts.heavy,
    fontSize: type.label.size,
    letterSpacing: type.label.tracking,
    textTransform: 'uppercase',
    color: colors.ink600,
  },
  point: { padding: space.md },
  pointHidden: { backgroundColor: colors.bg, borderStyle: 'dashed' },
  pointText: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  offlineCard: { gap: space.sm, marginTop: space.lg },
  offlineTitle: { fontFamily: fonts.black, fontSize: type.h3.size, color: colors.ink900 },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
  },
});
