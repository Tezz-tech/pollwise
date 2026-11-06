import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Rocket } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Button, Card, Pill, Skeleton, STATUS_TONE } from '../components/ui.jsx';
import OutlineTree from '../builder/OutlineTree.jsx';
import {
  CourseEditor,
  ModuleEditor,
  AddModuleDialog,
  AddLessonDialog,
} from '../builder/CourseEditors.jsx';
import LessonEditor, { useLessonQuery } from '../builder/LessonEditors.jsx';
import AssessmentEditor from '../builder/AssessmentEditor.jsx';
import PublishModal from '../builder/PublishModal.jsx';
import PhoneFrame from '../preview/PhoneFrame.jsx';
import { LearnerLesson, LearnerQuestion } from '../preview/LearnerView.jsx';
import Confetti from '../components/Confetti.jsx';

/**
 * The course builder (DESIGN §7): outline on the left, the editor for the selected item in the middle,
 * and a phone preview of what the learner will see on the right.
 */
export default function CourseBuilderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState({ kind: 'course' });
  const [addingModule, setAddingModule] = useState(false);
  const [addingLessonTo, setAddingLessonTo] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [burst, setBurst] = useState(0);

  const query = useQuery({ queryKey: ['course', id], queryFn: () => api(`/admin/courses/${id}`) });
  const course = query.data;

  const reorderModules = useMutation({
    mutationFn: (moduleIds) =>
      api(`/admin/courses/${id}/modules/order`, { method: 'PUT', body: { moduleIds } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', id] }),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'The order could not be saved.'),
  });
  const reorderLessons = useMutation({
    mutationFn: ({ moduleId, lessonIds }) =>
      api(`/admin/modules/${moduleId}/lessons/order`, { method: 'PUT', body: { lessonIds } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course', id] }),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'The order could not be saved.'),
  });

  /** Map a checklist path such as modules[1].lessons[0] to the item that needs fixing. */
  const jump = (path) => {
    if (!course) return;
    const m = /^modules\[(\d+)\](?:\.(lessons|assessment))?(?:\[(\d+)\])?/.exec(path ?? '');
    if (!m) return setSelection({ kind: 'course' });
    const mod = course.modules[Number(m[1])];
    if (!mod) return setSelection({ kind: 'course' });
    if (m[2] === 'assessment' && mod.assessment)
      return setSelection({ kind: 'assessment', moduleId: mod.id });
    if (m[2] === 'lessons' && m[3] !== undefined && mod.lessons[Number(m[3])]) {
      return setSelection({
        kind: 'lesson',
        moduleId: mod.id,
        lessonId: mod.lessons[Number(m[3])].id,
      });
    }
    setSelection({ kind: 'module', moduleId: mod.id });
  };

  if (query.isPending) return <Skeleton className="h-[480px]" />;
  if (query.isError) {
    return (
      <Card className="flex items-center justify-between gap-lg">
        <p className="text-pw-body text-ink900">
          This course could not be opened. It may not exist, or it may belong to another admin.
        </p>
        <Link to="/courses" className="text-pw-body font-[800] text-jade700 underline">
          Back to courses
        </Link>
      </Card>
    );
  }

  const selectedModule = course.modules.find((m) => m.id === selection.moduleId);
  const readOnly = user.role !== 'super_admin' && course.createdBy !== user.id;

  return (
    <div className="flex flex-col gap-xl">
      <header className="flex flex-wrap items-center justify-between gap-lg">
        <div className="min-w-0">
          <Link to="/courses" className="text-pw-small font-[800] text-jade700 hover:underline">
            ← All courses
          </Link>
          <h1 className="mt-xs truncate text-pw-h1 font-[800] text-ink900">{course.title}</h1>
          <div className="mt-xs flex items-center gap-md">
            <Pill tone={STATUS_TONE[course.status]}>{course.status}</Pill>
            <span className="text-pw-small text-ink600">
              {course.modules.length} module{course.modules.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
        <div className="flex gap-md">
          <Link
            to={`/courses/${id}/preview`}
            className="inline-flex h-11 items-center gap-sm rounded-md border border-line bg-surface px-lg text-pw-label font-[800] uppercase text-ink900 hover:bg-bg"
          >
            <Eye size={16} aria-hidden="true" /> Preview as learner
          </Link>
          <Button onClick={() => setPublishing(true)} disabled={readOnly}>
            <Rocket size={16} aria-hidden="true" /> Publish
          </Button>
        </div>
      </header>

      {readOnly && (
        <p className="rounded-md bg-sky100 p-md text-pw-small text-sky600">
          You can see this course but only its author or a super admin can change it.
        </p>
      )}

      <div className="grid gap-xl xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-md">
          <OutlineTree
            course={course}
            selection={selection}
            onSelect={setSelection}
            onReorderModules={(moduleIds) => reorderModules.mutate(moduleIds)}
            onReorderLessons={(moduleId, lessonIds) =>
              reorderLessons.mutate({ moduleId, lessonIds })
            }
            onAddModule={() => setAddingModule(true)}
            onAddLesson={(moduleId) => setAddingLessonTo(moduleId)}
          />
        </aside>

        <section aria-label="Editor" className="min-w-0">
          {selection.kind === 'course' && <CourseEditor key={course.id} course={course} />}
          {selection.kind === 'module' && selectedModule && (
            <ModuleEditor
              key={selectedModule.id}
              courseId={id}
              moduleId={selectedModule.id}
              module={selectedModule}
              onDeleted={() => setSelection({ kind: 'course' })}
            />
          )}
          {selection.kind === 'lesson' && (
            <LessonEditor
              key={selection.lessonId}
              courseId={id}
              moduleId={selection.moduleId}
              lessonId={selection.lessonId}
            />
          )}
          {selection.kind === 'assessment' && (
            <AssessmentEditor
              key={selection.moduleId}
              courseId={id}
              moduleId={selection.moduleId}
            />
          )}
        </section>

        <aside className="hidden xl:block">
          <div className="sticky top-24">
            <p className="mb-md text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600">
              Learner preview
            </p>
            <PreviewPane course={course} selection={selection} />
          </div>
        </aside>
      </div>

      <AddModuleDialog
        courseId={id}
        open={addingModule}
        onClose={() => setAddingModule(false)}
        onCreated={(moduleId) => setSelection({ kind: 'module', moduleId })}
      />
      {addingLessonTo && (
        <AddLessonDialog
          courseId={id}
          moduleId={addingLessonTo}
          open
          onClose={() => setAddingLessonTo(null)}
          onCreated={(lessonId) =>
            setSelection({ kind: 'lesson', moduleId: addingLessonTo, lessonId })
          }
        />
      )}
      <PublishModal
        courseId={id}
        open={publishing}
        onClose={() => setPublishing(false)}
        onJump={jump}
        onPublished={() => {
          setBurst((b) => b + 1);
          queryClient.invalidateQueries({ queryKey: ['course', id] });
          queryClient.invalidateQueries({ queryKey: ['courses'] });
        }}
      />
      <Confetti burstKey={burst} />
    </div>
  );
}

/** What the learner will see for the current selection, using the saved version of the content. */
function PreviewPane({ course, selection }) {
  return (
    <PhoneFrame>
      {selection.kind === 'course' && <CoursePreviewCard course={course} />}
      {selection.kind === 'module' && (
        <ModulePreview module={course.modules.find((m) => m.id === selection.moduleId)} />
      )}
      {selection.kind === 'lesson' && (
        <LessonPreview moduleId={selection.moduleId} lessonId={selection.lessonId} />
      )}
      {selection.kind === 'assessment' && <AssessmentPreview moduleId={selection.moduleId} />}
    </PhoneFrame>
  );
}

function CoursePreviewCard({ course }) {
  return (
    <div className="flex flex-col gap-md">
      <div className="aspect-video overflow-hidden rounded-lg bg-gradient-to-br from-jade500 to-jade700">
        {course.coverImage?.url && (
          <img src={course.coverImage.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <h3 className="text-pw-h3 font-[800] text-ink900">{course.title}</h3>
      <p className="text-pw-small text-ink600">{course.summary}</p>
      <p className="text-pw-small text-ink600">{course.modules.length} modules</p>
    </div>
  );
}

function ModulePreview({ module: m }) {
  if (!m) return null;
  return (
    <div className="flex flex-col gap-md">
      <div className="rounded-lg bg-jade600 p-md text-white">
        <p className="text-pw-label font-[800] uppercase">Module</p>
        <p className="text-pw-h3 font-[800]">{m.title}</p>
      </div>
      {m.lessons.map((l, i) => (
        <div
          key={l.id}
          className="rounded-lg border border-line border-b-4 bg-surface p-md text-pw-body text-ink900"
        >
          <span className="font-[800] text-jade700">{i + 1}.</span> {l.title}
        </div>
      ))}
      {m.assessment && (
        <div className="rounded-lg bg-amber100 p-md text-pw-body font-[800] text-ink900">
          Module check
        </div>
      )}
    </div>
  );
}

function LessonPreview({ moduleId, lessonId }) {
  const query = useLessonQuery(moduleId, lessonId);
  const lesson = useMemo(() => {
    if (!query.data) return null;
    const d = query.data;
    return { ...d, text: d.text, questions: d.practice?.questions ?? [] };
  }, [query.data]);
  if (query.isPending) return <Skeleton className="h-40" />;
  return <LearnerLesson lesson={lesson} />;
}

function AssessmentPreview({ moduleId }) {
  const query = useQuery({
    queryKey: ['assessment', moduleId],
    queryFn: () => api(`/admin/modules/${moduleId}/assessment`),
  });
  if (query.isPending) return <Skeleton className="h-40" />;
  return (
    <div className="flex flex-col gap-lg">
      <p className="text-pw-label font-[800] uppercase text-amber700">Module check</p>
      {query.data.questions.map((q) => (
        <LearnerQuestion key={q.id} question={q} />
      ))}
    </div>
  );
}
