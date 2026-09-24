import { useRef, useState } from 'react';
import { downloadLineItemSample } from '../../utils/lineItemCsv';

type ImportSummary = {
  added: number;
  failed: number;
  errors?: string[];
};

type Props = {
  onImport: (csvText: string) => ImportSummary;
  showSample?: boolean;
  sampleFilename?: string;
};

export default function LineItemImportExport({
  onImport,
  showSample = false,
  sampleFilename = 'line-items-sample.csv',
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const text = await file.text();
      const result = onImport(text);
      if (!result.added && result.failed) {
        throw new Error(result.errors?.[0] || 'No valid line items in the file');
      }
      setMessage(
        result.failed
          ? `Added ${result.added} item${result.added === 1 ? '' : 's'}; ${result.failed} row${result.failed === 1 ? '' : 's'} skipped`
          : `Added ${result.added} line item${result.added === 1 ? '' : 's'} to the table`
      );
      if (result.errors?.length) {
        setError(result.errors.slice(0, 4).join(' | '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showSample && (
        <button
          type="button"
          disabled={busy}
          onClick={() => downloadLineItemSample(sampleFilename)}
          className="px-3 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-50 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
        >
          <i className="ri-file-excel-2-line"></i>
          Sample
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy ? 'loader-4-line animate-spin' : 'upload-2-line'}`}></i>
        Import
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      {message && <span className="text-[11px] text-emerald-700">{message}</span>}
      {error && (
        <span className="text-[11px] text-red-600 max-w-xs truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}
