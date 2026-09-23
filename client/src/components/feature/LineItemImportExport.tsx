import { useRef, useState } from 'react';

type ImportSummary = {
  added: number;
  failed: number;
  errors?: string[];
};

type Props = {
  onExport: () => void;
  onDownloadSample: () => void;
  onImport: (csvText: string) => ImportSummary;
};

export default function LineItemImportExport({ onExport, onDownloadSample, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'sample' | 'import' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (kind: 'export' | 'sample' | 'import', fn: () => void | Promise<void>) => {
    setBusy(kind);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    await run('import', async () => {
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
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!!busy}
        onClick={() =>
          run('export', () => {
            onExport();
            setMessage('Line items exported');
          })
        }
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy === 'export' ? 'loader-4-line animate-spin' : 'download-2-line'}`}></i>
        Export
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() =>
          run('sample', () => {
            onDownloadSample();
            setMessage('Sample CSV downloaded');
          })
        }
        className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy === 'sample' ? 'loader-4-line animate-spin' : 'file-excel-2-line'}`}></i>
        Sample
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => fileRef.current?.click()}
        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy === 'import' ? 'loader-4-line animate-spin' : 'upload-2-line'}`}></i>
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
