import { InvoiceData } from '../../../../mocks/invoice-data';

interface Props {
  invoices: InvoiceData[];
}

export default function InvoiceStatsCards({ invoices }: Props) {
  const stats = {
    pendingVerification: invoices.filter((i) => i.status === 'Pending Verification').length,
    matched: invoices.filter((i) => i.status === 'Matched').length,
    pendingManager: invoices.filter((i) => i.status === 'Pending Manager Approval').length,
    discrepancy: invoices.filter((i) => i.status === 'Discrepancy').length,
    onHold: invoices.filter((i) => i.status === 'On Hold').length,
    approved: invoices.filter((i) => i.status === 'Approved for Payment').length,
  };

  return (
    <div className="grid grid-cols-6 gap-6 mb-6">
      <div className="bg-white rounded-xl p-6 border border-orange-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Pending Verification</p>
            <p className="text-3xl font-bold text-orange-600">{stats.pendingVerification}</p>
          </div>
          <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
            <i className="ri-time-line text-2xl text-orange-600"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-green-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Matched</p>
            <p className="text-3xl font-bold text-green-600">{stats.matched}</p>
          </div>
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
            <i className="ri-checkbox-circle-line text-2xl text-green-600"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-blue-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Pending Manager</p>
            <p className="text-3xl font-bold text-blue-600">{stats.pendingManager}</p>
          </div>
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <i className="ri-user-star-line text-2xl text-blue-600"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-red-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Discrepancy</p>
            <p className="text-3xl font-bold text-red-600">{stats.discrepancy}</p>
          </div>
          <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
            <i className="ri-error-warning-line text-2xl text-red-600"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-yellow-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">On Hold</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.onHold}</p>
          </div>
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
            <i className="ri-pause-circle-line text-2xl text-yellow-600"></i>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-teal-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Approved</p>
            <p className="text-3xl font-bold text-teal-600">{stats.approved}</p>
          </div>
          <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
            <i className="ri-shield-check-line text-2xl text-teal-600"></i>
          </div>
        </div>
      </div>
    </div>
  );
}