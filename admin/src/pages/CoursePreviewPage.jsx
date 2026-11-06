import { Link, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api.js';
import { Card, Skeleton } from '../components/ui.jsx';
import PhoneFrame from '../preview/PhoneFrame.jsx';
import { LearnerLesson, LearnerQuestion } from '../preview/LearnerView.jsx';

/** Preview as learner (SPEC §6): the whole course as the app shows it, with no lock state. */
export default function CoursePreviewPage() {
  const { id } = useParams();
  const query = useQuery({
    queryKey: ['course-preview', id],
    queryFn: () => api(`/admin/courses/${id}/preview`),
  });

  return (
    <div className="flex flex-col gap-xl">
      <Link to={`/courses/${id}`} className="text-pw-small font-[800] text-jade700 hover:underline">
        ← Back to the builder
      </Link>
      {query.isPending && <Skeleton className="h-[480px]" />}
      {query.isError && (
        <Card>
          <p className="text-pw-body text-ink900">
            {query.error instanceof ApiError
              ? query.error.message
              : 'The preview could not be loaded.'}
          </p>
        </Card>
      )}
      {query.data && (
        <>
          <h1 className="sr-only">Learner preview: {query.data.title}</h1>
          <PhoneFrame label="Course preview">
            <div className="flex flex-col gap-xl">
              <h2 className="text-pw-h2 font-[800] text-ink900">{query.data.title}</h2>
              <p className="text-pw-small text-ink600">{query.data.summary}</p>
              {query.data.modules.map((m) => (
                <section key={m.id} className="flex flex-col gap-md">
                  <div className="rounded-lg bg-jade600 p-md text-white">
                    <p className="text-pw-h3 font-[800]">{m.title}</p>
                  </div>
                  {m.lessons.map((l) => (
                    <div
                      key={l.id}
                      className="flex flex-col gap-sm rounded-lg border border-line bg-surface p-md"
                    >
                      <LearnerLesson lesson={l} />
                    </div>
                  ))}
                  {m.assessment && (
                    <div className="flex flex-col gap-md rounded-lg bg-amber100 p-md">
                      <p className="text-pw-label font-[800] uppercase text-ink900">
                        Module check · pass mark {m.assessment.passMark ?? 70}%
                      </p>
                      {m.assessment.questions.map((q) => (
                        <LearnerQuestion key={q.id} question={q} />
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          </PhoneFrame>
        </>
      )}
    </div>
  );
}
