import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Screen from '../Screen.js';
import LipButton from '../LipButton.js';
import QuestionView from '../questions/QuestionView.js';
import FeedbackSheet from '../questions/FeedbackSheet.js';
import ComboChip from '../questions/ComboChip.js';
import { api, offlineQueue } from '../../api/client.js';
import { useConnection } from '../../stores/connectionStore.js';
import { useToasts } from '../../stores/toastStore.js';
import { ApiError } from '../../lib/api.js';
import { correctAnswerText, firstUnanswered, responseFor } from '../../lib/practice.js';
import { theme } from '../../theme/theme.js';

const { space } = theme;

/**
 * Practice (DESIGN §6.7): the question flow, ungraded for the learner's score. Each answer is checked by the server, then
 * the feedback sheet shows. Resuming starts at the first unanswered question. An answer that cannot be sent is queued
 * and the learner moves on: the server checks it when the connection returns.
 * @param {{
 *   lesson: { id: string, questions: object[] },
 *   progress: { answeredQuestionIds: string[] },
 *   onComplete: () => Promise<void>,
 *   topBar: (progress: number) => import('react').ReactNode,
 * }} props
 */
export default function PracticeLesson({ lesson, progress, onComplete, topBar }) {
  const questions = lesson.questions ?? [];
  const answered = progress.answeredQuestionIds ?? [];
  const [index, setIndex] = useState(() => Math.max(0, firstUnanswered(questions, answered)));
  const [values, setValues] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const [doneCount, setDoneCount] = useState(answered.length);
  const finished = index >= questions.length;
  const question = questions[index];
  const value = question ? values[question.id] : undefined;

  // Start ordering and fill-in questions from something the learner can change.
  useEffect(() => {
    if (!question) return;
    if (question.type === 'ordering' && values[question.id] === undefined) {
      setValues((v) => ({ ...v, [question.id]: question.items.map((i) => i.id) }));
    }
    if (question.type === 'fill_blank' && values[question.id] === undefined) {
      setValues((v) => ({
        ...v,
        [question.id]: Array.from({ length: question.blankCount }, () => ''),
      }));
    }
  }, [question, values]);

  const next = () => {
    setFeedback(null);
    setIndex((i) => i + 1);
  };

  const check = async () => {
    const response = responseFor(question.type, value);
    if (!response || busy) return;
    setBusy(true);
    const path = `/lessons/${lesson.id}/practice/answer`;
    try {
      const result = await api.request(path, {
        method: 'POST',
        body: { questionId: question.id, response },
      });
      setDoneCount((c) => c + 1);
      if (result.correct === true) setStreak((s) => s + 1);
      if (result.correct === false) {
        setStreak(0);
        setShakeKey((k) => k + 1);
      }
      if (result.correct === null) {
        // Reflections are not marked: saved, then on to the next one.
        next();
        return;
      }
      setFeedback({
        result: { ...result, correctAnswerText: correctAnswerText(question, result.correctAnswer) },
        index: doneCount,
      });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ALREADY_ANSWERED') {
        setDoneCount((c) => c + 1);
        next();
      } else if (err?.isNetwork) {
        await offlineQueue.enqueue({
          key: `answer:${question.id}`,
          kind: 'other',
          path,
          method: 'POST',
          body: { questionId: question.id, response },
        });
        useConnection.getState().setQueued((await offlineQueue.list()).length);
        useToasts.getState().show("Saved. We'll check this when you're back online.", 'info');
        setDoneCount((c) => c + 1);
        next();
      } else {
        useToasts.getState().show(err.message, 'warn');
      }
    } finally {
      setBusy(false);
    }
  };

  const total = questions.length || 1;
  const topProgress = Math.min(1, doneCount / total);

  if (finished || questions.length === 0) {
    return (
      <Screen
        padded
        footer={
          <LipButton
            label="Finish practice"
            onPress={() => onComplete()}
            testID="practice-finish"
          />
        }
      >
        {topBar(1)}
      </Screen>
    );
  }

  const canCheck = responseFor(question.type, value) !== null && !busy;
  return (
    <Screen
      scroll
      footer={
        feedback ? null : (
          <LipButton
            label={busy ? 'Checking…' : 'Check'}
            onPress={check}
            disabled={!canCheck}
            testID="practice-check"
          />
        )
      }
    >
      {topBar(topProgress)}
      <View style={{ marginTop: space.sm }}>
        <ComboChip streak={streak} />
      </View>
      <QuestionView
        question={question}
        value={value}
        onChange={(v) => setValues((all) => ({ ...all, [question.id]: v }))}
        disabled={busy || feedback !== null}
        shakeKey={shakeKey}
        reveal={feedback ? feedback.result : null}
      />
      {feedback ? (
        <FeedbackSheet
          result={feedback.result}
          index={feedback.index}
          onContinue={next}
          continueLabel={index + 1 >= questions.length ? 'Finish' : 'Continue'}
        />
      ) : null}
    </Screen>
  );
}
