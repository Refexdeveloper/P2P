import { Fragment, useEffect, useRef, useState } from 'react';
import { InvoiceData } from '../../../../mocks/invoice-data';
import InvoiceExpandedRow from './InvoiceExpandedRow';

interface Props {
  invoices: InvoiceData[];
  onAction: (
    type: 'approve' | 'hold' | 'reject' | 'manager_approve' | 'upload',
    invoice: InvoiceData
  ) => void;
}

export default function InvoiceTable({ invoices, onAction }: Props) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const didAutoExpand = useRef(false);

  useEffect(() => {
    if (didAutoExpand.current || !invoices.length) return;
    didAutoExpand.current = true;
    const first =
      invoices.find((i) => i.status === 'Pending Verification' || i.status === 'Pending Manager Approval') ||
      invoices[0];
    setExpandedRow(first.invoiceNumber);
  }, [invoices]);

  const getStatusBadge = (status: string) => {
    const styles = {
      'Pending Verification': 'bg-orange-100 text-orange-700',
      Matched: 'bg-green-100 text-green-700',
      Discrepancy: 'bg-red-100 text-red-700',
      'Approved for Payment': 'bg-[#E3F2FD] text-[#1565C0]',
      'On Hold': 'bg-yellow-100 text-yellow-700',
      'Pending Manager Approval': 'bg-blue-100 text-blue-700',
      Paid: 'bg-emerald-100 text-emerald-700',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      high: 'bg-red-100 text-red-700',
      medium: 'bg-orange-100 text-orange-700',
      low: 'bg-green-100 text-green-700',
    };
    return styles[priority as keyof typeof styles] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="relative w-full min-w-0 overflow-x-clip rounded-2xl border border-transparent bg-[#F8FAFC]/90 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 100% 0%, rgba(30, 136, 229, 0.10) 0%, rgba(248,250,252,0) 55%)',
        }}
      />
      <div className="relative z-[1] overflow-x-auto px-0 pb-3 pt-1">
      <table className="w-max min-w-full border-separate border-spacing-x-0 border-spacing-y-3 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Invoice #
            </th>
            <th className="w-[240px] max-w-[240px] bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Title
            </th>
            <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Vendor
            </th>
            <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              PO / GRN
            </th>
            <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Amount
            </th>
            <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Due Date
            </th>
            <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Match
            </th>
            <th className="whitespace-nowrap bg-[#F8FAFC] px-3 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Status
            </th>
            <th className="sticky right-0 z-30 whitespace-nowrap bg-[#F8FAFC] py-1 pl-3 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const isExpanded = expandedRow === invoice.invoiceNumber;
            const rowBorder = isExpanded ? 'border-[#90CAF9]' : 'border-transparent group-hover:border-[#90CAF9]';
            const rowShadow = isExpanded
              ? 'shadow-[0_14px_32px_-14px_rgba(15,23,42,0.18)]'
              : 'shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] group-hover:shadow-[0_14px_32px_-14px_rgba(15,23,42,0.16)]';
            return (
            <Fragment key={invoice.id || invoice.invoiceNumber}>
              <tr
                className="group cursor-pointer"
                onClick={() => setExpandedRow(isExpanded ? null : invoice.invoiceNumber)}
              >
                <td className="relative sticky left-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]">
                  <div className={`relative z-[1] flex h-full items-center gap-2.5 whitespace-nowrap rounded-l-2xl border border-r-0 bg-white py-4 pl-3 pr-3 transition-[border-color,box-shadow] sm:rounded-l-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                    <button
                      type="button"
                      className={`flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl ${
                        isExpanded ? 'bg-[#1E88E5] text-white' : 'bg-[#E3F2FD] text-[#1E88E5]'
                      }`}
                      aria-expanded={isExpanded}
                    >
                      <i className={`ri-arrow-${isExpanded ? 'down' : 'right'}-s-line text-base`}></i>
                    </button>
                    <span className="text-sm font-bold text-[#1E88E5]" title={invoice.invoiceNumber}>
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                </td>
                <td className={`w-[240px] max-w-[240px] border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`} title={invoice.prTitle}>
                  <p className="truncate text-sm font-semibold text-[#2C3E50]">{invoice.prTitle || '—'}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{invoice.prId || '—'}</p>
                </td>
                <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                  <p className="text-sm font-semibold text-[#2C3E50]">{invoice.vendor}</p>
                </td>
                <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                  <p className="text-sm font-semibold text-[#2C3E50]">{invoice.poNumber}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{invoice.grnNumber || '—'}</p>
                </td>
                <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 text-right align-middle text-sm font-bold tabular-nums text-[#2C3E50] sm:py-5 ${rowBorder}`}>
                  ₹{invoice.invoiceGrandTotal.toLocaleString('en-IN')}
                </td>
                <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle text-sm text-slate-600 sm:py-5 ${rowBorder}`}>
                  {invoice.dueDate || '—'}
                </td>
                <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                  {invoice.matchStatus.overallMatch ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                      <i className="ri-checkbox-circle-fill"></i> All Match
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-rose-600">
                      <i className="ri-error-warning-fill"></i> Mismatch
                    </span>
                  )}
                </td>
                <td className={`whitespace-nowrap border border-x-0 bg-white px-3 py-4 align-middle sm:py-5 ${rowBorder}`}>
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(invoice.status)}`}>
                    {invoice.status}
                  </span>
                  <span className={`ml-1.5 inline-flex rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${getPriorityBadge(invoice.priority)}`}>
                    {invoice.priority}
                  </span>
                </td>
                <td
                  className="relative sticky right-0 z-20 h-px bg-[#F8FAFC] p-0 before:pointer-events-none before:absolute before:inset-x-0 before:-bottom-3 before:-top-3 before:z-0 before:bg-[#F8FAFC]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`relative z-[1] flex h-full flex-nowrap items-center justify-end gap-1.5 whitespace-nowrap rounded-r-2xl border border-l-0 bg-white py-4 pl-3 pr-4 sm:rounded-r-[18px] sm:py-5 ${rowBorder} ${rowShadow}`}>
                    {(invoice.statusRaw === 'awaiting_upload' || !invoice.hasInvoiceFile) &&
                      invoice.status !== 'Approved for Payment' &&
                      invoice.status !== 'Paid' && (
                        <button
                          onClick={() => onAction('upload', invoice)}
                          className="px-2.5 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 whitespace-nowrap"
                          title="Upload invoice"
                        >
                          <i className="ri-upload-2-line mr-1"></i> Add Invoice
                        </button>
                      )}
                    {(invoice.status === 'Pending Verification' || invoice.status === 'Matched') &&
                      invoice.hasInvoiceFile && (
                        <>
                          <button
                            onClick={() => onAction('approve', invoice)}
                            className="px-2.5 py-1.5 bg-[#1E88E5] text-white text-xs font-medium rounded-lg hover:bg-[#1565C0] transition-colors whitespace-nowrap"
                            title="Send to Manager"
                          >
                            <i className="ri-send-plane-fill"></i>
                          </button>
                          <button
                            onClick={() => onAction('hold', invoice)}
                            className="px-2.5 py-1.5 bg-orange-500 text-white text-xs font-medium rounded-lg hover:bg-orange-600 transition-colors whitespace-nowrap"
                            title="Put On Hold"
                          >
                            <i className="ri-pause-circle-line"></i>
                          </button>
                          <button
                            onClick={() => onAction('reject', invoice)}
                            className="px-2.5 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                            title="Raise Discrepancy"
                          >
                            <i className="ri-error-warning-line"></i>
                          </button>
                        </>
                      )}
                    {invoice.status === 'Pending Manager Approval' && (
                      <button
                        onClick={() => onAction('manager_approve', invoice)}
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-[#1E88E5] text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-[#1565C0] transition-all whitespace-nowrap"
                      >
                        Manager Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {isExpanded && (
                <tr>
                  <td colSpan={9} className="bg-transparent p-0">
                    <div className="relative my-1 overflow-hidden rounded-2xl border border-transparent bg-[#F5F7FA] px-4 py-4 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px] sm:px-5 sm:py-5">
                      <InvoiceExpandedRow invoice={invoice} onAction={onAction} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
