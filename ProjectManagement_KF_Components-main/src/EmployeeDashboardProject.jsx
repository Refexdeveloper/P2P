/* eslint-disable max-lines -- Single-file Kissflow employee dashboard bundle */
import { useState, useCallback, useContext, useEffect, useId, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import AppLayout from './components/feature/AppLayout.jsx';
import { KissflowSDKContext, kf } from './sdk/index.js';


/** --- Shared data helpers --- */

/** Kissflow Project Management case — shared list/detail mapping & fetch (CTO + employee dashboards). */

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
const CASE_ID = 'Project_Management_A01';
const DEV_KISSFLOW_ORIGIN = 'https://development-refexgroup.kissflow.com';
const LIVE_KISSFLOW_ORIGIN = 'https://refexgroup.kissflow.com';

function resolveKissflowAccountId(kfInstance) {
  const sdkAccountId = String(kfInstance?.account?._id || '').trim();
  if (sdkAccountId) return sdkAccountId;

  const candidates = [];
  const safePush = (v) => {
    if (v) candidates.push(String(v));
  };

  safePush(typeof window !== 'undefined' ? window?.location?.href : '');
  safePush(typeof window !== 'undefined' ? window?.location?.pathname : '');
  safePush(typeof document !== 'undefined' ? document?.referrer : '');

  try {
    safePush(typeof window !== 'undefined' ? window?.top?.location?.href : '');
    safePush(typeof window !== 'undefined' ? window?.top?.location?.pathname : '');
    safePush(typeof window !== 'undefined' ? window?.parent?.location?.href : '');
    safePush(typeof window !== 'undefined' ? window?.parent?.location?.pathname : '');
  } catch {
    // ignore
  }

  const re = /\/(?:flow|case|metadata)\/2\/([^/]+)/i;
  for (const raw of candidates) {
    const match = raw.match(re);
    if (match?.[1]) return match[1];
  }
  return DEFAULT_ACCOUNT_ID;
}

function resolveKissflowBaseUrl() {
  const origin = typeof window !== 'undefined' && window?.location?.origin ? String(window.location.origin) : '';
  if (origin && origin.includes('kissflow.com')) return origin;

  const isDev =
    (typeof import.meta !== 'undefined' && import.meta?.env?.DEV) ||
    (typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development');

  return isDev ? DEV_KISSFLOW_ORIGIN : LIVE_KISSFLOW_ORIGIN;
}

const BASE_URL = resolveKissflowBaseUrl();
const getAccountId = (kfInstance) => resolveKissflowAccountId(kfInstance);
const getFieldsPath = (accountId) => `/case/2/${accountId}/${CASE_ID}/fields`;
const getProjectItemsPath = (accountId) => `/case/2/${accountId}/${CASE_ID}/view/Project_Management_A01_all/list/items`;

function resolveRoleName(roleLike) {
  if (!roleLike) return '';
  if (typeof roleLike === 'string') return roleLike.trim();
  if (typeof roleLike === 'object') return String(roleLike.Name || roleLike.name || '').trim();
  return '';
}

function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function toInitials(name) {
  const txt = String(name || '').trim();
  if (!txt) return 'NA';
  const parts = txt.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NA';
}

function parseKfDate(dateLike) {
  if (!dateLike) return null;
  const cleaned = String(dateLike).replace(/\s+[A-Za-z_\/]+$/, '');
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function mapStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('complete')) return 'Completed';
  if (s.includes('plan') || s.includes('new') || s.includes('notstart')) return 'Planning';
  if (s.includes('hold')) return 'On Hold';
  return 'Active';
}

function mapRag(value, delayDays) {
  const s = String(value || '').toLowerCase();
  if (s.includes('red')) return 'Red';
  if (s.includes('amber') || s.includes('yellow')) return 'Amber';
  if (s.includes('green')) return 'Green';
  return delayDays > 0 ? 'Red' : 'Green';
}

function mapSubtaskStatus(raw, endDate) {
  const s = String(raw || '').trim().toLowerCase();
  const completed = s.includes('complete') || s.includes('closed') || s.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (s.includes('progress') || s.includes('review')) return 'In Progress';
  if (s.includes('overdue') || s.includes('delay')) return 'Overdue';
  return 'Pending';
}

function pickDisplayRef(detail, item, subtasks, fallbackId) {
  const candidates = [
    detail?.Task_ID,
    detail?.Task_Id,
    detail?.TaskID,
    detail?.Project_Task_ID,
    detail?.Project_ID,
    detail?.Project_Id,
    detail?.ProjectID,
    detail?.Project_Code,
    detail?.Code,
    item?.Task_ID,
    item?.TaskId,
    item?.Project_ID,
    item?.ProjectId,
    item?.Project_Code,
    item?.Code,
    subtasks?.[0]?.Subtask_ID,
    subtasks?.[0]?._id,
  ];
  const normalized = candidates.map((v) => String(v ?? '').trim()).find(Boolean);
  return normalized || String(fallbackId ?? '');
}

function extractPersonRef(personLike, fallbackName) {
  if (!personLike || typeof personLike !== 'object') {
    return {
      name: String(fallbackName || '').trim(),
      id: '',
      email: '',
    };
  }
  return {
    name: String(personLike.Name || personLike.name || fallbackName || '').trim(),
    id: String(personLike._id || personLike.Id || personLike.id || personLike.UserId || '').trim(),
    email: String(personLike.Email || personLike.email || personLike.User_email || '').trim(),
  };
}

function mapItemsToProjectRows(items, detailById, activityById, availableFieldIds) {
  const now = new Date();
  const hasField = (id) => !availableFieldIds || availableFieldIds.has(id);
  return items.map((item, index) => {
    const id = item?._item_id || item?._id || `PRJ-${index + 1}`;
    const detail = detailById[id] || {};
    const ownerName = detail?.Business_Owner?.Name || item?.AssignedTo?.Name || item?.Requester?.Name || item?._created_by?.Name || 'Unassigned';
    const ownerRef = extractPersonRef(
      detail?.Business_Owner || item?.AssignedTo || item?.Requester || item?._created_by,
      ownerName,
    );
    const status = mapStatus(detail?._status_name || item?._status_name || detail?._category || item?._category || '');
    const dueDate = parseKfDate(detail?.End_Date || detail?.DueDate || item?.DueDate);
    const startDate = parseKfDate(detail?.Start_Date || detail?._start_date || item?._start_date || item?._created_at);
    const delayDays = status !== 'Completed' && dueDate && dueDate < now
      ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const timeline = Array.isArray(detail?.['Table::Project_Timeline_History']) ? detail['Table::Project_Timeline_History'] : [];
    const activities = Array.isArray(activityById[id]) ? activityById[id] : [];
    const subtasks = Array.isArray(detail?.['Table::Project_Subtasks']) ? detail['Table::Project_Subtasks'] : [];
    const completedTasks = subtasks.filter((s) => mapSubtaskStatus(s?.Task_Status_1, s?.End_date_2) === 'Completed').length;
    const totalTasks = subtasks.length;
    const progress = totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : (status === 'Completed' ? 100 : status === 'Planning' ? 20 : 55);
    const rag = mapRag(detail?.RAG_Calculation, delayDays);
    const displayId = pickDisplayRef(detail, item, subtasks, id);
    return {
      id,
      displayId,
      name: hasField('Project_Name') ? (detail?.Project_Name || item?.Name || `Project ${id}`) : (item?.Name || `Project ${id}`),
      owner: ownerName,
      ownerId: ownerRef.id,
      ownerEmail: ownerRef.email,
      ownerAvatar: toInitials(ownerName),
      lineOfBusiness: hasField('Project_Category') ? (detail?.Project_Category || 'Project Management') : 'Project Management',
      department: hasField('Department') ? (detail?.Department || detail?.Project_Department || detail?.Department_1 || 'N/A') : (detail?.Department || detail?.Project_Department || detail?.Department_1 || 'N/A'),
      priority: detail?._priority_name || item?._priority_name || detail?.Priority_1 || 'Low',
      startDate: fmtDate(startDate),
      originalEndDate: fmtDate(dueDate),
      revisedEndDate: null,
      revisedCount: timeline.length,
      progress,
      rag,
      status,
      delayDays,
      totalTasks,
      completedTasks,
      risk: hasField('Risk') ? (detail?.Risk || 'N/A') : 'N/A',
      governanceFrequency: hasField('Governance_Frequency') ? (detail?.Governance_Frequency || 'N/A') : 'N/A',
      entity: hasField('Entity') ? (detail?.Entity || 'N/A') : 'N/A',
      aiUsage: hasField('AI_Usage') ? Boolean(detail?.AI_Usage) : false,
      subtasks: subtasks.map((row, subIdx) => {
        const end = fmtDate(parseKfDate(row?.End_date_2));
        const st = mapSubtaskStatus(row?.Task_Status_1, row?.End_date_2);
        const due = parseKfDate(row?.End_date_2);
        const delay = st !== 'Completed' && due && due < now
          ? Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const assigneeName = row?.Assigned_To_1?.Name || 'Unassigned';
        const assigneeRef = extractPersonRef(row?.Assigned_To_1, assigneeName);
        return {
          id: row?.Subtask_ID || row?._id || `${id}-SUB-${subIdx + 1}`,
          projectId: id,
          projectName: detail?.Project_Name || item?.Name || `Project ${id}`,
          taskName: row?.Subtask_Name || 'Untitled Task',
          assignedTo: assigneeName,
          assignedToId: assigneeRef.id,
          assignedToEmail: assigneeRef.email,
          assigneeAvatar: toInitials(assigneeName),
          status: st,
          startDate: fmtDate(parseKfDate(row?.Start_Date_2)),
          endDate: end,
          agingDays: Number(row?.Aging_Days || 0),
          delayDays: delay,
        };
      }),
      revisionHistory: timeline.map((rev, revIdx) => ({
        date: fmtDate(parseKfDate(rev?.Changed_on || rev?._created_at)),
        previousEndDate: 'N/A',
        newEndDate: fmtDate(parseKfDate(rev?.New_Revised_Date || rev?.Changed_on)),
        reason: 'Timeline updated',
        revisedBy: rev?._created_by?.Name || 'System',
        key: rev?._id || `${id}-REV-${revIdx + 1}`,
      })),
      activityHistory: activities.map((event, actIdx) => {
        const change = event?._change_summary || {};
        const changeKeys = Object.keys(change);
        const firstKey = changeKeys[0];
        const firstChange = firstKey ? change[firstKey] : null;
        return {
          key: event?._id || `${id}-ACT-${actIdx + 1}`,
          date: fmtDate(parseKfDate(event?._created_at)),
          eventType: event?._event_type || 'Updated',
          field: event?._event_field || firstKey || 'Project',
          by: event?._created_by?.Name || 'System',
          oldValue: firstChange?.old_value?.Name || firstChange?.old_value || null,
          newValue: firstChange?.current_value?.Name || firstChange?.current_value || null,
          status: event?._status_name || null,
        };
      }),
    };
  });
}

async function fetchJson(kfInstance, path, fullUrl) {
  if (kfInstance?.api) {
    const resp = await kfInstance.api(path, { method: 'GET', headers: { Accept: 'application/json' } });
    return resp?.data ?? resp ?? null;
  }
  const res = await fetch(fullUrl, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Loads all project rows + flattened subtasks from the same Kissflow endpoints as the CTO dashboard. */
async function fetchProjectDashboardData(kfInstance) {
  const accountId = getAccountId(kfInstance);
  const fieldsPath = getFieldsPath(accountId);
  const listPath = getProjectItemsPath(accountId);

  const fieldsResponse = await fetchJson(kfInstance, fieldsPath, `${BASE_URL}${fieldsPath}`);
  const fieldIds = new Set((Array.isArray(fieldsResponse) ? fieldsResponse : []).map((f) => f?.Id).filter(Boolean));
  const listResponse = await fetchJson(kfInstance, listPath, `${BASE_URL}${listPath}`);
  const listItems = Array.isArray(listResponse?.Data) ? listResponse.Data : [];
  const itemIds = listItems.map((x) => x?._item_id || x?._id).filter(Boolean);
  const detailResults = await Promise.allSettled(
    itemIds.map((id) => {
      const path = `/case/2/${accountId}/${CASE_ID}/${id}`;
      return fetchJson(kfInstance, path, `${BASE_URL}${path}`);
    }),
  );
  const activityResults = await Promise.allSettled(
    itemIds.map((id) => {
      const path = `/case/2/${accountId}/${CASE_ID}/${id}/activity`;
      return fetchJson(kfInstance, path, `${BASE_URL}${path}`);
    }),
  );
  const detailById = {};
  const activityById = {};
  detailResults.forEach((res, idx) => {
    if (res.status === 'fulfilled' && res.value) detailById[itemIds[idx]] = res.value;
  });
  activityResults.forEach((res, idx) => {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) activityById[itemIds[idx]] = res.value;
  });
  const rows = mapItemsToProjectRows(listItems, detailById, activityById, fieldIds);
  const subtasks = rows.flatMap((r) => r.subtasks || []);
  return { rows, subtasks };
}

/** Loads task tracker items from Project_Sub_Task_A01 for employee dashboard. */
async function fetchTaskTrackerData(kfInstance) {
  const path =
    '/process/2/AcCMptp3yqcn/admin/Project_Sub_Task_A01/item?page_number=1&page_size=100000&apply_preference=1';
  const fullUrl = `https://development-refexgroup.kissflow.com${path}`;
  const payload = await fetchJson(kfInstance, path, fullUrl);
  const rows = Array.isArray(payload?.Data) ? payload.Data : [];
  const now = new Date();

  return rows.map((r, idx) => {
    const projectRefObj = r?.Project_ID || r?.Project_Lookup || r?.Project_Details || r?.Datelookup || {};
    const projectId = String(projectRefObj?._item_id || projectRefObj?._id || '').trim();
    const projectRef = String(projectRefObj?.Project_ID || r?.Project_ID_Details || '').trim();
    const projectName =
      String(projectRefObj?.Project_Name || projectRefObj?.Name || r?.Project_ID_Details || '').trim() || '—';

    const assignedTo = String(r?.Assigned_To?.Name || r?._created_by?.Name || 'Unassigned').trim() || 'Unassigned';
    const assignedToId = String(r?.Assigned_To?._id || '').trim();
    const assignedToEmail = String(r?.Assigned_To?.Email || r?.Assigned_To?.email || '').trim();

    const startRaw = parseKfDate(r?.Start_Date || r?.fetch_start_date);
    const endRaw = parseKfDate(r?.End_Date || r?.fetch_End_date || r?.Actual_End_Date_1);
    const startDate = fmtDate(startRaw);
    const endDate = fmtDate(endRaw);

    const status = mapSubtaskStatus(r?.Task_Status || r?._status, endRaw);
    const agingDays =
      r?.Aging_Days != null && r?.Aging_Days !== ''
        ? Number(r.Aging_Days)
        : startRaw
          ? Math.max(0, Math.ceil((now.getTime() - startRaw.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;
    const delayDays =
      r?.Delay_Days != null && r?.Delay_Days !== ''
        ? Number(r.Delay_Days)
        : endRaw && status !== 'Completed'
          ? Math.max(0, Math.ceil((now.getTime() - endRaw.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

    return {
      id: String(r?.Subtaxk_id || r?._id || `TASK-${idx + 1}`).trim(),
      projectId,
      projectRef,
      projectName,
      taskName: String(r?.Sub_Task_Name || r?.Name || 'Untitled Task').trim() || 'Untitled Task',
      assignedTo,
      assignedToId,
      assignedToEmail,
      assigneeAvatar: toInitials(assignedTo),
      status,
      priority: String(r?.Task_Priority || 'Medium').trim() || 'Medium',
      startDate,
      endDate,
      agingDays: Number.isFinite(agingDays) ? agingDays : 0,
      delayDays: Number.isFinite(delayDays) ? delayDays : 0,
      dueDate: endDate || '',
      isOverdue: status === 'Overdue' || (Number(delayDays) > 0 && status !== 'Completed'),
      completionDate: null,
      raw: r,
    };
  });
}

/** Normalize Kissflow user field vs display name (assignee / owner). */
function personMatches(user, displayName) {
  if (!user || !displayName) return false;
  const userId = String(user._id || user.Id || user.id || user.UserId || '').trim().toLowerCase();
  const userEmail = String(user.Email || user.email || user.User_email || '').trim().toLowerCase();
  const userName = String(user.Name || user.DisplayName || user.FullName || '').trim().toLowerCase();
  const userFirstName = String(user.FirstName || '').trim().toLowerCase();

  // Accept both plain string and rich refs { id, email, name } from mapped rows.
  const personRef = typeof displayName === 'object'
    ? displayName
    : { name: displayName };
  const targetId = String(personRef.id || personRef._id || personRef.UserId || '').trim().toLowerCase();
  const targetEmail = String(personRef.email || personRef.Email || '').trim().toLowerCase();
  const targetName = String(personRef.name || personRef.Name || '').trim().toLowerCase();

  // 1) Strong keys first.
  if (userId && targetId && userId === targetId) return true;
  if (userEmail && targetEmail && userEmail === targetEmail) return true;
  // 2) Exact/near-exact display name match.
  if (userName && targetName && (userName === targetName || userName.includes(targetName) || targetName.includes(userName))) return true;
  const userToken = (userFirstName || userName).split(/\s+/)[0] || '';
  const targetToken = targetName.split(/\s+/)[0] || '';
  if (userToken && targetToken && userToken === targetToken) return true;
  return false;
}


/** --- Employee motion presets --- */

const EMP_MOTION = {
  hoverLift: {
    y: -2,
    transition: { type: 'spring', stiffness: 320, damping: 24 },
  },
  tapPress: {
    scale: 0.98,
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  },
  rowTap: {
    scale: 0.996,
    transition: { type: 'spring', stiffness: 520, damping: 28 },
  },
  sectionEnter: {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.42, ease: 'easeOut' },
  },
  modalBackdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.22 },
  },
  modalPanel: {
    initial: { opacity: 0, y: 36, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 24, scale: 0.985 },
    transition: { type: 'spring', stiffness: 240, damping: 24 },
  },
  counter: {
    duration: 0.8,
    ease: 'easeOut',
  },
};



/** --- Toast --- */

/**
 * Lightweight toast stack for dashboard actions.
 * @typedef {{ id: string; message: string; type?: 'success'|'info'|'error' }} ToastMessage
 */

const tone = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-blue-200 bg-blue-50 text-slate-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

function Toast({ toasts = [], onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-2.5 right-2.5 z-[100] flex w-[92vw] max-w-sm flex-col gap-1.5 p-1.5 sm:bottom-6 sm:right-6 sm:w-auto sm:gap-2 sm:p-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start justify-between gap-2.5 rounded-lg border px-3 py-2.5 text-xs shadow-lg sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm ${tone[t.type] || tone.success}`}
          role="status"
        >
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => onRemove?.(t.id)}
            className="shrink-0 rounded-lg p-1 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <i className="ri-close-line text-base" aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}


/** --- Employee components --- */



function EmpHeader({ profile }) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="sticky top-0 z-30 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1.5 py-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E88E5] text-[10px] font-bold text-white shadow-[0_8px_20px_-4px_rgba(30,136,229,0.45)] sm:h-12 sm:w-12 sm:rounded-2xl sm:text-sm">
            {profile.avatar}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[11px] font-semibold text-slate-900 sm:text-base">{profile.name}</h2>
              <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[8px] font-semibold text-[#1E88E5] ring-1 ring-[#1E88E5]/20 sm:px-2.5 sm:text-xs">
                {profile.role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[9px] text-slate-600 sm:text-xs">{profile.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/90 px-2 py-1.5 text-[10px] text-slate-800 shadow-sm sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
            <i className="ri-calendar-line text-[#1E88E5]" />
            <span className="font-medium">{dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}







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

function EmpKPICards({ data }) {
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
    <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          className={`group relative min-w-[11.2rem] shrink-0 snap-start overflow-hidden rounded-lg border border-white/80 bg-gradient-to-br ${card.bar} p-2.5 shadow-[0_10px_28px_-14px_rgba(15,23,42,0.12)] backdrop-blur-sm ring-1 ${card.ring} transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.16)] sm:min-w-0 sm:rounded-2xl sm:p-4 lg:rounded-3xl lg:p-5`}
          data-aos="fade-up"
          data-aos-duration="600"
          whileHover={EMP_MOTION.hoverLift}
          whileTap={EMP_MOTION.tapPress}
        >
          <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-xs text-[#1E88E5] shadow-sm ring-1 ring-slate-200/60 sm:h-10 sm:w-10 sm:rounded-xl sm:text-base">
              <i className={card.icon} aria-hidden />
            </div>
          </div>
          <p className={`text-lg font-bold tabular-nums leading-none sm:text-3xl ${card.accent}`}>
            {card.label === 'Completion rate' ? <AnimatedValue value={data.completionRate} suffix="%" /> : <AnimatedValue value={card.value} />}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-slate-800 sm:mt-2 sm:text-sm">{card.label}</p>
          <p className="mt-0.5 text-[9px] text-slate-500 sm:text-xs">{card.subtext}</p>
        </motion.div>
      ))}
    </div>
  );
}







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

function EmpProgressChart({ projects }) {
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
      className="overflow-hidden rounded-xl border border-white/80 bg-white/95 p-3 shadow-lg shadow-slate-200/40 backdrop-blur-sm sm:p-6 lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="650"
      whileHover={EMP_MOTION.hoverLift}
    >
      <div className="mb-3 flex flex-col gap-2 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h3 className="text-xs font-semibold text-slate-800 sm:text-base">My progress overview</h3>
          <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">Completion across your assigned projects</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          {[
            { label: 'On track', count: onTrack, dot: 'bg-[#43A047]', bg: 'bg-green-50' },
            { label: 'At risk', count: atRisk, dot: 'bg-[#FB8C00]', bg: 'bg-orange-50' },
            { label: 'Delayed', count: delayed, dot: 'bg-[#E53935]', bg: 'bg-red-50' },
          ].map((item) => (
            <div key={item.label} className={`flex items-center gap-1 rounded-lg px-2 py-1 ${item.bg} sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:py-1.5`}>
              <div className={`h-2 w-2 rounded-full ${item.dot}`} />
              <span className="text-[10px] font-semibold text-slate-700 sm:text-xs">
                {item.count} {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 lg:flex-row lg:gap-8">
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative h-24 w-24 sm:h-32 sm:w-32">
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
              <span className="text-xl font-bold tabular-nums sm:text-2xl" style={{ color: stroke }}>
                {overallDisplay}%
              </span>
              <span className="text-[10px] font-medium text-slate-500">Overall</span>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] font-semibold text-slate-800 sm:mt-3 sm:text-xs">Task completion</p>
          <p className="text-center text-[9px] text-slate-500 sm:text-[10px]">
            {list.reduce((s, p) => s + p.completedTasks, 0)} / {list.reduce((s, p) => s + p.totalTasks, 0)} tasks
          </p>
        </div>

        <div className="w-full flex-1 space-y-3 sm:space-y-4">
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

function EmpProjectsTable({ projects, subtasks, onMarkProjectComplete }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const closeCommittedRef = useRef(false);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const prevHtml = document.documentElement.style.overflow;
    const prevBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  const getProjectSubtasks = (projectId) => subtasks.filter((t) => t.projectId === projectId);

  const openModal = (p) => {
    closeCommittedRef.current = false;
    setSelected(p);
    setOpen(true);
    setActiveTab('overview');
  };

  const requestClose = useCallback(() => {
    setOpen(false);
  }, []);

  const finishClose = useCallback(() => {
    if (closeCommittedRef.current) return;
    closeCommittedRef.current = true;
    setSelected(null);
  }, []);

  return (
    <>
      <div
        className="overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
        data-aos="fade-up"
        data-aos-duration="650"
      >
        <div className="flex flex-col gap-2.5 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-2.5 py-2.5 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1E88E5]/10 text-[#1E88E5]">
              <i className="ri-folder-3-line text-lg" aria-hidden />
            </div>
            <div className="text-center lg:text-left">
              <h3 className="text-xs font-semibold text-slate-800 sm:text-base">My projects</h3>
              <p className="text-[10px] text-slate-500 sm:text-xs">
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
                {['Project Name', 'Owner', 'Start Date', 'End Date', 'Revised', 'Progress', 'RAG Status', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
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
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-xs font-bold text-white">
                          {p.ownerAvatar}
                        </div>
                        <span className="whitespace-nowrap text-sm text-[#2C3E50]">{p.owner}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="whitespace-nowrap text-sm text-[#2C3E50]">{formatDate(p.startDate)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm ${overdue ? 'font-medium text-[#E53935]' : 'text-[#2C3E50]'}`}>
                        {formatDate(p.revisedEndDate ?? p.dueDate)}
                      </span>
                      {overdue ? <i className="ri-alarm-warning-line ml-1 text-xs text-[#E53935]" aria-hidden /> : null}
                    </td>
                    <td className="px-5 py-3">
                      {p.revisedCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                          <i className="ri-refresh-line text-xs" />
                          {p.revisedCount}x
                        </span>
                      ) : (
                        <span className="text-xs text-[#7F8C8D]">—</span>
                      )}
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
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${rag.bg}`} style={{ color: rag.text }}>
                        <span>{rag.dot}</span>
                        {rag.label}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[p.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {p.status}
                      </span>
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

      {typeof document !== 'undefined'
        ? createPortal(
      <AnimatePresence mode="sync" onExitComplete={finishClose}>
      {open && selected ? (
        <motion.div
          key={`emp-project-modal-${selected.id}`}
          className="fixed inset-0 z-[200] overflow-hidden bg-black/50 backdrop-blur-sm"
          onClick={requestClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="flex min-h-full items-center justify-center p-3 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <motion.div
              className="flex max-h-[80vh] w-full max-w-[58rem] flex-col overflow-hidden rounded-2xl bg-white"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.84, y: 32 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{
                opacity: 0,
                scale: 0.9,
                y: 22,
                transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.8 },
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 14, mass: 0.85 }}
              style={{
                transformOrigin: 'center center',
                boxShadow: '0 20px 60px rgba(31, 41, 55, 0.28)',
              }}
            >
              <div className="flex shrink-0 items-start justify-between border-b border-gray-100 bg-[#F5F7FA] px-6 py-5">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs font-semibold text-[#7F8C8D]">
                      {selected.displayId || selected.id}
                    </span>
                    <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${(ragConfig[selected.rag] || ragConfig.Green).bg}`} style={{ color: (ragConfig[selected.rag] || ragConfig.Green).text }}>
                      {(ragConfig[selected.rag] || ragConfig.Green).dot} {(ragConfig[selected.rag] || ragConfig.Green).label}
                    </span>
                    <span className={`rounded-lg px-2.5 py-0.5 text-xs font-semibold ${statusBadge[selected.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {selected.status}
                    </span>
                  </div>
                  <h2 className="truncate text-lg font-bold text-[#2C3E50]">{selected.name}</h2>
                  <p className="mt-0.5 text-xs text-[#7F8C8D]">{selected.lineOfBusiness}</p>
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  className="ml-4 flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#7F8C8D] transition-all hover:bg-gray-200 hover:text-[#2C3E50]"
                >
                  <i className="ri-close-line text-lg" aria-hidden />
                </button>
              </div>

              <div className="flex shrink-0 gap-1 border-b border-gray-100 bg-white px-6">
                {['overview', 'subtasks', 'activity'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium capitalize transition-all ${
                      activeTab === tab ? 'border-[#1E88E5] text-[#1E88E5]' : 'border-transparent text-[#7F8C8D] hover:text-[#2C3E50]'
                    }`}
                  >
                    {tab === 'subtasks' ? `Subtasks (${getProjectSubtasks(selected.id).length})` : tab}
                  </button>
                ))}
              </div>

              <div className="max-h-[64vh] overflow-y-auto overscroll-contain p-6">
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

              <div className="flex flex-col items-stretch justify-between gap-2 border-t border-gray-100 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-6 sm:py-4">
              <button type="button" onClick={requestClose} className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 sm:w-auto">
                Close
              </button>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => setActiveTab('subtasks')} className="w-full rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-[#1E88E5] sm:w-auto">
                  Subtasks
                </button>
                {selected.status !== 'Completed' ? (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkProjectComplete(selected.id);
                      requestClose();
                    }}
                    className="w-full rounded-xl bg-[#43A047] px-4 py-2 text-sm font-semibold text-white sm:w-auto"
                  >
                    Mark complete
                  </button>
                ) : null}
              </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
      </AnimatePresence>
      , document.body)
        : null}
    </>
  );
}







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

function formatTaskDate(d) {
  if (!d) return '—';
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? String(d) : t.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function EmpSubtasksTable({ tasks, onComplete, onStatusChange }) {
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
      className="overflow-hidden rounded-xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="650"
    >
      <div className="border-b border-slate-100 px-2.5 py-2.5 sm:px-5 sm:py-4">
        <div className="mb-2.5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#43A047]/10 text-[#43A047]">
              <i className="ri-checkbox-line text-lg" aria-hidden />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-800 sm:text-base">My tasks</h3>
              <p className="text-[10px] text-slate-500 sm:text-xs">
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
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-[11px] shadow-sm outline-none focus:border-[#1E88E5] sm:rounded-2xl sm:py-2 sm:text-xs"
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
                className={`flex min-h-[2rem] shrink-0 snap-start items-center gap-1.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition sm:text-xs ${
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
              {['Project', 'Task Name', 'Assigned To', 'Start Date', 'End Date', 'Aging', 'Delay', 'Status'].map((h) => (
                <th key={h || 'a'} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                  No tasks match
                </td>
              </tr>
            ) : (
              filtered.map((t, i) => {
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
                      <span className="rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-[#1E88E5]">{t.projectName || '—'}</span>
                    </td>
                    <td className="max-w-[220px] px-5 py-3">
                      <p className={`truncate text-sm font-medium text-[#2C3E50] ${isCompleted ? 'opacity-50 line-through' : ''}`}>{t.taskName}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-xs font-bold text-[#1E88E5]">
                          {(t.assigneeAvatar || toInitials(t.assignedTo || 'U')).slice(0, 2)}
                        </div>
                        <span className="whitespace-nowrap text-sm text-[#2C3E50]">{t.assignedTo || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-[#2C3E50]">{formatTaskDate(t.startDate)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-sm ${t.isOverdue ? 'font-medium text-[#E53935]' : 'text-[#2C3E50]'}`}>{formatTaskDate(t.endDate || t.dueDate)}</span>
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
                      {Number(t.delayDays) > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#E53935]">
                          +{t.delayDays}d
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-[#43A047]">On time</span>
                      )}
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
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 p-2 sm:p-3 lg:hidden">
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
                className={`rounded-xl border p-2.5 shadow-sm ring-1 ring-slate-100 ${t.status === 'Overdue' ? 'border-red-100 bg-red-50/30' : 'border-slate-200 bg-white'}`}
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
                    <span className={t.isOverdue ? 'font-medium text-[#E53935]' : 'font-medium text-slate-800'}>{formatTaskDate(t.dueDate)}</span>
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
                    className="w-full min-h-[2.25rem] rounded-lg bg-[#43A047] py-2 text-xs font-semibold text-white"
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


/** --- Employee page --- */







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

function EmployeeDashboardPage({ useLayout: useLayoutProp = true }) {
  const useChromeLayout = useLayoutProp;

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
        const [projectsRes, tasksRes] = await Promise.allSettled([
          fetchProjectDashboardData(kfInstance),
          fetchTaskTrackerData(kfInstance),
        ]);
        if (cancelled) return;

        const rows = projectsRes.status === 'fulfilled' ? (projectsRes.value?.rows ?? []) : [];
        const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value ?? []) : [];

        setApiRows(rows);
        setApiAllSubtasks(tasks);
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
    const projectRefsFromTasks = new Set(assigned.map((t) => String(t.projectRef || '').trim()).filter(Boolean));
    const prows = apiRows
      .filter((r) =>
        personMatches(kfUser, { id: r.ownerId, email: r.ownerEmail, name: r.owner }) ||
        projectIdsFromTasks.has(r.id) ||
        projectRefsFromTasks.has(String(r.displayId || '').trim()),
      )
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
    email: String(kfInstance?.user?.Email || kfInstance?.user?.email || '').trim() || '—',
    avatar: toInitials(userName),
  };

  const content = (
    <div className="min-h-screen scroll-smooth bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff] p-1.5 pb-4 sm:p-4 lg:p-6">
      <motion.div
        className="-mx-1.5 -mt-1.5 mb-2.5 sm:-mx-4 sm:-mt-4 sm:mb-5 lg:-mx-6 lg:-mt-6 lg:mb-6"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
      >
        <EmpHeader profile={profile} />
      </motion.div>

      <div className="mx-auto max-w-[1800px] space-y-2.5 sm:space-y-4 lg:space-y-6">
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




export default function EmployeeDashboardProject({ useLayout = false }) {
  return <EmployeeDashboardPage useLayout={useLayout} />;
}
