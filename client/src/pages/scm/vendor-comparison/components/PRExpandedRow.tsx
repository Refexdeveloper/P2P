import { useState } from 'react';
import RFQRoundsPanel from './RFQRoundsPanel';
import { vendorComparisonData } from '../../../../mocks/vendor-comparison-data';

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: string;
}

interface VendorRow {
  vendorName: string;
  quotedPrice: number;
  leadTime: number;
  paymentTerms: string;
  compliance: string;
  technicalScore: number;
  commercialScore: number;
  overallScore: number;
  recommended: boolean;
}

interface ApprovalHistoryItem {
  stage: string;
  approver: string;
  role: string;
  action: string;
  date: string;
  remarks: string;
}

interface PR {
  id: string;
  title: string;
  department: string;
  requester: string;
  amount: number;
  recommendedVendor: string;
  overallScore: number;
  status: string;
  requestedDate: string;
  requiredDate: string;
  priority: string;
  requestType: string;
  justification: string;
  lineItems: LineItem[];
  vendorComparison: VendorRow[];
  approvalHistory: ApprovalHistoryItem[];
}

interface PRExpandedRowProps {
  pr: PR;
  colSpan: number;
  onSelectWinner: (pr: PR) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

export default function PRExpandedRow({ pr, colSpan, onSelectWinner }: PRExpandedRowProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'items' | 'vendors' | 'rounds' | 'history'>('details');

  const tabs = [
    { key: 'details', label: 'PR Details', icon: 'ri-information-line' },
    { key: 'items', label: 'Line Items', icon: 'ri-list-check-2' },
    { key: 'vendors', label: 'Vendor Comparison', icon: 'ri-store-2-line' },
    { key: 'rounds', label: 'RFQ Quote Rounds', icon: 'ri-refresh-line' },
    { key: 'history', label: 'Approval History', icon: 'ri-history-line' },
  ];

  const priorityColor: Record<string, string> = {
    High: 'bg-red-50 text-red-600 border border-red-200',
    Medium: 'bg-amber-50 text-amber-600 border border-amber-200',
    Low: 'bg-gray-100 text-gray-500 border border-gray-200',
  };

  const statusColor: Record<string, string> = {
    'Ready for PO': 'bg-teal-100 text-teal-700 border border-teal-200',
    'Pending Approval': 'bg-amber-100 text-amber-700 border border-amber-200',
    'PO Approved': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'PO Rejected': 'bg-red-100 text-red-700 border border-red-200',
  };

  const actionColor: Record<string, string> = {
    Approved: 'bg-emerald-100 text-emerald-700',
    Cleared: 'bg-emerald-100 text-emerald-700',
    Completed: 'bg-teal-100 text-teal-700',
    Submitted: 'bg-gray-100 text-gray-600',
    Created: 'bg-teal-100 text-teal-700',
    Rejected: 'bg-red-100 text-red-700',
  };

  const actionIcon: Record<string, string> = {
    Approved: 'ri-check-line text-emerald-600',
    Cleared: 'ri-shield-check-line text-emerald-600',
    Completed: 'ri-check-double-line text-teal-600',
    Submitted: 'ri-file-add-line text-gray-500',
    Created: 'ri-file-text-line text-teal-600',
    Rejected: 'ri-close-line text-red-600',
  };

  const isReadyForPO = pr.status === 'Ready for PO';

  return (
    <tr>
      <td colSpan={colSpan} className="px-0 py-0 bg-slate-50 border-b border-teal-200">
        <div className="mx-6 my-4 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Expanded Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-gradient-to-r from-teal-50 to-white border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                <i className="ri-file-list-3-line text-teal-600 text-lg"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{pr.id}</p>
                <p className="text-xs text-gray-500">{pr.title}</p>
              </div>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColor[pr.status] || 'bg-gray-100 text-gray-600'}`}>
                {pr.status}
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold capitalize whitespace-nowrap ${priorityColor[pr.priority] || 'bg-gray-100 text-gray-500'}`}>
                <i className="ri-flag-line text-xs"></i>{pr.priority}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isReadyForPO && (
                <button
                  onClick={() => onSelectWinner(pr)}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 shadow-sm"
                >
                  <i className="ri-trophy-line"></i> Select Winner & Create PO
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 px-6 bg-white">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <i className={tab.icon}></i>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* ── PR Details ── */}
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top summary row */}
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-2">
                  {[
                    { label: 'PR Number', value: pr.id, icon: 'ri-file-text-line', color: 'text-teal-600' },
                    { label: 'Requested Date', value: pr.requestedDate, icon: 'ri-calendar-line', color: 'text-gray-700' },
                    { label: 'Required By', value: pr.requiredDate, icon: 'ri-calendar-check-line', color: 'text-gray-700' },
                    { label: 'Estimated Amount', value: formatCurrency(pr.amount), icon: 'ri-money-rupee-circle-line', color: 'text-teal-600' },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                        <i className={`${item.icon} text-xs`}></i>{item.label}
                      </p>
                      <p className={`text-sm font-semibold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>

                {/* Left */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <i className="ri-user-line text-teal-500"></i> Requester Information
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Requester</p>
                        <p className="text-sm font-medium text-gray-900">{pr.requester}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Department</p>
                        <p className="text-sm font-medium text-gray-900">{pr.department}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Request Type</p>
                        <p className="text-sm font-medium text-gray-900">{pr.requestType}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <i className="ri-chat-quote-line"></i> Justification
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">{pr.justification}</p>
                  </div>
                </div>

                {/* Right */}
                <div className="lg:col-span-1">
                  <div className="bg-teal-50 border border-teal-100 rounded-lg p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
                      <i className="ri-trophy-line text-teal-500"></i> Recommended Vendor
                    </h4>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <i className="ri-store-2-line text-teal-600"></i>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{pr.recommendedVendor}</p>
                        <p className="text-xs text-teal-600 font-medium">Overall Score: {pr.overallScore}/100</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Total Vendors</span>
                        <span className="text-xs font-semibold text-gray-800">{pr.vendorComparison.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Line Items</span>
                        <span className="text-xs font-semibold text-gray-800">{pr.lineItems.length}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">Total Value</span>
                        <span className="text-xs font-bold text-teal-700">{formatCurrency(pr.amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Line Items ── */}
            {activeTab === 'items' && (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {['#', 'Description', 'Category', 'Qty', 'Unit Price', 'Total'].map((h) => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide ${h === '#' || h === 'Qty' ? 'text-center' : h === 'Unit Price' || h === 'Total' ? 'text-right' : 'text-left'}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pr.lineItems.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500 text-center">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.description}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{item.category}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-teal-50 border-t-2 border-teal-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 text-right">Grand Total</td>
                      <td className="px-4 py-3 text-base font-bold text-teal-600 text-right">{formatCurrency(pr.amount)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* ── Vendor Comparison ── */}
            {activeTab === 'vendors' && (
              <div>
                <div className="border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        {['Parameter', ...pr.vendorComparison.map(v => v.vendorName)].map((h, i) => (
                          <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide ${i === 0 ? 'text-left' : 'text-center'}`}>
                            <div className="flex flex-col items-center gap-1">
                              {i > 0 && pr.vendorComparison[i - 1].recommended && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  <i className="ri-star-fill text-xs"></i> Recommended
                                </span>
                              )}
                              <span>{h}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {[
                        { key: 'quotedPrice', label: 'Quoted Price', icon: 'ri-money-rupee-circle-line', format: (v: VendorRow) => formatCurrency(v.quotedPrice), best: 'min' },
                        { key: 'leadTime', label: 'Lead Time', icon: 'ri-time-line', format: (v: VendorRow) => `${v.leadTime} days`, best: 'min' },
                        { key: 'paymentTerms', label: 'Payment Terms', icon: 'ri-bank-card-line', format: (v: VendorRow) => v.paymentTerms, best: null },
                        { key: 'compliance', label: 'Compliance', icon: 'ri-shield-check-line', format: (v: VendorRow) => v.compliance, best: null },
                        { key: 'technicalScore', label: 'Technical Score', icon: 'ri-tools-line', format: (v: VendorRow) => `${v.technicalScore}/100`, best: 'max' },
                        { key: 'commercialScore', label: 'Commercial Score', icon: 'ri-line-chart-line', format: (v: VendorRow) => `${v.commercialScore}/100`, best: 'max' },
                        { key: 'overallScore', label: 'Overall Score', icon: 'ri-star-line', format: (v: VendorRow) => `${v.overallScore}/100`, best: 'max' },
                      ].map((row, rowIdx) => {
                        let bestIdx = -1;
                        if (row.best === 'min') {
                          const vals = pr.vendorComparison.map(v => (v as Record<string, number>)[row.key] as number);
                          bestIdx = vals.indexOf(Math.min(...vals));
                        } else if (row.best === 'max') {
                          const vals = pr.vendorComparison.map(v => (v as Record<string, number>)[row.key] as number);
                          bestIdx = vals.indexOf(Math.max(...vals));
                        }
                        return (
                          <tr key={row.key} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-700">
                              <div className="flex items-center gap-2">
                                <i className={`${row.icon} text-gray-400 text-sm`}></i>
                                {row.label}
                              </div>
                            </td>
                            {pr.vendorComparison.map((vendor, vIdx) => (
                              <td key={vIdx} className={`px-4 py-3 text-sm text-center font-medium ${bestIdx === vIdx ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'text-gray-800'}`}>
                                {row.format(vendor)}
                                {bestIdx === vIdx && <i className="ri-arrow-up-line text-emerald-500 text-xs ml-1"></i>}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Winner highlight */}
                <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <i className="ri-trophy-line text-white text-lg"></i>
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-emerald-600 font-medium">Recommended Vendor</p>
                    <p className="text-sm font-bold text-gray-900">{pr.recommendedVendor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Overall Score</p>
                    <p className="text-lg font-bold text-emerald-700">{pr.overallScore}/100</p>
                  </div>
                  {isReadyForPO && (
                    <button
                      onClick={() => onSelectWinner(pr)}
                      className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 shadow-sm"
                    >
                      <i className="ri-check-double-line"></i> Select Winner
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── RFQ Quote Rounds ── */}
            {activeTab === 'rounds' && (
              <RFQRoundsPanel vendors={vendorComparisonData.vendors} />
            )}

            {/* ── Approval History ── */}
            {activeTab === 'history' && (
              <div className="space-y-0 max-w-2xl">
                {pr.approvalHistory.map((item, idx) => (
                  <div key={idx} className="flex gap-4 pb-6 relative">
                    {idx !== pr.approvalHistory.length - 1 && (
                      <div className="absolute left-4 top-10 w-0.5 h-full bg-gray-200"></div>
                    )}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      item.action === 'Approved' || item.action === 'Cleared' ? 'bg-emerald-100' :
                      item.action === 'Rejected' ? 'bg-red-100' :
                      item.action === 'Submitted' ? 'bg-gray-100' : 'bg-teal-100'
                    }`}>
                      <i className={`text-sm ${actionIcon[item.action] || 'ri-time-line text-gray-500'}`}></i>
                    </div>
                    <div className="flex-1 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{item.stage}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{item.approver} · {item.role}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${actionColor[item.action] || 'bg-gray-100 text-gray-600'}`}>
                          {item.action}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-2 leading-relaxed">{item.remarks}</p>
                      <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                        <i className="ri-calendar-line"></i>{item.date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
