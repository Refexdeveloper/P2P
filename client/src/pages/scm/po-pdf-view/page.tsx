import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { poApi } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

export default function POPDFViewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const poIdParam = searchParams.get('poId');
  const poNumber = searchParams.get('poNumber');
  const [po, setPO] = useState<Record<string, unknown> | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setMetaLoading(true);
      setDocLoading(true);
      setError('');
      try {
        let data: Record<string, unknown>;
        if (poIdParam) {
          const res = await poApi.get(Number(poIdParam));
          data = res.data;
        } else if (poNumber) {
          const res = await poApi.getByNumber(poNumber);
          data = res.data;
        } else {
          throw new Error('PO reference missing');
        }

        if (cancelled) return;
        setPO(data);
        setMetaLoading(false);

        const poId = Number(data.id);
        const token = localStorage.getItem('p2p_token');
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        const pdfRes = await fetch(poApi.getPdfUrl(poId), { headers: authHeaders });
        if (cancelled) return;
        if (pdfRes.ok) {
          const blob = await pdfRes.blob();
          objectUrl = URL.createObjectURL(blob);
          setDocUrl(objectUrl);
          return;
        }

        const htmlRes = await fetch(poApi.getDocumentUrl(poId), { headers: authHeaders });
        if (cancelled) return;
        if (!htmlRes.ok) throw new Error('Could not load PO document');
        const html = await htmlRes.text();
        const htmlBlob = new Blob([html], { type: 'text/html' });
        objectUrl = URL.createObjectURL(htmlBlob);
        setDocUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PO');
          setPO(null);
        }
      } finally {
        if (!cancelled) {
          setMetaLoading(false);
          setDocLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [poIdParam, poNumber]);

  if (metaLoading && !po) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading PO details...</p>
      </div>
    );
  }

  const goBack = () => {
    if (user?.role === 'Requester') {
      navigate('/requester/track-pr');
      return;
    }
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/scm/purchase-requests');
    }
  };

  if (error || !po) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <i className="ri-file-warning-line text-6xl text-gray-400 mb-4"></i>
          <p className="text-lg text-gray-600">{error || 'Purchase Order not found'}</p>
          <button
            onClick={goBack}
            className="mt-4 px-6 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const title = String(po.poNumber || poNumber || 'Purchase Order');

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">PO document viewer</p>
        </div>
        <button
          onClick={goBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
        >
          Back
        </button>
      </div>
      <div className="flex-1 relative">
        {docLoading && !docUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Generating PO document…</p>
              <p className="text-xs text-gray-400 mt-1">This may take a moment for long POs</p>
            </div>
          </div>
        )}
        {docUrl ? (
          <iframe
            title="PO Document"
            src={docUrl}
            className="w-full h-[calc(100vh-73px)] border-0 bg-white"
            onLoad={() => setDocLoading(false)}
          />
        ) : !docLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-73px)] text-gray-500">
            Document could not be loaded.
          </div>
        ) : null}
      </div>
    </div>
  );
}
