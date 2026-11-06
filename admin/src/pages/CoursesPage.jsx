import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, ApiError, fieldErrors } from '../lib/api.js';
import { courseCreateSchema } from '../lib/courseSchemas.js';
import { PERSONNEL_ROLE_LABELS } from '../lib/labels.js';
import {
  Button,
  Card,
  Field,
  Input,
  Modal,
  Pill,
  Skeleton,
  STATUS_TONE,
  Tally,
  Textarea,
} from '../components/ui.jsx';
import { relativeTime } from '../lib/time.js';

const STATUSES = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
];

/** Course list (SPEC §4, DESIGN §7): cards with cover, status, modules and last edit; search and filter. */
export default function CoursesPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: ['courses', { q, status }],
    queryFn: () =>
      api('/admin/courses', {
        query: { q: q || undefined, status: status || undefined, limit: 100 },
      }),
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  return (
    <div className="mx-auto flex max-w-[1120px] flex-col gap-2xl">
      <header className="flex flex-wrap items-end justify-between gap-lg">
        <div>
          <h1 className="text-pw-display font-[900] text-ink900">Courses</h1>
          <p className="mt-xs text-pw-body text-ink600">
            Build training for election personnel, module by module.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>New course</Button>
      </header>

      <div className="flex flex-wrap items-center gap-md">
        <div className="min-w-[240px] flex-1">
          <label htmlFor="course-search" className="sr-only">
            Search courses
          </label>
          <Input
            id="course-search"
            placeholder="Search by title or summary"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div role="group" aria-label="Filter by status" className="flex gap-xs">
          {STATUSES.map((s) => (
            <button
              key={s.value || 'all'}
              type="button"
              aria-pressed={status === s.value}
              onClick={() => setStatus(s.value)}
              className={`h-11 rounded-pill border px-lg text-pw-label font-[800] uppercase tracking-[0.6px] transition-colors ${status === s.value ? 'border-jade600 bg-jade100 text-jade700' : 'border-line bg-surface text-ink600 hover:text-ink900'}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {list.isPending && (
        <div className="grid gap-lg sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading courses">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[260px]" />
          ))}
        </div>
      )}

      {list.isError && (
        <Card className="flex items-center justify-between gap-lg">
          <p className="text-pw-body text-ink900">We could not load courses.</p>
          <Button tone="quiet" onClick={() => list.refetch()}>
            Try again
          </Button>
        </Card>
      )}

      {list.isSuccess && items.length === 0 && (
        <Card className="flex flex-col items-center gap-lg py-3xl text-center">
          <Tally size={112} />
          <p className="text-pw-h3 font-[800] text-ink900">No courses here yet.</p>
          <p className="text-pw-body text-ink600">
            Start with a course title and a summary. You can add the rest afterwards.
          </p>
          <Button onClick={() => setCreating(true)}>Create the first course</Button>
        </Card>
      )}

      {items.length > 0 && (
        <ul className="grid gap-lg sm:grid-cols-2 xl:grid-cols-3">
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => navigate(`/courses/${c.id}`)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-lg border border-line border-b-4 bg-surface text-left transition-colors hover:border-jade600 focus-visible:outline-2 focus-visible:outline-jade600"
              >
                <div className="relative h-[140px] w-full bg-gradient-to-br from-jade500 to-jade700">
                  {c.coverImage?.url ? (
                    <img
                      src={c.coverImage.url}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/80">
                      <span className="text-pw-label font-[800] uppercase tracking-[0.6px]">
                        No cover yet
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-sm p-lg">
                  <div className="flex items-center justify-between gap-md">
                    <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
                    <span className="text-pw-small text-ink600">
                      {c.moduleCount} module{c.moduleCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h2 className="text-pw-h3 font-[800] text-ink900">{c.title}</h2>
                  <p className="line-clamp-2 text-pw-small text-ink600">{c.summary}</p>
                  <p className="mt-auto pt-sm text-pw-small text-ink600">
                    {c.targetRoles.map((r) => PERSONNEL_ROLE_LABELS[r]).join(' · ')}
                  </p>
                  <p className="text-pw-small text-ink600">
                    Last edited {relativeTime(c.updatedAt)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <NewCourseDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(course) => {
          queryClient.invalidateQueries({ queryKey: ['courses'] });
          toast.success('Course created. Add a cover and your first module next.');
          navigate(`/courses/${course.id}`);
        }}
      />
    </div>
  );
}

function NewCourseDialog({ open, onClose, onCreated }) {
  const [serverErrors, setServerErrors] = useState({});
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: { title: '', summary: '', category: '', targetRoles: ['party_agent'] },
    mode: 'onBlur',
  });

  const create = useMutation({
    mutationFn: (body) => api('/admin/courses', { method: 'POST', body }),
    onSuccess: (course) => {
      reset();
      onCreated(course);
      onClose();
    },
    onError: (err) => {
      if (err instanceof ApiError) setServerErrors(fieldErrors(err));
      toast.error(err instanceof ApiError ? err.message : 'The course could not be created.');
    },
  });

  const onSubmit = (values) => {
    setServerErrors({});
    const parsed = courseCreateSchema.safeParse({
      ...values,
      targetRoles: [].concat(values.targetRoles ?? []),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) setError(issue.path[0], { message: issue.message });
      return;
    }
    create.mutate(parsed.data);
  };

  return (
    <Modal open={open} onClose={onClose} title="New course" wide>
      <form className="flex flex-col gap-lg" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Title" htmlFor="title" error={errors.title?.message ?? serverErrors.title}>
          <Input
            id="title"
            invalid={Boolean(errors.title || serverErrors.title)}
            {...register('title')}
          />
        </Field>
        <Field
          label="Summary"
          htmlFor="summary"
          hint="One or two sentences. Learners see this on the course card."
          error={errors.summary?.message ?? serverErrors.summary}
        >
          <Textarea
            id="summary"
            invalid={Boolean(errors.summary || serverErrors.summary)}
            {...register('summary')}
          />
        </Field>
        <Field label="Category" htmlFor="category">
          <Input id="category" placeholder="For example: Election day" {...register('category')} />
        </Field>
        <fieldset className="flex flex-col gap-sm">
          <legend className="text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600">
            Who is this for?
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
        <div className="mt-sm flex justify-end gap-md">
          <Button tone="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create course'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
