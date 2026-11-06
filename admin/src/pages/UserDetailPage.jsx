import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, ChevronDown, X } from 'lucide-react';
import { api, ApiError } from '../lib/api.js';
import { PERSONNEL_ROLE_LABELS } from '../lib/labels.js';
import { formatDate, formatDateTime, formatNumber } from '../lib/format.js';
import { Button, Card, Field, Pill, Skeleton } from '../components/ui.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

/** One learner, for the super admin (SPEC §4): profile, progress, every answer, certificates, and actions. */
export default function UserDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(null);
  const [grantFor, setGrantFor] = useState('');

  const query = useQuery({ queryKey: ['user', id], queryFn: () => api(`/admin/users/${id}`) });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['user', id] });
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  const act = useMutation({
    mutationFn: async (action) => {
      if (action.kind === 'status')
        return api(`/admin/users/${id}/status`, {
          method: 'PATCH',
          body: { status: action.status },
        });
      if (action.kind === 'reset') return api(`/admin/users/${id}/reset`, { method: 'POST' });
      if (action.kind === 'grant')
        return api(`/admin/users/${id}/attempts`, {
          method: 'POST',
          body: { assessmentId: action.assessmentId },
        });
      throw new Error('Unknown action');
    },
    onSuccess: (_res, action) => {
      setConfirm(null);
      const done = {
        status: 'Account updated.',
        reset: 'A reset code has been emailed to the learner.',
        grant: 'One more attempt has been granted.',
      }[action.kind];
      toast.success(done);
      refresh();
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'That did not work. Try again.'),
  });

  if (query.isPending) return <Skeleton className="h-[480px]" />;
  if (query.isError) {
    return (
      <Card>
        <p className="text-pw-body text-ink900">
          {query.error instanceof ApiError
            ? query.error.message
            : 'This learner could not be opened.'}
        </p>
        <Link
          to="/users"
          className="mt-md inline-block text-pw-body font-[800] text-jade700 underline"
        >
          Back to learners
        </Link>
      </Card>
    );
  }
  const u = query.data;
  const deactivated = u.status === 'deactivated';
  const grantable = u.enrolments.flatMap((e) =>
    e.modules
      .filter((m) => m.assessmentId)
      .map((m) => ({ id: m.assessmentId, label: `${e.courseTitle} · ${m.title}` }))
  );

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-2xl">
      <Link to="/users" className="text-pw-small font-[800] text-jade700 hover:underline">
        ← All learners
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-lg">
        <div>
          <h1 className="text-pw-display font-[900] text-ink900">{u.name}</h1>
          <p className="mt-xs text-pw-body text-ink600">
            {u.email ?? 'No email'} · {u.phone ?? 'No phone'}
          </p>
          <div className="mt-md flex flex-wrap items-center gap-md">
            <Pill tone={deactivated ? 'warn' : 'published'}>{u.status.replace('_', ' ')}</Pill>
            <span className="text-pw-small text-ink600">
              Joined {formatDate(u.joinedAt)} · last sign-in {formatDateTime(u.lastLoginAt)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-sm">
          <Button
            tone="quiet"
            disabled={!u.email || u.status !== 'active'}
            onClick={() =>
              setConfirm({
                kind: 'reset',
                title: 'Send a reset code?',
                body: `A six-digit code will be emailed to ${u.email}. It lasts 15 minutes.`,
                label: 'Send code',
              })
            }
          >
            Send reset code
          </Button>
          {deactivated ? (
            <Button
              onClick={() =>
                setConfirm({
                  kind: 'status',
                  status: 'active',
                  title: 'Reactivate this account?',
                  body: 'The learner can sign in again straight away.',
                  label: 'Reactivate',
                })
              }
            >
              Reactivate
            </Button>
          ) : (
            <Button
              tone="danger"
              onClick={() =>
                setConfirm({
                  kind: 'status',
                  status: 'deactivated',
                  title: 'Deactivate this account?',
                  body: 'Every session ends at once, and the learner cannot sign in until you reactivate it.',
                  label: 'Deactivate',
                  tone: 'danger',
                })
              }
            >
              Deactivate
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-lg md:grid-cols-3">
        <Card>
          <p className="text-pw-label font-[800] uppercase text-ink600">Area</p>
          <p className="mt-xs text-pw-body text-ink900">
            {u.stateCode ?? '—'} {u.lgaCode ? `· ${u.lgaCode}` : ''}
          </p>
        </Card>
        <Card>
          <p className="text-pw-label font-[800] uppercase text-ink600">Role</p>
          <p className="mt-xs text-pw-body text-ink900">
            {u.personnelRole ? PERSONNEL_ROLE_LABELS[u.personnelRole] : 'Not chosen yet'}
          </p>
        </Card>
        <Card>
          <p className="text-pw-label font-[800] uppercase text-ink600">XP</p>
          <p className="mt-xs text-pw-h2 font-[800] text-ink900">{formatNumber(u.xp)}</p>
        </Card>
      </div>

      <section aria-labelledby="enrol-h" className="flex flex-col gap-md">
        <h2 id="enrol-h" className="text-pw-h2 font-[800] text-ink900">
          Courses and progress
        </h2>
        {u.enrolments.length === 0 && (
          <Card>
            <p className="text-pw-body text-ink600">Not enrolled in any course yet.</p>
          </Card>
        )}
        {u.enrolments.map((e) => (
          <Card key={e.courseId} className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <p className="text-pw-h3 font-[800] text-ink900">{e.courseTitle}</p>
              <Pill tone={e.status === 'completed' ? 'published' : 'info'}>
                {e.status === 'completed' ? 'Completed' : 'In progress'}
              </Pill>
            </div>
            {e.modules.map((m) => {
              const pct = m.lessonsTotal
                ? Math.round((m.lessonsCompleted / m.lessonsTotal) * 100)
                : 0;
              return (
                <div key={m.id} className="flex flex-col gap-xs">
                  <div className="flex items-center justify-between text-pw-small">
                    <span className="font-[700] text-ink900">{m.title}</span>
                    <span className="flex items-center gap-xs text-ink600">
                      {m.lessonsCompleted}/{m.lessonsTotal} lessons
                      {m.passed ? (
                        <>
                          <Check size={14} className="text-jade700" aria-hidden="true" />
                          <span className="font-[800] text-jade700">Check passed</span>
                        </>
                      ) : null}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${m.title} lessons`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    className="h-3 overflow-hidden rounded-pill bg-line"
                  >
                    <div className="h-full rounded-pill bg-jade500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(e.extraAttempts ?? {}).length > 0 && (
              <p className="text-pw-small text-ink600">
                Extra attempts granted: {Object.values(e.extraAttempts).reduce((a, b) => a + b, 0)}
              </p>
            )}
          </Card>
        ))}
        {grantable.length > 0 && (
          <Card className="flex flex-wrap items-end gap-md">
            <Field label="Grant one more attempt on" htmlFor="grant">
              <select
                id="grant"
                value={grantFor}
                onChange={(e) => setGrantFor(e.target.value)}
                className="h-11 w-[360px] rounded-md border border-line bg-surface px-md text-pw-body text-ink900"
              >
                <option value="">Choose a check</option>
                {grantable.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              tone="quiet"
              disabled={!grantFor}
              onClick={() =>
                setConfirm({
                  kind: 'grant',
                  assessmentId: grantFor,
                  title: 'Grant one more attempt?',
                  body: 'The learner gets one extra attempt on this check. It is recorded in the audit log.',
                  label: 'Grant attempt',
                })
              }
            >
              Grant attempt
            </Button>
          </Card>
        )}
      </section>

      <section aria-labelledby="att-h" className="flex flex-col gap-md">
        <h2 id="att-h" className="text-pw-h2 font-[800] text-ink900">
          Attempts and answers
        </h2>
        {u.attempts.length === 0 && (
          <Card>
            <p className="text-pw-body text-ink600">No attempts yet.</p>
          </Card>
        )}
        {u.attempts.map((a, i) => (
          <AttemptRow key={a.id} attempt={a} label={`Attempt ${u.attempts.length - i}`} />
        ))}
      </section>

      <section aria-labelledby="cert-h" className="flex flex-col gap-md">
        <h2 id="cert-h" className="text-pw-h2 font-[800] text-ink900">
          Certificates
        </h2>
        {u.certificates.length === 0 && (
          <Card>
            <p className="text-pw-body text-ink600">No certificates yet.</p>
          </Card>
        )}
        {u.certificates.map((c) => (
          <Card key={c.id} className="flex flex-wrap items-center justify-between gap-md">
            <div>
              <p className="text-pw-body font-[800] text-ink900">{c.courseTitle}</p>
              <p className="text-pw-small text-ink600">
                Code {c.code} · score {c.score}% · issued {formatDate(c.issuedAt)}
              </p>
            </div>
            {c.revoked ? <Pill tone="warn">Revoked</Pill> : <Pill tone="published">Valid</Pill>}
          </Card>
        ))}
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        body={confirm?.body ?? ''}
        confirmLabel={confirm?.label ?? 'Confirm'}
        tone={confirm?.tone ?? 'primary'}
        busy={act.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && act.mutate(confirm)}
      />
    </div>
  );
}

/** One attempt, collapsed by default. Each answer says "Right" or "Not right" in words, not only by colour. */
function AttemptRow({ attempt: a, label }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-md p-lg text-left"
      >
        <span>
          <span className="block text-pw-body font-[800] text-ink900">
            {label} · {formatDateTime(a.startedAt)}
          </span>
          <span className="block text-pw-small text-ink600">
            {a.status === 'in_progress'
              ? 'In progress'
              : `Score ${a.score ?? 0}% · ${a.passed ? 'passed' : 'not passed'}`}
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`text-ink600 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul className="flex flex-col gap-sm border-t border-line p-lg">
          {a.answers.length === 0 && (
            <li className="text-pw-small text-ink600">No answers were given.</li>
          )}
          {a.answers.map((ans) => (
            <li
              key={ans.questionId}
              className="flex items-start justify-between gap-md rounded-md bg-bg p-md"
            >
              <span className="text-pw-small text-ink900">{ans.prompt ?? 'Question'}</span>
              <span
                className={`flex shrink-0 items-center gap-xs text-pw-small font-[800] ${ans.correct ? 'text-jade700' : 'text-coral700'}`}
              >
                {ans.correct ? (
                  <Check size={14} aria-hidden="true" />
                ) : (
                  <X size={14} aria-hidden="true" />
                )}
                {ans.correct === null ? 'Not marked' : ans.correct ? 'Right' : 'Not right'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
