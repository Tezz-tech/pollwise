import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Screen from '../../src/components/Screen.js';
import LipButton from '../../src/components/LipButton.js';
import ProgressBar from '../../src/components/ProgressBar.js';
import QuestionView from '../../src/components/questions/QuestionView.js';
import FeedbackSheet from '../../src/components/questions/FeedbackSheet.js';
import ComboChip from '../../src/components/questions/ComboChip.js';
import AssessmentIntro from '../../src/components/assessment/AssessmentIntro.js';
import PassResults from '../../src/components/assessment/PassResults.js';
import NotYetResults from '../../src/components/assessment/NotYetResults.js';
import { api } from '../../src/api/client.js';
import { queryKeys } from '../../src/api/queries.js';
import { useCelebrations } from '../../src/stores/celebrationStore.js';
import { useToasts } from '../../src/stores/toastStore.js';
import { useCountdown } from '../../src/hooks/useCountdown.js';
import { ApiError } from '../../src/lib/api.js';
import { correctAnswerText, firstUnanswered, responseFor } from '../../src/lib/practice.js';
import {
  missedPrompts,
  scorePercent,
  xpBreakdown,
  formatCountdown,
} from '../../src/lib/assessment.js';
import { theme } from '../../src/theme/theme.js';

const { colors, fonts, type, space, size } = theme;

/**
 * A module check (SPEC §8.2, DESIGN §6.8): intro, one question at a time with feedback, the timer if the check has one,
 * then the result. The server grades every answer and decides the pass. An attempt in progress is resumed, never
 * restarted, and the timer's end is the server's, so closing the app cannot buy time.
 */
export default function AssessmentRoute() {
  const { id, title, passMark: passMarkParam } = useLocalSearchParams();
  const queryClient = useQueryClient();
  const setPaused = useCelebrations((s) => s.setPaused);
  const [phase, setPhase] = useState('intro');
  const [attempt, setAttempt] = useState(null);
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [streak, setStreak] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [resuming, setResuming] = useState(false);
  const countdown = useCountdown(phase === 'question' ? attempt?.expiresAt : null);
  const passMark = Number(passMarkParam) || attempt?.passMark || 70;
  const questions = useMemo(() => attempt?.questions ?? [], [attempt]);
  const question = questions[index];
  const allAnswered = questions.length > 0 && index >= questions.length;

  // Pop-ups wait until the learner leaves the check (DESIGN §5: never on top of a question).
  useEffect(() => {
    setPaused(true);
    return () => setPaused(false);
  }, [setPaused]);

  /** Start a new attempt, or pick up the one in progress (the server returns whichever applies). */
  const start = async () => {
    setBusy(true);
    try {
      const result = await api.request(`/assessments/${id}/attempts`, { method: 'POST' });
      const a = result.attempt;
      setAttempt(a);
      setValues(initialValues(a.questions));
      setIndex(Math.max(0, firstUnanswered(a.questions, a.answeredQuestionIds)));
      setResuming(a.answeredQuestionIds.length > 0);
      setFeedback(null);
      setStreak(0);
      setOutcome(null);
      setPhase('question');
    } catch (err) {
      useToasts
        .getState()
        .show(err instanceof ApiError ? err.message : 'The check could not be opened.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    setFeedback(null);
    setIndex((i) => i + 1);
  };

  const submit = useCallback(async () => {
    if (!attempt) return;
    setBusy(true);
    try {
      const result = await api.request(`/attempts/${attempt.id}/submit`, { method: 'POST' });
      useCelebrations.getState().push(result.events);
      setOutcome({ result: result.result, events: result.events });
      setPhase('results');
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      queryClient.invalidateQueries({ queryKey: ['course'] });
    } catch (err) {
      if (err?.isNetwork) {
        useToasts.getState().show('Connect to finish the check. Your answers are saved.', 'info');
      } else {
        useToasts.getState().show(err.message, 'warn');
      }
    } finally {
      setBusy(false);
    }
  }, [attempt, queryClient]);

  // The timer ran out: the server settles the attempt on submit, recording what was answered.
  useEffect(() => {
    if (phase === 'question' && countdown.expired && attempt) {
      useToasts.getState().show('Time is up. Your answers were saved.', 'info');
      submit();
    }
  }, [phase, countdown.expired, attempt, submit]);

  const check = async () => {
    const response = responseFor(question.type, values[question.id]);
    if (!response || busy) return;
    setBusy(true);
    try {
      const result = await api.request(`/attempts/${attempt.id}/answers`, {
        method: 'POST',
        body: { questionId: question.id, response },
      });
      if (result.correct === true) setStreak((s) => s + 1);
      if (result.correct === false) {
        setStreak(0);
        setShakeKey((k) => k + 1);
      }
      setAttempt((a) => ({ ...a, answeredQuestionIds: [...a.answeredQuestionIds, question.id] }));
      if (result.correct === null) {
        advance();
        return;
      }
      setFeedback({
        result: { ...result, correctAnswerText: correctAnswerText(question, result.correctAnswer) },
        index,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ANSWERED') {
        advance();
      } else if (err instanceof ApiError && err.code === 'ATTEMPT_EXPIRED') {
        useToasts.getState().show('Time is up. Your answers were saved.', 'info');
        submit();
      } else if (err?.isNetwork) {
        useToasts.getState().show('Connect to check this answer. It is not lost.', 'info');
      } else {
        useToasts.getState().show(err.message, 'warn');
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmLeave = () => {
    if (phase !== 'question') {
      router.replace('/learn');
      return;
    }
    Alert.alert(
      'Leave this check?',
      'Your answers are saved. The timer keeps running while you are away.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.replace('/learn') },
      ]
    );
  };

  const topBar = (value) => (
    <View style={styles.topBar}>
      <Pressable
        onPress={confirmLeave}
        accessibilityRole="button"
        accessibilityLabel="Close check"
        hitSlop={12}
        style={styles.close}
      >
        <Text style={styles.closeText}>×</Text>
      </Pressable>
      <View style={styles.progress}>
        <ProgressBar progress={value} shineKey={index} accessibilityLabel="Check progress" />
      </View>
      {countdown.ms !== null ? (
        <Text
          style={[styles.timer, countdown.ms < 60_000 && styles.timerLow]}
          accessibilityLabel={`Time left ${formatCountdown(countdown.ms)}`}
        >
          {formatCountdown(countdown.ms)}
        </Text>
      ) : null}
    </View>
  );

  if (phase === 'intro') {
    return (
      <AssessmentIntro
        title={typeof title === 'string' ? title : 'Module check'}
        passMark={passMark}
        busy={busy}
        resuming={resuming}
        onStart={start}
        onBack={() => router.replace('/learn')}
      />
    );
  }

  if (phase === 'results' && outcome) {
    const { result, events } = outcome;
    const score = scorePercent(result.score);
    if (result.passed) {
      return (
        <PassResults
          score={score}
          passMark={result.passMark ?? passMark}
          rows={xpBreakdown(events)}
          onContinue={() => router.replace('/learn')}
        />
      );
    }
    return (
      <NotYetResults
        score={score}
        passMark={result.passMark ?? passMark}
        missed={missedPrompts(result.review, questions)}
        busy={busy}
        onTryAgain={start}
        onReview={() => router.replace('/learn')}
      />
    );
  }

  if (!attempt || !question) {
    if (attempt && allAnswered) {
      return (
        <Screen
          padded
          footer={
            <LipButton
              label={busy ? 'Submitting…' : 'Submit check'}
              onPress={submit}
              disabled={busy}
              testID="assessment-submit"
            />
          }
        >
          {topBar(1)}
          <Text style={styles.title}>All questions answered.</Text>
          <Text style={styles.body}>
            Submit to see your result. You cannot change answers after this.
          </Text>
        </Screen>
      );
    }
    return <Screen padded>{topBar(0)}</Screen>;
  }

  const canCheck = responseFor(question.type, values[question.id]) !== null && !busy;
  const last = index === questions.length - 1;
  return (
    <Screen
      scroll
      footer={
        feedback ? null : (
          <LipButton
            label={busy ? 'Checking…' : 'Check'}
            onPress={check}
            disabled={!canCheck}
            testID="assessment-check"
          />
        )
      }
    >
      {topBar(index / questions.length)}
      <View style={styles.combo}>
        <ComboChip streak={streak} />
      </View>
      <QuestionView
        question={question}
        value={values[question.id]}
        onChange={(v) => setValues((all) => ({ ...all, [question.id]: v }))}
        disabled={busy || feedback !== null}
        shakeKey={shakeKey}
        reveal={feedback ? feedback.result : null}
      />
      {feedback ? (
        <FeedbackSheet
          result={feedback.result}
          index={feedback.index}
          onContinue={() => (last ? setIndex(questions.length) : advance())}
          continueLabel={last ? 'Finish' : 'Continue'}
        />
      ) : null}
    </Screen>
  );
}

/** Ordering questions start in the server's order, and fill-in questions start blank (see PracticeLesson). */
function initialValues(questions) {
  const values = {};
  for (const q of questions) {
    if (q.type === 'ordering') values[q.id] = q.items.map((i) => i.id);
    if (q.type === 'fill_blank') values[q.id] = Array.from({ length: q.blankCount }, () => '');
  }
  return values;
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
  timer: { fontFamily: fonts.black, fontSize: type.small.size, color: colors.ink900 },
  timerLow: { color: colors.coral700 },
  combo: { marginTop: space.sm },
  title: {
    fontFamily: fonts.black,
    fontSize: type.h1.size,
    color: colors.ink900,
    marginTop: space.lg,
  },
  body: {
    fontFamily: fonts.bold,
    fontSize: type.body.size,
    lineHeight: type.body.line,
    color: colors.ink600,
    marginTop: space.md,
  },
});
