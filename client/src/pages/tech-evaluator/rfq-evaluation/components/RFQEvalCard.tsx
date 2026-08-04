import type { TechEvalRFQ } from '../../../../mocks/tech-eval-data';

interface Props {
  rfq: TechEvalRFQ;
  onOpen: (rfq: TechEvalRFQ) => void;
}

const statusConfig = {
  'Pending Evaluation': { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'ri-time-line' },
  'In Progress': { bg: 'bg-teal-100', text: 'text-teal-700', icon: 'ri-loader-4-line' },
  'Completed': { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: 'ri-checkbox-circle-line' },
};

const priorityConfig = {
  High: { bg: 'bg-red-100', text: 'text-red-700' },
  Medium: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Low: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export default function RFQEvalCard({ rfq, onOpen }: Props) {
  const sc = statusConfig[rfq.status];
  const pc = priorityConfig[rfq.priority];
  const progress = rfq.totalVendors > 0 ? Math.round((rfq.evaluatedVendors / rfq.totalVendors) * 100) : 0;

  const today = new Date();
  const due = new Date(rfq.dueDate);
  const daysLeft = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:border-teal-300 transition-all cursor-pointer" onClick={() => onOpen(rfq)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 bg-teal-50 text-teal-700 rounded-full text-xs font-bold">{rfq.rfqRef}</span>
            <span className="px-2 py-0.5 text-xs text-gray-500">{rfq.prRef}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${pc.bg} ${pc.text}`}>{rfq.priority}</span>
          </div>
          <h3 className="text-sm font-bold text-gray-900 leading-tight">{rfq.prTitle}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{rfq.department} · SCM: {rfq.scmBuyer}</p>
        </div>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sc.bg} ${sc.text} whitespace-nowrap ml-3`}>
          <i className={sc.icon}></i>
          {rfq.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-500">Vendors Evaluated</span>
          <span className="text-xs font-bold text-gray-700">{rfq.evaluatedVendors}/{rfq.totalVendors}</span>
        </div>
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all ${rfq.status === 'Completed' ? 'bg-emerald-500' : 'bg-teal-500'}`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Vendor chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {rfq.vendors.map(v => {
          const latestRound = v.rounds[v.rounds.length - 1];
          const isEval = latestRound?.status === 'evaluated';
          return (
            <span key={v.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
              isEval ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
            }`}>
              {isEval ? <i className="ri-checkbox-circle-fill text-xs"></i> : <i className="ri-time-line text-xs"></i>}
              {v.vendorName}
              {v.source === 'vendor-portal' && <i className="ri-global-line text-xs opacity-60"></i>}
            </span>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <i className="ri-calendar-line"></i>
            Due: {rfq.dueDate}
          </span>
          {daysLeft > 0 && rfq.status !== 'Completed' ? (
            <span className={`flex items-center gap-1 font-semibold ${daysLeft <= 2 ? 'text-red-600' : daysLeft <= 5 ? 'text-amber-600' : 'text-gray-500'}`}>
              <i className="ri-alarm-line"></i>
              {daysLeft}d left
            </span>
          ) : rfq.status === 'Completed' ? (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <i className="ri-check-line"></i>Done
            </span>
          ) : (
            <span className="text-red-600 font-semibold flex items-center gap-1">
              <i className="ri-error-warning-line"></i>Overdue
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onOpen(rfq); }}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap ${
            rfq.status === 'Completed'
              ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              : 'bg-teal-600 text-white hover:bg-teal-700'
          }`}
        >
          {rfq.status === 'Completed' ? 'View Results' : rfq.status === 'In Progress' ? 'Continue Eval' : 'Start Evaluation'}
        </button>
      </div>
    </div>
  );
}
