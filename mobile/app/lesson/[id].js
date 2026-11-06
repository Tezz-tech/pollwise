import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import ProgressBar from '../../src/components/ProgressBar.js';
import Skeleton from '../../src/components/Skeleton.js';
import LessonComplete from '../../src/components/lessons/LessonComplete.js';
import TextLesson from '../../src/components/lessons/TextLesson.js';
import VideoLesson from '../../src/components/lessons/VideoLesson.js';
import DocumentLesson from '../../src/components/lessons/DocumentLesson.js';
import PracticeLesson from '../../src/components/lessons/PracticeLesson.js';
import { api, offlineQueue } from '../../src/api/client.js';
import { queryKeys } from '../../src/api/queries.js';
import { useCelebrations } from '../../src/stores/celebrationStore.js';
import { useConnection } from '../../src/stores/connectionStore.js';
import { toast } from '../../src/lib/toast.js';
import { xpFrom } from '../../src/lib/lessonRules.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, size } = theme;

/**
 * The lesson player (DESIGN §6.7). It loads the lesson, shows the top bar, and hands the body to the component for its
 * type. Completing a lesson is one request; if the phone is offline, the completion is queued and the learner is told.
 */
export default function LessonPlayer() {
  const { id } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const setPaused = useCelebrations((s) => s.setPaused);
  const lesson = useQuery({
    queryKey: queryKeys.lesson(id),
    queryFn: () => api.request(`/lessons/${id}`),
    enabled: Boolean(id),
  });
  const [done, setDone] = useState(null);
  const [videoXp, setVideoXp] = useState(0);
  const [videoCompleted, setVideoCompleted] = useState(null);

  // Pop-ups wait until the learner leaves the lesson (DESIGN §5: never on top of a question).
  useEffect(() => {
    setPaused(true);
    return () => setPaused(false);
  }, [setPaused]);

  const finishLeaving = () => router.replace('/learn');

  const confirmLeave = () => {
    Alert.alert('Leave this lesson?', 'Your progress is saved.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: finishLeaving },
    ]);
  };

  /** Complete a lesson that the app finishes itself (text, document, practice). */
  const completeLesson = async () => {
    try {
      const result = await api.request(`/lessons/${id}/complete`, { method: 'POST' });
      const { inline } = useCelebrations.getState().push(result.events);
      setDone({ xp: xpFrom(inline), queued: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    } catch (err) {
      if (err?.isNetwork) {
        await offlineQueue.enqueue({
          key: `complete:${id}`,
          kind: 'complete',
          path: `/lessons/${id}/complete`,
          method: 'POST',
        });
        useConnection.getState().setQueued((await offlineQueue.list()).length);
        setDone({ xp: 0, queued: true });
      } else {
        toast.error(err.message);
      }
    }
  };

  const topBar = (value) => (
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
        footer={<LipButton label="Back to learning" tone="secondary" onPress={finishLeaving} />}
      >
        <Text style={styles.error}>{lesson.error.message}</Text>
      </Screen>
    );
  }

  const { lesson: data, progress } = lesson.data;

  if (done) {
    return (
      <LessonComplete
        title={data.title}
        xp={done.xp}
        queued={done.queued}
        onContinue={finishLeaving}
      />
    );
  }

  switch (data.type) {
    case 'text':
      return <TextLesson lesson={data} topBar={topBar} onComplete={completeLesson} />;
    case 'document':
      return <DocumentLesson lesson={data} topBar={topBar} onComplete={completeLesson} />;
    case 'practice':
      return (
        <PracticeLesson
          lesson={data}
          progress={progress}
          topBar={topBar}
          onComplete={completeLesson}
        />
      );
    case 'video':
      return (
        <VideoLesson
          lesson={data}
          progress={progress}
          completed={videoCompleted ?? progress.status === 'completed'}
          topBar={topBar}
          onCompleted={(xp) => {
            setVideoCompleted(true);
            setVideoXp(xp);
          }}
          onFinished={() => setDone({ xp: videoXp, queued: false })}
          onLeave={finishLeaving}
        />
      );
    default:
      return (
        <Screen
          padded
          footer={<LipButton label="Back to learning" tone="secondary" onPress={finishLeaving} />}
        >
          {topBar(0)}
          <Text style={styles.title}>{data.title}</Text>
          <Text style={styles.body}>This kind of lesson is not available in this version.</Text>
        </Screen>
      );
  }
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
  },
  error: { fontFamily: fonts.bold, fontSize: type.body.size, color: colors.ink900 },
});
