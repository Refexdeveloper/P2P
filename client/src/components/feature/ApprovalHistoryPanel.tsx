import type { CSSProperties } from 'react';
import '../../styles/approval-history.css';
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

/** Colour + icon for a history step, from its action/status text. */
function stepTone(action: string): { tone: string; icon: string } {
  const a = action.toLowerCase();
  if (a.includes('reject')) return { tone: 'red', icon: 'ri-close-line' };
  if (a.includes('return') || a.includes('send back') || a.includes('sent back')) return { tone: 'orange', icon: 'ri-arrow-go-back-line' };
  if (a.includes('pending') || a.includes('waiting')) return { tone: 'amber', icon: 'ri-time-line' };
  if (a.includes('approv') || a.includes('complet') || a.includes('verif')) return { tone: 'green', icon: 'ri-check-line' };
  if (a.includes('creat')) return { tone: 'teal', icon: 'ri-file-add-line' };
  if (a.includes('submit')) return { tone: 'teal', icon: 'ri-send-plane-line' };
  return { tone: 'teal', icon: 'ri-history-line' };
}

export function ManagerL2CommentsHighlight({
  history,
}: {
  history: ApprovalHistoryEntry[];
}) {
  const manager = pickLatestComment(history, isManagerEntry);
  const l2 = pickLatestComment(history, isL2ManagerEntry);

  const cards = [
    { key: 'mgr', title: 'Manager Comments', icon: 'ri-user-star-line', tone: 'teal', entry: manager, fallbackWho: 'Manager', empty: 'No manager comments recorded.' },
    { key: 'l2', title: 'L2 Manager Comments', icon: 'ri-shield-user-line', tone: 'violet', entry: l2, fallbackWho: 'L2 Manager', empty: 'No L2 manager comments recorded.' },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cards.map((c, i) => (
        <div key={c.key} className={`ahx-comment tone-${c.tone}${c.entry ? '' : ' is-empty'}`} style={{ '--i': i } as CSSProperties}>
          <div className="flex items-center gap-2.5">
            <span className="ahx-comment-ic">
              <i className={c.icon} aria-hidden />
            </span>
            <h4 className="ahx-comment-title">{c.title}</h4>
          </div>
          {c.entry ? (
            <>
              <p className="ahx-quote">{c.entry.remarks}</p>
              <p className="ahx-meta">
                <span className="ahx-avatar">{(c.entry.approver || c.entry.user || c.fallbackWho).trim().charAt(0).toUpperCase()}</span>
                {c.entry.approver || c.entry.user || c.fallbackWho}
                {roleLabelForEntry(c.entry) ? ` · ${roleLabelForEntry(c.entry)}` : ''}
                {c.entry.date ? <span className="ahx-date"><i className="ri-calendar-line" aria-hidden /> {c.entry.date}</span> : null}
              </p>
            </>
          ) : (
            <p className="ahx-empty-text">{c.empty}</p>
          )}
        </div>
      ))}
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
      <div className="ahx-empty">
        <i className="ri-history-line" aria-hidden />
        <p>No approval history available.</p>
      </div>
    );
  }

  return (
    <ol className="ahx-timeline">
      {items.map((item, idx) => {
        const action = item.action || item.status || 'Updated';
        const who = item.approver || item.user || 'System';
        const isL2 = isL2ManagerEntry(item);
        const isMgr = isManagerEntry(item);
        const isBuyerSel = isScmBuyerSelectionEntry(item);
        const isVendorFinal = isVendorFinalEntry(item) && !isL2 && !isMgr;
        const { tone, icon } = stepTone(action);
        const tags = [
          isMgr && 'Manager',
          isL2 && 'L2 Manager',
          isBuyerSel && 'SCM Buyer Selection',
          isVendorFinal && 'Vendor Final',
        ].filter(Boolean) as string[];

        return (
          <li
            key={`${item.stage}-${item.date}-${idx}`}
            className={`ahx-step tone-${tone}`}
            style={{ '--i': idx } as CSSProperties}
          >
            <span className="ahx-dot" aria-hidden>
              <i className={icon} />
              <b>{idx + 1}</b>
            </span>
            <div className="ahx-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="ahx-stage">{item.stage}</p>
                    {tags.map((t) => (
                      <span key={t} className="ahx-tag">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="ahx-who">
                    <span className="ahx-avatar">{who.trim().charAt(0).toUpperCase()}</span>
                    {who}
                    {roleLabelForEntry(item) ? <span className="text-slate-400"> · {roleLabelForEntry(item)}</span> : null}
                  </p>
                </div>
                <span className="ahx-status">
                  <i className={icon} aria-hidden />
                  {action}
                </span>
              </div>
              {item.remarks && <p className="ahx-quote">{item.remarks}</p>}
              {item.date && (
                <span className="ahx-date">
                  <i className="ri-calendar-line" aria-hidden />
                  {item.date}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
