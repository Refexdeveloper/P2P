import { formatRoleDisplayName, isMugeshUser } from '../../utils/roleDisplay';

function roleLabelForEntry(entry: ApprovalHistoryEntry): string {
  const who = entry.approver || entry.user;
  if (isMugeshUser(who) || isMugeshUser({ name: who })) return '';
  // Cloud Subscription Mugesh steps are labeled by stage — never show CFO designation
  const stage = String(entry.stage || '').toLowerCase();
  if (stage.includes('mugesh')) return '';
  const role = String(entry.role || '');
  if (/^cfo$/i.test(role) && (stage.includes('mugesh') || isMugeshUser({ name: who }))) return '';
  return formatRoleDisplayName(role, { name: who });
}

export type ApprovalHistoryEntry = {
  stage: string;
  approver?: string;
  user?: string;
  role?: string;
  action?: string;
  status?: string;
  date: string;
  remarks?: string;
  step?: string;
};

function haystack(entry: ApprovalHistoryEntry) {
  return `${entry.stage || ''} ${entry.role || ''} ${entry.approver || ''} ${entry.user || ''}`.toLowerCase();
}

export function isPrAdminEditEntry(entry: Pick<ApprovalHistoryEntry, 'stage' | 'step' | 'status'>) {
  const label = `${entry.stage || ''} ${entry.step || ''}`
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .trim();
  const status = String(entry.status || '').toLowerCase();
  return label.includes('PR_ADMIN_EDIT') || (status === 'updated' && label.includes('ADMIN'));
}

/** Keep submit/approve/return rows visible; fold consecutive admin saves into one. */
export function collapsePrAdminEditHistory<T extends ApprovalHistoryEntry>(history: T[]): T[] {
  const out: Array<T & { editCount?: number }> = [];
  for (const entry of history) {
    const last = out[out.length - 1];
    if (last && isPrAdminEditEntry(entry) && isPrAdminEditEntry(last)) {
      last.editCount = (last.editCount || 1) + 1;
      last.date = entry.date;
      if (entry.approver) last.approver = entry.approver;
      if (entry.user) last.user = entry.user;
      if (entry.role) last.role = entry.role;
      if (entry.status) last.status = entry.status;
      if (entry.action) last.action = entry.action;
      last.remarks = entry.remarks;
      continue;
    }
    out.push({ ...entry, editCount: isPrAdminEditEntry(entry) ? 1 : 0 });
  }
  return out.map((entry) => {
    const { editCount, ...rest } = entry;
    if (editCount && editCount > 1) {
      const base = String(rest.remarks || '').trim();
      rest.remarks = base ? `${base} (${editCount} saves)` : `${editCount} admin saves`;
    }
    return rest as T;
  });
}

export function isL2ManagerEntry(entry: ApprovalHistoryEntry) {
  const h = haystack(entry);
  return h.includes('l2') || h.includes('pr manager');
}

export function isManagerEntry(entry: ApprovalHistoryEntry) {
  if (isL2ManagerEntry(entry)) return false;
  const h = haystack(entry);
  return (
    h.includes('hod') ||
    h.includes('vendor final') ||
    (h.includes('manager') && !h.includes('scm manager') && !h.includes('scm buyer')) ||
    h.includes('supervisor')
  );
}

export function isScmBuyerSelectionEntry(entry: ApprovalHistoryEntry) {
  const h = haystack(entry);
  return (
    h.includes('scm buyer vendor') ||
    h.includes('vendor selection') ||
    (h.includes('scm buyer') && (h.includes('selection') || h.includes('final rfq') || h.includes('create po')))
  );
}

export function isVendorFinalEntry(entry: ApprovalHistoryEntry) {
  const h = haystack(entry);
  return h.includes('vendor final') || h.includes('rfq submitted');
}

/** Latest matching entry that has remarks */
export function pickLatestComment(
  history: ApprovalHistoryEntry[],
  matcher: (entry: ApprovalHistoryEntry) => boolean
) {
  const matches = history.filter((h) => matcher(h) && String(h.remarks || '').trim());
  return matches.length ? matches[matches.length - 1] : null;
}

export function ManagerL2CommentsHighlight({
  history,
}: {
  history: ApprovalHistoryEntry[];
}) {
  const manager = pickLatestComment(history, isManagerEntry);
  const l2 = pickLatestComment(history, isL2ManagerEntry);

  const softWash = {
    background:
      'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
  } as const;

  const softCard =
    'relative overflow-hidden rounded-2xl border border-transparent bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]';

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className={softCard}>
        <div className="pointer-events-none absolute inset-0" style={softWash} />
        <div className="relative z-[1]">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
              <i className="ri-user-star-line text-sm"></i>
            </span>
            Manager Comments
          </h4>
          {manager ? (
            <>
              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#2C3E50]">
                {manager.remarks}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {manager.approver || manager.user || 'Manager'}
                {roleLabelForEntry(manager) ? ` · ${roleLabelForEntry(manager)}` : ''}
                {manager.date ? ` · ${manager.date}` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm italic text-slate-400">No manager comments recorded.</p>
          )}
        </div>
      </div>

      <div className={softCard}>
        <div className="pointer-events-none absolute inset-0" style={softWash} />
        <div className="relative z-[1]">
          <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E3F2FD] text-[#1E88E5]">
              <i className="ri-shield-user-line text-sm"></i>
            </span>
            L2 Manager Comments
          </h4>
          {l2 ? (
            <>
              <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#2C3E50]">
                {l2.remarks}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {l2.approver || l2.user || 'L2 Manager'}
                {roleLabelForEntry(l2) ? ` · ${roleLabelForEntry(l2)}` : ''}
                {l2.date ? ` · ${l2.date}` : ''}
              </p>
            </>
          ) : (
            <p className="text-sm italic text-slate-400">No L2 manager comments recorded.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ApprovalHistoryPanel({
  history,
}: {
  history: ApprovalHistoryEntry[];
}) {
  const items = collapsePrAdminEditHistory(history);
  if (!items.length) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-transparent bg-white px-4 py-8 text-center shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
          }}
        />
        <p className="relative z-[1] text-sm italic text-slate-500">No approval history available.</p>
      </div>
    );
  }

  const softWash = {
    background:
      'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(255,255,255,0) 55%)',
  } as const;

  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const action = item.action || item.status || 'Updated';
        const who = item.approver || item.user || 'System';
        const isL2 = isL2ManagerEntry(item);
        const isMgr = isManagerEntry(item);
        const isBuyerSel = isScmBuyerSelectionEntry(item);
        const isVendorFinal = isVendorFinalEntry(item) && !isL2 && !isMgr;
        const isPositive =
          action === 'Approved' ||
          action === 'Created' ||
          action === 'Submitted' ||
          action === 'Completed' ||
          action === 'Verified';
        const isRejected = action === 'Rejected';

        return (
          <div key={`${item.stage}-${item.date}-${idx}`} className="relative flex gap-4 pb-5">
            {idx !== items.length - 1 && (
              <div className="absolute left-4 top-10 h-full w-0.5 bg-[#BBDEFB]/70"></div>
            )}
            <div
              className={`z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
                isPositive
                  ? 'bg-[#E3F2FD] text-[#1E88E5]'
                  : isRejected
                    ? 'bg-rose-50 text-rose-500'
                    : 'bg-[#E3F2FD] text-[#1E88E5]'
              }`}
            >
              <i
                className={`text-sm ${
                  isPositive && action === 'Created'
                    ? 'ri-file-add-line'
                    : isPositive && action === 'Submitted'
                      ? 'ri-send-plane-line'
                      : isPositive
                        ? 'ri-check-line'
                        : isRejected
                          ? 'ri-close-line'
                          : 'ri-time-line'
                }`}
              ></i>
            </div>
            <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-transparent bg-white p-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
              <div className="pointer-events-none absolute inset-0" style={softWash} />
              <div className="relative z-[1]">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#2C3E50]">{item.stage}</p>
                      {isMgr && (
                        <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1E88E5]">
                          Manager
                        </span>
                      )}
                      {isL2 && (
                        <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1E88E5]">
                          L2 Manager
                        </span>
                      )}
                      {isBuyerSel && (
                        <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1E88E5]">
                          SCM Buyer Selection
                        </span>
                      )}
                      {isVendorFinal && (
                        <span className="rounded-full bg-[#E3F2FD] px-2 py-0.5 text-[10px] font-bold uppercase text-[#1E88E5]">
                          Vendor Final
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {who}
                      {roleLabelForEntry(item) ? ` · ${roleLabelForEntry(item)}` : ''}
                    </p>
                  </div>
                  <span
                    className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      isPositive
                        ? 'bg-[#E3F2FD] text-[#1E88E5]'
                        : isRejected
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {action}
                  </span>
                </div>
                {item.remarks && (
                  <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#2C3E50]">
                    {item.remarks}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <i className="ri-calendar-line"></i>
                  {item.date}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
