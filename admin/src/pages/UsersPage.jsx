import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { api, ApiError } from '../lib/api.js';
import { PERSONNEL_ROLE_LABELS } from '../lib/labels.js';
import { formatDate, formatNumber } from '../lib/format.js';
import { Button, Card, Input, Pill, Skeleton } from '../components/ui.jsx';

const PAGE_SIZE = 25;
const STATUS_TONE = { active: 'published', deactivated: 'warn', pending_deletion: 'draft' };

/** A short pause after typing, so each keystroke does not send a request. */
function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Learners (SPEC §4): combined filters, LGA list narrowed by the chosen state, paging, and CSV export. */
export default function UsersPage() {
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const search = useDebounced(q);
  const [exporting, setExporting] = useState(false);

  const filters = {
    q: search || undefined,
    stateCode: state || undefined,
    lgaCode: lga || undefined,
    personnelRole: role || undefined,
    status: status || undefined,
  };

  useEffect(() => setPage(1), [search, state, lga, role, status]);

  const states = useQuery({
    queryKey: ['geo', 'states'],
    queryFn: () => api('/geo/states'),
    staleTime: Infinity,
  });
  const lgas = useQuery({
    queryKey: ['geo', 'lgas', state],
    queryFn: () => api(`/geo/states/${state}/lgas`),
    enabled: Boolean(state),
    staleTime: Infinity,
  });
  const list = useQuery({
    queryKey: ['users', filters, page],
    queryFn: () => api('/admin/users', { query: { ...filters, page, limit: PAGE_SIZE } }),
    placeholderData: keepPreviousData,
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await api('/admin/users/export.csv', { query: filters, raw: true });
      if (!res.ok) throw new Error('The export could not be made.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pollwise-learners.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : (err.message ?? 'The export could not be made.')
      );
    } finally {
      setExporting(false);
    }
  };

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-xl">
      <header className="flex flex-wrap items-end justify-between gap-lg">
        <div>
          <h1 className="text-pw-display font-[900] text-ink900">Learners</h1>
          <p className="mt-xs text-pw-body text-ink600">
            {list.isSuccess
              ? `${formatNumber(total)} learner${total === 1 ? '' : 's'} match`
              : 'Finding learners…'}
          </p>
        </div>
        <Button tone="quiet" onClick={exportCsv} disabled={exporting}>
          <Download size={16} aria-hidden="true" /> {exporting ? 'Preparing…' : 'Export CSV'}
        </Button>
      </header>

      <Card className="grid gap-md md:grid-cols-2 xl:grid-cols-5">
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          Search
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email or phone"
            aria-label="Search learners"
          />
        </label>
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          State
          <Select
            value={state}
            onChange={(v) => {
              setState(v);
              setLga('');
            }}
            aria-label="Filter by state"
          >
            <option value="">All states</option>
            {(states.data ?? []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          Local government area
          <Select
            value={lga}
            onChange={setLga}
            disabled={!state}
            aria-label="Filter by local government area"
          >
            <option value="">{state ? 'All areas' : 'Choose a state first'}</option>
            {(lgas.data ?? []).map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          Role
          <Select value={role} onChange={setRole} aria-label="Filter by role">
            <option value="">All roles</option>
            {Object.entries(PERSONNEL_ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-xs text-pw-label font-[800] uppercase text-ink600">
          Status
          <Select value={status} onChange={setStatus} aria-label="Filter by status">
            <option value="">Any status</option>
            <option value="active">Active</option>
            <option value="deactivated">Deactivated</option>
            <option value="pending_deletion">Waiting for deletion</option>
          </Select>
        </label>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[860px] border-collapse text-left text-pw-small">
          <caption className="sr-only">Learners matching the filters</caption>
          <thead className="sticky top-0 bg-bg text-ink600">
            <tr>
              {['Name', 'Contact', 'Area', 'Role', 'Status', 'XP', 'Joined'].map((h) => (
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
            {list.isPending &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-lg py-md">
                    <Skeleton className="h-6" />
                  </td>
                </tr>
              ))}
            {list.isSuccess && list.data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-lg py-2xl text-center text-pw-body text-ink600">
                  No learners match these filters. Try clearing one.
                </td>
              </tr>
            )}
            {list.data?.items.map((u) => (
              <tr key={u.id} className="border-t border-line hover:bg-bg">
                <td className="px-lg py-md">
                  <Link to={`/users/${u.id}`} className="font-[800] text-jade700 hover:underline">
                    {u.name}
                  </Link>
                </td>
                <td className="px-lg py-md text-ink600">
                  {u.email ?? '—'}
                  <br />
                  {u.phone ?? ''}
                </td>
                <td className="px-lg py-md text-ink600">
                  {u.stateCode ?? '—'}{' '}
                  {u.lgaCode ? `· ${u.lgaCode.split('-').slice(1).join(' ')}` : ''}
                </td>
                <td className="px-lg py-md text-ink600">
                  {u.personnelRole ? PERSONNEL_ROLE_LABELS[u.personnelRole] : '—'}
                </td>
                <td className="px-lg py-md">
                  <Pill tone={STATUS_TONE[u.status] ?? 'info'}>{u.status.replace('_', ' ')}</Pill>
                </td>
                <td className="px-lg py-md text-ink900">{formatNumber(u.xp)}</td>
                <td className="px-lg py-md text-ink600">{formatDate(u.joinedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <nav aria-label="Pages" className="flex items-center justify-between gap-md">
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
      {list.isFetching && list.isSuccess && (
        <span className="sr-only" role="status">
          Updating…
        </span>
      )}
    </div>
  );
}

function Select({ value, onChange, children, ...props }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-md border border-line bg-surface px-md text-pw-body normal-case text-ink900 disabled:opacity-50"
      {...props}
    >
      {children}
    </select>
  );
}
