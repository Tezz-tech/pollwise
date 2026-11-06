import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { formatNumber, percent } from '../lib/format.js';
import { Button, Card, Pill, Skeleton } from '../components/ui.jsx';

/** A completion bar with the percentage in words beside it (DESIGN §9: colour is never the only signal). */
function Bar({ value, label }) {
  const pct = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="flex items-center gap-md">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-3 w-40 overflow-hidden rounded-pill bg-line"
      >
        <div className="h-full rounded-pill bg-jade500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 text-pw-small font-[800] text-ink900">{percent(value)}</span>
    </div>
  );
}

/** Reports (SPEC §4): completion per course, and geography with a state-to-LGA drill-down. */
export default function ReportsPage() {
  const [stateCode, setStateCode] = useState(null);
  const courses = useQuery({
    queryKey: ['reports', 'courses'],
    queryFn: () => api('/admin/reports/courses'),
  });
  const states = useQuery({
    queryKey: ['geo', 'states'],
    queryFn: () => api('/geo/states'),
    staleTime: Infinity,
  });
  const geo = useQuery({
    queryKey: ['reports', 'geography', stateCode ?? 'all'],
    queryFn: () =>
      api('/admin/reports/geography', { query: { stateCode: stateCode ?? undefined } }),
  });

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-2xl">
      <header>
        <h1 className="text-pw-display font-[900] text-ink900">Reports</h1>
        <p className="mt-xs text-pw-body text-ink600">
          Completion by course and by area. Choose a state to see its local government areas.
        </p>
      </header>

      <section aria-labelledby="courses-h" className="flex flex-col gap-md">
        <h2 id="courses-h" className="text-pw-h2 font-[800] text-ink900">
          By course
        </h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] border-collapse text-left text-pw-small">
            <caption className="sr-only">Completion for each course</caption>
            <thead className="bg-bg text-ink600">
              <tr>
                {[
                  'Course',
                  'Status',
                  'Enrolled',
                  'Completed',
                  'Completion',
                  'Average score',
                  'Attempts per learner',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-lg py-md text-pw-label font-[800] uppercase tracking-[0.6px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courses.isPending && (
                <tr>
                  <td colSpan={7} className="p-lg">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              )}
              {courses.isError && (
                <tr>
                  <td colSpan={7} className="p-lg text-pw-body text-ink900">
                    {courses.error instanceof ApiError
                      ? courses.error.message
                      : 'The report could not be loaded.'}
                  </td>
                </tr>
              )}
              {courses.data?.items.map((c) => (
                <tr key={c.courseId} className="border-t border-line">
                  <td className="px-lg py-md font-[800] text-ink900">{c.title}</td>
                  <td className="px-lg py-md">
                    <Pill
                      tone={
                        c.status === 'published'
                          ? 'published'
                          : c.status === 'archived'
                            ? 'archived'
                            : 'draft'
                      }
                    >
                      {c.status}
                    </Pill>
                  </td>
                  <td className="px-lg py-md text-ink900">{formatNumber(c.enrolled)}</td>
                  <td className="px-lg py-md text-ink900">{formatNumber(c.completed)}</td>
                  <td className="px-lg py-md">
                    <Bar value={c.completionPct} label={`${c.title} completion`} />
                  </td>
                  <td className="px-lg py-md text-ink900">{percent(c.averageScore)}</td>
                  <td className="px-lg py-md text-ink900">{c.attemptsPerLearner ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section aria-labelledby="geo-h" className="flex flex-col gap-md">
        <div className="flex flex-wrap items-center justify-between gap-md">
          <h2 id="geo-h" className="text-pw-h2 font-[800] text-ink900">
            {stateCode
              ? `Local government areas in ${states.data?.find((s) => s.code === stateCode)?.name ?? stateCode}`
              : 'By state'}
          </h2>
          {stateCode && (
            <Button tone="quiet" onClick={() => setStateCode(null)}>
              <ArrowLeft size={16} aria-hidden="true" /> All states
            </Button>
          )}
        </div>
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-left text-pw-small">
            <caption className="sr-only">
              {stateCode ? 'Local government areas' : 'States'} with learners, enrolments and
              completion
            </caption>
            <thead className="bg-bg text-ink600">
              <tr>
                {[
                  stateCode ? 'Area' : 'State',
                  'Learners',
                  'Enrolled',
                  'Completed',
                  'Completion',
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-lg py-md text-pw-label font-[800] uppercase tracking-[0.6px]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {geo.isPending && (
                <tr>
                  <td colSpan={5} className="p-lg">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              )}
              {geo.data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-lg text-pw-body text-ink600">
                    No learners here yet.
                  </td>
                </tr>
              )}
              {geo.data?.items.map((row) => (
                <tr key={row.code} className="border-t border-line">
                  <td className="px-lg py-md">
                    {stateCode ? (
                      <span className="font-[800] text-ink900">{row.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStateCode(row.code)}
                        className="font-[800] text-jade700 hover:underline"
                      >
                        {row.name}
                      </button>
                    )}
                  </td>
                  <td className="px-lg py-md text-ink900">{formatNumber(row.learners)}</td>
                  <td className="px-lg py-md text-ink900">{formatNumber(row.enrolled)}</td>
                  <td className="px-lg py-md text-ink900">{formatNumber(row.completed)}</td>
                  <td className="px-lg py-md">
                    <Bar value={row.completionPct} label={`${row.name} completion`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
