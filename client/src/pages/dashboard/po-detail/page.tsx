import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import TrackPoExpandedRow from '../../scm/track-po/components/TrackPoExpandedRow';
import { poApi } from '../../../services/api';
import { PM_PAGE_BG } from '../../../constants/pmTheme';

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
      <div className="min-h-full font-sans text-[#0F172A]" style={{ background: PM_PAGE_BG }}>
        <div className="p-2 pb-6 sm:p-4 lg:p-6">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-1 pb-3 pt-1 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:mb-5 sm:px-0 sm:pb-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#1E88E5]"
            >
              <i className="ri-arrow-left-line" />
              Back to Financial Insights
            </button>
            {row?.poNumber ? (
              <span className="text-sm font-bold text-[#1E88E5]">{row.poNumber}</span>
            ) : null}
          </header>

          {loading ? (
            <div className="rounded-2xl border border-transparent bg-white px-6 py-16 text-center text-sm text-slate-500 shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)] sm:rounded-[18px]">
              <i className="ri-loader-4-line mr-2 animate-spin text-lg text-[#1E88E5]" />
              Loading PO details…
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 px-6 py-8 text-center text-sm text-rose-700">
              {error}
            </div>
          ) : row ? (
            <TrackPoExpandedRow row={row} standalone />
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
