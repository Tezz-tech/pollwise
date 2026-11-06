import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { chartColors } from '@pollwise/shared/tokens';
import { api, ApiError } from '../lib/api.js';
import { formatNumber, percent } from '../lib/format.js';
import { useCountUp } from '../hooks/useCountUp.js';
import { Card, Skeleton } from '../components/ui.jsx';

const AXIS = { fill: '#4B5D55', fontSize: 12 };
const GRID = '#E2E8E4';

/** Dashboard (DESIGN §7): KPI strip with count-up, a 30-day activity chart, and completion charts. */
export default function DashboardPage() {
  const overview = useQuery({
    queryKey: ['reports', 'overview'],
    queryFn: () => api('/admin/reports/overview'),
  });
  const courses = useQuery({
    queryKey: ['reports', 'courses'],
    queryFn: () => api('/admin/reports/courses'),
  });
  const states = useQuery({
    queryKey: ['reports', 'geography'],
    queryFn: () => api('/admin/reports/geography'),
  });

  if (overview.isError) return <ErrorCard error={overview.error} />;
  const k = overview.data?.kpis;

  return (
    <div className="mx-auto flex max-w-[1200px] flex-col gap-2xl">
      <header>
        <h1 className="text-pw-display font-[900] text-ink900">Dashboard</h1>
        <p className="mt-xs text-pw-body text-ink600">
          How learners are getting on, updated when you open this page.
        </p>
      </header>

      <section aria-label="Key numbers" className="grid gap-lg sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Learners" value={k?.learners} />
        <Kpi label="Active this week" value={k?.activeThisWeek} />
        <Kpi label="Enrolments" value={k?.enrolments} />
        <Kpi label="Completions" value={k?.completions} />
        <Kpi label="Average score" value={k?.averageScore} suffix="%" />
      </section>

      <Card>
        <h2 className="text-pw-h3 font-[800] text-ink900">The last 30 days</h2>
        <div className="mt-md h-[280px]">
          {overview.isPending ? (
            <Skeleton className="h-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={overview.data.series}
                margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tick={AXIS} tickFormatter={(d) => d.slice(5)} interval={4} />
                <YAxis tick={AXIS} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="joined"
                  name="New learners"
                  stroke={chartColors[2]}
                  fill={chartColors[2]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="enrolled"
                  name="Enrolments"
                  stroke={chartColors[0]}
                  fill={chartColors[0]}
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completions"
                  stroke={chartColors[1]}
                  fill={chartColors[1]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="grid gap-lg xl:grid-cols-2">
        <Card>
          <h2 className="text-pw-h3 font-[800] text-ink900">Completion by course</h2>
          <div className="mt-md h-[300px]">
            {courses.isPending ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={courses.data.items
                    .slice(0, 8)
                    .map((c) => ({ name: c.title.slice(0, 22), pct: c.completionPct }))}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <XAxis type="number" domain={[0, 100]} tick={AXIS} unit="%" />
                  <YAxis type="category" dataKey="name" tick={AXIS} width={150} />
                  <Tooltip formatter={(v) => percent(v)} />
                  <Bar dataKey="pct" name="Completed" fill={chartColors[0]} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="text-pw-h3 font-[800] text-ink900">Completion by state</h2>
          <div className="mt-md h-[300px]">
            {states.isPending ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...states.data.items]
                    .sort((a, b) => b.enrolled - a.enrolled)
                    .slice(0, 10)
                    .map((s) => ({ name: s.name, pct: s.completionPct }))}
                  margin={{ left: -12, right: 8 }}
                >
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={AXIS}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={70}
                  />
                  <YAxis tick={AXIS} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v) => percent(v)} />
                  <Bar dataKey="pct" name="Completed" fill={chartColors[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, suffix = '' }) {
  const counted = useCountUp(typeof value === 'number' ? value : NaN);
  return (
    <Card className="flex flex-col gap-xs">
      <p className="text-pw-label font-[800] uppercase tracking-[0.6px] text-ink600">{label}</p>
      <p className="text-pw-display font-[900] text-ink900" aria-live="polite">
        {value === undefined ? (
          <Skeleton className="h-9 w-24" />
        ) : value === null ? (
          '—'
        ) : (
          `${formatNumber(counted)}${suffix}`
        )}
      </p>
    </Card>
  );
}

function ErrorCard({ error }) {
  return (
    <Card>
      <p className="text-pw-body text-ink900">
        {error instanceof ApiError ? error.message : 'The dashboard could not be loaded.'}
      </p>
    </Card>
  );
}
