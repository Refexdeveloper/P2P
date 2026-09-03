import { useState } from 'react';
import { prApi, type PrAttachmentRecord } from '../../services/api';

type Props = {
  prId: number;
  attachments?: PrAttachmentRecord[] | null;
  /** Compact layout for expand rows / side panels */
  compact?: boolean;
  className?: string;
  emptyLabel?: string;
};

function formatFileSize(bytes: number) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PrDocumentsPanel({
  prId,
  attachments,
  compact = false,
  className = '',
  emptyLabel = 'No FSD / PR documents uploaded for this purchase request.',
}: Props) {
  const files = Array.isArray(attachments)
    ? attachments.filter((f) => Number(f?.id) > 0 && String(f?.fileName || '').trim())
    : [];
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const openFile = async (file: PrAttachmentRecord) => {
    setBusyId(file.id);
    setError('');
    try {
      await prApi.downloadAttachment(prId, file.id, file.fileName);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not open ${file.fileName}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={className}>
      <div className={`flex items-start gap-3 ${compact ? 'mb-3' : 'mb-4'}`}>
        <div
          className={`rounded-lg flex items-center justify-center shrink-0 ${
            compact ? 'w-9 h-9 bg-indigo-50' : 'w-10 h-10 bg-indigo-100'
          }`}
        >
          <i className={`ri-file-list-3-line text-indigo-600 ${compact ? 'text-lg' : 'text-xl'}`} />
        </div>
        <div className="min-w-0">
          <h4 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
            PR Documents (FSD)
          </h4>
          <p className="text-xs text-gray-500 mt-0.5">
            Functional specification and supporting files uploaded on the PR
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {files.length === 0 ? (
        <p className="text-sm text-gray-500 py-2">{emptyLabel}</p>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <div className="w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                <i className="ri-file-text-line text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate" title={file.fileName}>
                  {file.fileName}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatFileSize(file.size)}
                  {file.uploadedAt ? ` · ${file.uploadedAt}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={busyId === file.id}
                onClick={() => void openFile(file)}
                className="px-3 py-1.5 border border-indigo-200 text-indigo-700 bg-white rounded-lg text-xs font-semibold hover:bg-indigo-50 disabled:opacity-50 whitespace-nowrap"
              >
                {busyId === file.id ? 'Opening…' : 'Open'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
