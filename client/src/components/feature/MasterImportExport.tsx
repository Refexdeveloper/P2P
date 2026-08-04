import { useRef, useState } from 'react';

type ImportResult = {
  created: number;
  updated: number;
  failed: number;
  errors?: string[];
};

type Props = {
  onExport: () => Promise<void>;
  onDownloadTemplate: () => Promise<void>;
  onImport: (csvText: string) => Promise<{ message?: string; data?: ImportResult }>;
  onImported?: () => void;
};

export default function MasterImportExport({
  onExport,
  onDownloadTemplate,
  onImport,
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'export' | 'template' | 'import' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const run = async (kind: 'export' | 'template' | 'import', fn: () => Promise<void>) => {
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
      const res = await onImport(text);
      const result = res.data;
      setMessage(
        res.message ||
          (result
            ? `Import done: ${result.created} created, ${result.updated} updated, ${result.failed} failed`
            : 'Import completed')
      );
      if (result?.errors?.length) {
        setError(result.errors.slice(0, 5).join(' | '));
      }
      onImported?.();
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={!!busy}
        onClick={() => run('export', onExport)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy === 'export' ? 'loader-4-line animate-spin' : 'download-2-line'}`}></i>
        Export CSV
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => run('template', onDownloadTemplate)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy === 'template' ? 'loader-4-line animate-spin' : 'file-excel-2-line'}`}></i>
        Template
      </button>
      <button
        type="button"
        disabled={!!busy}
        onClick={() => fileRef.current?.click()}
        className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
      >
        <i className={`ri-${busy === 'import' ? 'loader-4-line animate-spin' : 'upload-2-line'}`}></i>
        Import CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] || null)}
      />
      {message && <span className="text-xs text-emerald-700">{message}</span>}
      {error && <span className="text-xs text-red-600 max-w-md truncate" title={error}>{error}</span>}
    </div>
  );
}
