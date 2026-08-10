import { Fragment, useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { adminApi, EmailLogRecord } from '../../../services/api';

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-amber-50 text-amber-800 border-amber-200',
  queued: 'bg-slate-50 text-slate-600 border-slate-200',
};

const TYPE_LABELS: Record<string, string> = {
  pr_raised: 'PR Raised (Ops)',
  pr_approval_pending: 'Approval Pending (L1/L2/CFO/SCM)',
  pr_post_rfq_action: 'PR Reject / Return',
  rfq_vendor: 'RFQ Vendor Invite',
  rfq_send_back: 'RFQ Send Back',
  rfq_submitted: 'RFQ Quote Submitted',
  po_vendor: 'PO Vendor Acceptance',
  smtp_test: 'SMTP Test',
  generic: 'Other',
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export default function AdminEmailLogsPage() {
  const [items, setItems] = useState<EmailLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [emailType, setEmailType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const limit = 40;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listEmailLogs({
        status: status || undefined,
        emailType: emailType || undefined,
        search: search || undefined,
        page,
        limit,
      });
      setItems(res.data.items);
      setTotal(res.data.total);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [status, emailType, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Email Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Track whether PR raised, L1/L2 manager, and later workflow emails were sent successfully.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Search</label>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPage(1);
                  setSearch(searchInput.trim());
                }
              }}
              placeholder="PR number, subject, recipient…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="skipped">Skipped</option>
              <option value="queued">Queued</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
            <select
              value={emailType}
              onChange={(e) => {
                setPage(1);
                setEmailType(e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {Object.entries(TYPE_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setSearch(searchInput.trim());
            }}
            className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => load()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
          >
            Refresh
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">PR / PO</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Subject</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                      No email logs yet. Raise a PR to see L1 / approval mails appear here.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const open = expandedId === row.id;
                    const role =
                      row.meta && typeof row.meta === 'object' && 'assignedRole' in row.meta
                        ? String((row.meta as { assignedRole?: string }).assignedRole || '')
                        : '';
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className="border-t border-slate-100 hover:bg-slate-50/80 cursor-pointer"
                          onClick={() => setExpandedId(open ? null : row.id)}
                        >
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                            {formatWhen(row.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${
                                STATUS_COLORS[row.status] || STATUS_COLORS.queued
                              }`}
                            >
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div>{TYPE_LABELS[row.emailType] || row.emailType}</div>
                            {role ? (
                              <div className="text-xs text-slate-400 mt-0.5">Role: {role}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {row.prNumber || (row.prId ? `PR#${row.prId}` : '—')}
                            {row.poNumber ? (
                              <div className="text-xs text-slate-400">{row.poNumber}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 max-w-[220px] truncate text-slate-600" title={row.toAddresses}>
                            {row.toAddresses || '—'}
                          </td>
                          <td className="px-4 py-3 max-w-[280px] truncate text-slate-700" title={row.subject}>
                            {row.subject}
                          </td>
                        </tr>
                        {open ? (
                          <tr className="border-t border-slate-100 bg-slate-50/60">
                            <td colSpan={6} className="px-4 py-3 text-xs text-slate-600 space-y-1">
                              <div>
                                <span className="font-medium text-slate-700">To:</span> {row.toAddresses || '—'}
                              </div>
                              {row.ccAddresses ? (
                                <div>
                                  <span className="font-medium text-slate-700">CC:</span> {row.ccAddresses}
                                </div>
                              ) : null}
                              {row.bccAddresses ? (
                                <div>
                                  <span className="font-medium text-slate-700">BCC:</span> {row.bccAddresses}
                                </div>
                              ) : null}
                              {row.messageId ? (
                                <div>
                                  <span className="font-medium text-slate-700">Message ID:</span> {row.messageId}
                                </div>
                              ) : null}
                              {row.sentAt ? (
                                <div>
                                  <span className="font-medium text-slate-700">Sent at:</span>{' '}
                                  {formatWhen(row.sentAt)}
                                </div>
                              ) : null}
                              {row.errorMessage ? (
                                <div className="text-red-600">
                                  <span className="font-medium">Error:</span> {row.errorMessage}
                                </div>
                              ) : null}
                              {row.meta ? (
                                <div>
                                  <span className="font-medium text-slate-700">Meta:</span>{' '}
                                  <code className="text-[11px] bg-white border border-slate-200 rounded px-1 py-0.5">
                                    {JSON.stringify(row.meta)}
                                  </code>
                                </div>
                              ) : null}
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

          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm text-slate-600">
            <span>
              {total} log{total === 1 ? '' : 's'}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-2 py-1">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
