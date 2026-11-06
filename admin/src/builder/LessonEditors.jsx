import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api.js';
import { readVideoDuration } from '../lib/youtube.js';
import { uploadAndConfirm } from '../lib/uploads.js';
import { Button, Card, Field, Input, Skeleton } from '../components/ui.jsx';
import RichTextEditor from './RichTextEditor.jsx';
import QuestionBank from './QuestionBank.jsx';
import { apiToDraft, draftToApi, validateDraft } from '../lib/questionDraft.js';

/** Shared save for a lesson: PATCH the lesson and refresh the course tree. */
function useSaveLesson(courseId, moduleId, lessonId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      api(`/admin/modules/${moduleId}/lessons/${lessonId}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Lesson saved.');
      queryClient.invalidateQueries({ queryKey: ['course', courseId] });
      queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'The lesson could not be saved.'),
  });
}

/** Loads one lesson in full (with answer keys, for the admin). */
export function useLessonQuery(moduleId, lessonId) {
  return useQuery({
    queryKey: ['lesson', lessonId],
    queryFn: () => api(`/admin/modules/${moduleId}/lessons/${lessonId}`),
  });
}

/** Video: the link and title, key points, and a length read from YouTube (SPEC §7). */
export function VideoLessonEditor({ courseId, moduleId, lesson }) {
  const save = useSaveLesson(courseId, moduleId, lesson.id);
  const [title, setTitle] = useState(lesson.title);
  const [points, setPoints] = useState((lesson.video?.keyPoints ?? []).join('\n'));
  const [duration, setDuration] = useState(lesson.video?.durationSec ?? null);
  const [lengthNote, setLengthNote] = useState('');

  useEffect(() => {
    if (duration || !lesson.video?.youtubeId) return;
    let cancelled = false;
    setLengthNote('Reading the length from YouTube…');
    readVideoDuration(lesson.video.youtubeId)
      .then((seconds) => {
        if (cancelled) return;
        setDuration(seconds);
        setLengthNote('');
        save.mutate({ title: lesson.title, video: { ...videoBody(lesson), durationSec: seconds } });
      })
      .catch((err) => !cancelled && setLengthNote(err.message));
    return () => {
      cancelled = true;
    };
    // The length is read once, when the lesson has none yet.
  }, [lesson.id]);

  const submit = () =>
    save.mutate({
      title,
      video: {
        ...videoBody(lesson),
        keyPoints: points
          .split('\n')
          .map((p) => p.trim())
          .filter(Boolean)
          .slice(0, 10),
        durationSec: duration,
      },
    });

  return (
    <div className="flex flex-col gap-lg">
      <Card className="grid gap-lg md:grid-cols-[260px_1fr]">
        <div className="aspect-video overflow-hidden rounded-md bg-ink900">
          {lesson.video?.thumbnailUrl && (
            <img
              src={lesson.video.thumbnailUrl}
              alt="Video thumbnail"
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="flex flex-col gap-md">
          <Field label="Title" htmlFor="video-title">
            <Input id="video-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <p className="text-pw-small text-ink600">Video ID {lesson.video?.youtubeId}</p>
          <p className="rounded-md bg-amber100 p-md text-pw-small text-ink900">
            Make sure this video is set to <strong>Unlisted</strong> on YouTube, not Private.
            Private videos will not play in the app.
          </p>
          <p className="text-pw-small font-[700] text-ink900" role="status">
            {duration
              ? `Length: ${Math.floor(duration / 60)} min ${String(duration % 60).padStart(2, '0')} s`
              : lengthNote || 'Length not read yet.'}
          </p>
        </div>
      </Card>
      <Field
        label="Key points (one per line, up to 10)"
        htmlFor="video-points"
        hint="These reveal one by one as the video plays."
      >
        <textarea
          id="video-points"
          rows={5}
          className="w-full rounded-md border border-line bg-surface p-md text-pw-body text-ink900"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />
      </Field>
      <div>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save lesson'}
        </Button>
      </div>
    </div>
  );
}

function videoBody(lesson) {
  return {
    youtubeId: lesson.video.youtubeId,
    title: lesson.video.title,
    durationSec: lesson.video.durationSec,
    keyPoints: lesson.video.keyPoints ?? [],
  };
}

/** Text lesson: title, read time and the formatted body, saved to the allowlist. */
export function TextLessonEditor({ courseId, moduleId, lesson }) {
  const save = useSaveLesson(courseId, moduleId, lesson.id);
  const [title, setTitle] = useState(lesson.title);
  const [minutes, setMinutes] = useState(lesson.text?.readMinutes ?? 1);
  const [doc, setDoc] = useState(lesson.text?.doc);
  return (
    <div className="flex flex-col gap-lg">
      <Field label="Title" htmlFor="text-title">
        <Input id="text-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <RichTextEditor value={doc} onChange={setDoc} label="Lesson text" />
      <Field
        label="Reading time (minutes)"
        htmlFor="read-min"
        hint="Learners must spend at least 20 seconds per minute here before they can finish."
      >
        <Input
          id="read-min"
          type="number"
          min={1}
          max={120}
          className="w-32"
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        />
      </Field>
      <div>
        <Button
          onClick={() => save.mutate({ title, text: { doc, readMinutes: minutes } })}
          disabled={save.isPending}
        >
          {save.isPending ? 'Saving…' : 'Save lesson'}
        </Button>
      </div>
    </div>
  );
}

/** Document: a PDF uploaded through the signed flow. Replacing it re-runs the same checks. */
export function DocumentLessonEditor({ courseId, moduleId, lesson }) {
  const save = useSaveLesson(courseId, moduleId, lesson.id);
  const [title, setTitle] = useState(lesson.title);
  const [uploading, setUploading] = useState(false);
  const onFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadAndConfirm({ courseId, kind: 'pdf', file });
      save.mutate({
        title,
        document: {
          url: asset.url,
          publicId: asset.publicId,
          fileName: file.name,
          bytes: asset.bytes,
          pages: asset.pages,
        },
      });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="flex flex-col gap-lg">
      <Field label="Title" htmlFor="doc-title">
        <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Card className="flex flex-col gap-sm">
        <p className="text-pw-body text-ink900">Current file: {lesson.document?.fileName}</p>
        <p className="text-pw-small text-ink600">
          {lesson.document?.pages ? `${lesson.document.pages} pages · ` : ''}
          {Math.round((lesson.document?.bytes ?? 0) / 1024)} KB
        </p>
        <label className="mt-sm inline-flex w-fit cursor-pointer items-center rounded-md border-b-4 border-line bg-surface px-lg py-md text-pw-label font-[800] uppercase text-ink900 hover:bg-bg">
          {uploading ? 'Uploading…' : 'Replace PDF'}
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
      </Card>
      <div>
        <Button
          onClick={() => save.mutate({ title, document: documentBody(lesson) })}
          disabled={save.isPending}
        >
          Save lesson
        </Button>
      </div>
    </div>
  );
}

function documentBody(lesson) {
  return {
    url: lesson.document.url,
    publicId: lesson.document.publicId,
    fileName: lesson.document.fileName,
    bytes: lesson.document.bytes,
    pages: lesson.document.pages ?? null,
  };
}

/** Practice: ungraded questions with immediate feedback for the learner (SPEC §6.7). */
export function PracticeLessonEditor({
  courseId,
  moduleId,
  lesson,
  onSelectQuestion,
  selectedKey,
}) {
  const save = useSaveLesson(courseId, moduleId, lesson.id);
  const [title, setTitle] = useState(lesson.title);
  const [drafts, setDrafts] = useState(() => (lesson.practice?.questions ?? []).map(apiToDraft));
  const [serverErrors, setServerErrors] = useState({});
  const submit = () => {
    const bad = drafts.filter((d) => Object.keys(validateDraft(d)).length > 0);
    if (bad.length) {
      toast.error(`${bad.length} question(s) still need attention.`);
      return;
    }
    save.mutate(
      { title, practice: { questions: drafts.map(draftToApi) } },
      {
        onError: (err) =>
          setServerErrors(err.details?.[0] ? { [drafts[0]?.key]: err.details[0].message } : {}),
      }
    );
  };
  return (
    <div className="flex flex-col gap-lg">
      <Field label="Title" htmlFor="practice-title">
        <Input id="practice-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <QuestionBank
        drafts={drafts}
        onChange={setDrafts}
        serverErrors={serverErrors}
        onSelect={onSelectQuestion}
        selectedKey={selectedKey}
      />
      <div>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save practice'}
        </Button>
      </div>
    </div>
  );
}

/** Routes a lesson to the right editor by its type. */
export default function LessonEditor({
  courseId,
  moduleId,
  lessonId,
  onSelectQuestion,
  selectedKey,
}) {
  const query = useLessonQuery(moduleId, lessonId);
  if (query.isPending) return <Skeleton className="h-[320px]" />;
  if (query.isError)
    return (
      <Card>
        <p className="text-pw-body text-ink900">We could not load this lesson.</p>
      </Card>
    );
  const lesson = query.data;
  const props = { courseId, moduleId, lesson };
  switch (lesson.type) {
    case 'video':
      return <VideoLessonEditor {...props} />;
    case 'text':
      return <TextLessonEditor {...props} />;
    case 'document':
      return <DocumentLessonEditor {...props} />;
    case 'practice':
      return (
        <PracticeLessonEditor
          {...props}
          onSelectQuestion={onSelectQuestion}
          selectedKey={selectedKey}
        />
      );
    default:
      return null;
  }
}
