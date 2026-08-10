export type ApprovalHistoryEntry = {
  stage: string;
  approver?: string;
  user?: string;
  role?: string;
  action?: string;
  status?: string;
  date: string;
  remarks?: string;
};

function haystack(entry: ApprovalHistoryEntry) {
  return `${entry.stage || ''} ${entry.role || ''} ${entry.approver || ''} ${entry.user || ''}`.toLowerCase();
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-4 shadow-sm">
        <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <i className="ri-user-star-line text-amber-600"></i>
          Manager Comments
        </h4>
        {manager ? (
          <>
            <p className="text-sm text-amber-950 leading-relaxed font-medium whitespace-pre-wrap">
              {manager.remarks}
            </p>
            <p className="text-xs text-amber-700/80 mt-2">
              {manager.approver || manager.user || 'Manager'}
              {manager.role ? ` · ${manager.role}` : ''}
              {manager.date ? ` · ${manager.date}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-amber-700/70 italic">No manager comments recorded.</p>
        )}
      </div>

      <div className="rounded-lg border-2 border-violet-300 bg-violet-50 p-4 shadow-sm">
        <h4 className="text-xs font-bold text-violet-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <i className="ri-shield-user-line text-violet-600"></i>
          L2 Manager Comments
        </h4>
        {l2 ? (
          <>
            <p className="text-sm text-violet-950 leading-relaxed font-medium whitespace-pre-wrap">
              {l2.remarks}
            </p>
            <p className="text-xs text-violet-700/80 mt-2">
              {l2.approver || l2.user || 'L2 Manager'}
              {l2.role ? ` · ${l2.role}` : ''}
              {l2.date ? ` · ${l2.date}` : ''}
            </p>
          </>
        ) : (
          <p className="text-sm text-violet-700/70 italic">No L2 manager comments recorded.</p>
        )}
      </div>
    </div>
  );
}

export default function ApprovalHistoryPanel({
  history,
}: {
  history: ApprovalHistoryEntry[];
}) {
  if (!history.length) {
    return <p className="text-sm text-gray-500 italic py-4">No approval history available.</p>;
  }

  return (
    <div className="space-y-0">
      {history.map((item, idx) => {
        const action = item.action || item.status || 'Updated';
        const who = item.approver || item.user || 'System';
        const isL2 = isL2ManagerEntry(item);
        const isMgr = isManagerEntry(item);
        const isBuyerSel = isScmBuyerSelectionEntry(item);
        const isVendorFinal = isVendorFinalEntry(item) && !isL2 && !isMgr;
        const cardCls = isBuyerSel
          ? 'bg-teal-50 border-teal-200'
          : isL2
            ? 'bg-violet-50 border-violet-200'
            : isMgr || isVendorFinal
              ? 'bg-amber-50 border-amber-200'
              : 'bg-gray-50 border-gray-100';

        return (
          <div key={`${item.stage}-${item.date}-${idx}`} className="flex gap-4 pb-6 relative">
            {idx !== history.length - 1 && (
              <div className="absolute left-4 top-10 w-0.5 h-full bg-gray-200"></div>
            )}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                action === 'Approved' || action === 'Created' || action === 'Submitted' || action === 'Completed' || action === 'Verified'
                  ? 'bg-emerald-100'
                  : action === 'Rejected'
                    ? 'bg-red-100'
                    : 'bg-amber-100'
              }`}
            >
              <i
                className={`text-sm ${
                  action === 'Approved' || action === 'Completed' || action === 'Verified'
                    ? 'ri-check-line text-emerald-600'
                    : action === 'Created'
                      ? 'ri-file-add-line text-emerald-600'
                      : action === 'Submitted'
                        ? 'ri-send-plane-line text-emerald-600'
                        : action === 'Rejected'
                          ? 'ri-close-line text-red-600'
                          : 'ri-time-line text-amber-600'
                }`}
              ></i>
            </div>
            <div className={`flex-1 rounded-lg p-4 border ${cardCls}`}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900">{item.stage}</p>
                    {isMgr && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                        Manager
                      </span>
                    )}
                    {isL2 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-violet-200 text-violet-900">
                        L2 Manager
                      </span>
                    )}
                    {isBuyerSel && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-200 text-teal-900">
                        SCM Buyer Selection
                      </span>
                    )}
                    {isVendorFinal && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                        Vendor Final
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {who}
                    {item.role ? ` · ${item.role}` : ''}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                    action === 'Approved' || action === 'Created' || action === 'Submitted' || action === 'Completed' || action === 'Verified'
                      ? 'bg-emerald-100 text-emerald-700'
                      : action === 'Rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {action}
                </span>
              </div>
              {item.remarks && (
                <p className="text-sm text-gray-800 mt-2 leading-relaxed whitespace-pre-wrap font-medium">
                  {item.remarks}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                <i className="ri-calendar-line"></i>
                {item.date}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
