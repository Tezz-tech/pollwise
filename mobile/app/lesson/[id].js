import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import ProgressBar from '../../src/components/ProgressBar.js';
import Tally from '../../src/components/Tally.js';
import CountUp from '../../src/components/CountUp.js';
import Skeleton from '../../src/components/Skeleton.js';
import Card from '../../src/components/Card.js';
import { api, offlineQueue } from '../../src/api/client.js';
import { useCelebrations } from '../../src/stores/celebrationStore.js';
import { toast } from '../../src/lib/toast.js';
import { toCards } from '../../src/lib/richText.js';
import { textMinimumSeconds, xpFrom } from '../../src/lib/lessonRules.js';
import { COPY, pickCopy } from '@pollwise/shared/copy';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, radius, size } = theme;

/**
 * The lesson player (DESIGN §6.7). This version covers text lessons, which is the path a new learner's first lesson
 * usually takes. Video, document and practice lessons arrive in the next part of the build.
 */
export default function LessonPlayer() {
  const { id } = useLocalSearchParams();
  const setPaused = useCelebrations((s) => s.setPaused);
  const lesson = useQuery({
    queryKey: ['lesson', id],
    queryFn: () => api.request(`/lessons/${id}`),
    enabled: Boolean(id),
  });
  const [done, setDone] = useState(null);

  // Pop-ups wait until the learner leaves the lesson (DESIGN §5: never on top of a question).
  useEffect(() => {
    setPaused(true);
    return () => setPaused(false);
  }, [setPaused]);

  const confirmLeave = () => {
    Alert.alert('Leave this lesson?', 'Your progress is saved.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.replace('/learn') },
    ]);
  };

  const complete = async () => {
    try {
      const result = await api.request(`/lessons/${id}/complete`, { method: 'POST' });
      const { inline } = useCelebrations.getState().push(result.events);
      setDone({ xp: xpFrom(inline), queued: false });
    } catch (err) {
      if (err?.isNetwork) {
        await offlineQueue.enqueue({
          key: `complete:${id}`,
          kind: 'complete',
          path: `/lessons/${id}/complete`,
          method: 'POST',
        });
        setDone({ xp: 0, queued: true });
      } else {
        toast.error(err.message);
      }
    }
  };

  if (lesson.isPending) {
    return (
      <Screen padded>
        <Skeleton height={28} width="60%" />
        <Skeleton height={180} style={{ marginTop: space.lg }} />
      </Screen>
    );
  }
  if (lesson.isError) {
    return (
      <Screen
        padded
        footer={
          <LipButton
            label="Back to learning"
            tone="secondary"
            onPress={() => router.replace('/learn')}
          />
        }
      >
        <Text style={styles.error}>{lesson.error.message}</Text>
      </Screen>
    );
  }

  const data = lesson.data.lesson;
  const progressBar = (value) => (
    <View style={styles.topBar}>
      <Pressable
        onPress={confirmLeave}
        accessibilityRole="button"
        accessibilityLabel="Close lesson"
        hitSlop={12}
        style={styles.close}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.progress}>
        <ProgressBar
          progress={value}
          shineKey={done ? 1 : 0}
          accessibilityLabel="Lesson progress"
        />
      </View>
    </View>
  );

  if (done) {
    return <Completion lessonTitle={data.title} xp={done.xp} queued={done.queued} />;
  }

  if (data.type !== 'text') {
    return (
      <Screen
        padded
        footer={
          <LipButton
            label="Back to learning"
            tone="secondary"
            onPress={() => router.replace('/learn')}
          />
        }
      >
        {progressBar(0)}
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.body}>This kind of lesson opens in the next part of the build.</Text>
      </Screen>
    );
  }

  return <TextLesson lesson={data} progressBar={progressBar} onComplete={complete} />;
}

/**
 * Text lesson: cards you swipe through. The last card's button stays disabled until the server's minimum reading time
 * has passed on this device (the server still checks, SECURITY §3).
 */
function TextLesson({ lesson, progressBar, onComplete }) {
  const { width } = useWindowDimensions();
  const cards = useMemo(() => toCards(lesson.text?.doc), [lesson.text?.doc]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const minimum = textMinimumSeconds(lesson.text?.readMinutes);
  // Start the clock once, when the lesson opens: refetches must not restart the reading time.
  const [openedAt] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(minimum);
  const list = useRef(null);
  const last = index === cards.length - 1;

  useEffect(() => {
    const tick = () =>
      setSecondsLeft(Math.max(0, minimum - Math.floor((Date.now() - openedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [minimum, openedAt]);

  const goTo = (next) => {
    list.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const finish = async () => {
    setBusy(true);
    await onComplete();
    setBusy(false);
  };

  const footer = last ? (
    <LipButton
      label={
        secondsLeft > 0 ? `Keep reading · ${secondsLeft}s` : busy ? 'Saving…' : 'Complete lesson'
      }
      onPress={finish}
      disabled={secondsLeft > 0 || busy}
      testID="lesson-complete"
    />
  ) : (
    <LipButton label="Continue" onPress={() => goTo(index + 1)} testID="lesson-continue" />
  );

  return (
    <Screen padded footer={footer}>
      {progressBar((index + 1) / Math.max(cards.length, 1))}
      <Text style={styles.lessonTitle}>{lesson.title}</Text>
      <FlatList
        ref={list}
        data={cards}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        keyExtractor={(_, i) => String(i)}
        getItemLayout={(_, i) => ({
          length: width - space['2xl'] * 2,
          offset: (width - space['2xl'] * 2) * i,
          index: i,
        })}
        renderItem={({ item }) => (
          <View style={[styles.cardPage, { width: width - space['2xl'] * 2 }]}>
            <Card style={styles.cardBody}>
              {item.map((block, i) => (
                <BlockView key={i} block={block} />
              ))}
            </Card>
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        style={styles.pager}
      />
      <Text style={styles.pageCount}>
        {index + 1} of {cards.length}
      </Text>
    </Screen>
  );
}

function BlockView({ block }) {
  if (block.kind === 'heading') {
    return (
      <Text accessibilityRole="header" style={block.level === 2 ? styles.h2 : styles.h3}>
        {block.runs.map(RunText)}
      </Text>
    );
  }
  if (block.kind === 'callout') {
    return (
      <View style={styles.callout}>
        <Text style={styles.calloutText}>{block.runs.map(RunText)}</Text>
      </View>
    );
  }
  if (block.kind === 'list') {
    return (
      <View style={styles.list}>
        {block.items.map((runs, i) => (
          <Text key={i} style={styles.paragraph}>
            {block.ordered ? `${i + 1}. ` : '•  '}
            {runs.map(RunText)}
          </Text>
        ))}
      </View>
    );
  }
  return <Text style={styles.paragraph}>{block.runs.map(RunText)}</Text>;
}

/** A styled run. Text is always rendered as text, never as markup. */
function RunText(run, i) {
  return (
    <Text key={i} style={[run.bold && styles.bold, run.italic && styles.italic]}>
      {run.text}
    </Text>
  );
}

/** Lesson complete (DESIGN §6.7, §5): Tally cheers, XP counts up, one button back to the path. */
function Completion({ lessonTitle, xp, queued }) {
  const pop = useSharedValue(0);
  useEffect(() => {
    pop.value = withSpring(1);
  }, [pop]);
  const style = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.9 + pop.value * 0.1 }],
  }));
  return (
    <Screen
      padded
      footer={
        <LipButton
          label="Continue"
          onPress={() => router.replace('/learn')}
          testID="lesson-done-continue"
        />
      }
    >
      <Animated.View style={[styles.completion, style]}>
        <Tally mood="cheer" size={180} accessibilityLabel="Tally cheering" />
        <Text accessibilityRole="header" style={styles.completeTitle}>
          {pickCopy(COPY.lessonComplete, 0)}
        </Text>
        <Text style={styles.body}>{lessonTitle}</Text>
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
  topBar: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.sm },
  close: {
    minWidth: size.touch,
    minHeight: size.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontFamily: fonts.black, fontSize: type.h1.size, color: colors.ink600 },
  progress: { flex: 1 },
  lessonTitle: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.ink600,
    marginTop: space.lg,
    marginBottom: space.md,
  },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    lineHeight: type.h1.line,
    color: colors.ink900,
    marginTop: space.lg,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    textAlign: 'center',
  },
  error: { fontFamily: fonts.bold, fontSize: type.body.size, color: colors.ink900 },
  pager: { flexGrow: 0 },
  cardPage: { paddingRight: space.md },
  cardBody: { minHeight: 300, gap: space.md },
  h2: {
    fontFamily: fonts.black,
    fontSize: type.h2.size,
    lineHeight: type.h2.line,
    color: colors.ink900,
  },
  h3: {
    fontFamily: fonts.heavy,
    fontSize: type.h3.size,
    lineHeight: type.h3.line,
    color: colors.ink900,
  },
  paragraph: {
    fontFamily: fonts.regular,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  bold: { fontFamily: fonts.heavy },
  italic: { fontStyle: 'italic' },
  list: { gap: space.xs },
  callout: {
    backgroundColor: colors.sky100,
    borderRadius: radius.md,
    padding: space.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.sky600,
  },
  calloutText: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink900,
  },
  pageCount: {
    fontFamily: fonts.bold,
    fontSize: type.small.size,
    color: colors.ink600,
    textAlign: 'center',
    marginTop: space.md,
  },
  completion: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  completeTitle: {
    fontFamily: fonts.black,
    fontSize: type.display.size,
    lineHeight: type.display.line,
    color: colors.ink900,
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  plus: { fontFamily: fonts.black, fontSize: 40, color: colors.amber700 },
});
