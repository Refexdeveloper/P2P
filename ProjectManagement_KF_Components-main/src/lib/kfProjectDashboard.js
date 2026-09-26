/** Kissflow Project Management case — shared list/detail mapping & fetch (CTO + employee dashboards). */

import { resolveKissflowAccountId, resolveKissflowOrigin, kfGetJson } from './kfRuntime.js';

const DEFAULT_ACCOUNT_ID = 'AcCMptp3yqcn';
export const CASE_ID = 'Project_Management_A01';

export const BASE_URL = resolveKissflowOrigin();

function getAccountId(kfInstance) {
  return resolveKissflowAccountId(kfInstance, DEFAULT_ACCOUNT_ID);
}

function getFieldsPath(accountId) {
  return `/case/2/${accountId}/${CASE_ID}/fields`;
}

function getProjectItemsPath(accountId) {
  return `/case/2/${accountId}/${CASE_ID}/view/Project_Management_A01_all/list/items`;
}

export function resolveRoleName(roleLike) {
  if (!roleLike) return '';
  if (typeof roleLike === 'string') return roleLike.trim();
  if (typeof roleLike === 'object') return String(roleLike.Name || roleLike.name || '').trim();
  return '';
}

export function getGreetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function toInitials(name) {
  const txt = String(name || '').trim();
  if (!txt) return 'NA';
  const parts = txt.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('') || 'NA';
}

export function parseKfDate(dateLike) {
  if (!dateLike) return null;
  const cleaned = String(dateLike).replace(/\s+[A-Za-z_\/]+$/, '');
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(d) {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export function mapStatus(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s.includes('complete')) return 'Completed';
  if (s.includes('plan') || s.includes('new') || s.includes('notstart')) return 'Planning';
  if (s.includes('hold')) return 'On Hold';
  return 'Active';
}

export function mapRag(value, delayDays) {
  const s = String(value || '').toLowerCase();
  if (s.includes('red')) return 'Red';
  if (s.includes('amber') || s.includes('yellow')) return 'Amber';
  if (s.includes('green')) return 'Green';
  return delayDays > 0 ? 'Red' : 'Green';
}

export function mapSubtaskStatus(raw, endDate) {
  const s = String(raw || '').trim().toLowerCase();
  const completed = s.includes('complete') || s.includes('closed') || s.includes('done');
  if (completed) return 'Completed';
  const due = parseKfDate(endDate);
  if (due && due < new Date()) return 'Overdue';
  if (s.includes('progress') || s.includes('review')) return 'In Progress';
  if (s.includes('overdue') || s.includes('delay')) return 'Overdue';
  return 'Pending';
}

export function pickDisplayRef(detail, item, subtasks, fallbackId) {
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

export function mapItemsToProjectRows(items, detailById, activityById, availableFieldIds) {
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
    const latestRevisionDate = timeline.length > 0
      ? fmtDate(
        parseKfDate(
          timeline[timeline.length - 1]?.New_Revised_Date ||
          timeline[timeline.length - 1]?.Changed_on ||
          timeline[timeline.length - 1]?._created_at,
        ),
      )
      : null;
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
      revisedEndDate: latestRevisionDate,
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
  return kfGetJson(kfInstance, path, fullUrl);
}

/** Loads all project rows + flattened subtasks from the same Kissflow endpoints as the CTO dashboard. */
export async function fetchProjectDashboardData(kfInstance) {
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

/** Normalize Kissflow user field vs display name (assignee / owner). */
export function personMatches(user, displayName) {
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
