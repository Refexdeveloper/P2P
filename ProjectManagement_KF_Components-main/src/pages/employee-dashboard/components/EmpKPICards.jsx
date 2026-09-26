import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { EMP_MOTION } from '../motion';

function AnimatedValue({ value, suffix = '' }) {
  const numeric = Number.parseInt(String(value).replace(/[^\d-]/g, ''), 10) || 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const durationMs = Math.max(1, (EMP_MOTION.counter.duration || 0.8) * 1000);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (numeric - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numeric]);

  return (
    <span>{display}{suffix}</span>
  );
}

export default function EmpKPICards({ data }) {
  const cards = [
    {
      label: 'My projects',
      value: data.totalProjects,
      subtext: 'Assigned to you',
      icon: 'ri-folder-3-line',
      accent: 'text-[#2B5AED]',
      bar: 'from-sky-50/90 via-white to-indigo-50/70',
      ring: 'ring-sky-500/15',
    },
    {
      label: 'My tasks',
      value: data.totalSubtasks,
      subtext: 'Across those projects',
      icon: 'ri-checkbox-line',
      accent: 'text-[#8B5CF6]',
      bar: 'from-violet-50/90 via-white to-purple-50/70',
      ring: 'ring-violet-500/15',
    },
    {
      label: 'Completion rate',
      value: `${data.completionRate}%`,
      subtext: `${data.completedTasks} of ${data.totalSubtasks} done`,
      icon: 'ri-pie-chart-2-line',
      accent: 'text-[#22C55E]',
      bar: 'from-emerald-50/90 via-white to-teal-50/70',
      ring: 'ring-emerald-500/15',
    },
    {
      label: 'Overdue',
      value: data.overdueTasks,
      subtext: 'Needs attention',
      icon: 'ri-time-line',
      accent: 'text-[#E53935]',
      bar: 'from-rose-50/90 via-white to-red-50/70',
      ring: 'ring-red-500/15',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          className={`group relative overflow-hidden rounded-xl border border-white/80 bg-gradient-to-br ${card.bar} p-3 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.12)] backdrop-blur-sm ring-1 ${card.ring} transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.16)] sm:rounded-2xl sm:p-4 lg:rounded-3xl lg:p-5`}
          data-aos="fade-up"
          data-aos-duration="600"
          whileHover={EMP_MOTION.hoverLift}
          whileTap={EMP_MOTION.tapPress}
        >
          <div className="mb-2.5 flex items-start justify-between gap-2 sm:mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-sm text-[#1E88E5] shadow-sm ring-1 ring-slate-200/60 sm:h-10 sm:w-10 sm:rounded-xl sm:text-base">
              <i className={card.icon} aria-hidden />
            </div>
          </div>
          <p className={`text-xl font-bold tabular-nums leading-none sm:text-3xl ${card.accent}`}>
            {card.label === 'Completion rate' ? <AnimatedValue value={data.completionRate} suffix="%" /> : <AnimatedValue value={card.value} />}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-800 sm:mt-2 sm:text-sm">{card.label}</p>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">{card.subtext}</p>
        </motion.div>
      ))}
    </div>
  );
}
