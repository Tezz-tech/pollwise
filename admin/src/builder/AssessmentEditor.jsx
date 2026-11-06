import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api.js';
import { REVEAL_LABELS } from '../lib/labels.js';
import { apiToDraft, draftToApi, validateDraft } from '../lib/questionDraft.js';
import { Button, Card, Field, Input, Skeleton } from '../components/ui.jsx';
import QuestionBank from './QuestionBank.jsx';

/**
 * Assessment settings and question bank for one module (SPEC §4, §5 Assessment). Saving sends the whole
 * bank; the server works out which questions changed and bumps their versions (SPEC §8.2).
 */
export default function AssessmentEditor({ courseId, moduleId, onSelectQuestion, selectedKey }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['assessment', moduleId],
    queryFn: () => api(`/admin/modules/${moduleId}/assessment`),
  });
  const [settings, setSettings] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [serverErrors, setServerErrors] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!query.data) return;
    const a = query.data;
    setSettings({
      title: a.title,
      drawCount: a.drawCount ?? '',
      passMark: a.passMark ?? '',
      maxAttempts: a.maxAttempts ?? '',
      shuffleQuestions: a.shuffleQuestions,
      shuffleOptions: a.shuffleOptions,
      revealAnswers: a.revealAnswers,
      timeLimitMin: a.timeLimitMin ?? '',
    });
    setDrafts(a.questions.map(apiToDraft));
    setDirty(false);
  }, [query.data]);

  const save = useMutation({
    mutationFn: (body) => api(`/admin/modules/${moduleId}/assessment`, { method: 'PUT', body }),
    onSuccess: () => {
      toast.success('Check saved.');
      setDirty(false);
      setServerErrors({});
      queryClient.invalidateQueries({ queryKey: ['assessment', moduleId] });
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    },
    onError: (err) => {
      const message = err instanceof ApiError ? err.message : 'The check could not be saved.';
      toast.error(message);
      if (err instanceof ApiError && err.details?.length) {
        // Server messages name the question path; show the first problem on the whole bank.
        setServerErrors({ [drafts[0]?.key ?? 'bank']: err.details[0].message });
      }
    },
  });

  if (query.isPending || !settings) return <Skeleton className="h-[320px]" />;
  if (query.isError)
    return (
      <Card>
        <p className="text-pw-body text-ink900">We could not load this check.</p>
      </Card>
    );

  const setSetting = (key, value) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  };
  const setDraftList = (next) => {
    setDrafts(next);
    setDirty(true);
  };

  const submit = () => {
    const bad = drafts.filter((d) => Object.keys(validateDraft(d)).length > 0);
    if (bad.length) {
      toast.error(
        `${bad.length} question${bad.length === 1 ? '' : 's'} still need attention. Fix them before saving.`
      );
      return;
    }
    const num = (v) => (v === '' || v === null ? null : Number(v));
    save.mutate({
      title: settings.title,
      drawCount: num(settings.drawCount),
      passMark: num(settings.passMark),
      maxAttempts: num(settings.maxAttempts),
      timeLimitMin: num(settings.timeLimitMin),
      shuffleQuestions: settings.shuffleQuestions,
      shuffleOptions: settings.shuffleOptions,
      revealAnswers: settings.revealAnswers,
      questions: drafts.map(draftToApi),
    });
  };

  return (
    <div className="flex flex-col gap-2xl">
      <Card className="flex flex-col gap-lg">
        <h3 className="text-pw-h3 font-[800] text-ink900">Check settings</h3>
        <div className="grid gap-lg sm:grid-cols-2">
          <Field label="Title" htmlFor="check-title">
            <Input
              id="check-title"
              value={settings.title}
              onChange={(e) => setSetting('title', e.target.value)}
            />
          </Field>
          <Field
            label="Questions drawn per attempt"
            htmlFor="draw"
            hint="Leave empty to use every question."
          >
            <Input
              id="draw"
              type="number"
              min={1}
              value={settings.drawCount}
              onChange={(e) => setSetting('drawCount', e.target.value)}
            />
          </Field>
          <Field
            label="Pass mark (%)"
            htmlFor="pass"
            hint="Leave empty to use the platform default of 70."
          >
            <Input
              id="pass"
              type="number"
              min={1}
              max={100}
              value={settings.passMark}
              onChange={(e) => setSetting('passMark', e.target.value)}
            />
          </Field>
          <Field label="Attempts allowed" htmlFor="attempts" hint="Leave empty for unlimited.">
            <Input
              id="attempts"
              type="number"
              min={1}
              value={settings.maxAttempts}
              onChange={(e) => setSetting('maxAttempts', e.target.value)}
            />
          </Field>
          <Field label="Time limit (minutes)" htmlFor="time" hint="Leave empty for untimed.">
            <Input
              id="time"
              type="number"
              min={1}
              max={240}
              value={settings.timeLimitMin}
              onChange={(e) => setSetting('timeLimitMin', e.target.value)}
            />
          </Field>
          <Field label="Show answers" htmlFor="reveal">
            <select
              id="reveal"
              className="h-11 w-full rounded-md border border-line bg-surface px-md text-pw-body text-ink900"
              value={settings.revealAnswers}
              onChange={(e) => setSetting('revealAnswers', e.target.value)}
            >
              {Object.entries(REVEAL_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-lg">
          <label className="flex items-center gap-sm text-pw-body text-ink900">
            <input
              type="checkbox"
              className="h-5 w-5 accent-jade600"
              checked={settings.shuffleQuestions}
              onChange={(e) => setSetting('shuffleQuestions', e.target.checked)}
            />{' '}
            Shuffle question order
          </label>
          <label className="flex items-center gap-sm text-pw-body text-ink900">
            <input
              type="checkbox"
              className="h-5 w-5 accent-jade600"
              checked={settings.shuffleOptions}
              onChange={(e) => setSetting('shuffleOptions', e.target.checked)}
            />{' '}
            Shuffle options
          </label>
        </div>
      </Card>

      <section className="flex flex-col gap-md">
        <div className="flex items-center justify-between gap-md">
          <h3 className="text-pw-h3 font-[800] text-ink900">
            Question bank <span className="text-ink600">({drafts.length})</span>
          </h3>
          <Button onClick={submit} disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : dirty ? 'Save check' : 'Saved'}
          </Button>
        </div>
        <QuestionBank
          drafts={drafts}
          onChange={setDraftList}
          serverErrors={serverErrors}
          onSelect={onSelectQuestion}
          selectedKey={selectedKey}
        />
      </section>
    </div>
  );
}
