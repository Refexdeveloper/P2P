import { Fragment, useCallback, useEffect, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { adminApi, EmailLogRecord, WhatsAppLogRecord } from '../../../services/api';

const STATUS_COLORS: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  skipped: 'bg-amber-50 text-amber-800 border-amber-200',
  queued: 'bg-slate-50 text-slate-600 border-slate-200',
};

const EMAIL_TYPE_LABELS: Record<string, string> = {
  pr_raised: 'PR Raised (Ops)',
  pr_approval_pending: 'Approval Pending (L1/L2/CFO/SCM)',
  pr_post_rfq_action: 'PR Reject / Return',
  rfq_vendor: 'RFQ Vendor Invite',
  rfq_send_back: 'RFQ Send Back',
  rfq_submitted: 'RFQ Quote Submitted',
  po_vendor: 'PO Vendor Acceptance',
  po_workflow: 'PO Assign / Send Back / Reject',
  smtp_test: 'SMTP Test',
  generic: 'Other',
};

const WA_TYPE_LABELS: Record<string, string> = {
  workflow: 'Workflow Notify',
  whatsapp_test: 'WhatsApp Test',
};

function formatWhen(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

type Channel = 'email' | 'whatsapp';

export default function AdminEmailLogsPage() {
  const [channel, setChannel] = useState<Channel>('email');
  const [emailItems, setEmailItems] = useState<EmailLogRecord[]>([]);
  const [waItems, setWaItems] = useState<WhatsAppLogRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [retriggerRow, setRetriggerRow] = useState<EmailLogRecord | null>(null);
  const [extraTo, setExtraTo] = useState('');
  const [retriggering, setRetriggering] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const limit = 40;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (channel === 'email') {
        const res = await adminApi.listEmailLogs({
          status: status || undefined,
          emailType: typeFilter || undefined,
          search: search || undefined,
          page,
          limit,
        });
        setEmailItems(res.data.items);
        setWaItems([]);
        setTotal(res.data.total);
      } else {
        const res = await adminApi.listWhatsAppLogs({
          status: status || undefined,
          notifyType: typeFilter || undefined,
          search: search || undefined,
          page,
          limit,
        });
        setWaItems(res.data.items);
        setEmailItems([]);
        setTotal(res.data.total);
      }
    } catch {
      setEmailItems([]);
      setWaItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [channel, status, typeFilter, search, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const typeOptions = channel === 'email' ? EMAIL_TYPE_LABELS : WA_TYPE_LABELS;

  const switchChannel = (next: Channel) => {
    setChannel(next);
    setPage(1);
    setTypeFilter('');
    setExpandedId(null);
  };

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const canRetrigger = (status: string) =>
    status === 'skipped' || status === 'failed' || status === 'queued';

  const handleRetrigger = async () => {
    if (!retriggerRow) return;
    setRetriggering(true);
    try {
      const res = await adminApi.retriggerEmailLog(retriggerRow.id, extraTo.trim());
      showToast(res.message || 'Email sent', 'success');
      setRetriggerRow(null);
      setExtraTo('');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Retrigger failed', 'error');
    } finally {
      setRetriggering(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">Notification Logs</h1>
          <p className="text-sm text-slate-500 mt-1">
            Check whether PR / L1 manager and later workflow emails and WhatsApp messages were sent.
          </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => switchChannel('email')}
            className={`rounded-lg px-4 py-2 text-sm border ${
              channel === 'email'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            Email
          </button>
          <button
            type="button"
            onClick={() => switchChannel('whatsapp')}
            className={`rounded-lg px-4 py-2 text-sm border ${
              channel === 'whatsapp'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            WhatsApp
          </button>
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
              placeholder={
                channel === 'email'
                  ? 'PR number, subject, recipient…'
                  : 'PR number, phone, stage, wamid…'
              }
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
              value={typeFilter}
              onChange={(e) => {
                setPage(1);
                setTypeFilter(e.target.value);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {Object.entries(typeOptions).map(([code, label]) => (
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
            {channel === 'email' ? (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">PR / PO</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : emailItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        No email logs yet. Raise a PR to see L1 / approval mails appear here.
                      </td>
                    </tr>
                  ) : (
                    emailItems.map((row) => {
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
                              <div>{EMAIL_TYPE_LABELS[row.emailType] || row.emailType}</div>
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
                            <td
                              className="px-4 py-3 max-w-[220px] truncate text-slate-600"
                              title={row.toAddresses}
                            >
                              {row.toAddresses || '—'}
                            </td>
                            <td
                              className="px-4 py-3 max-w-[280px] truncate text-slate-700"
                              title={row.subject}
                            >
                              {row.subject}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              {canRetrigger(row.status) ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRetriggerRow(row);
                                    setExtraTo('');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800 hover:bg-teal-100"
                                >
                                  <i className="ri-refresh-line"></i>
                                  Retrigger
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                          {open ? (
                            <tr className="border-t border-slate-100 bg-slate-50/60">
                              <td colSpan={7} className="px-4 py-3 text-xs text-slate-600 space-y-1">
                                <div>
                                  <span className="font-medium text-slate-700">To:</span>{' '}
                                  {row.toAddresses || '—'}
                                </div>
                                {row.ccAddresses ? (
                                  <div>
                                    <span className="font-medium text-slate-700">CC:</span>{' '}
                                    {row.ccAddresses}
                                  </div>
                                ) : null}
                                {row.bccAddresses ? (
                                  <div>
                                    <span className="font-medium text-slate-700">BCC:</span>{' '}
                                    {row.bccAddresses}
                                  </div>
                                ) : null}
                                {row.messageId ? (
                                  <div>
                                    <span className="font-medium text-slate-700">Message ID:</span>{' '}
                                    {row.messageId}
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
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">When</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Stage</th>
                    <th className="px-4 py-3">PR / PO</th>
                    <th className="px-4 py-3">Phone</th>
                    <th className="px-4 py-3">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Loading…
                      </td>
                    </tr>
                  ) : waItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        No WhatsApp logs yet. Raise a PR (approval step) to see notifications here.
                      </td>
                    </tr>
                  ) : (
                    waItems.map((row) => {
                      const open = expandedId === row.id;
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
                              <div>{row.stage || WA_TYPE_LABELS[row.notifyType] || row.notifyType}</div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {WA_TYPE_LABELS[row.notifyType] || row.notifyType}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {row.prNumber || (row.prId ? `PR#${row.prId}` : '—')}
                              {row.poNumber ? (
                                <div className="text-xs text-slate-400">{row.poNumber}</div>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                              {row.toPhone || '—'}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{row.templateName || '—'}</td>
                          </tr>
                          {open ? (
                            <tr className="border-t border-slate-100 bg-slate-50/60">
                              <td colSpan={6} className="px-4 py-3 text-xs text-slate-600 space-y-1">
                                <div>
                                  <span className="font-medium text-slate-700">Phone:</span>{' '}
                                  {row.toPhone || '—'}
                                </div>
                                {row.wamid ? (
                                  <div>
                                    <span className="font-medium text-slate-700">WAMID:</span>{' '}
                                    {row.wamid}
                                  </div>
                                ) : null}
                                {row.sentAt ? (
                                  <div>
                                    <span className="font-medium text-slate-700">Sent at:</span>{' '}
                                    {formatWhen(row.sentAt)}
                                  </div>
                                ) : null}
                                {row.parameters?.length ? (
                                  <div>
                                    <span className="font-medium text-slate-700">Params:</span>{' '}
                                    <code className="text-[11px] bg-white border border-slate-200 rounded px-1 py-0.5">
                                      {JSON.stringify(row.parameters)}
                                    </code>
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
            )}
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

      {retriggerRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => !retriggering && setRetriggerRow(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-teal-50 border-b border-teal-100">
              <h3 className="text-base font-bold text-teal-900">Retrigger email</h3>
              <p className="text-xs text-teal-800 mt-0.5">Rebuild and send this skipped / failed mail again</p>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-500 uppercase">Subject</p>
                <p className="text-slate-800 mt-0.5">{retriggerRow.subject}</p>
                <p className="text-xs font-semibold text-slate-500 uppercase mt-2">Original To</p>
                <p className="text-slate-800 mt-0.5 break-all">{retriggerRow.toAddresses || '(none)'}</p>
                {retriggerRow.errorMessage ? (
                  <p className="text-xs text-red-600 mt-2">{retriggerRow.errorMessage}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Add extra recipient (optional)
                </label>
                <input
                  type="email"
                  value={extraTo}
                  onChange={(e) => setExtraTo(e.target.value)}
                  placeholder="name@refex.co.in"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Leave blank to send only to the original To. If original To is empty, this email is required.
                </p>
              </div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                disabled={retriggering}
                onClick={() => setRetriggerRow(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={retriggering}
                onClick={() => void handleRetrigger()}
                className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                {retriggering ? 'Sending…' : 'Send now'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-5 py-3 rounded-xl shadow-lg text-sm font-semibold ${
              toast.type === 'success' ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
            }`}
          >
            {toast.text}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
