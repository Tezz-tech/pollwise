import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fieldErrors } from '../lib/api.js';
import { uploadAndConfirm } from '../lib/uploads.js';
import { courseCreateSchema, moduleSchema, textLessonSchema } from '../lib/courseSchemas.js';
import { LESSON_TYPE_LABELS, PERSONNEL_ROLE_LABELS } from '../lib/labels.js';
import { Button, Card, Field, Input, Modal, Textarea } from '../components/ui.jsx';

function useInvalidate(courseId) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['course', courseId] });
    queryClient.invalidateQueries({ queryKey: ['courses'] });
  };
}

/** Course details and the cover image (SPEC §4 course fields). */
export function CourseEditor({ course }) {
  const refresh = useInvalidate(course.id);
  const [serverErrors, setServerErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm({
    defaultValues: {
      title: course.title,
      summary: course.summary,
      category: course.category ?? '',
      targetRoles: course.targetRoles,
      isRequired: course.isRequired,
      estimatedMinutes: course.estimatedMinutes ?? 0,
    },
    mode: 'onBlur',
  });

  const save = useMutation({
    mutationFn: (body) => api(`/admin/courses/${course.id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Course saved.');
      setServerErrors({});
      refresh();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerErrors(fieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : 'The course could not be saved.');
    },
  });

  const onSubmit = (values) => {
    const parsed = courseCreateSchema.safeParse({
      ...values,
      targetRoles: [].concat(values.targetRoles ?? []),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) setError(issue.path[0], { message: issue.message });
      return;
    }
    save.mutate(parsed.data);
  };

  const onCover = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const asset = await uploadAndConfirm({ courseId: course.id, kind: 'image', file });
      await api(`/admin/courses/${course.id}`, {
        method: 'PATCH',
        body: { coverImage: { url: asset.url, publicId: asset.publicId } },
      });
      toast.success('Cover image saved.');
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2xl">
      <Card className="grid gap-lg md:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-md">
          <div className="aspect-video overflow-hidden rounded-md bg-gradient-to-br from-jade500 to-jade700">
            {course.coverImage?.url ? (
              <img
                src={course.coverImage.url}
                alt="Course cover"
                className="h-full w-full object-cover"
              />
            ) : null}
          </div>
          <label className="inline-flex w-fit cursor-pointer items-center rounded-md border-b-4 border-line bg-surface px-lg py-md text-pw-label font-[800] uppercase text-ink900 hover:bg-bg">
            {uploading ? 'Uploading…' : course.coverImage ? 'Replace cover' : 'Upload cover'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => onCover(e.target.files?.[0])}
            />
          </label>
          <p className="text-pw-small text-ink600">JPEG, PNG or WebP, up to 5 MB.</p>
        </div>
        <form className="flex flex-col gap-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Field
            label="Title"
            htmlFor="c-title"
            error={errors.title?.message ?? serverErrors.title}
          >
            <Input
              id="c-title"
              invalid={Boolean(errors.title || serverErrors.title)}
              {...register('title')}
            />
          </Field>
          <Field
            label="Summary"
            htmlFor="c-summary"
            error={errors.summary?.message ?? serverErrors.summary}
          >
            <Textarea
              id="c-summary"
              invalid={Boolean(errors.summary || serverErrors.summary)}
              {...register('summary')}
            />
          </Field>
          <div className="grid gap-lg sm:grid-cols-2">
            <Field label="Category" htmlFor="c-category">
              <Input id="c-category" {...register('category')} />
            </Field>
            <Field label="Estimated minutes" htmlFor="c-minutes">
              <Input
                id="c-minutes"
                type="number"
                min={0}
                {...register('estimatedMinutes', { valueAsNumber: true })}
              />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-sm">
            <legend className="text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600">
              Roles this is for
            </legend>
            <div className="grid gap-sm sm:grid-cols-2">
              {Object.entries(PERSONNEL_ROLE_LABELS).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-md rounded-md border border-line bg-surface p-md text-pw-body text-ink900 has-[:checked]:border-jade600 has-[:checked]:bg-jade100"
                >
                  <input
                    type="checkbox"
                    value={value}
                    className="h-4 w-4 accent-jade600"
                    {...register('targetRoles')}
                  />
                  {label}
                </label>
              ))}
            </div>
            {(errors.targetRoles || serverErrors.targetRoles) && (
              <p role="alert" className="text-pw-small font-[700] text-coral700">
                {errors.targetRoles?.message ?? serverErrors.targetRoles}
              </p>
            )}
          </fieldset>
          <label className="flex items-center gap-sm text-pw-body text-ink900">
            <input type="checkbox" className="h-5 w-5 accent-jade600" {...register('isRequired')} />
            Required for these roles
          </label>
          <div>
            <Button type="submit" disabled={!isDirty || isSubmitting || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save course'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

/** Module title and description, with delete. */
export function ModuleEditor({ courseId, moduleId, module, onDeleted }) {
  const refresh = useInvalidate(courseId);
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? '');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: (body) =>
      api(`/admin/courses/${courseId}/modules/${moduleId}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success('Module saved.');
      refresh();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'The module could not be saved.'),
  });
  const remove = useMutation({
    mutationFn: () => api(`/admin/courses/${courseId}/modules/${moduleId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Module removed.');
      refresh();
      onDeleted();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'The module could not be removed.'),
  });

  const submit = () => {
    const parsed = moduleSchema.safeParse({ title, description });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError('');
    save.mutate(parsed.data);
  };

  return (
    <Card className="flex flex-col gap-lg">
      <Field label="Module title" htmlFor="m-title" error={error}>
        <Input
          id="m-title"
          invalid={Boolean(error)}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="What this module covers (optional)" htmlFor="m-desc">
        <Textarea
          id="m-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="flex flex-wrap justify-between gap-md">
        <Button
          tone="danger"
          onClick={() =>
            window.confirm(
              'Delete this module, its lessons and its check? This cannot be undone.'
            ) && remove.mutate()
          }
        >
          Delete module
        </Button>
        <Button onClick={submit} disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save module'}
        </Button>
      </div>
    </Card>
  );
}

/** Add a module. The server gives it an empty check, so the publish checklist can see it at once. */
export function AddModuleDialog({ courseId, open, onClose, onCreated }) {
  const refresh = useInvalidate(courseId);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const create = useMutation({
    mutationFn: (body) => api(`/admin/courses/${courseId}/modules`, { method: 'POST', body }),
    onSuccess: (mod) => {
      setTitle('');
      refresh();
      onCreated(mod.id);
      onClose();
    },
    onError: (err) =>
      setError(err instanceof ApiError ? err.message : 'The module could not be added.'),
  });
  const submit = () => {
    const parsed = moduleSchema.safeParse({ title });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    create.mutate(parsed.data);
  };
  return (
    <Modal open={open} onClose={onClose} title="Add a module">
      <div className="flex flex-col gap-lg">
        <Field
          label="Module title"
          htmlFor="new-m"
          error={error}
          hint="For example: Before the polls open"
        >
          <Input
            id="new-m"
            invalid={Boolean(error)}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </Field>
        <div className="flex justify-end gap-md">
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Adding…' : 'Add module'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Add a lesson of a chosen type (SPEC §4). Video takes a link and looks it up first; a document takes a PDF.
 * Each type is created complete, so there is never a half-made lesson to clean up.
 */
export function AddLessonDialog({ courseId, moduleId, open, onClose, onCreated }) {
  const refresh = useInvalidate(courseId);
  const [type, setType] = useState('text');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [lookup, setLookup] = useState(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setType('text');
    setTitle('');
    setUrl('');
    setLookup(null);
    setFile(null);
    setError('');
  };
  const close = () => {
    reset();
    onClose();
  };

  const runLookup = async () => {
    setError('');
    setBusy(true);
    try {
      const data = await api('/admin/youtube/lookup', { query: { url } });
      setLookup(data);
      if (!title) setTitle(data.title);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That link could not be checked.');
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    setError('');
    const titled = textLessonSchema.safeParse({ title });
    if (!titled.success) return setError(titled.error.issues[0].message);
    setBusy(true);
    try {
      let body;
      if (type === 'video') {
        if (!lookup) return setError('Check the video link first.');
        body = {
          title: titled.data.title,
          type,
          video: { youtubeId: lookup.youtubeId, title: lookup.title, keyPoints: [] },
        };
      } else if (type === 'text') {
        body = {
          title: titled.data.title,
          type,
          text: { doc: { type: 'doc', content: [{ type: 'paragraph' }] }, readMinutes: 1 },
        };
      } else if (type === 'document') {
        if (!file) return setError('Choose a PDF first.');
        const asset = await uploadAndConfirm({ courseId, kind: 'pdf', file });
        body = {
          title: titled.data.title,
          type,
          document: {
            url: asset.url,
            publicId: asset.publicId,
            fileName: file.name,
            bytes: asset.bytes,
            pages: asset.pages,
          },
        };
      } else {
        body = { title: titled.data.title, type, practice: { questions: [] } };
      }
      const lesson = await api(`/admin/modules/${moduleId}/lessons`, { method: 'POST', body });
      refresh();
      onCreated(lesson.id);
      close();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : (err.message ?? 'The lesson could not be added.')
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add a lesson" wide>
      <div className="flex flex-col gap-lg">
        <div
          role="radiogroup"
          aria-label="Lesson type"
          className="grid grid-cols-2 gap-sm sm:grid-cols-4"
        >
          {Object.entries(LESSON_TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              onClick={() => {
                setType(value);
                setError('');
              }}
              className={`rounded-lg border border-b-4 p-md text-pw-body font-[800] ${type === value ? 'border-jade600 bg-jade100 text-jade700' : 'border-line bg-surface text-ink900'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <Field
          label="Lesson title"
          htmlFor="l-title"
          error={error && !url && type !== 'video' ? error : undefined}
        >
          <Input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        {type === 'video' && (
          <div className="flex flex-col gap-sm">
            <Field
              label="YouTube link"
              htmlFor="l-url"
              hint="Paste a watch, youtu.be, shorts or embed link. The video must be Unlisted."
            >
              <div className="flex gap-sm">
                <Input
                  id="l-url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setLookup(null);
                  }}
                />
                <Button tone="quiet" onClick={runLookup} disabled={!url || busy}>
                  Check
                </Button>
              </div>
            </Field>
            {lookup && (
              <div className="flex items-center gap-md rounded-md bg-bg p-md">
                <img
                  src={lookup.thumbnailUrl}
                  alt=""
                  className="h-16 w-28 rounded-sm object-cover"
                />
                <p className="text-pw-small text-ink900">{lookup.title}</p>
              </div>
            )}
          </div>
        )}
        {type === 'document' && (
          <label className="inline-flex w-fit cursor-pointer items-center rounded-md border-b-4 border-line bg-surface px-lg py-md text-pw-label font-[800] uppercase text-ink900 hover:bg-bg">
            {file ? file.name : 'Choose PDF'}
            <input
              type="file"
              accept="application/pdf"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
        {error && (
          <p role="alert" className="text-pw-small font-[700] text-coral700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-md">
          <Button tone="quiet" onClick={close}>
            Cancel
          </Button>
          <Button onClick={create} disabled={busy}>
            {busy ? 'Adding…' : 'Add lesson'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
