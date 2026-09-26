/* eslint-disable max-lines -- Single-file Kissflow + app dashboard bundle */
import { useState, useCallback, useContext, useEffect, useRef, useMemo, Fragment } from 'react';
import { motion } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import { KissflowSDKContext, kf } from './sdk/index.js';

/** --- Kissflow API / data layer (from kfProjectDashboard) --- */
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

  // If embedded in an iframe, the top URL often contains the real /flow/2/<id>/... path.
  try {
    safePush(typeof window !== 'undefined' ? window?.top?.location?.href : '');
    safePush(typeof window !== 'undefined' ? window?.top?.location?.pathname : '');
    safePush(typeof window !== 'undefined' ? window?.parent?.location?.href : '');
    safePush(typeof window !== 'undefined' ? window?.parent?.location?.pathname : '');
  } catch {
    // Cross-origin/sandboxed frames: ignore.
  }

  // Kissflow URLs commonly look like: /flow/2/<ACCOUNT_ID>/application/... or /case/2/<ACCOUNT_ID>/...
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

function getQuarterKey(date) {
  const d = date instanceof Date ? date : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function getQuarterBounds(date) {
  const d = date instanceof Date ? date : new Date();
  const year = d.getFullYear();
  const qIndex = Math.floor(d.getMonth() / 3); // 0..3
  const startMonth = qIndex * 3;
  const start = new Date(year, startMonth, 1);
  const end = new Date(year, startMonth + 3, 1); // exclusive
  return { start, end, qIndex, year };
}

function computeQuarterOverQuarterTrend(projects) {
  const now = new Date();
  const { start: curStart, end: curEnd, qIndex, year } = getQuarterBounds(now);
  const prevStart = qIndex === 0 ? new Date(year - 1, 9, 1) : new Date(year, (qIndex - 1) * 3, 1);
  const prevEnd = curStart;

  const items = Array.isArray(projects) ? projects : [];
  const startDates = items
    .map((p) => parseKfDate(p?.startDate) || parseKfDate(p?.createdAt) || parseKfDate(p?._created_at))
    .filter(Boolean);

  const curCount = startDates.filter((d) => d >= curStart && d < curEnd).length;
  const prevCount = startDates.filter((d) => d >= prevStart && d < prevEnd).length;

  if (prevCount === 0) {
    if (curCount === 0) return { label: '+0%', positive: true };
    return { label: '+100%', positive: true };
  }

  const pct = ((curCount - prevCount) / prevCount) * 100;
  const rounded = Math.round(pct);
  const sign = rounded > 0 ? '+' : '';
  return { label: `${sign}${rounded}%`, positive: rounded >= 0 };
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
    const progressFromApi = Number(detail?.Project_Objectives ?? item?.Project_Objectives);
    const progress = Number.isFinite(progressFromApi)
      ? Math.max(0, Math.min(100, Math.round(progressFromApi)))
      : totalTasks > 0
        ? Math.round((completedTasks / totalTasks) * 100)
        : (status === 'Completed' ? 100 : status === 'Planning' ? 20 : 55);

    const rag = mapRag(detail?.RAG_Calculation ?? item?.RAG_Calculation, delayDays);
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

/** Loads subtask tracker items from Project_Sub_Task_A01. */
async function fetchSubtaskTrackerData(kfInstance) {
  const path =
    '/process/2/AcCMptp3yqcn/admin/Project_Sub_Task_A01/item?page_number=1&page_size=100000&apply_preference=1';
  const fullUrl = `https://development-refexgroup.kissflow.com${path}`;
  const payload = await fetchJson(kfInstance, path, fullUrl);
  const rows = Array.isArray(payload?.Data) ? payload.Data : [];
  const now = new Date();

  return rows.map((r, idx) => {
    const projectRef = r?.Project_ID || r?.Project_Lookup || r?.Project_Details || r?.Datelookup || {};
    const projectName =
      projectRef?.Project_Name ||
      projectRef?.Name ||
      r?.Project_ID?.Project_Name ||
      r?.Project_Lookup?.Project_Name ||
      r?.Project_ID_Details ||
      '—';

    const taskName = String(r?.Sub_Task_Name || r?.Name || '—').trim() || '—';
    const assignedTo = String(r?.Assigned_To?.Name || r?._created_by?.Name || '—').trim() || '—';

    const start = parseKfDate(r?.Start_Date || r?.fetch_start_date);
    const end = parseKfDate(r?.End_Date || r?.fetch_End_date || r?.Actual_End_Date_1);
    const startDate = fmtDate(start);
    const endDate = fmtDate(end);

    const status = String(r?.Task_Status || r?._status || '—').trim() || '—';

    const agingDays =
      r?.Aging_Days != null && r?.Aging_Days !== '' ? Number(r.Aging_Days) : start ? Math.max(0, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    const delayDays =
      r?.Delay_Days != null && r?.Delay_Days !== ''
        ? Number(r.Delay_Days)
        : end && status.toLowerCase() !== 'completed'
          ? Math.max(0, Math.ceil((now.getTime() - end.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

    return {
      id: String(r?.Subtaxk_id || r?._id || `SUBTASK-${idx + 1}`).trim(),
      InstanceID: String(r?._id || '').trim(),
      ActivityID: Array.isArray(r?._activity_instance_id) ? (r._activity_instance_id[0] ?? '') : (r?._activity_instance_id ?? ''),
      _id: r?._id,
      _activity_instance_id: r?._activity_instance_id,
      projectId: String(projectRef?._item_id || projectRef?._id || r?.Project_ID_Details || '').trim(),
      projectName,
      taskName,
      assignedTo,
      assigneeAvatar: toInitials(assignedTo),
      startDate,
      endDate,
      agingDays: Number.isFinite(agingDays) ? agingDays : 0,
      delayDays: Number.isFinite(delayDays) ? delayDays : 0,
      status,
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


/** --- Default KPI fallback (from cto-dashboard mock) --- */
const DEFAULT_CTO_KPI_METRICS = {
  totalProjects: 8,
  activeProjects: 6,
  completedProjects: 0,
  delayedProjects: 3,
  totalSubtasks: 15,
  openTasks: 9,
  completedTasks: 5,
  overdueTasks: 2,
  trendTotalProjects: '+12.5%',
  trendTotalProjectsPositive: true,
  trendActiveProjects: '75% of total',
  trendCompletedProjects: '0% completion rate',
  trendDelayedProjects: '37.5% at risk',
};


/** --- KPI section --- */



/** Inspired palette — high-contrast SaaS dashboard (+ RAG-style gradient shells / hover) */
const KPI_THEME = {
  total: {
    valueClass: 'text-[#2B5AED]',
    iconBg: 'bg-[#2B5AED]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(43,90,237,0.12)]',
    cardBg: 'from-sky-50/92 via-white to-indigo-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(43,90,237,0.22)]',
    hoverRing: 'group-hover:ring-[#2B5AED]/25',
    hoverBorder: 'group-hover:border-[#2B5AED]/40',
    glow: 'rgba(43,90,237,0.18)',
    iconRing: 'ring-1 ring-[#2B5AED]/20 group-hover:ring-white/50',
  },
  active: {
    valueClass: 'text-[#0084AD]',
    iconBg: 'bg-[#0084AD]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(0,132,173,0.12)]',
    cardBg: 'from-cyan-50/92 via-white to-sky-50/75',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(0,132,173,0.2)]',
    hoverRing: 'group-hover:ring-[#0084AD]/25',
    hoverBorder: 'group-hover:border-[#0084AD]/38',
    glow: 'rgba(0,132,173,0.16)',
    iconRing: 'ring-1 ring-[#0084AD]/20 group-hover:ring-white/50',
  },
  completed: {
    valueClass: 'text-[#22C55E]',
    iconBg: 'bg-[#22C55E]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(34,197,94,0.1)]',
    cardBg: 'from-emerald-50/92 via-white to-green-50/78',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(34,197,94,0.18)]',
    hoverRing: 'group-hover:ring-[#22C55E]/25',
    hoverBorder: 'group-hover:border-[#22C55E]/38',
    glow: 'rgba(34,197,94,0.14)',
    iconRing: 'ring-1 ring-emerald-500/20 group-hover:ring-white/50',
  },
  delayed: {
    valueClass: 'text-[#EF4444]',
    iconBg: 'bg-[#EF4444]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(239,68,68,0.1)]',
    cardBg: 'from-rose-50/92 via-white to-red-50/78',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(239,68,68,0.2)]',
    hoverRing: 'group-hover:ring-[#EF4444]/22',
    hoverBorder: 'group-hover:border-[#EF4444]/38',
    glow: 'rgba(239,68,68,0.14)',
    iconRing: 'ring-1 ring-red-500/20 group-hover:ring-white/55',
  },
  subtasks: {
    valueClass: 'text-[#8B5CF6]',
    iconBg: 'bg-[#8B5CF6]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(139,92,246,0.12)]',
    cardBg: 'from-violet-50/92 via-white to-purple-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(139,92,246,0.2)]',
    hoverRing: 'group-hover:ring-[#8B5CF6]/25',
    hoverBorder: 'group-hover:border-[#8B5CF6]/38',
    glow: 'rgba(139,92,246,0.16)',
    iconRing: 'ring-1 ring-violet-500/20 group-hover:ring-white/50',
  },
  open: {
    valueClass: 'text-[#F97316]',
    iconBg: 'bg-[#F97316]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(249,115,22,0.1)]',
    cardBg: 'from-amber-50/92 via-white to-orange-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(249,115,22,0.2)]',
    hoverRing: 'group-hover:ring-[#F97316]/25',
    hoverBorder: 'group-hover:border-[#F97316]/38',
    glow: 'rgba(249,115,22,0.14)',
    iconRing: 'ring-1 ring-orange-500/25 group-hover:ring-white/50',
  },
  tasksDone: {
    valueClass: 'text-[#0F766E]',
    iconBg: 'bg-[#0F766E]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(15,118,110,0.1)]',
    cardBg: 'from-teal-50/92 via-white to-emerald-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(15,118,110,0.18)]',
    hoverRing: 'group-hover:ring-[#0F766E]/25',
    hoverBorder: 'group-hover:border-[#0F766E]/38',
    glow: 'rgba(15,118,110,0.14)',
    iconRing: 'ring-1 ring-teal-600/22 group-hover:ring-white/50',
  },
  overdue: {
    valueClass: 'text-[#D946EF]',
    iconBg: 'bg-[#D946EF]/55',
    iconShadow: 'shadow-[0_6px_14px_-8px_rgba(217,70,239,0.1)]',
    cardBg: 'from-fuchsia-50/92 via-white to-pink-50/72',
    cardShadow: 'shadow-[0_10px_28px_-14px_rgba(217,70,239,0.2)]',
    hoverRing: 'group-hover:ring-[#D946EF]/25',
    hoverBorder: 'group-hover:border-[#D946EF]/38',
    glow: 'rgba(217,70,239,0.15)',
    iconRing: 'ring-1 ring-fuchsia-500/22 group-hover:ring-white/50',
  },
};

function PremiumKPICard({ title, value, subtitle, trend, icon, theme, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 380,
        damping: 28,
        delay: Math.min(index * 0.035, 0.25),
      }}
      whileHover={{
        y: -6,
        scale: 1.02,
        transition: { type: 'spring', stiffness: 420, damping: 22 },
      }}
      whileTap={{ scale: 0.985 }}
      className={`
        group relative cursor-default overflow-hidden rounded-xl border border-slate-200/88 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
        ${theme.cardBg}
        ${theme.cardShadow}
        transition-[box-shadow,border-color] duration-300 ease-out
        hover:shadow-[0_20px_48px_-16px_rgba(15,23,42,0.22)] hover:shadow-slate-400/20
        hover:ring-2 ring-transparent
        ${theme.hoverRing}
        ${theme.hoverBorder}
      `}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: theme.glow }}
      />
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 via-transparent to-slate-100/35 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-[11px] sm:tracking-[0.14em]">
            {title}
          </p>
          <p
            className={`mt-1.5 text-3xl font-bold tabular-nums leading-none tracking-tight sm:mt-2 sm:text-4xl ${theme.valueClass}`}
          >
            {value}
          </p>
          {subtitle ? (
            <p className="mt-1.5 text-[11px] font-medium text-slate-400 sm:mt-2 sm:text-xs">{subtitle}</p>
          ) : null}
          {trend ? (
            <p
              className={`mt-2 flex items-center gap-1 text-[11px] font-semibold sm:mt-2.5 sm:text-xs ${trend.positive ? 'text-[#22C55E]' : 'text-[#EF4444]'
                }`}
            >
              <i className={`${trend.positive ? 'ri-arrow-up-line' : 'ri-arrow-down-line'} text-xs sm:text-sm`} />
              {trend.value}
            </p>
          ) : null}
        </div>

        <div
          className={`
            relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/90 sm:h-12 sm:w-12 sm:rounded-xl
            ${theme.iconBg}
            ${theme.iconShadow}
            ${theme.iconRing}
            transition-all duration-300 ease-out
            group-hover:scale-105 group-hover:-rotate-[8deg] group-hover:shadow-[0_10px_22px_-12px_rgba(15,23,42,0.25)]
          `}
        >
          <i className={`${icon} text-lg transition-transform duration-300 group-hover:scale-110 sm:text-xl`} />
        </div>
      </div>
    </motion.div>
  );
}

function KPISection({ metrics }) {
  const k = metrics ?? DEFAULT_CTO_KPI_METRICS;
  const totalProjects = Math.max(k.totalProjects || 0, 1);
  const totalTasks = Math.max(k.totalSubtasks || 0, 1);

  const cards = [
    {
      title: 'Total Projects',
      value: k.totalProjects,
      subtitle: `${k.trendTotalProjects} from last quarter`,
      icon: 'ri-folder-3-line',
      theme: KPI_THEME.total,
      trend: { value: k.trendTotalProjects, positive: k.trendTotalProjectsPositive ?? true },
    },
    {
      title: 'Active Projects',
      value: k.activeProjects,
      subtitle: `${Math.round((k.activeProjects / totalProjects) * 100)}% of total`,
      icon: 'ri-notification-3-line',
      theme: KPI_THEME.active,
      trend: { value: `${k.activeProjects} running`, positive: true },
    },
    {
      title: 'Completed Projects',
      value: k.completedProjects,
      subtitle: `${Math.round((k.completedProjects / totalProjects) * 100)}% completion rate`,
      icon: 'ri-checkbox-circle-line',
      theme: KPI_THEME.completed,
      trend: { value: `${k.completedProjects} done`, positive: true },
    },
    {
      title: 'Delayed Projects',
      value: k.delayedProjects,
      subtitle: `${Math.round((k.delayedProjects / totalProjects) * 100)}% at risk`,
      icon: 'ri-error-warning-line',
      theme: KPI_THEME.delayed,
      trend: { value: `${k.delayedProjects} flagged`, positive: false },
    },
    {
      title: 'Total Tasks',
      value: k.totalSubtasks,
      subtitle: 'Across all active projects',
      icon: 'ri-list-check-3',
      theme: KPI_THEME.subtasks,
      trend: { value: `${k.totalSubtasks} tracked`, positive: true },
    },
    {
      title: 'Open Tasks',
      value: k.openTasks,
      subtitle: `${Math.round((k.openTasks / totalTasks) * 100)}% of total tasks`,
      icon: 'ri-folder-open-line',
      theme: KPI_THEME.open,
      trend: { value: `${k.openTasks} pending`, positive: false },
    },
    {
      title: 'Completed Tasks',
      value: k.completedTasks,
      subtitle: `${Math.round((k.completedTasks / totalTasks) * 100)}% task completion rate`,
      icon: 'ri-check-double-line',
      theme: KPI_THEME.tasksDone,
      trend: { value: `${k.completedTasks} closed`, positive: true },
    },
    {
      title: 'Overdue Tasks',
      value: k.overdueTasks,
      subtitle: 'Requires immediate action',
      icon: 'ri-alarm-warning-line',
      theme: KPI_THEME.overdue,
      trend: { value: `${k.overdueTasks} overdue`, positive: false },
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:gap-5 xl:grid-cols-4">
      {cards.map((card, index) => (
        <PremiumKPICard
          key={card.title}
          title={card.title}
          value={card.value}
          subtitle={card.subtitle}
          icon={card.icon}
          theme={card.theme}
          trend={card.trend}
          index={index}
        />
      ))}
    </div>
  );
}


/** --- RAG summary --- */


const ragCards = (green, amber, red, total) => {
  const pct = (n) => Math.round((n / total) * 100);
  return [
    {
      key: 'on-track',
      label: 'On Track',
      value: green,
      icon: '🟢',
      pct: pct(green),
      footnote: '% of projects',
      valueColor: 'text-[#22C55E]',
      iconWrap: 'bg-emerald-500/15 ring-1 ring-emerald-500/25',
      barColor: '#22C55E',
      barTrack: 'bg-emerald-100/80',
      cardBg: 'from-emerald-50/95 via-white to-green-50/80',
      borderHover: 'hover:border-emerald-300/60',
      ringHover: 'group-hover:ring-emerald-400/25',
      glow: 'rgba(34,197,94,0.22)',
      shadow: 'shadow-emerald-900/5',
    },
    {
      key: 'at-risk',
      label: 'At Risk',
      value: amber,
      icon: '🟡',
      pct: pct(amber),
      footnote: '% of projects',
      valueColor: 'text-[#F59E0B]',
      iconWrap: 'bg-amber-500/15 ring-1 ring-amber-500/30',
      barColor: '#F59E0B',
      barTrack: 'bg-amber-100/80',
      cardBg: 'from-amber-50/95 via-white to-yellow-50/70',
      borderHover: 'hover:border-amber-300/60',
      ringHover: 'group-hover:ring-amber-400/25',
      glow: 'rgba(245,158,11,0.2)',
      shadow: 'shadow-amber-900/5',
    },
    {
      key: 'delayed',
      label: 'Delayed',
      value: red,
      icon: '🔴',
      pct: pct(red),
      footnote: '% of projects',
      valueColor: 'text-[#EF4444]',
      iconWrap: 'bg-red-500/15 ring-1 ring-red-500/30',
      barColor: '#EF4444',
      barTrack: 'bg-red-100/80',
      cardBg: 'from-rose-50/95 via-white to-red-50/75',
      borderHover: 'hover:border-red-300/55',
      ringHover: 'group-hover:ring-red-400/25',
      glow: 'rgba(239,68,68,0.2)',
      shadow: 'shadow-red-900/5',
    },
  ];
};

function AnimatedBar({ widthPct, color, trackClass, delay }) {
  const x = Math.min(100, Math.max(0, widthPct)) / 100;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${trackClass}`}>
      <motion.div
        className="h-full w-full origin-left rounded-full"
        style={{ backgroundColor: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: x }}
        transition={{
          type: 'spring',
          stiffness: 120,
          damping: 18,
          delay,
        }}
      />
    </div>
  );
}

function RAGSummaryBar({ data }) {
  const total = Math.max(data.length, 1);
  const red = data.filter((p) => p.rag === 'Red').length;
  const amber = data.filter((p) => p.rag === 'Amber').length;
  const green = data.filter((p) => p.rag === 'Green').length;
  const overdue = data.reduce((acc, p) => acc + (p.delayDays > 0 ? 1 : 0), 0);
  const totalRevisions = data.reduce((acc, p) => acc + p.revisedCount, 0);
  const avgProgress = Math.round(data.reduce((acc, p) => acc + p.progress, 0) / total);
  const projectCount = data.length;
  const overduePct = Math.round((overdue / total) * 100);

  const revisionBarPct = Math.min(100, totalRevisions <= 0 ? 0 : Math.min(100, (totalRevisions / Math.max(projectCount * 8, 8)) * 100));

  const metricCards = [
    {
      key: 'avg-progress',
      label: 'Avg Progress',
      display: `${avgProgress}%`,
      footnote: 'Portfolio average',
      barPct: avgProgress,
      iconClass: 'ri-pie-chart-2-line',
      valueColor: 'text-[#2B5AED]',
      iconBg: 'bg-[#2B5AED]/12 text-[#2B5AED] ring-[#2B5AED]/25',
      barColor: '#2B5AED',
      barTrack: 'bg-blue-100/90',
      cardBg: 'from-sky-50/90 via-white to-indigo-50/70',
      borderHover: 'hover:border-blue-300/55',
      ringHover: 'group-hover:ring-blue-400/25',
      glow: 'rgba(43,90,237,0.18)',
      shadow: 'shadow-blue-900/5',
      delay: 0.15,
    },
    {
      key: 'revisions',
      label: 'Total Revisions',
      display: String(totalRevisions),
      footnote: `Across ${projectCount} project${projectCount === 1 ? '' : 's'}`,
      barPct: revisionBarPct,
      iconClass: 'ri-refresh-line',
      valueColor: 'text-[#EA580C]',
      iconBg: 'bg-orange-500/12 text-[#EA580C] ring-orange-500/25',
      barColor: '#F97316',
      barTrack: 'bg-orange-100/90',
      cardBg: 'from-orange-50/90 via-white to-amber-50/75',
      borderHover: 'hover:border-orange-300/55',
      ringHover: 'group-hover:ring-orange-400/25',
      glow: 'rgba(249,115,22,0.18)',
      shadow: 'shadow-orange-900/5',
      delay: 0.2,
    },
    {
      key: 'overdue',
      label: 'Overdue Projects',
      display: String(overdue),
      footnote: `${overduePct}% of portfolio`,
      barPct: overduePct,
      iconClass: 'ri-alarm-warning-line',
      valueColor: 'text-[#E11D48]',
      iconBg: 'bg-rose-500/12 text-rose-600 ring-rose-500/25',
      barColor: '#E11D48',
      barTrack: 'bg-rose-100/90',
      cardBg: 'from-rose-50/92 via-white to-fuchsia-50/65',
      borderHover: 'hover:border-rose-300/55',
      ringHover: 'group-hover:ring-rose-400/25',
      glow: 'rgba(225,29,72,0.16)',
      shadow: 'shadow-rose-900/5',
      delay: 0.25,
    },
  ];

  const items = ragCards(green, amber, red, total);

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5 xl:grid-cols-6"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      {items.map((item, index) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 28,
            delay: index * 0.05,
          }}
          whileHover={{
            y: -6,
            scale: 1.025,
            transition: { type: 'spring', stiffness: 420, damping: 22 },
          }}
          whileTap={{ scale: 0.985 }}
          data-aos="zoom-in"
          data-aos-duration="550"
          className={`
            group relative col-span-1 cursor-default overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
            ${item.cardBg}
            shadow-md ${item.shadow}
            transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-300/35
            hover:ring-2 ring-transparent ${item.ringHover}
            ${item.borderHover}
          `}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: item.glow }}
          />

          <div className="relative flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
                {item.label}
              </span>
              <motion.span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm sm:h-9 sm:w-9 sm:rounded-xl sm:text-base ${item.iconWrap} shadow-sm backdrop-blur-sm`}
                whileHover={{ scale: 1.12, rotate: [0, -6, 6, 0] }}
                transition={{ duration: 0.45 }}
              >
                {item.icon}
              </motion.span>
            </div>

            <motion.p
              className={`text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${item.valueColor}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.08 + index * 0.05 }}
            >
              {item.value}
            </motion.p>

            <AnimatedBar
              widthPct={item.pct}
              color={item.barColor}
              trackClass={item.barTrack}
              delay={0.12 + index * 0.06}
            />

            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">
              {item.pct}
              {item.footnote}
            </p>
          </div>
        </motion.div>
      ))}

      {metricCards.map((m, index) => (
        <motion.div
          key={m.key}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 380,
            damping: 28,
            delay: 0.12 + index * 0.05,
          }}
          whileHover={{
            y: -6,
            scale: 1.025,
            transition: { type: 'spring', stiffness: 420, damping: 22 },
          }}
          whileTap={{ scale: 0.985 }}
          data-aos="zoom-in"
          data-aos-duration="650"
          className={`
            group relative col-span-1 cursor-default overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br p-3.5 sm:rounded-2xl sm:p-5
            ${m.cardBg}
            shadow-md ${m.shadow}
            transition-shadow duration-300 hover:shadow-xl hover:shadow-slate-300/35
            hover:ring-2 ring-transparent ${m.ringHover}
            ${m.borderHover}
          `}
        >
          <div
            className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            style={{ background: m.glow }}
          />

          <div className="relative flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">
                {m.label}
              </span>
              <motion.div
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-base ring-1 sm:h-9 sm:w-9 sm:rounded-xl sm:text-lg ${m.iconBg}`}
                whileHover={{ scale: 1.1, rotate: -8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
              >
                <i className={m.iconClass} />
              </motion.div>
            </div>

            <motion.p
              className={`text-2xl font-bold tabular-nums tracking-tight sm:text-3xl ${m.valueColor}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22, delay: m.delay }}
            >
              {m.display}
            </motion.p>

            <AnimatedBar
              widthPct={m.barPct}
              color={m.barColor}
              trackClass={m.barTrack}
              delay={m.delay + 0.05}
            />

            <p className="text-[11px] font-medium text-slate-500 sm:text-xs">{m.footnote}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}


/** --- Project health table --- */


const PAGE_SIZE = 10;

const COLUMN_META = [
  { key: 'name', label: 'Project Name' },
  { key: 'owner', label: 'Owner' },
  { key: 'startDate', label: 'Start Date' },
  { key: 'endDate', label: 'End Date' },
  { key: 'revised', label: 'Revised' },
  { key: 'progress', label: 'Progress' },
  { key: 'rag', label: 'RAG Status' },
  { key: 'status', label: 'Status' },
];

function parseRowEndDate(row) {
  const s = row.revisedEndDate ?? row.originalEndDate;
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

function parseRowStartDate(row) {
  const s = row.startDate;
  if (s == null || s === '') return null;
  const t = Date.parse(String(s));
  return Number.isNaN(t) ? null : t;
}

function ragRank(rag) {
  const order = { Green: 1, Amber: 2, Red: 3 };
  return order[rag] ?? 99;
}

/** Sorted unique page indices with gaps filled visually via ellipsis in the UI */
function compactPageIndices(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2]);
  return [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
}

function RAGCell({ rag }) {
  const config = {
    Red: { bg: 'bg-red-50', border: 'border-l-4 border-[#E53935]', dot: '🔴', text: 'text-[#E53935]', label: 'Delayed' },
    Amber: { bg: 'bg-orange-50', border: 'border-l-4 border-[#FB8C00]', dot: '🟡', text: 'text-[#FB8C00]', label: 'At Risk' },
    Green: { bg: 'bg-green-50', border: 'border-l-4 border-[#43A047]', dot: '🟢', text: 'text-[#43A047]', label: 'On Track' },
  }[rag];
  if (!config) {
    return <span className="text-xs font-medium text-slate-500">—</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text}`}>
      <span>{config.dot}</span>
      {config.label}
    </span>
  );
}

function StatusCell({ status }) {
  const map = {
    Active: 'bg-blue-50 text-[#1E88E5]',
    Planning: 'bg-purple-50 text-purple-600',
    'On Hold': 'bg-orange-50 text-[#FB8C00]',
    Completed: 'bg-green-50 text-[#43A047]',
  };
  return (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ProgressCell({ value, compact }) {
  const color = value >= 70 ? '#43A047' : value >= 40 ? '#FB8C00' : '#E53935';
  return (
    <div className={`flex items-center gap-2 ${compact ? 'min-w-0 w-full' : 'min-w-[100px]'}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-xs font-bold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function SortHeader({ label, colKey, sortKey, sortDir, onSort }) {
  const active = sortKey === colKey;
  return (
    <th className="whitespace-nowrap px-5 py-3 text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSort(colKey);
        }}
        className={`group inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider transition-colors ${active ? 'text-[#1E88E5]' : 'text-[#7F8C8D] hover:text-slate-900'
          }`}
      >
        {label}
        <span className="flex flex-col leading-none opacity-70">
          <i
            className={`ri-arrow-up-s-fill text-[10px] ${active && sortDir === 'asc' ? 'text-[#1E88E5] opacity-100' : 'text-slate-300 group-hover:text-slate-400'}`}
            aria-hidden
          />
          <i
            className={`-mt-1 ri-arrow-down-s-fill text-[10px] ${active && sortDir === 'desc' ? 'text-[#1E88E5] opacity-100' : 'text-slate-300 group-hover:text-slate-400'}`}
            aria-hidden
          />
        </span>
      </button>
    </th>
  );
}

function formatProjectRef(displayId, rowId) {
  const raw = String(displayId ?? rowId ?? '').trim();
  if (!raw) return 'Task-NA';
  if (raw.startsWith('Task-')) return raw;
  return raw;
}

function ProjectHealthTable({ data, allTasks, onOpenTaskPopup, onCreateTaskPopup }) {
  const [ragFilter, setRagFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const owners = Array.from(new Set(data.map((d) => d.owner)));
  const statuses = Array.from(new Set(data.map((d) => d.status)));

  const filtered = useMemo(
    () =>
      data.filter((row) => {
        if (ragFilter !== 'all' && row.rag !== ragFilter) return false;
        if (statusFilter !== 'all' && row.status !== statusFilter) return false;
        if (ownerFilter !== 'all' && row.owner !== ownerFilter) return false;
        if (
          search &&
          !row.name.toLowerCase().includes(search.toLowerCase()) &&
          !row.owner.toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [data, ragFilter, statusFilter, ownerFilter, search],
  );

  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
        case 'owner':
          return dir * String(a.owner || '').localeCompare(String(b.owner || ''), undefined, { sensitivity: 'base' });
        case 'startDate': {
          const ta = parseRowStartDate(a);
          const tb = parseRowStartDate(b);
          if (ta == null && tb == null) return 0;
          if (ta == null) return sortDir === 'asc' ? 1 : -1;
          if (tb == null) return sortDir === 'asc' ? -1 : 1;
          return dir * (ta - tb);
        }
        case 'endDate': {
          const ta = parseRowEndDate(a);
          const tb = parseRowEndDate(b);
          if (ta == null && tb == null) return 0;
          if (ta == null) return sortDir === 'asc' ? 1 : -1;
          if (tb == null) return sortDir === 'asc' ? -1 : 1;
          return dir * (ta - tb);
        }
        case 'revised':
          return dir * ((a.revisedCount ?? 0) - (b.revisedCount ?? 0));
        case 'progress':
          return dir * ((a.progress ?? 0) - (b.progress ?? 0));
        case 'rag':
          return dir * (ragRank(a.rag) - ragRank(b.rag));
        case 'status':
          return dir * String(a.status || '').localeCompare(String(b.status || ''), undefined, { sensitivity: 'base' });
        default:
          return 0;
      }
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const total = sortedFiltered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, total);
  const pageRows = sortedFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, ragFilter, statusFilter, ownerFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setExpandedId(null);
  }, [search, ragFilter, statusFilter, ownerFilter, page, sortKey, sortDir]);

  const toggleExpand = (row) => {
    setExpandedId((id) => (id === row.id ? null : row.id));
  };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const rowBg = (rag) => {
    if (rag === 'Red') return 'hover:bg-red-50/60';
    if (rag === 'Amber') return 'hover:bg-orange-50/60';
    return 'hover:bg-green-50/40';
  };

  const pageIndexList = useMemo(() => compactPageIndices(safePage, totalPages), [safePage, totalPages]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Project Health Overview</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">
            {filtered.length} of {data.length} projects
            {totalPages > 1 ? ` · ${PAGE_SIZE} per page` : ''}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className="relative w-full sm:w-44 lg:w-44">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 lg:justify-end [&::-webkit-scrollbar]:hidden">
            <select
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="min-w-0 shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All RAG</option>
              <option value="Red">🔴 Red</option>
              <option value="Amber">🟡 Amber</option>
              <option value="Green">🟢 Green</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="min-w-0 shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="min-w-[7.5rem] shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:max-w-[180px] sm:text-xs"
            >
              <option value="all">All Owners</option>
              {owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2 lg:hidden">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sort by</span>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white py-1.5 pl-2 pr-6 text-[11px] font-medium text-slate-700"
        >
          {COLUMN_META.map((col) => (
            <option key={col.key} value={col.key}>
              {col.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          className="flex h-8 shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700"
          aria-label={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
        >
          <i className={sortDir === 'asc' ? 'ri-sort-asc' : 'ri-sort-desc'} />
          {sortDir === 'asc' ? 'A–Z' : 'Z–A'}
        </button>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {COLUMN_META.map((col) => (
                <SortHeader
                  key={col.key}
                  label={col.label}
                  colKey={col.key}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-inbox-line text-3xl text-gray-300" />
                    <p className="text-sm text-[#7F8C8D]">No projects found</p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearch('');
                        setRagFilter('all');
                        setStatusFilter('all');
                        setOwnerFilter('all');
                      }}
                      className="cursor-pointer text-xs text-[#1E88E5] hover:underline"
                    >
                      Clear filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const open = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr
                      onClick={() => toggleExpand(row)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleExpand(row);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} details for ${row.name}`}
                      className={`cursor-pointer border-b border-slate-100 transition-all duration-150 ${rowBg(row.rag)} ${open ? 'bg-slate-50/70' : ''}`}
                      style={{ height: '56px' }}
                    >
                  <td className="px-5 py-3">
                    <div className="flex items-start gap-2">
                      <i
                        className={`ri-arrow-down-s-line mt-0.5 shrink-0 text-base text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#2C3E50] transition-colors">{row.name}</p>
                        <p className="text-xs text-[#7F8C8D]">
                          {formatProjectRef(row.displayId, row.id)} · {row.lineOfBusiness}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-xs font-bold text-white">
                        {row.ownerAvatar}
                      </div>
                      <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.owner}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="whitespace-nowrap text-sm text-[#2C3E50]">{row.startDate || '—'}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="whitespace-nowrap text-sm text-[#2C3E50]">{row.revisedEndDate ?? row.originalEndDate}</p>
                      {row.delayDays > 0 ? <p className="text-xs font-medium text-[#E53935]">+{row.delayDays}d delay</p> : null}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line text-xs" />
                        {row.revisedCount}x
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <ProgressCell value={row.progress} />
                  </td>
                  <td className="px-5 py-3">
                    <RAGCell rag={row.rag} />
                  </td>
                  <td className="px-5 py-3">
                    <StatusCell status={row.status} />
                  </td>
                    </tr>
                    {open ? (
                      <tr className="bg-slate-50/95">
                        <td colSpan={8} className="border-b border-slate-200 p-0 align-top">
                          <div className="max-h-[min(70vh,36rem)] overflow-y-auto border-t border-slate-200/80">
                            <ProjectDrillDownPanel
                              project={row}
                              allTasks={allTasks}
                              onOpenTaskPopup={onOpenTaskPopup}
                              onCreateTaskPopup={onCreateTaskPopup}
                            />
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500 sm:text-sm">
            No projects found
          </div>
        )}
        {pageRows.map((row) => {
          const open = expandedId === row.id;
          return (
          <div
            key={row.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100 sm:rounded-2xl"
            data-aos="zoom-in-up"
            data-aos-duration="500"
          >
            <button
              type="button"
              onClick={() => toggleExpand(row)}
              aria-expanded={open}
              className="w-full p-3 text-left transition active:scale-[0.99] sm:p-4"
            >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                  {formatProjectRef(row.displayId, row.id)} · {row.lineOfBusiness}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-1.5">
                <i
                  className={`ri-arrow-down-s-line text-lg text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                  aria-hidden
                />
                <div className="scale-90 origin-top-right">
                  <RAGCell rag={row.rag} />
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[10px] font-bold text-white">
                {row.ownerAvatar}
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Owner</span>
                <p className="truncate font-medium text-slate-800">{row.owner}</p>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="shrink-0 text-slate-500">Start date</span>
                <span className="min-w-0 truncate text-right font-medium text-slate-800">{row.startDate || '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="shrink-0 text-slate-500">End date</span>
                <span className="min-w-0 truncate text-right font-medium text-slate-800">{row.revisedEndDate ?? row.originalEndDate}</span>
              </div>
              {row.delayDays > 0 ? (
                <p className="text-end text-[10px] font-medium text-[#E53935]">+{row.delayDays}d delay</p>
              ) : null}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Revised</span>
                {row.revisedCount > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FB8C00]">
                    <i className="ri-refresh-line text-[10px]" />
                    {row.revisedCount}×
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="rounded-lg bg-slate-50 px-2.5 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Progress</span>
                <div className="mt-1">
                  <ProgressCell value={row.progress} compact />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Status</span>
                <StatusCell status={row.status} />
              </div>
            </div>
            </button>
            {open ? (
              <div className="border-t border-slate-100 bg-slate-50/80">
                <div className="max-h-[min(75vh,40rem)] overflow-y-auto">
                  <ProjectDrillDownPanel
                    project={row}
                    allTasks={allTasks}
                    onOpenTaskPopup={onOpenTaskPopup}
                    onCreateTaskPopup={onCreateTaskPopup}
                  />
                </div>
              </div>
            ) : null}
          </div>
        );
        })}
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-2 py-2.5 sm:flex-row sm:gap-3 sm:px-5 sm:py-3 lg:items-stretch">
          <p className="w-full text-center text-[10px] text-slate-500 sm:w-auto sm:text-left sm:text-xs lg:text-xs">
            Showing <span className="font-semibold text-slate-700">{pageStart}</span>–
            <span className="font-semibold text-slate-700">{pageEnd}</span> of{' '}
            <span className="font-semibold text-slate-700">{total}</span>
          </p>
          <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-0.5 sm:w-auto sm:max-w-none sm:gap-1 lg:justify-end">
            <button
              type="button"
              aria-label="First page"
              disabled={safePage <= 1}
              onClick={() => setPage(1)}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              «
            </button>
            <button
              type="button"
              aria-label="Previous page"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              ‹
            </button>
            {pageIndexList.map((n, idx) => (
              <span key={n} className="flex items-center">
                {idx > 0 && pageIndexList[idx - 1] !== n - 1 ? (
                  <span className="px-1.5 text-xs font-medium text-slate-400" aria-hidden>
                    …
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label={`Page ${n}`}
                  aria-current={n === safePage ? 'page' : undefined}
                  onClick={() => setPage(n)}
                  className={`flex h-7 min-w-[1.6rem] items-center justify-center rounded-md border px-1.5 text-[10px] font-semibold shadow-sm transition sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:px-2 sm:text-xs ${n === safePage
                    ? 'border-[#1E88E5] bg-[#1E88E5] text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                >
                  {n}
                </button>
              </span>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              ›
            </button>
            <button
              type="button"
              aria-label="Last page"
              disabled={safePage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-md border border-slate-200 bg-white text-xs text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-w-[2rem] sm:rounded-lg sm:text-sm"
            >
              »
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}


/** --- Subtask table --- */

function StatusBadge({ status }) {
  const v = String(status || '').trim();
  const sLower = v.toLowerCase();
  const cfg =
    sLower === 'completed' || sLower === 'closed' || sLower === 'done'
      ? { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' }
      : sLower.includes('progress') || sLower.includes('review')
        ? { bg: 'bg-blue-50', text: 'text-[#1E88E5]', dot: 'bg-[#1E88E5]' }
        : sLower.includes('hold') || sLower.includes('blocked')
          ? { bg: 'bg-orange-50', text: 'text-[#FB8C00]', dot: 'bg-[#FB8C00]' }
          : { bg: 'bg-gray-100', text: 'text-[#7F8C8D]', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {v || '—'}
    </span>
  );
}

function SubtaskTable({
  data,
  onRowClick,
  onOpenPopup,
  hideTitle = false,
  countLabel,
  compact = false,
  headerActions = null,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const projects = Array.from(new Set(data.map((d) => d.projectName)));
  const statuses = Array.from(new Set(data.map((d) => d.status)));
  const filtered = data.filter((row) => {
    if (statusFilter !== 'all' && row.status !== statusFilter) return false;
    if (projectFilter !== 'all' && row.projectName !== projectFilter) return false;
    if (
      search &&
      !row.taskName.toLowerCase().includes(search.toLowerCase()) &&
      !row.assignedTo.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div
      className={`overflow-hidden rounded-2xl ${compact ? 'border border-slate-200 bg-white shadow-sm' : 'border border-white/80 bg-white/95 shadow-lg shadow-slate-200/40 backdrop-blur-sm'} lg:rounded-3xl`}
      data-aos="fade-up"
      data-aos-duration="700"
    >
      <div className={`flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/40 px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center ${compact ? 'sm:py-3' : ''}`}>
        {!hideTitle ? (
          <div className="text-center lg:text-left">
            <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Task Tracker</h3>
            <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">{filtered.length} tasks shown</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className={`text-slate-600 ${compact ? 'text-[11px]' : 'text-[11px]'} sm:text-xs`}>
              {typeof countLabel === 'function' ? countLabel(filtered.length) : (countLabel ?? `${filtered.length} tasks shown`)}
            </p>
          </div>
        )}

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <div className={`relative w-full ${compact ? 'sm:w-48' : 'sm:w-40'}`}>
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search task..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 outline-none focus:border-indigo-500 ${compact ? 'text-[11px]' : 'text-[11px]'} sm:text-xs`}
            />
          </div>
          <div className="flex snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All Status</option>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="min-w-[8rem] shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-500 sm:max-w-[180px] sm:text-xs"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {headerActions}
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Task Name', 'Project', 'Assigned To', 'Start Date', 'End Date', 'Aging', 'Delay', 'Status'].map((h) => (
                <th
                  key={h}
                  className={`whitespace-nowrap text-left font-semibold uppercase tracking-wider text-[#7F8C8D] ${compact ? 'px-4 py-2.5 text-[11px]' : 'px-5 py-3 text-xs'}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <i className="ri-task-line text-3xl text-gray-300" />
                    <p className="text-sm text-[#7F8C8D]">No tasks found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => {
                    const opened = typeof onOpenPopup === 'function' ? onOpenPopup(row) : false;
                    if (!opened) onRowClick?.(row);
                  }}
                  className="cursor-pointer border-b border-slate-100 transition-all duration-150 hover:bg-slate-50"
                  style={{ height: '56px' }}
                >
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <p className={`max-w-[200px] truncate font-medium text-[#2C3E50] ${compact ? 'text-[12px]' : 'text-sm'}`}>{row.taskName}</p>
                    <p className="text-xs text-[#7F8C8D]">{row.id}</p>
                  </td>
                  <td
                    className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}
                    onClick={(e) => e.stopPropagation()}
                    title={row.projectName}
                  >
                    <p className="max-w-[140px] truncate text-xs font-medium text-[#1E88E5]">{row.projectName}</p>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-xs font-bold text-[#1E88E5]">
                        {row.assigneeAvatar.slice(0, 2)}
                      </div>
                      <span className={`whitespace-nowrap text-[#2C3E50] ${compact ? 'text-[12px]' : 'text-sm'}`}>{row.assignedTo}</span>
                    </div>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <span className={`whitespace-nowrap text-[#2C3E50] ${compact ? 'text-[12px]' : 'text-sm'}`}>{row.startDate}</span>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <span className={`whitespace-nowrap ${compact ? 'text-[12px]' : 'text-sm'} ${row.status === 'Overdue' ? 'font-semibold text-[#E53935]' : 'text-[#2C3E50]'}`}>
                      {row.endDate}
                    </span>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <span className={`${compact ? 'text-[12px]' : 'text-sm'} text-[#7F8C8D]`}>{row.agingDays}d</span>
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    {row.delayDays > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-[#E53935]">+{row.delayDays}d</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-[#43A047]">On time</span>
                    )}
                  </td>
                  <td className={compact ? 'px-4 py-2.5' : 'px-5 py-3'}>
                    <StatusBadge status={row.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">No tasks found</div>
        )}
        {filtered.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => {
              const opened = typeof onOpenPopup === 'function' ? onOpenPopup(row) : false;
              if (!opened) onRowClick?.(row);
            }}
            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm ring-1 ring-slate-100 transition active:scale-[0.99] sm:rounded-2xl sm:p-4"
            data-aos="zoom-in-up"
            data-aos-duration="500"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#1E88E5]">Task</p>
                <p className="truncate text-sm font-semibold text-slate-800">{row.taskName}</p>
                <p className="mt-1 truncate text-[11px] font-medium text-[#1E88E5]">{row.projectName}</p>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">{row.id}</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1E88E5]/10 text-[10px] font-bold text-[#1E88E5]">
                  {row.assigneeAvatar.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500">Assignee</span>
                  <p className="truncate font-medium text-slate-800">{row.assignedTo}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Start</span>
                <span className="font-medium text-slate-800">{row.startDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">End</span>
                <span className={`font-medium ${row.status === 'Overdue' ? 'text-[#E53935]' : 'text-slate-800'}`}>{row.endDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Aging</span>
                <span className="font-medium text-slate-700">{row.agingDays}d</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Delay</span>
                {row.delayDays > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#E53935]">+{row.delayDays}d</span>
                ) : (
                  <span className="text-[10px] font-medium text-[#43A047]">On time</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={row.status} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}


/** --- Delay / revision --- */
function DelayRevisionSection({ data }) {
  const [search, setSearch] = useState('');
  const [ragFilter, setRagFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all'); // all | delayed | revised | both

  const delayed = useMemo(() => {
    const base = data.filter((p) => p.delayDays > 0 || p.revisedCount > 0);
    return base.filter((p) => {
      if (ragFilter !== 'all' && p.rag !== ragFilter) return false;
      if (typeFilter === 'delayed' && !(p.delayDays > 0)) return false;
      if (typeFilter === 'revised' && !(p.revisedCount > 0)) return false;
      if (typeFilter === 'both' && !(p.delayDays > 0 && p.revisedCount > 0)) return false;
      if (search) {
        const hay = `${p.name || ''} ${p.id || ''}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [data, ragFilter, typeFilter, search]);

  return (
    <div
      className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm lg:rounded-3xl lg:border-white/80 lg:bg-white/95 lg:shadow-lg lg:shadow-slate-200/40 lg:backdrop-blur-sm"
      data-aos="fade-up"
      data-aos-duration="700"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-gradient-to-r from-rose-50/60 to-white px-3 py-3 sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="text-center lg:text-left">
          <h3 className="text-sm font-semibold text-slate-800 sm:text-base">Delay &amp; Revision Tracker</h3>
          <p className="mt-0.5 text-[11px] text-slate-500 sm:text-xs">Projects with timeline changes</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto lg:justify-end">
          <div className="relative w-full sm:w-44 lg:w-44">
            <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-[#7F8C8D]" />
            <input
              type="text"
              placeholder="Search project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs shadow-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible sm:pb-0 lg:justify-end [&::-webkit-scrollbar]:hidden">
            <select
              value={ragFilter}
              onChange={(e) => setRagFilter(e.target.value)}
              className="min-w-0 shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All RAG</option>
              <option value="Red">🔴 Red</option>
              <option value="Amber">🟡 Amber</option>
              <option value="Green">🟢 Green</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="min-w-0 shrink-0 snap-start cursor-pointer rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] shadow-sm outline-none focus:border-indigo-500 sm:text-xs"
            >
              <option value="all">All</option>
              <option value="delayed">Delayed only</option>
              <option value="revised">Revised only</option>
              <option value="both">Delayed + revised</option>
            </select>
            <span className="inline-flex items-center justify-center gap-1.5 self-center rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-[#E53935] sm:self-auto sm:text-xs">
              <i className="ri-alarm-warning-line" aria-hidden />
              {delayed.length} affected
            </span>
          </div>
        </div>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70">
              {['Project', 'Original End Date', 'Latest Revised Date', 'Delay Days', 'Revisions', 'Risk'].map((h) => (
                <th key={h} className="whitespace-nowrap px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[#7F8C8D]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {delayed.map((row) => {
              const latestDate = row.revisedEndDate ?? row.originalEndDate;
              const isDelayed = row.delayDays > 0;
              return (
                <tr key={row.id} className="border-b border-slate-100 transition-all hover:bg-slate-50" style={{ height: '56px' }}>
                  <td className="px-5 py-3">
                    <p className="text-sm font-semibold text-[#2C3E50]">{row.name}</p>
                    <p className="text-xs text-[#7F8C8D]">{row.id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-sm text-[#2C3E50]">{row.originalEndDate}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-sm font-medium ${row.revisedEndDate ? 'text-[#FB8C00]' : 'text-[#7F8C8D]'}`}>
                      {latestDate}
                      {row.revisedEndDate ? <span className="ml-1 text-xs text-[#FB8C00]">(revised)</span> : null}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {isDelayed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-[#E53935]">
                        <i className="ri-time-line" aria-hidden />+{row.delayDays} days
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {row.revisedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">
                        <i className="ri-refresh-line" aria-hidden />
                        {row.revisedCount} revision{row.revisedCount > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-xs text-[#7F8C8D]">No revisions</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {row.rag === 'Red' ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#E53935]">🔴 Critical</span>
                    ) : row.rag === 'Amber' ? (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">🟡 At Risk</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-[#43A047]">🟢 Managed</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2.5 p-2.5 sm:space-y-3 sm:p-3 lg:hidden">
        {delayed.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-500">No delayed projects</div>
        )}
        {delayed.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100 sm:rounded-2xl sm:p-4" data-aos="zoom-in-up" data-aos-duration="500">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{row.id}</p>
              </div>
              {row.rag === 'Red' ? (
                <span className="shrink-0 rounded-lg bg-red-50 px-2 py-1 text-[10px] font-semibold text-[#E53935]">🔴 Critical</span>
              ) : row.rag === 'Amber' ? (
                <span className="shrink-0 rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-semibold text-[#FB8C00]">🟡 At Risk</span>
              ) : (
                <span className="shrink-0 rounded-lg bg-green-50 px-2 py-1 text-[10px] font-semibold text-[#43A047]">🟢 Managed</span>
              )}
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px]">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Original</span>
                <span className="font-medium text-slate-800">{row.originalEndDate}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Latest</span>
                <span className={`font-medium ${row.revisedEndDate ? 'text-[#FB8C00]' : 'text-slate-800'}`}>
                  {row.revisedEndDate ?? row.originalEndDate}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Delay</span>
                {row.delayDays > 0 ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-[#E53935]">+{row.delayDays}d</span>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5">
                <span className="text-slate-500">Revisions</span>
                <span className="font-medium text-slate-800">{row.revisedCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


/** --- Project drill-down (inline accordion panel) --- */

function ProjectDrillDownPanel({ project, allTasks, onOpenTaskPopup, onCreateTaskPopup }) {
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setActiveTab('overview');
  }, [project?.id]);

  const rows = Array.isArray(allTasks) ? allTasks : [];
  const pid = String(project?.id ?? '').trim();
  const pref = String(project?.displayId ?? '').trim();
  const linkedTasks = pid
    ? rows.filter((t) => {
        const tPid = String(
          t?.projectId ??
            t?.raw?.Project_ID?._item_id ??
            t?.raw?.Project_Lookup?._item_id ??
            '',
        ).trim();
        const tPref = String(
          t?.raw?.Project_ID?.Project_ID ??
            t?.raw?.Project_Lookup?.Project_ID ??
            t?.raw?.Project_ID_Details ??
            '',
        ).trim();
        return (tPid && tPid === pid) || (pref && tPref && tPref === pref);
      })
    : [];

  if (!project) return null;

  const p = project;
  const revisionHistory = Array.isArray(p.revisionHistory) ? p.revisionHistory : [];
  const revisedCount = p.revisedCount ?? revisionHistory.length;
  const completedTaskCount = linkedTasks.filter((t) => {
    const s = String(t?.status || '').toLowerCase();
    return s === 'completed' || s === 'closed' || s === 'done';
  }).length;

  const progressColor = p.progress >= 70 ? '#43A047' : p.progress >= 40 ? '#FB8C00' : '#E53935';

  const tabs = [
    { key: 'overview', label: 'Overview', icon: 'ri-dashboard-line' },
    { key: 'subtasks', label: `Tasks (${linkedTasks.length})`, icon: 'ri-list-check-3' },
    { key: 'revisions', label: `Revisions (${revisedCount})`, icon: 'ri-history-line' },
  ];

  return (
    <div className="flex min-h-0 flex-col bg-white">
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 bg-white px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex min-h-[2.5rem] shrink-0 snap-start cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:py-3 sm:text-sm ${activeTab === tab.key
              ? 'border-[#1E88E5] text-[#1E88E5]'
              : 'border-transparent text-[#7F8C8D] hover:text-[#2C3E50]'
              }`}
          >
            <i className={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="rounded-xl bg-[#F5F7FA] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-[#2C3E50]">Overall Progress</span>
                <span className="text-2xl font-bold" style={{ color: progressColor }}>
                  {p.progress}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${p.progress}%`, backgroundColor: progressColor }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-[#7F8C8D]">
                  {completedTaskCount} of {linkedTasks.length} tasks completed
                </span>
                <span className="text-xs text-[#7F8C8D]">{Math.max(0, linkedTasks.length - completedTaskCount)} remaining</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                { label: 'Start Date', value: p.startDate, icon: 'ri-calendar-line', color: 'text-[#1E88E5]' },
                { label: 'Original End Date', value: p.originalEndDate, icon: 'ri-calendar-check-line', color: 'text-[#43A047]' },
                {
                  label: 'Revised End Date',
                  value: p.revisedEndDate ?? 'No revision',
                  icon: 'ri-calendar-2-line',
                  color: p.revisedEndDate ? 'text-[#FB8C00]' : 'text-[#7F8C8D]',
                },
                {
                  label: 'Priority',
                  value: p.priority,
                  icon: 'ri-flag-line',
                  color: p.priority === 'High' ? 'text-[#E53935]' : p.priority === 'Medium' ? 'text-[#FB8C00]' : 'text-[#43A047]',
                },
                {
                  label: 'Delay Days',
                  value: p.delayDays > 0 ? `+${p.delayDays} days` : 'On schedule',
                  icon: 'ri-time-line',
                  color: p.delayDays > 0 ? 'text-[#E53935]' : 'text-[#43A047]',
                },
                {
                  label: 'Revisions',
                  value: `${revisedCount} revision${revisedCount !== 1 ? 's' : ''}`,
                  icon: 'ri-refresh-line',
                  color: revisedCount > 0 ? 'text-[#FB8C00]' : 'text-[#7F8C8D]',
                },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-3">
                  <div className="mb-1 flex items-center gap-1.5">
                    <i className={`${item.icon} text-sm ${item.color}`} />
                    <span className="text-xs text-[#7F8C8D]">{item.label}</span>
                  </div>
                  <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-xs text-[#7F8C8D]">Risk</p>
                <p className="text-sm font-semibold text-[#2C3E50]">{p.risk || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-xs text-[#7F8C8D]">Entity</p>
                <p className="text-sm font-semibold text-[#2C3E50]">{p.entity || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-xs text-[#7F8C8D]">Governance</p>
                <p className="text-sm font-semibold text-[#2C3E50]">{p.governanceFrequency || 'N/A'}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-white p-3">
                <p className="text-xs text-[#7F8C8D]">AI Usage</p>
                <p className={`text-sm font-semibold ${p.aiUsage ? 'text-[#43A047]' : 'text-[#7F8C8D]'}`}>
                  {p.aiUsage ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subtasks' && (
          <div className="space-y-3">
            <SubtaskTable
              data={linkedTasks}
              onOpenPopup={onOpenTaskPopup}
              hideTitle
              compact
              countLabel={(n) => `${n} task${n === 1 ? '' : 's'} assigned to this project`}
              headerActions={
                <button
                  type="button"
                  onClick={() => onCreateTaskPopup?.()}
                  className="shrink-0 inline-flex items-center gap-2 rounded-2xl bg-[#1E88E5] px-3 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:opacity-95 sm:text-xs"
                >
                  <i className="ri-add-line" aria-hidden />
                  Create task
                </button>
              }
            />
          </div>
        )}

        {activeTab === 'revisions' && (
          <div>
            {revisionHistory.length === 0 && (!p.activityHistory || p.activityHistory.length === 0) ? (
              <div className="flex flex-col items-center gap-2 py-10">
                <i className="ri-history-line text-3xl text-gray-300" />
                <p className="text-sm text-[#7F8C8D]">No revisions recorded</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute bottom-0 left-5 top-0 w-px bg-gray-200" />
                <div className="space-y-4">
                  {revisionHistory.map((rev, idx) => (
                    <div key={rev.key ?? idx} className="relative pl-12">
                      <div
                        className="absolute left-3.5 top-3 h-3 w-3 rounded-full border-2 border-white bg-[#FB8C00]"
                        style={{ boxShadow: '0 0 0 2px #FB8C00' }}
                      />
                      <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#FB8C00]">Revision #{idx + 1}</span>
                          <span className="text-xs text-[#7F8C8D]">{rev.date}</span>
                        </div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs text-[#7F8C8D] line-through">{rev.previousEndDate}</span>
                          <i className="ri-arrow-right-line text-xs text-[#FB8C00]" />
                          <span className="text-xs font-semibold text-[#FB8C00]">{rev.newEndDate}</span>
                        </div>
                        <p className="text-sm text-[#2C3E50]">{rev.reason}</p>
                        <p className="mt-1 text-xs text-[#7F8C8D]">Revised by: {rev.revisedBy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(p.activityHistory) && p.activityHistory.length > 0 ? (
              <div className="mt-6">
                <h4 className="mb-3 text-sm font-semibold text-[#2C3E50]">Activity History</h4>
                <div className="space-y-3">
                  {p.activityHistory.map((act) => (
                    <div key={act.key} className="rounded-xl border border-gray-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-[#2C3E50]">
                          {act.eventType} - {act.field}
                        </p>
                        <span className="text-xs text-[#7F8C8D]">{act.date || 'N/A'}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#7F8C8D]">
                        By: {act.by}
                        {act.status ? ` | Status: ${act.status}` : ''}
                      </p>
                      {(act.oldValue || act.newValue) && (
                        <p className="mt-1 text-xs text-[#2C3E50]">
                          {act.oldValue ? String(act.oldValue) : 'N/A'} → {act.newValue ? String(act.newValue) : 'N/A'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}


/** --- Main dashboard (from page-premium) --- */

const NAV_ITEMS = [
  { key: 'kpi', label: 'Analytics', icon: 'ri-layout-grid-line' },
  { key: 'rag', label: 'Health Monitor', icon: 'ri-speed-line' },
  { key: 'health', label: 'Projects', icon: 'ri-folder-3-line' },
  { key: 'subtasks', label: 'Tasks', icon: 'ri-checkbox-line' },
  { key: 'delay', label: 'Timeline', icon: 'ri-time-line' },
];
/** Soft, floaty spring — "jelly" motion when the active tab moves */
const JELLY_SPRING = {
  type: 'spring',
  stiffness: 115,
  damping: 13,
  mass: 1.05,
};
function DashboardPagePremium({ useLayout = true }) {
  const { kf: kfFromContext } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null) ?? (typeof kf !== 'undefined' ? kf : null);
  const [userName, setUserName] = useState('User');
  const [roleName, setRoleName] = useState('Admin');
  const [activeSection, setActiveSection] = useState('kpi');
  const [apiProjectData, setApiProjectData] = useState([]);
  const [apiSubtaskData, setApiSubtaskData] = useState([]);
  const sectionRefs = useRef({});
  const headerRef = useRef(null);

  const handleTaskTrackerOpenPopup = useCallback(
    (row) => {
      const sdk = kfInstance ?? ((typeof kf !== 'undefined' ? kf : null) ?? (typeof window !== 'undefined' ? window.kf : null));
      if (typeof sdk?.app?.page?.openPopup !== 'function') {
        console.warn('Task Tracker popup: openPopup not available', { hasSdk: Boolean(sdk) });
        return false;
      }

      const raw = row?.raw ?? row ?? {};
      const instanceId =
        raw?._id ??
        row?.InstanceID ??
        row?.InstanceId ??
        row?.instanceId ??
        row?.id ??
        row?._id ??
        '';
      const activityInstance =
        raw?._activity_instance_id ??
        row?.ActivityID ??
        row?.ActivityId ??
        row?.activityId ??
        row?.activityInstanceId ??
        row?._activity_instance_id ??
        '';
      const activityId = Array.isArray(activityInstance) ? (activityInstance[0] ?? '') : activityInstance;

      if (!instanceId || !activityId) {
        console.warn('Task Tracker popup: missing ids', { instanceId, activityId, row });
        return false;
      }

      try {
        // IMPORTANT: Call via sdk.app.page.openPopup(...) (preserve `this` binding),
        // matching the working `popupreference.jsx` pattern.
        const p = sdk.app.page.openPopup('Popup_mS9FovL2TO', {
          // Match working pattern: provide canonical keys + aliases.
          ActivityID: String(activityId),
          InstanceId: String(instanceId),
          ActivityInstanceId: String(activityId),
          ActivityId: String(activityId),
          activityId: String(activityId),
          InstanceID: String(instanceId),
          width: 960,
          height: 720,
          popupWidth: '960px',
          popupHeight: '720px',
        });
        if (p && typeof p.catch === 'function') {
          p.catch((err) => console.warn('Task Tracker popup: openPopup failed', err));
        }
        return true;
      } catch (err) {
        console.warn('Task Tracker popup: openPopup threw', err);
        return false;
      }
    },
    [kfInstance],
  );

  const handleTaskTrackerCreatePopup = useCallback(() => {
    const sdk = kfInstance ?? ((typeof kf !== 'undefined' ? kf : null) ?? (typeof window !== 'undefined' ? window.kf : null));
    if (typeof sdk?.app?.page?.openPopup !== 'function') {
      console.warn('Task Tracker popup: openPopup not available', { hasSdk: Boolean(sdk) });
      return false;
    }
    try {
      const p = sdk.app.page.openPopup('Popup_mS9FovL2TO', {
        width: 960,
        height: 720,
        popupWidth: '960px',
        popupHeight: '720px',
      });
      if (p && typeof p.catch === 'function') {
        p.catch((err) => console.warn('Task Tracker popup: openPopup failed', err));
      }
      return true;
    } catch (err) {
      console.warn('Task Tracker popup: openPopup threw', err);
      return false;
    }
  }, [kfInstance]);

  /** Offset by sticky header height so section titles aren't hidden under the bar */
  const scrollToSection = useCallback((key) => {
    setActiveSection(key);
    const align = () => {
      const el = sectionRefs.current[key];
      if (!el) return;
      const headerH = headerRef.current?.getBoundingClientRect().height ?? 0;
      const gap = 16;
      const offset = headerH + gap;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };
    requestAnimationFrame(() => requestAnimationFrame(align));
  }, []);
  useEffect(() => {
    if (!kfInstance?.user) return;
    const user = kfInstance.user;
    const resolvedName = String(user.Name || user.FirstName || 'User').trim();
    const resolvedRole = resolveRoleName(user.Role || user.Roles?.[0] || 'Admin');
    if (resolvedName) setUserName(resolvedName);
    if (resolvedRole) setRoleName(resolvedRole);
  }, [kfInstance]);
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const [projectsRes, subtasksRes] = await Promise.allSettled([
          fetchProjectDashboardData(kfInstance),
          fetchSubtaskTrackerData(kfInstance),
        ]);

        const rows = projectsRes.status === 'fulfilled' ? (projectsRes.value?.rows ?? []) : [];
        const subtasks =
          subtasksRes.status === 'fulfilled'
            ? (subtasksRes.value ?? [])
            : (projectsRes.status === 'fulfilled' ? (projectsRes.value?.subtasks ?? []) : []);

        if (!cancelled) {
          setApiProjectData(rows);
          setApiSubtaskData(subtasks);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Project items fetch failed:', error?.message || error);
          setApiProjectData([]);
          setApiSubtaskData([]);
        }
      }
    }
    run();
    return () => { cancelled = true; };
  }, [kfInstance]);
  const totalProjects = apiProjectData.length;
  const activeProjects = apiProjectData.filter((p) => p.status !== 'Completed').length;
  const completedProjects = apiProjectData.filter((p) => p.status === 'Completed').length;
  const delayedProjects = apiProjectData.filter((p) => p.delayDays > 0 && p.status !== 'Completed').length;
  const totalSubtasks = apiSubtaskData.length;
  const openTasks = apiSubtaskData.filter((t) => t.status !== 'Completed').length;
  const completedTasks = apiSubtaskData.filter((t) => t.status === 'Completed').length;
  const overdueTasks = apiSubtaskData.filter((t) => t.status === 'Overdue').length;
  const totalProjectsTrend = computeQuarterOverQuarterTrend(apiProjectData);

  const kpiMetrics = {
    totalProjects, activeProjects, completedProjects, delayedProjects,
    totalSubtasks, openTasks, completedTasks, overdueTasks,
    trendTotalProjects: totalProjectsTrend.label,
    trendTotalProjectsPositive: totalProjectsTrend.positive,
    trendActiveProjects: `${Math.round((activeProjects / Math.max(totalProjects, 1)) * 100)}% of total`,
    trendCompletedProjects: `${Math.round((completedProjects / Math.max(totalProjects, 1)) * 100)}% completion rate`,
    trendDelayedProjects: `${Math.round((delayedProjects / Math.max(totalProjects, 1)) * 100)}% at risk`,
  };
  const content = (
    <div className="bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff]">
      <div className="p-2 pb-6 sm:p-6">
        <motion.header
          ref={headerRef}
          data-dashboard-header
          className="sticky top-0 z-30 -mx-2 mb-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-2 pb-2.5 pt-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.2)] backdrop-blur-md sm:-mx-6 sm:mb-5 sm:px-6 sm:pb-4 sm:pt-3"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        >
          <div className="mx-auto flex max-w-[1800px] flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 shrink text-center lg:w-auto lg:py-0.5 lg:text-left">
              <h1 className="text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl md:text-3xl">
                {getGreetingText()}, <span className="font-semibold text-slate-900">{userName}</span>
              </h1>
              <p className="mt-0.5 text-[11px] font-medium text-slate-500 lg:text-sm">
                Logged in as <span className="text-slate-600">{roleName}</span>
              </p>
            </div>
            {/* Dashboard section tab bar temporarily hidden per request.
            <nav className="min-w-0 shrink-0 lg:max-w-none" aria-label="Dashboard sections">
              <LayoutGroup>
                <div className="mx-auto w-full max-w-full rounded-xl border border-slate-200/90 bg-white/95 p-0.5 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.18)] backdrop-blur-sm lg:w-max lg:rounded-2xl lg:p-1.5">
                  <div className="flex w-full snap-x snap-mandatory items-stretch justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] lg:inline-flex lg:w-auto lg:snap-none lg:flex-wrap lg:justify-end [&::-webkit-scrollbar]:hidden">
                    {NAV_ITEMS.map((item) => {
                      const isActive = activeSection === item.key;
                      return (
                        <motion.button
                          key={item.key}
                          type="button"
                          onClick={() => scrollToSection(item.key)}
                          whileHover={{ y: -2, transition: { type: 'spring', stiffness: 400, damping: 20 } }}
                          whileTap={{
                            scale: 0.94,
                            transition: { type: 'spring', stiffness: 500, damping: 22 },
                          }}
                          className={`relative inline-flex min-h-[2.35rem] shrink-0 snap-center items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-semibold leading-tight sm:px-3 sm:text-xs lg:min-h-0 lg:gap-2 lg:rounded-xl lg:px-4 lg:py-2.5 lg:text-sm ${
                            isActive ? 'text-white' : 'text-slate-600'
                          }`}
                        >
                          {isActive ? (
                            <motion.span
                              layoutId="dashboard-nav-active-pill"
                              className="absolute inset-0 z-0 rounded-lg bg-[#0f172a] shadow-[0_4px_14px_-4px_rgba(15,23,42,0.55)] lg:rounded-xl"
                              transition={JELLY_SPRING}
                              style={{ borderRadius: 14 }}
                            />
                          ) : null}
                          <span className="relative z-10 flex max-w-[5.5rem] flex-col items-center gap-0.5 sm:max-w-none sm:flex-row sm:gap-2">
                            <motion.span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs lg:h-7 lg:w-7 lg:rounded-lg lg:text-base"
                              animate={
                                isActive
                                  ? { scale: [1, 1.12, 1], rotate: [0, -4, 4, 0] }
                                  : { scale: 1, rotate: 0 }
                              }
                              transition={
                                isActive
                                  ? { duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }
                                  : { duration: 0.2 }
                              }
                            >
                              <i className={item.icon} aria-hidden />
                            </motion.span>
                            <span className="line-clamp-2 text-center sm:line-clamp-none lg:text-left">{item.label}</span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </LayoutGroup>
            </nav>
            */}
          </div>
        </motion.header>

        <div className="space-y-3 lg:space-y-6">
          <motion.section
            ref={(el) => { sectionRefs.current.kpi = el; }}
            id="kpi"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Insights</h2>
            </div>
            <KPISection metrics={kpiMetrics} />
          </motion.section>

          <motion.section
            ref={(el) => { sectionRefs.current.rag = el; }}
            id="rag"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <div className="mb-1.5 px-0.5 sm:mb-3">
              <h2 className="text-xs font-bold tracking-wide text-slate-700 sm:text-base">Health Monitor</h2>
            </div>
            <RAGSummaryBar data={apiProjectData} />
          </motion.section>

          <motion.section
            ref={(el) => { sectionRefs.current.health = el; }}
            id="health"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ProjectHealthTable
              data={apiProjectData}
              allTasks={apiSubtaskData}
              onOpenTaskPopup={handleTaskTrackerOpenPopup}
              onCreateTaskPopup={handleTaskTrackerCreatePopup}
            />
          </motion.section>

          <motion.section
            ref={(el) => { sectionRefs.current.subtasks = el; }}
            id="subtasks"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <DelayRevisionSection data={apiProjectData} />
          </motion.section>

          <motion.section
            ref={(el) => { sectionRefs.current.delay = el; }}
            id="delay"
            className="scroll-mt-24 lg:scroll-mt-32"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SubtaskTable data={apiSubtaskData} onOpenPopup={handleTaskTrackerOpenPopup} />
          </motion.section>
        </div>

      </div>
    </div>
  );
  if (!useLayout) return content;
  return <AppLayout>{content}</AppLayout>;
}

/**
 * Premium project dashboard — single file for Kissflow custom components (copy-paste friendly).
 * In the SPA, `DashboardPage.jsx` passes useLayout={true}; Kissflow embed uses default useLayout={false}.
 */
export default function ProjectDashboardPage({ useLayout = false }) {
  return <DashboardPagePremium useLayout={useLayout} />;
}
