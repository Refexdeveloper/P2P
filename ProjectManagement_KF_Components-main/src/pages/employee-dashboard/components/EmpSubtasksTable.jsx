import { useState } from 'react';
import { motion } from 'framer-motion';
import { EMP_MOTION } from '../motion';

const priorityConfig = {
  High: { bg: '#FEF2F2', color: '#E53935', label: 'High' },
  Medium: { bg: '#FFFBEB', color: '#FB8C00', label: 'Medium' },
  Low: { bg: '#F0FDF4', color: '#43A047', label: 'Low' },
};

const statusConfig = {
  'Not Started': { bg: '#F8FAFC', color: '#64748B', label: 'Not Started' },
  'In Progress': { bg: '#EFF6FF', color: '#1E88E5', label: 'In Progress' },
  Completed: { bg: '#F0FDF4', color: '#43A047', label: 'Completed' },
  Overdue: { bg: '#FEF2F2', color: '#E53935', label: 'Overdue' },
  Pending: { bg: '#F8FAFC', color: '#64748B', label: 'Not Started' },
};

function formatDate(d) {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function EmpSubtasksTable({ tasks, onComplete, onStatusChange }) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = tasks.filter((t) => {
    const matchFilter = filter === 'All' || t.status === filter;
    const matchSearch =
      String(t.taskName).toLowerCase().includes(search.toLowerCase()) ||
      String(t.projectName).toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const filterCounts = {
    All: tasks.length,
    'Not Started': tasks.filter((t) => t.status === 'Not Started' || t.status === 'Pending').length,
    'In Progress': tasks.filter((t) => t.status === 'In Progress').length,
    Completed: tasks.filter((t) => t.status === 'Completed').length,
    Overdue: tasks.filter((t) => t.status === 'Overdue').length,
  };

  const filterTabs = ['All', 'Not Started', 'In Progress', 'Completed', 'Overdue'];

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="650"
    >
      <div className="border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#43A047]/10 text-[#43A047]">
              <i className="ri-checkbox-line text-lg" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800 sm:text-base">My tasks</h3>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                {tasks.filter((t) => t.status !== 'Completed').length} open · {tasks.filter((t) => t.isOverdue).length} overdue
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-56">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" aria-hidden />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-8 text-xs shadow-sm outline-none focus:border-[#1E88E5]"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" aria-label="Clear">
                <i className="ri-close-line" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {filterTabs.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition sm:text-xs ${
                filter === f ? 'bg-[#0f172a] text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600'
              }`}
            >
              {f}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f === 'Not Started' ? filterCounts['Not Started'] : filterCounts[f]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Project', 'Task', 'Priority', 'Due', 'Aging', 'Status', ''].map((h) => (
                <th key={h || 'a'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                  No tasks match
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => {
                const pri = priorityConfig[t.priority] || priorityConfig.Medium;
                const st = statusConfig[t.status] || statusConfig['Not Started'];
                const isCompleted = t.status === 'Completed';
                return (
                  <motion.tr
                    key={t.id}
                    className={`border-b border-slate-100 ${t.status === 'Overdue' ? 'bg-red-50/40' : 'hover:bg-slate-50/80'}`}
                    style={{ height: 56 }}
                    whileTap={EMP_MOTION.rowTap}
                  >
                    <td className="px-5 py-3">
                      <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#1E88E5]">{t.projectName}</span>
                    </td>
                    <td className="max-w-[220px] px-5 py-3">
                      <p className={`truncate text-sm font-medium text-[#2C3E50] ${isCompleted ? 'opacity-50 line-through' : ''}`}>{t.taskName}</p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: pri.bg, color: pri.color }}>
                        {pri.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm ${t.isOverdue ? 'font-medium text-[#E53935]' : 'text-[#2C3E50]'}`}>{formatDate(t.dueDate)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: t.agingDays > 20 ? '#E53935' : t.agingDays > 10 ? '#FB8C00' : '#94A3B8',
                        }}
                      >
                        {t.agingDays > 0 ? `${t.agingDays}d` : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={t.status === 'Pending' ? 'Not Started' : t.status}
                        onChange={(e) => onStatusChange(t.id, e.target.value)}
                        className="cursor-pointer rounded-lg border-0 px-2 py-1.5 text-xs font-medium outline-none"
                        style={{ background: st.bg, color: st.color, fontFamily: 'inherit' }}
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                        <option value="Overdue">Overdue</option>
                      </select>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!isCompleted ? (
                        <motion.button
                          type="button"
                          onClick={() => onComplete(t.id)}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#43A047] hover:bg-emerald-100"
                          whileTap={EMP_MOTION.tapPress}
                        >
                          Done
                        </motion.button>
                      ) : (
                        <span className="text-xs font-medium text-[#43A047]">Done</span>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:p-3 lg:hidden">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No tasks</div>
        ) : (
          filtered.map((t) => {
            const pri = priorityConfig[t.priority] || priorityConfig.Medium;
            const st = statusConfig[t.status] || statusConfig['Not Started'];
            const isCompleted = t.status === 'Completed';
            return (
              <motion.div
                key={t.id}
                className={`rounded-xl border p-3 shadow-sm ring-1 ring-slate-100 ${t.status === 'Overdue' ? 'border-red-100 bg-red-50/30' : 'border-slate-200 bg-white'}`}
                whileHover={EMP_MOTION.hoverLift}
                whileTap={EMP_MOTION.tapPress}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold text-slate-900 ${isCompleted ? 'opacity-50 line-through' : ''}`}>{t.taskName}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{t.projectName}</p>
                  </div>
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: pri.bg, color: pri.color }}>
                    {pri.label}
                  </span>
                </div>
                <div className="mt-2 grid gap-1.5 text-[11px]">
                  <div className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-500">Due</span>
                    <span className={t.isOverdue ? 'font-medium text-[#E53935]' : 'font-medium text-slate-800'}>{formatDate(t.dueDate)}</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-500">Status</span>
                    <select
                      value={t.status === 'Pending' ? 'Not Started' : t.status}
                      onChange={(e) => onStatusChange(t.id, e.target.value)}
                      className="max-w-[9rem] cursor-pointer rounded-md border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-semibold"
                      style={{ color: st.color }}
                    >
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>
                  {!isCompleted ? (
                    <motion.button
                      type="button"
                      onClick={() => onComplete(t.id)}
                      className="w-full rounded-lg bg-[#43A047] py-2 text-xs font-semibold text-white"
                      whileTap={EMP_MOTION.tapPress}
                    >
                      Mark complete
                    </motion.button>
                  ) : null}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5 sm:px-5">
        <p className="text-[10px] text-slate-500 sm:text-xs">
          Showing {filtered.length} of {tasks.length}
        </p>
      </div>
    </div>
  );
}
