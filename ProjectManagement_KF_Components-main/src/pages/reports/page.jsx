import AppLayout from '../../components/feature/AppLayout';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ProjectTrackerEmbedContext } from '@/contexts/ProjectTrackerEmbedContext.jsx';
import { KissflowSDKContext, kf } from '@/sdk/index.js';
import { fetchProjectDashboardData } from '@/lib/kfProjectDashboard';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const ragColor = { Green: '#22c55e', Amber: '#f59e0b', Red: '#ef4444' };

function r(v) { return Math.round(v); }
function monthLabel(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function Kpi({ title, value, sub, trend, tone }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/75 p-3 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.25)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-22px_rgba(15,23,42,0.35)] sm:p-4">
      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100" style={{ background: 'radial-gradient(600px 140px at 0% 0%, rgba(59,130,246,0.16), transparent 55%), radial-gradient(520px 160px at 100% 10%, rgba(168,85,247,0.14), transparent 55%)' }} />
      <p className="relative text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 sm:text-xs">{title}</p>
      <p className={`relative mt-1.5 text-2xl font-bold leading-none sm:mt-2 sm:text-3xl ${tone}`}>{value}</p>
      <p className="relative mt-1 text-[11px] font-medium text-slate-500 sm:text-xs">{sub}</p>
      {trend ? (
        <p className="relative mt-1.5 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-[#1E88E5] sm:mt-2 sm:text-xs">
          <i className="ri-sparkling-2-line text-xs" aria-hidden />
          {trend}
        </p>
      ) : null}
    </div>
  );
}

export default function ReportsPage({ useLayout = true }) {
  const { embed } = useContext(ProjectTrackerEmbedContext);
  const useChromeLayout = useLayout && !embed;
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  const [apiRows, setApiRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('All Entities');
  const [department, setDepartment] = useState('All Departments');
  const [owner, setOwner] = useState('All Owners');
  const [tab, setTab] = useState('Projects');
  const [entityFocus, setEntityFocus] = useState('All');
  const handleEntityBarClick = (barState) => {
    const key = barState?.payload?.entity || barState?.entity || null;
    if (key) setEntityFocus(key);
  };

  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;
    const run = async (attempt = 0) => {
      try {
        const liveKf = kfInstance ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
        if (!liveKf?.api && attempt < 6) {
          retryTimer = setTimeout(() => { if (!cancelled) run(attempt + 1); }, 700);
          return;
        }
        setLoading(true);
        setFetchError('');
        const { rows } = await fetchProjectDashboardData(liveKf);
        if (!cancelled) {
          setApiRows(rows || []);
          if (!rows || rows.length === 0) setFetchError('No rows returned from API');
        }
      } catch (error) {
        if (!cancelled) {
          setApiRows([]);
          setFetchError(error?.message || 'Failed to fetch report data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [kfInstance]);

  const PROJECTS = useMemo(
    () =>
      (apiRows || []).map((r) => ({
        id: r.displayId || r.id,
        name: r.name,
        // Keep semantic columns correct: Entity from Entity field, Department from LOB/category.
        entity: r.entity && r.entity !== 'N/A' ? r.entity : (r.lineOfBusiness || 'N/A'),
        department: r.department && r.department !== 'N/A' ? r.department : (r.lineOfBusiness || 'N/A'),
        owner: r.owner || 'Unassigned',
        ownerAvatar: r.ownerAvatar || 'NA',
        rag: r.rag || 'Green',
        progress: Number(r.progress || 0),
        delayDays: Number(r.delayDays || 0),
        budget: '—',
        budgetUtil: 0,
        status: r.status || 'Active',
        start: r.startDate || '—',
        end: r.originalEndDate || '—',
        revisedEnd: r.revisedEndDate || r.originalEndDate || '—',
      })),
    [apiRows],
  );

  const total = PROJECTS.length;
  const completedCount = PROJECTS.filter((p) => p.status === 'Completed').length;
  const onTrack = PROJECTS.filter((p) => p.rag === 'Green').length;
  const atRisk = PROJECTS.filter((p) => p.rag === 'Amber').length;
  const critical = PROJECTS.filter((p) => p.rag === 'Red').length;
  const avgProgress = total ? r(PROJECTS.reduce((a, b) => a + b.progress, 0) / total) : 0;
  const budgetKnown = PROJECTS.filter((p) => p.budgetUtil > 0);
  const budgetUtil = budgetKnown.length ? r(budgetKnown.reduce((a, b) => a + b.budgetUtil, 0) / budgetKnown.length) : 0;
  const avgDelay = PROJECTS.filter((p) => p.delayDays > 0).length
    ? r(PROJECTS.filter((p) => p.delayDays > 0).reduce((a, b) => a + b.delayDays, 0) / PROJECTS.filter((p) => p.delayDays > 0).length)
    : 0;

  const entities = ['All Entities', ...Array.from(new Set(PROJECTS.map((p) => p.entity)))];
  const departments = ['All Departments', ...Array.from(new Set(PROJECTS.map((p) => p.department)))];
  const owners = ['All Owners', ...Array.from(new Set(PROJECTS.map((p) => p.owner)))];

  const entityData = useMemo(() => {
    const map = {};
    PROJECTS.forEach((p) => {
      if (!map[p.entity]) map[p.entity] = { entity: p.entity, Green: 0, Amber: 0, Red: 0, count: 0 };
      map[p.entity][p.rag] += 1;
      map[p.entity].count += 1;
    });
    return Object.values(map);
  }, []);

  const deptData = useMemo(() => {
    const map = {};
    PROJECTS.forEach((p) => {
      if (!map[p.department]) map[p.department] = { department: p.department, Green: 0, Amber: 0, Red: 0, count: 0, avg: 0, budget: 0 };
      map[p.department][p.rag] += 1;
      map[p.department].count += 1;
      map[p.department].avg += p.progress;
      map[p.department].budget += p.budgetUtil;
    });
    return Object.values(map).map((d) => ({ ...d, avg: r(d.avg / d.count), budget: r(d.budget / d.count) }));
  }, []);

  const ownerData = useMemo(() => {
    const map = {};
    PROJECTS.forEach((p) => {
      if (!map[p.owner]) map[p.owner] = { owner: p.owner, avatar: p.ownerAvatar, projects: 0, avg: 0, red: 0, onTime: 0, delay: 0 };
      map[p.owner].projects += 1;
      map[p.owner].avg += p.progress;
      map[p.owner].red += p.rag === 'Red' ? 1 : 0;
      map[p.owner].onTime += p.delayDays === 0 ? 1 : 0;
      map[p.owner].delay += p.delayDays;
    });
    return Object.values(map).map((o) => ({
      ...o,
      avg: r(o.avg / o.projects),
      onTimePct: r((o.onTime / o.projects) * 100),
      avgDelay: r(o.delay / o.projects),
    })).sort((a, b) => b.projects - a.projects);
  }, []);

  const TREND = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
      const m = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      return { m, Started: 0, Completed: 0, OnTime: 0 };
    });
    const byKey = Object.fromEntries(months.map((m) => [m.m, m]));
    PROJECTS.forEach((p) => {
      const sm = monthLabel(p.start);
      const em = monthLabel(p.revisedEnd || p.end);
      if (sm && byKey[sm]) byKey[sm].Started += 1;
      if (p.status === 'Completed' && em && byKey[em]) {
        byKey[em].Completed += 1;
        if (p.delayDays === 0) byKey[em].OnTime += 1;
      }
    });
    return months;
  }, [PROJECTS]);

  const filteredProjects = PROJECTS.filter((p) => {
    if (entity !== 'All Entities' && p.entity !== entity) return false;
    if (department !== 'All Departments' && p.department !== department) return false;
    if (owner !== 'All Owners' && p.owner !== owner) return false;
    if (entityFocus !== 'All' && p.entity !== entityFocus) return false;
    if (search && !`${p.name} ${p.owner} ${p.id}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const topDelayed = [...PROJECTS].filter((p) => p.delayDays > 0).sort((a, b) => b.delayDays - a.delayDays).slice(0, 8);
  const gantt = [...PROJECTS].sort((a, b) => b.delayDays - a.delayDays).slice(0, 10);
  const pageRows = filteredProjects.slice(0, 10);

  const content = (
    <div className="min-h-screen bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="mx-auto max-w-[1800px] p-2 pb-6 sm:p-6">
      <div className="space-y-3.5 sm:space-y-5">
      {loading ? (
        <div className="rounded-2xl border border-white/70 bg-white/70 px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md sm:px-4 sm:py-3 sm:text-sm">
          <span className="inline-flex items-center gap-2">
            <i className="ri-loader-4-line animate-spin text-base text-blue-600" aria-hidden />
            Loading analytics from Kissflow API...
          </span>
        </div>
      ) : null}
      {!loading && fetchError ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-xs font-semibold text-amber-900 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.18)] backdrop-blur-md sm:px-4 sm:py-3 sm:text-sm">
          <span className="inline-flex items-center gap-2">
            <i className="ri-error-warning-line text-base text-amber-600" aria-hidden />
            {fetchError}
          </span>
        </div>
      ) : null}
      <motion.div
        className="sticky top-0 z-30 -mx-2 flex flex-col gap-2.5 rounded-2xl border border-white/70 bg-white/70 p-3.5 shadow-[0_12px_34px_-22px_rgba(15,23,42,0.30)] backdrop-blur-md sm:-mx-6 sm:rounded-3xl sm:p-5 lg:static lg:mx-0 lg:flex-row lg:items-center lg:justify-between"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">Project Analytics Command Center</h1>
          <p className="text-xs text-slate-500 sm:text-sm">
            Power BI–style · {total} projects · {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm sm:px-3 sm:py-1.5 sm:text-xs">
            <i className="ri-calendar-2-line text-slate-500" aria-hidden />
            Jan 2026 – Apr 2026
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm sm:px-3 sm:py-1.5 sm:text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live · 2 min ago
          </span>
        </div>
      </motion.div>

      <div className="rounded-2xl border border-white/70 bg-white/70 p-3 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md sm:p-4">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:text-xs">Filters</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <label className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500">Entity</span>
            <select value={entity} onChange={(e) => setEntity(e.target.value)} className="h-10 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white sm:text-sm">
              {entities.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500">Department</span>
            <select value={department} onChange={(e) => setDepartment(e.target.value)} className="h-10 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white sm:text-sm">
              {departments.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-semibold text-slate-500">Owner</span>
            <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-10 w-full rounded-xl border border-white/70 bg-white/70 px-3 text-xs font-semibold text-slate-700 shadow-sm outline-none ring-0 transition focus:border-blue-300 focus:bg-white sm:text-sm">
              {owners.map((x) => <option key={x}>{x}</option>)}
            </select>
          </label>
          <div className="sm:col-span-3 lg:col-span-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {['KPIs', 'Analytics', 'Performance', 'Timeline', 'Projects'].map((x) => (
                <button
                  key={x}
                  onClick={() => setTab(x)}
                  className={`min-h-[2.5rem] shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition active:scale-[0.99] sm:text-sm ${tab === x
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-white/70 bg-white/60 text-slate-700 hover:bg-white/80'
                    }`}
                  type="button"
                >
                  {x}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-5">
        <Kpi title="Total Projects" value={total} sub={`${completedCount} completed`} trend="From Kissflow API" tone="text-[#1E88E5]" />
        <Kpi title="On Track" value={onTrack} sub={`${total ? r((onTrack / total) * 100) : 0}% of portfolio`} trend={`${onTrack} projects healthy`} tone="text-[#43A047]" />
        <Kpi title="At Risk" value={atRisk} sub="Needs attention" trend={`${total ? r((atRisk / total) * 100) : 0}% portfolio risk`} tone="text-[#FB8C00]" />
        <Kpi title="Critical / Delayed" value={critical} sub="Immediate action" trend={avgDelay ? `Avg ${avgDelay} days delay` : 'No current delays'} tone="text-[#E53935]" />
        <Kpi title="Budget Utilization" value={budgetKnown.length ? `${budgetUtil}%` : '—'} sub={budgetKnown.length ? `${budgetKnown.length} projects with budget data` : 'Budget data unavailable from API'} trend={budgetKnown.length ? 'API-derived' : 'Waiting for budget fields'} tone="text-slate-800" />
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Analytics Overview</h3>
            <p className="text-xs text-slate-500">Click entity bars to filter</p>
          </div>
          {entityFocus !== 'All' ? (
            <button
              type="button"
              onClick={() => setEntityFocus('All')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/60 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:bg-white/80 active:scale-[0.99]"
            >
              <i className="ri-close-circle-line text-slate-500" aria-hidden />
              Clear entity filter
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Entity Distribution</h3>
            <span className="text-xs text-slate-500">Projects by business entity</span>
                </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={entityData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="entity" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Green" stackId="a" fill="#22c55e" onClick={handleEntityBarClick} />
                <Bar dataKey="Amber" stackId="a" fill="#f59e0b" onClick={handleEntityBarClick} />
                <Bar dataKey="Red" stackId="a" fill="#ef4444" onClick={handleEntityBarClick} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

          <div className="space-y-4">
          <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
            <h3 className="text-sm font-bold text-slate-900">RAG Status Distribution</h3>
            <p className="text-xs text-slate-500">Portfolio health overview</p>
            <div className="mt-3 space-y-2">
              {[['On Track', onTrack, '#22c55e'], ['At Risk', atRisk, '#f59e0b'], ['Critical', critical, '#ef4444']].map(([n, v, c]) => (
                <div key={n} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/60 px-3 py-2 shadow-sm">
                  <span className="text-xs font-semibold text-slate-600">{n}</span>
                  <span className="text-sm font-bold" style={{ color: c }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
            <h3 className="text-sm font-bold text-slate-900">Department Performance</h3>
            <p className="text-xs text-slate-500">Stacked by RAG status</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Green" stackId="a" fill="#22c55e" />
                  <Bar dataKey="Amber" stackId="a" fill="#f59e0b" />
                  <Bar dataKey="Red" stackId="a" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
            <h3 className="text-sm font-bold text-slate-900">Completion Trend</h3>
            <p className="text-xs text-slate-500">Monthly project activity</p>
            <div className="h-36">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={TREND}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Completed" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="OnTime" stroke="#3b82f6" strokeWidth={2} />
                  <Line type="monotone" dataKey="Started" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2 rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
          <h3 className="text-sm font-bold text-slate-900">Owner & Department Performance</h3>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/70 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
          <div className="border-b border-white/70 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Project Owner Performance</h3><p className="text-xs text-slate-500">{ownerData.length} active owners</p></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50">{['Owner', 'Projects', 'Avg %', 'Red', 'On Time%', 'Avg Delay'].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">{h}</th>)}</tr></thead>
              <tbody>{ownerData.map((o) => <tr key={o.owner} className="border-t border-slate-100"><td className="px-3 py-2 text-xs font-medium text-slate-800">{o.avatar} {o.owner}</td><td className="px-3 py-2 text-xs">{o.projects}</td><td className="px-3 py-2 text-xs font-bold">{o.avg}%</td><td className="px-3 py-2 text-xs">{o.red || '—'}</td><td className="px-3 py-2 text-xs">{o.onTimePct}%</td><td className="px-3 py-2 text-xs">{o.avgDelay ? `+${o.avgDelay}d` : 'On time'}</td></tr>)}</tbody>
            </table>
          </div>
        </div>
        <div className="rounded-3xl border border-white/70 bg-white/70 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
          <div className="border-b border-white/70 px-4 py-3"><h3 className="text-sm font-bold text-slate-900">Department Performance</h3><p className="text-xs text-slate-500">{deptData.length} departments tracked</p></div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50">{['Department', 'Count', 'Avg %', 'RAG Score', 'Budget Util'].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">{h}</th>)}</tr></thead>
              <tbody>{deptData.map((d) => <tr key={d.department} className="border-t border-slate-100"><td className="px-3 py-2 text-xs font-medium text-slate-800">{d.department}</td><td className="px-3 py-2 text-xs">{d.count}</td><td className="px-3 py-2 text-xs font-bold">{d.avg}%</td><td className="px-3 py-2 text-xs">{d.Red ? `⚠ ${d.Red} Red` : d.Amber ? `~ ${d.Amber} Amber` : '✓ All Green'}</td><td className="px-3 py-2 text-xs">{d.budget}%</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <h3 className="text-sm font-bold text-slate-900">Project Timeline (Gantt)</h3>
        <p className="text-xs text-slate-500">Top 10 projects · Actual vs planned</p>
        <div className="mt-4 space-y-2">
          {gantt.map((p) => (
            <div key={p.id} className="grid grid-cols-[220px_1fr_60px] items-center gap-3">
              <div><p className="truncate text-xs font-semibold text-slate-800">{p.name}</p><p className="text-[10px] text-slate-500">{p.id}</p></div>
              <div className="relative h-3 rounded-full bg-slate-100">
                <div className={`absolute left-0 top-0 h-3 rounded-full ${p.rag === 'Green' ? 'bg-emerald-500' : p.rag === 'Amber' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${Math.max(10, p.progress)}%` }} />
              </div>
              <div className="text-right text-xs font-bold">{p.delayDays ? `+${p.delayDays}d` : '✓'}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">On Track</span>
          <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">At Risk</span>
          <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700">Delayed / Critical</span>
          <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700">Delay extension</span>
        </div>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/70 p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <h3 className="text-sm font-bold text-slate-900">Top Delayed Projects</h3>
        <p className="text-xs text-slate-500">{topDelayed.length} projects behind schedule</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {topDelayed.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-red-100 bg-red-50/40 p-3">
              <p className="text-xs font-bold text-red-700">#{i + 1}</p>
              <p className="text-sm font-semibold text-slate-900">{p.name}</p>
              <p className="text-xs text-slate-600">+{p.delayDays}d · {p.end} {'->'} {p.revisedEnd}</p>
              <p className="text-xs text-slate-500">{p.owner} · {p.department} · {p.progress}% done</p>
              </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/70 shadow-[0_10px_26px_-18px_rgba(15,23,42,0.22)] backdrop-blur-md">
        <div className="flex flex-col gap-3 border-b border-white/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="text-sm font-bold text-slate-900">All Projects</h3><p className="text-xs text-slate-500">{filteredProjects.length} projects · Click row to drill down</p></div>
          <div className="flex gap-2">
            <div className="relative">
              <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects, owners..." className="h-10 rounded-xl border border-white/70 bg-white/70 pl-9 pr-3 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-300 focus:bg-white sm:text-sm" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="bg-slate-50">{['Project', 'Entity', 'Department', 'Owner', 'RAG', 'Progress', 'Delay', 'Budget', 'Status'].map((h) => <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2"><p className="text-xs font-semibold text-slate-800">{p.name}</p><p className="text-[10px] text-slate-500">{p.id}</p></td>
                  <td className="px-3 py-2 text-xs">{p.entity}</td>
                  <td className="px-3 py-2 text-xs">{p.department}</td>
                  <td className="px-3 py-2 text-xs">{p.owner}</td>
                  <td className="px-3 py-2"><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${ragColor[p.rag]}20`, color: ragColor[p.rag] }}>{p.rag}</span></td>
                  <td className="px-3 py-2 text-xs font-bold">{p.progress}%</td>
                  <td className="px-3 py-2 text-xs">{p.delayDays ? `+${p.delayDays}d` : '—'}</td>
                  <td className="px-3 py-2 text-xs">{p.budget}<div className="text-[10px] text-slate-500">{p.budgetUtil}% used</div></td>
                  <td className="px-3 py-2 text-xs">{p.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 text-xs font-medium text-slate-600">Showing 1-10 of {filteredProjects.length} projects</div>
      </div>
        </div>
      </div>
    </div>
  );

  if (!useChromeLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}
