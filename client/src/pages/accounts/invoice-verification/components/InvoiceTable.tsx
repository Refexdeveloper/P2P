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
      'Approved for Payment': 'bg-teal-100 text-teal-700',
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
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto w-full min-w-0">
      <table className="w-full min-w-[1100px] border-collapse table-fixed">
        <colgroup>
          <col style={{ width: '14%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '14%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '9%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '7%' }} />
          <col style={{ width: '9%' }} />
        </colgroup>
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Invoice #
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Vendor
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              PO / GRN
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Due Date
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Match Status
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Status
            </th>
            <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Priority
            </th>
            <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <Fragment key={invoice.id || invoice.invoiceNumber}>
              <tr
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() =>
                  setExpandedRow(expandedRow === invoice.invoiceNumber ? null : invoice.invoiceNumber)
                }
              >
                <td className="px-3 py-3 align-middle overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <i
                      className={`ri-arrow-${
                        expandedRow === invoice.invoiceNumber ? 'down' : 'right'
                      }-s-line text-gray-400 shrink-0`}
                    ></i>
                    <span
                      className="font-semibold text-sm text-gray-900 truncate"
                      title={invoice.invoiceNumber}
                    >
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3 align-middle overflow-hidden">
                  <span className="block text-sm text-gray-700 truncate" title={invoice.vendor}>
                    {invoice.vendor}
                  </span>
                </td>
                <td className="px-3 py-3 align-middle overflow-hidden">
                  <div className="text-sm min-w-0">
                    <div className="text-gray-900 font-medium truncate" title={invoice.poNumber}>
                      {invoice.poNumber}
                    </div>
                    <div className="text-gray-500 truncate" title={invoice.grnNumber}>
                      {invoice.grnNumber}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 align-middle text-sm font-semibold text-gray-900 text-right whitespace-nowrap">
                  ₹{invoice.invoiceGrandTotal.toLocaleString('en-IN')}
                </td>
                <td className="px-3 py-3 align-middle text-sm text-gray-700 whitespace-nowrap">
                  {invoice.dueDate}
                </td>
                <td className="px-3 py-3 align-middle overflow-hidden">
                  {invoice.matchStatus.overallMatch ? (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <i className="ri-checkbox-circle-fill text-green-600 text-lg shrink-0"></i>
                      <span className="text-sm font-medium text-green-700 truncate">All Match</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <i className="ri-error-warning-fill text-red-600 text-lg shrink-0"></i>
                      <span className="text-sm font-medium text-red-700 truncate">Mismatch</span>
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 align-middle overflow-hidden">
                  <span
                    className={`inline-block max-w-full px-2.5 py-1 ${getStatusBadge(
                      invoice.status
                    )} text-xs font-semibold rounded-full truncate`}
                    title={invoice.status}
                  >
                    {invoice.status}
                  </span>
                </td>
                <td className="px-3 py-3 align-middle">
                  <span
                    className={`px-2 py-1 ${getPriorityBadge(
                      invoice.priority
                    )} text-xs font-medium rounded uppercase whitespace-nowrap`}
                  >
                    {invoice.priority}
                  </span>
                </td>
                <td className="px-3 py-3 align-middle">
                  <div
                    className="flex items-center justify-end gap-1.5 flex-wrap"
                    onClick={(e) => e.stopPropagation()}
                  >
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
                            className="px-2.5 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
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
                        className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-teal-600 text-white text-xs font-semibold rounded-lg hover:from-blue-700 hover:to-teal-700 transition-all whitespace-nowrap"
                      >
                        Manager Approve
                      </button>
                    )}
                  </div>
                </td>
              </tr>

              {expandedRow === invoice.invoiceNumber && (
                <tr>
                  <td colSpan={9} className="bg-gray-50 px-3 sm:px-4 py-4">
                    <div className="min-w-0 w-full max-w-full overflow-hidden">
                      <InvoiceExpandedRow invoice={invoice} onAction={onAction} />
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
