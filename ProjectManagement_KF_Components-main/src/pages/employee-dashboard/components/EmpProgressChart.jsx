import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { EMP_MOTION } from '../motion';

const ragColor = {
  Green: '#43A047',
  Amber: '#FB8C00',
  Red: '#E53935',
};

const ragBg = {
  Green: 'bg-green-50',
  Amber: 'bg-orange-50',
  Red: 'bg-red-50',
};

const ragLabel = {
  Green: 'On track',
  Amber: 'At risk',
  Red: 'Delayed',
};

export default function EmpProgressChart({ projects }) {
  const list = projects.length ? projects : [];
  const overall = list.length ? Math.round(list.reduce((sum, p) => sum + p.progress, 0) / list.length) : 0;
  const circumference = 2 * Math.PI * 48;
  const offset = circumference - (overall / 100) * circumference;
  const onTrack = list.filter((p) => p.rag === 'Green').length;
  const atRisk = list.filter((p) => p.rag === 'Amber').length;
  const delayed = list.filter((p) => p.rag === 'Red').length;
  const stroke = overall >= 70 ? '#43A047' : overall >= 40 ? '#FB8C00' : '#E53935';

  const [overallDisplay, setOverallDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const durationMs = Math.max(1, (EMP_MOTION.counter.duration || 0.8) * 1000);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setOverallDisplay(Math.round(overall * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [overall]);

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-4 shadow-lg shadow-slate-200/40 backdrop-blur-sm sm:p-6 lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="650"
      whileHover={EMP_MOTION.hoverLift}
    >
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">My progress overview</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">Completion across your assigned projects</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          {[
            { label: 'On track', count: onTrack, dot: 'bg-[#43A047]', bg: 'bg-green-50' },
            { label: 'At risk', count: atRisk, dot: 'bg-[#FB8C00]', bg: 'bg-orange-50' },
            { label: 'Delayed', count: delayed, dot: 'bg-[#E53935]', bg: 'bg-red-50' },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 ${item.bg}`}>
              <div className={`h-2 w-2 rounded-full ${item.dot}`} />
              <span className="text-[11px] font-semibold text-slate-700 sm:text-xs">
                {item.count} {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-8 lg:flex-row">
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative h-32 w-32">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 112 112" aria-hidden>
              <circle cx="56" cy="56" r="48" fill="none" stroke="#F1F5F9" strokeWidth="10" />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                stroke={stroke}
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-[stroke-dashoffset] duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold tabular-nums" style={{ color: stroke }}>
                {overallDisplay}%
              </span>
              <span className="text-[10px] font-medium text-slate-500">Overall</span>
            </div>
          </div>
          <p className="mt-3 text-center text-xs font-semibold text-slate-800">Task completion</p>
          <p className="text-center text-[10px] text-slate-500">
            {list.reduce((s, p) => s + p.completedTasks, 0)} / {list.reduce((s, p) => s + p.totalTasks, 0)} tasks
          </p>
        </div>

        <div className="w-full flex-1 space-y-4">
          {list.map((p) => (
            <div key={p.id}>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: ragColor[p.rag] }} />
                  <span className="truncate text-sm font-medium text-[#2C3E50]">{p.name}</span>
                  <span className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold ${ragBg[p.rag]}`} style={{ color: ragColor[p.rag] }}>
                    {ragLabel[p.rag]}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold tabular-nums" style={{ color: ragColor[p.rag] }}>
                    {p.progress}%
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {p.completedTasks}/{p.totalTasks}
                  </span>
                </div>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{ width: `${p.progress}%`, background: ragColor[p.rag] }}
                />
              </div>
            </div>
          ))}
          {list.length > 0 ? (
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#1E88E5]" />
                  <span className="text-sm font-semibold text-[#2C3E50]">Overall average</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-[#1E88E5]">{overallDisplay}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100">
                <div className="h-2.5 rounded-full bg-[#1E88E5] transition-all duration-700" style={{ width: `${overall}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-slate-500">No assigned projects with tasks yet.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
