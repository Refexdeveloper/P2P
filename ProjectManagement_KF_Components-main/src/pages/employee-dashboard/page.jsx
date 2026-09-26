import { useState, useCallback, useContext, useEffect, useId } from 'react';
import { motion } from 'framer-motion';
import AppLayout from '@/components/feature/AppLayout';
import { KissflowSDKContext, kf } from '@/sdk/index.js';
import { ProjectTrackerEmbedContext } from '@/contexts/ProjectTrackerEmbedContext.jsx';
import {
  fetchProjectDashboardData,
  resolveRoleName,
  toInitials,
  personMatches,
} from '@/lib/kfProjectDashboard';
import { employeeNotifications } from '@/mocks/employee-dashboard';
import EmpHeader from './components/EmpHeader';
import EmpKPICards from './components/EmpKPICards';
import EmpProgressChart from './components/EmpProgressChart';
import EmpProjectsTable from './components/EmpProjectsTable';
import EmpSubtasksTable from './components/EmpSubtasksTable';
import Toast from '@/components/base/Toast';
import { EMP_MOTION } from './motion';

function mapActivityLogs(activityHistory) {
  return (activityHistory || []).map((h) => ({
    id: h.key,
    type: 'update',
    action: `${h.eventType}: ${h.field}${h.newValue != null && h.newValue !== '' ? ` → ${h.newValue}` : ''}`,
    user: h.by,
    timestamp: h.date || '',
  }));
}

function toEmployeeProject(row, kfUser) {
  const isOwner = personMatches(kfUser, {
    id: row.ownerId,
    email: row.ownerEmail,
    name: row.owner,
  });
  const role = isOwner ? 'Owner' : 'Contributor';
  return {
    ...row,
    dueDate: row.originalEndDate || '',
    role,
    description:
      row.risk && row.risk !== 'N/A'
        ? String(row.risk)
        : `Workspace for ${row.lineOfBusiness || 'your project'}.`,
    activityLogs: mapActivityLogs(row.activityHistory),
  };
}

function normalizeEmployeeTask(t) {
  const status = t.status === 'Pending' ? 'Not Started' : t.status;
  return {
    ...t,
    status,
    dueDate: t.endDate || '',
    isOverdue: status === 'Overdue' || (Number(t.delayDays) > 0 && status !== 'Completed'),
    priority: t.priority || 'Medium',
    completionDate: t.completionDate ?? null,
  };
}

function useToasts() {
  const uid = useId();
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(
    (message, type = 'success') => {
      const id = `${uid}-${Date.now()}`;
      setToasts((prev) => [...prev, { id, message, type }]);
    },
    [uid],
  );

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export default function EmployeeDashboardPage({ useLayout: useLayoutProp = true }) {
  const { embed } = useContext(ProjectTrackerEmbedContext);
  const useChromeLayout = useLayoutProp && !embed;

  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);

  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Member');
  const [apiRows, setApiRows] = useState([]);
  const [apiAllSubtasks, setApiAllSubtasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const { toasts, addToast, removeToast } = useToasts();

  useEffect(() => {
    if (!kfInstance?.user) return;
    const user = kfInstance.user;
    const resolvedName = String(user.Name || user.FirstName || 'User').trim();
    const resolvedRole = resolveRoleName(user.Role || user.Roles?.[0] || '');
    if (resolvedName) setUserName(resolvedName);
    if (resolvedRole) setRoleName(resolvedRole);
  }, [kfInstance]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(null);
        const { rows, subtasks: flat } = await fetchProjectDashboardData(kfInstance);
        if (cancelled) return;
        setApiRows(rows);
        setApiAllSubtasks(flat ?? rows.flatMap((r) => r.subtasks || []));
      } catch (e) {
        if (!cancelled) {
          console.warn('Employee dashboard fetch failed:', e?.message || e);
          setLoadError(e?.message || 'Failed to load');
          setApiRows([]);
          setApiAllSubtasks([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kfInstance]);

  useEffect(() => {
    const kfUser = kfInstance?.user || {};
    const assigned = apiAllSubtasks
      .filter((t) => personMatches(kfUser, { id: t.assignedToId, email: t.assignedToEmail, name: t.assignedTo }))
      .map(normalizeEmployeeTask);
    const projectIdsFromTasks = new Set(assigned.map((t) => t.projectId));
    const prows = apiRows
      .filter((r) => personMatches(kfUser, { id: r.ownerId, email: r.ownerEmail, name: r.owner }) || projectIdsFromTasks.has(r.id))
      .map((r) => toEmployeeProject(r, kfUser));

    setSubtasks(assigned);
    setProjects(prows);
  }, [apiRows, apiAllSubtasks, kfInstance]);

  const handleComplete = useCallback(
    (id) => {
      setSubtasks((prev) => {
        const task = prev.find((t) => t.id === id);
        if (!task || task.status === 'Completed') return prev;
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status: 'Completed',
                isOverdue: false,
                completionDate: new Date().toISOString().split('T')[0],
              }
            : t,
        );
        const pid = task.projectId;
        setProjects((prows) =>
          prows.map((p) => {
            if (p.id !== pid) return p;
            const projectTasks = next.filter((t) => t.projectId === pid);
            const completed = projectTasks.filter((t) => t.status === 'Completed').length;
            const total = Math.max(projectTasks.length, 1);
            const progress = Math.round((completed / total) * 100);
            const rag = progress === 100 ? 'Green' : progress >= 50 ? 'Amber' : 'Red';
            return {
              ...p,
              completedTasks: completed,
              progress,
              rag,
              status: progress === 100 ? 'Completed' : p.status,
            };
          }),
        );
        addToast(`“${task.taskName}” marked complete`, 'success');
        return next;
      });
    },
    [addToast],
  );

  const handleStatusChange = useCallback(
    (id, status) => {
      setSubtasks((prev) => {
        const task = prev.find((t) => t.id === id);
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                isOverdue: status === 'Overdue',
                completionDate: status === 'Completed' ? new Date().toISOString().split('T')[0] : t.completionDate,
              }
            : t,
        );
        if (task) addToast(`“${task.taskName}” → ${status}`, 'info');
        return next;
      });
    },
    [addToast],
  );

  const handleMarkProjectComplete = useCallback(
    (projectId) => {
      const project = projects.find((p) => p.id === projectId);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId ? { ...p, status: 'Completed', progress: 100, rag: 'Green' } : p,
        ),
      );
      setSubtasks((prev) =>
        prev.map((t) =>
          t.projectId === projectId ? { ...t, status: 'Completed', isOverdue: false } : t,
        ),
      );
      if (project) addToast(`Project “${project.name}” marked complete`, 'success');
    },
    [projects, addToast],
  );

  const completedCount = subtasks.filter((t) => t.status === 'Completed').length;
  const overdueCount = subtasks.filter((t) => t.status === 'Overdue' || t.isOverdue).length;
  const completionRate = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const kpiData = {
    totalProjects: projects.length,
    totalSubtasks: subtasks.length,
    completedTasks: completedCount,
    completionRate,
    overdueTasks: overdueCount,
  };

  const profile = {
    name: userName,
    role: roleName,
    department: resolveRoleName(kfInstance?.user?.Department) || 'Operations',
    email: String(kfInstance?.user?.Email || kfInstance?.user?.email || '').trim() || '—',
    avatar: toInitials(userName),
  };

  const content = (
    <div className="min-h-screen bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff] p-2 pb-6 sm:p-6">
      <motion.div
        className="-mx-2 -mt-2 mb-3 sm:-mx-6 sm:-mt-6 sm:mb-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      >
        <EmpHeader profile={profile} overdueCount={overdueCount} initialNotifications={employeeNotifications} />
      </motion.div>

      <div className="mx-auto max-w-[1800px] space-y-3 lg:space-y-6">
        {loadError ? <p className="text-center text-[11px] text-amber-800 lg:text-left">Could not refresh data: {loadError}</p> : null}

        <motion.section
          data-aos="fade-up"
          data-aos-duration="520"
          initial={EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={EMP_MOTION.sectionEnter.transition}
          whileHover={EMP_MOTION.hoverLift}
        >
          <EmpKPICards data={kpiData} />
        </motion.section>

        <motion.section
          data-aos="fade-up"
          data-aos-delay="70"
          data-aos-duration="560"
          initial={EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={{ ...EMP_MOTION.sectionEnter.transition, delay: 0.04 }}
          whileHover={EMP_MOTION.hoverLift}
        >
          <EmpProgressChart projects={projects} />
        </motion.section>

        <motion.section
          data-aos="fade-up"
          data-aos-delay="120"
          data-aos-duration="600"
          initial={EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={{ ...EMP_MOTION.sectionEnter.transition, delay: 0.08 }}
          whileHover={EMP_MOTION.hoverLift}
        >
          <EmpProjectsTable projects={projects} subtasks={subtasks} onMarkProjectComplete={handleMarkProjectComplete} />
        </motion.section>

        <motion.section
          data-aos="fade-up"
          data-aos-delay="180"
          data-aos-duration="650"
          initial={EMP_MOTION.sectionEnter.initial}
          animate={EMP_MOTION.sectionEnter.animate}
          transition={{ ...EMP_MOTION.sectionEnter.transition, delay: 0.12 }}
          whileHover={EMP_MOTION.hoverLift}
        >
          <EmpSubtasksTable tasks={subtasks} onComplete={handleComplete} onStatusChange={handleStatusChange} />
        </motion.section>
      </div>

      <Toast toasts={toasts} onRemove={removeToast} />
          </div>
  );

  if (!useChromeLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}
