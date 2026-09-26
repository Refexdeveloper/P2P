import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { EMP_MOTION } from '../motion';

const ragConfig = {
  Green: { text: '#43A047', bg: 'bg-green-50', label: 'On track', dot: '🟢' },
  Amber: { text: '#FB8C00', bg: 'bg-orange-50', label: 'At risk', dot: '🟡' },
  Red: { text: '#E53935', bg: 'bg-red-50', label: 'Delayed', dot: '🔴' },
};

const statusBadge = {
  Active: 'bg-blue-50 text-[#1E88E5]',
  Completed: 'bg-green-50 text-[#43A047]',
  'On Hold': 'bg-orange-50 text-[#FB8C00]',
  Planning: 'bg-purple-50 text-purple-600',
};

const activityIcon = {
  status: { icon: 'ri-refresh-line', color: '#1E88E5', bg: '#EFF6FF' },
  comment: { icon: 'ri-chat-3-line', color: '#8B5CF6', bg: '#F5F3FF' },
  complete: { icon: 'ri-checkbox-circle-line', color: '#43A047', bg: '#F0FDF4' },
  assign: { icon: 'ri-user-add-line', color: '#FB8C00', bg: '#FFFBEB' },
  update: { icon: 'ri-refresh-line', color: '#1E88E5', bg: '#EFF6FF' },
};

function formatDate(d) {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(d, status) {
  if (!d || status === 'Completed') return false;
  return new Date(d) < new Date();
}

export default function EmpProjectsTable({ projects, subtasks, onMarkProjectComplete }) {
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const getProjectSubtasks = (projectId) => subtasks.filter((t) => t.projectId === projectId);

  const openModal = (p) => {
    setSelected(p);
    setActiveTab('overview');
  };

  return (
    <>
      <div
        className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
        data-aos="fade-up"
        data-aos-duration="650"
      >
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
              <i className="ri-folder-3-line text-lg" aria-hidden />
            </div>
            <div className="text-center lg:text-left">
              <h3 className="text-sm font-semibold text-slate-800 sm:text-base">My projects</h3>
              <p className="text-[11px] text-slate-500 sm:text-xs">
                {projects.length} assigned · tap for details
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-end">
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-[#1E88E5]">
              {projects.filter((p) => p.status === 'Active').length} active
            </span>
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-[#E53935]">
              {projects.filter((p) => p.rag === 'Red').length} delayed
            </span>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {['Project', 'My role', 'Progress', 'Due date', 'Status', ''].map((h) => (
                  <th key={h || 'act'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => {
                const rag = ragConfig[p.rag] || ragConfig.Green;
                const overdue = isOverdue(p.dueDate, p.status);
                return (
                  <motion.tr
                    key={p.id}
                    onClick={() => openModal(p)}
                    className={`cursor-pointer border-b border-slate-100 transition-colors hover:bg-slate-50/80 ${i === 0 ? '' : ''}`}
                    style={{ height: 56 }}
                    whileTap={EMP_MOTION.rowTap}
                  >
                    <td className="px-5 py-3">
                      <p className="text-sm font-semibold text-[#2C3E50]">{p.name}</p>
                      <p className="text-xs text-[#7F8C8D]">
                        {p.displayId ? `${p.displayId} · ` : ''}
                        {p.lineOfBusiness}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-[#1E88E5]">{p.role}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 max-w-full rounded-full bg-slate-100">
                          <div className="h-2 rounded-full transition-all" style={{ width: `${p.progress}%`, background: rag.text }} />
                        </div>
                        <span className="text-xs font-bold" style={{ color: rag.text }}>
                          {p.progress}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm ${overdue ? 'font-medium text-[#E53935]' : 'text-[#2C3E50]'}`}>
                        {formatDate(p.dueDate)}
                      </span>
                      {overdue ? <i className="ri-alarm-warning-line ml-1 text-xs text-[#E53935]" aria-hidden /> : null}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openModal(p);
                        }}
                        className="rounded-lg border border-[#1E88E5]/30 bg-blue-50 px-3 py-1.5 text-xs font-medium text-[#1E88E5] transition hover:bg-blue-100"
                      >
                        <i className="ri-eye-line mr-1" aria-hidden />
                        Details
                      </button>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2.5 p-2.5 sm:p-3 lg:hidden">
          {projects.map((p) => {
            const rag = ragConfig[p.rag] || ragConfig.Green;
            const overdue = isOverdue(p.dueDate, p.status);
            return (
              <motion.button
                key={p.id}
                type="button"
                onClick={() => openModal(p)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 active:scale-[0.99] sm:rounded-2xl sm:p-4"
                whileHover={EMP_MOTION.hoverLift}
                whileTap={EMP_MOTION.tapPress}
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {p.displayId ? `${p.displayId} · ` : ''}
                      {p.lineOfBusiness}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${rag.bg}`} style={{ color: rag.text }}>
                    {rag.dot} {rag.label}
                  </span>
                </div>
                <div className="mt-2 grid gap-1.5 text-[11px]">
                  <div className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-500">Role</span>
                    <span className="font-medium text-slate-800">{p.role}</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                    <span className="text-slate-500">Due</span>
                    <span className={overdue ? 'font-medium text-[#E53935]' : 'font-medium text-slate-800'}>{formatDate(p.dueDate)}</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Progress</span>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 rounded-full bg-slate-200">
                        <div className="h-1.5 rounded-full" style={{ width: `${p.progress}%`, background: rag.text }} />
                      </div>
                      <span className="text-xs font-bold" style={{ color: rag.text }}>
                        {p.progress}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
      {selected ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelected(null)}
          role="presentation"
          initial={EMP_MOTION.modalBackdrop.initial}
          animate={EMP_MOTION.modalBackdrop.animate}
          exit={EMP_MOTION.modalBackdrop.exit}
          transition={EMP_MOTION.modalBackdrop.transition}
        >
          <motion.div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            initial={EMP_MOTION.modalPanel.initial}
            animate={EMP_MOTION.modalPanel.animate}
            exit={EMP_MOTION.modalPanel.exit}
            transition={EMP_MOTION.modalPanel.transition}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${(ragConfig[selected.rag] || ragConfig.Green).bg}`}>
                  <i className="ri-folder-3-line text-base" style={{ color: (ragConfig[selected.rag] || ragConfig.Green).text }} aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-slate-900">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${(ragConfig[selected.rag] || ragConfig.Green).bg}`} style={{ color: (ragConfig[selected.rag] || ragConfig.Green).text }}>
                      {(ragConfig[selected.rag] || ragConfig.Green).dot} {(ragConfig[selected.rag] || ragConfig.Green).label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge[selected.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {selected.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{selected.lineOfBusiness}</p>
                </div>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
                <i className="ri-close-line text-lg" aria-hidden />
              </button>
            </div>

            <div className="flex gap-1 border-b border-slate-100 px-4 sm:px-6">
              {['overview', 'subtasks', 'activity'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-3 py-2.5 text-xs font-semibold capitalize sm:text-sm ${
                    activeTab === tab ? 'border-[#1E88E5] text-[#1E88E5]' : 'border-transparent text-slate-500'
                  }`}
                >
                  {tab === 'subtasks' ? `Subtasks (${getProjectSubtasks(selected.id).length})` : tab}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {activeTab === 'overview' ? (
                <div className="space-y-5">
                  <p className="text-sm text-slate-600">{selected.description}</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      { label: 'My role', value: selected.role, icon: 'ri-user-line' },
                      { label: 'Project owner', value: selected.owner, icon: 'ri-shield-user-line' },
                      { label: 'Start', value: formatDate(selected.startDate), icon: 'ri-calendar-line' },
                      { label: 'Due', value: formatDate(selected.dueDate), icon: 'ri-calendar-check-line' },
                      { label: 'Tasks', value: `${selected.completedTasks} / ${selected.totalTasks}`, icon: 'ri-checkbox-circle-line' },
                      { label: 'Reference', value: selected.displayId || selected.id, icon: 'ri-hashtag' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-slate-50 p-3">
                        <div className="mb-1 flex items-center gap-1.5">
                          <i className={`${item.icon} text-xs text-slate-400`} aria-hidden />
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress</p>
                      <span className="text-sm font-bold" style={{ color: (ragConfig[selected.rag] || ragConfig.Green).text }}>
                        {selected.progress}%
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100">
                      <div className="h-3 rounded-full transition-all" style={{ width: `${selected.progress}%`, background: (ragConfig[selected.rag] || ragConfig.Green).text }} />
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === 'subtasks' ? (
                <div className="space-y-2">
                  {getProjectSubtasks(selected.id).length === 0 ? (
                    <div className="py-10 text-center text-sm text-slate-500">No subtasks</div>
                  ) : (
                    getProjectSubtasks(selected.id).map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center justify-between rounded-xl border px-3 py-3 ${
                          t.status === 'Overdue' ? 'border-red-100 bg-red-50/50' : 'border-slate-100 bg-slate-50/80'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{t.taskName}</p>
                          <p className="text-xs text-slate-500">Due {formatDate(t.dueDate)}</p>
                        </div>
                        <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200">{t.status}</span>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {activeTab === 'activity' ? (
                <div className="space-y-3">
                  {(selected.activityLogs || []).length === 0 ? (
                    <p className="text-center text-sm text-slate-500">No activity loaded</p>
                  ) : (
                    selected.activityLogs.map((log, idx) => {
                      const cfg = activityIcon[log.type] || activityIcon.update;
                      return (
                        <div key={log.id || idx} className="flex gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: cfg.bg }}>
                            <i className={`${cfg.icon} text-sm`} style={{ color: cfg.color }} aria-hidden />
                          </div>
                          <div>
                            <p className="text-sm text-slate-800">{log.action}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              <span className="font-medium text-[#1E88E5]">{log.user}</span> · {log.timestamp}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 sm:px-6">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                Close
              </button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setActiveTab('subtasks')} className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-[#1E88E5]">
                  Subtasks
                </button>
                {selected.status !== 'Completed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkProjectComplete(selected.id);
                      setSelected(null);
                    }}
                    className="rounded-xl bg-[#43A047] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Mark complete
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </>
  );
}
