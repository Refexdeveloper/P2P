import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import TrackPoExpandedRow from '../../scm/track-po/components/TrackPoExpandedRow';
import { poApi } from '../../../services/api';

type TrackRowLite = {
  key: string;
  prId: number;
  poId: number | null;
  prNumber: string;
  poNumber: string | null;
  title: string;
  department: string;
  requester: string;
  vendorName: string;
  amount: number;
  statusLabel: string;
  purchaseType?: string;
  purchaseTypeLabel?: string;
  entityName?: string;
  requiredDate: string;
  createdAt: string;
};

function buildRowFromPo(data: Record<string, unknown>): TrackRowLite {
  const poId = Number(data.id) || null;
  const prId = Number(data.prId ?? data.pr_id) || 0;
  const statusRaw = String(data.statusRaw || data.status || '');
  const statusLabel = String(data.status || statusRaw || '—');
  return {
    key: String(poId || data.poNumber || data.po_number || 'po'),
    prId,
    poId,
    prNumber: String(data.prNumber || data.pr_number || (prId ? `PR-${prId}` : '')),
    poNumber: String(data.poNumber || data.po_number || '') || null,
    title: String(data.title || data.prTitle || data.pr_title || 'Purchase Order'),
    department: String(data.department || ''),
    requester: String(data.requester || data.requesterName || ''),
    vendorName: String(data.vendorName || data.vendor_name || '—'),
    amount: Number(data.grandTotal ?? data.grand_total) || 0,
    statusLabel,
    purchaseType: String(data.purchaseType || data.purchase_type || ''),
    purchaseTypeLabel: String(data.purchaseTypeLabel || ''),
    entityName: String(data.entity || data.entityName || ''),
    requiredDate: String(data.expectedDeliveryDate || data.requiredDate || ''),
    createdAt: String(data.createdAt || data.poDate || ''),
  };
}

export default function FinancialPoDetailPage() {
  const navigate = useNavigate();
  const { poId: poIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const poNumberParam = searchParams.get('poNumber');
  const [row, setRow] = useState<TrackRowLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        let data: Record<string, unknown>;
        if (poIdParam) {
          const res = await poApi.get(Number(poIdParam));
          data = res.data;
        } else if (poNumberParam) {
          const res = await poApi.getByNumber(poNumberParam);
          data = res.data;
        } else {
          throw new Error('PO reference missing');
        }
        if (!cancelled) setRow(buildRowFromPo(data));
      } catch (err) {
        if (!cancelled) {
          setRow(null);
          setError(err instanceof Error ? err.message : 'Failed to load PO');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [poIdParam, poNumberParam]);

  return (
    <DashboardLayout>
      <div className="-m-3 sm:-m-4 lg:-m-6 min-h-full bg-[#F8F9FC] px-4 sm:px-6 lg:px-7 py-6 font-sans">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-teal-700 cursor-pointer"
          >
            <i className="ri-arrow-left-line" />
            Back to Financial Insights
          </button>
          {row?.poNumber ? (
            <span className="text-sm font-semibold text-slate-800">{row.poNumber}</span>
          ) : null}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center text-sm text-slate-500">
            <i className="ri-loader-4-line animate-spin text-lg text-teal-600 mr-2" />
            Loading PO details…
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-8 text-center text-sm text-red-700">
            {error}
          </div>
        ) : row ? (
          <TrackPoExpandedRow row={row} standalone />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
