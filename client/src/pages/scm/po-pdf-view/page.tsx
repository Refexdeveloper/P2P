import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { poApi, poPdfDownloadFileName, triggerBlobDownload } from '../../../services/api';
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
  const [pdfLoading, setPdfLoading] = useState(false);
  const [usingHtmlPreview, setUsingHtmlPreview] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const load = async () => {
      setMetaLoading(true);
      setPdfLoading(false);
      setUsingHtmlPreview(false);
      setError('');
      setDocUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });

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

        const htmlPromise = fetch(poApi.getDocumentUrl(poId), { headers: authHeaders })
          .then(async (htmlRes) => {
            if (!htmlRes.ok) return null;
            const html = await htmlRes.text();
            return URL.createObjectURL(new Blob([html], { type: 'text/html' }));
          })
          .catch(() => null);

        const pdfPromise = fetch(poApi.getPdfUrl(poId), { headers: authHeaders })
          .then(async (pdfRes) => {
            if (!pdfRes.ok) return null;
            const blob = await pdfRes.blob();
            return URL.createObjectURL(blob);
          })
          .catch(() => null);

        const htmlUrl = await htmlPromise;
        if (cancelled) {
          if (htmlUrl) URL.revokeObjectURL(htmlUrl);
          return;
        }
        if (htmlUrl) {
          objectUrl = htmlUrl;
          setDocUrl(htmlUrl);
          setUsingHtmlPreview(true);
        }

        setPdfLoading(true);
        const pdfUrl = await pdfPromise;
        if (cancelled) {
          if (pdfUrl) URL.revokeObjectURL(pdfUrl);
          return;
        }
        if (pdfUrl) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = pdfUrl;
          setDocUrl(pdfUrl);
          setUsingHtmlPreview(false);
        } else if (!htmlUrl) {
          throw new Error('Could not load PO document');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load PO');
          setPO(null);
        }
      } finally {
        if (!cancelled) {
          setMetaLoading(false);
          setPdfLoading(false);
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
  const poId = Number(po.id);

  const handleDownload = async () => {
    if (!Number.isFinite(poId) || poId <= 0) return;
    try {
      setPdfDownloading(true);
      const blob = await poApi.fetchPdfBlob(poId);
      const kind = po.signedPdfPath || po.signedAt ? 'signed' : 'final';
      triggerBlobDownload(
        blob,
        poPdfDownloadFileName(String(po.poNumber || poNumber || title), kind === 'signed' ? 'signed' : 'final')
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not download PDF');
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500">
            {pdfLoading && usingHtmlPreview
              ? 'Showing preview — final PDF is generating…'
              : 'PO document viewer'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={pdfDownloading || pdfLoading}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 cursor-pointer disabled:opacity-50"
          >
            <i className="ri-download-2-line mr-1"></i>
            {pdfDownloading ? 'Downloading…' : 'Download PDF'}
          </button>
          <button
            onClick={goBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 cursor-pointer"
          >
            Back
          </button>
        </div>
      </div>
      <div className="flex-1 relative">
        {!docUrl && pdfLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 z-10">
            <div className="text-center">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">Loading PO document…</p>
            </div>
          </div>
        )}
        {docUrl ? (
          <iframe
            title="PO Document"
            src={docUrl}
            className="w-full h-[calc(100vh-73px)] border-0 bg-white"
          />
        ) : !pdfLoading ? (
          <div className="flex items-center justify-center h-[calc(100vh-73px)] text-gray-500">
            Document could not be loaded.
          </div>
        ) : null}
      </div>
    </div>
  );
}
