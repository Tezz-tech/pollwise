import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../lib/api.js';
import { formatDateTime } from '../lib/format.js';
import { Button, Card, Input, Skeleton } from '../components/ui.jsx';

const PAGE = 25;
const ACTIONS = [
  '',
  'course.create',
  'course.publish',
  'course.unpublish',
  'course.archive',
  'course.delete',
  'course.update',
  'admin.login',
  'admin.login_failed',
  'admin.invite',
  'admin.revoke',
  'admin.totp_enabled',
  'user.deactivate',
  'user.reactivate',
  'user.view',
  'user.password_reset_sent',
  'attempt.grant',
  'users.export',
  'settings.update',
  'settings.access_code_add',
  'settings.access_code_enable',
  'settings.access_code_disable',
  'upload.sign',
  'upload.confirm',
  'upload.rejected',
];

/** Audit log (SECURITY §10): read only. Filter by action and date; every entry is shown with who and what. */
export default function AuditPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const filters = { action: action || undefined, from: from || undefined, to: to || undefined };
  const query = useQuery({
    queryKey: ['audit', filters, page],
    queryFn: () => api('/admin/audit-logs', { query: { ...filters, page, limit: PAGE } }),
    placeholderData: keepPreviousData,
  });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / PAGE));

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-xl">
      <header>
        <h1 className="text-pw-display font-[900] text-ink900">Audit log</h1>
        <p className="mt-xs text-pw-body text-ink600">
          A record of every admin action. Entries cannot be edited or removed.
        </p>
      </header>

      <Card className="grid gap-md md:grid-cols-4">
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          Action
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-11 rounded-md border border-line bg-surface px-md text-pw-body normal-case text-ink900"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a || 'Any action'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          From
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          To
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <div className="flex items-end">
          <Button
            tone="quiet"
            onClick={() => {
              setAction('');
              setFrom('');
              setTo('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] border-collapse text-left text-pw-small">
          <caption className="sr-only">Audit entries</caption>
          <thead className="bg-bg text-ink600">
            <tr>
              {['When', 'Who', 'Action', 'Target', 'Details'].map((h) => (
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
            {query.isPending && (
              <tr>
                <td colSpan={5} className="p-lg">
                  <Skeleton className="h-6" />
                </td>
              </tr>
            )}
            {query.isError && (
              <tr>
                <td colSpan={5} className="p-lg text-pw-body text-ink900">
                  {query.error instanceof ApiError
                    ? query.error.message
                    : 'The log could not be loaded.'}
                </td>
              </tr>
            )}
            {query.data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-lg text-pw-body text-ink600">
                  Nothing matches these filters.
                </td>
              </tr>
            )}
            {query.data?.items.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="px-lg py-md text-ink600">{formatDateTime(r.at)}</td>
                <td className="px-lg py-md text-ink900">
                  {r.actorRole ?? 'system'}
                  {r.actorId ? (
                    <span className="block font-mono text-[11px] text-ink600">{r.actorId}</span>
                  ) : null}
                </td>
                <td className="px-lg py-md font-[800] text-ink900">{r.action}</td>
                <td className="px-lg py-md text-ink600">
                  {r.targetType ?? '—'}
                  {r.targetId ? (
                    <span className="block font-mono text-[11px]">{r.targetId}</span>
                  ) : null}
                </td>
                <td className="px-lg py-md text-ink600">
                  {Object.keys(r.meta ?? {}).length ? JSON.stringify(r.meta) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <nav aria-label="Pages" className="flex items-center justify-between">
        <p className="text-pw-small text-ink600">
          Page {page} of {pages}
        </p>
        <div className="flex gap-sm">
          <Button tone="quiet" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button tone="quiet" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </nav>
    </div>
  );
}
