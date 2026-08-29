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
  const [isHtmlDoc, setIsHtmlDoc] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;

    const load = async () => {
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

        setPO(data);
        const poId = Number(data.id);
        const token = localStorage.getItem('p2p_token');
        const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

        const pdfRes = await fetch(poApi.getPdfUrl(poId), { headers: authHeaders });
        if (pdfRes.ok) {
          const contentType = pdfRes.headers.get('content-type') || '';
          const blob = await pdfRes.blob();
          objectUrl = URL.createObjectURL(blob);
          setDocUrl(objectUrl);
          setIsHtmlDoc(contentType.includes('text/html'));
          return;
        }

        const htmlRes = await fetch(poApi.getDocumentUrl(poId), { headers: authHeaders });
        if (!htmlRes.ok) throw new Error('Could not load PO document');
        const html = await htmlRes.text();
        const htmlBlob = new Blob([html], { type: 'text/html' });
        objectUrl = URL.createObjectURL(htmlBlob);
        setDocUrl(objectUrl);
        setIsHtmlDoc(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load PO');
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [poIdParam, poNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Loading PO document...</p>
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

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between print:hidden sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{String(po.poNumber)}</h1>
          <p className="text-sm text-gray-500">{String(po.prTitle)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={goBack}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer"
          >
            Back
          </button>
          {isHtmlDoc && (
            <button
              onClick={() => window.print()}
              className="px-4 py-2 border border-teal-300 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-50 cursor-pointer"
            >
              Print / Save PDF
            </button>
          )}
          {docUrl && (
            <a
              href={docUrl}
              download={`${po.poNumber}.${isHtmlDoc ? 'html' : 'pdf'}`}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
            >
              Download
            </a>
          )}
        </div>
      </div>
      {docUrl ? (
        <iframe title="PO Document" src={docUrl} className="w-full h-[calc(100vh-80px)] border-0 bg-white" />
      ) : (
        <div className="p-8 text-center text-gray-500">Document not available</div>
      )}
    </div>
  );
}
