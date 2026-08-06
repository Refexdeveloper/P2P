import { useEffect, useRef, useState } from 'react';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi } from '../../../services/api';
import {
  isPoExcelFile,
  parsePoExcelFile,
  PO_EXCEL_IMPORT_HEADERS,
  type PoExcelImportRow,
} from '../../../utils/poExcelImport';

export default function PoExcelImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<PoExcelImportRow[]>([]);
  const [status, setStatus] = useState<'draft' | 'imported'>('imported');
  const [defaultStatus, setDefaultStatus] = useState<'draft' | 'imported'>('imported');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [created, setCreated] = useState<Array<{ poNumber: string; lineItems: number; status: string }>>([]);

  useEffect(() => {
    poApi
      .getExcelImportConfig()
      .then((res) => {
        const s = res.data.defaultStatus === 'draft' ? 'draft' : 'imported';
        setDefaultStatus(s);
        setStatus(s);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  const handleFile = async (file: File | null) => {
    setError('');
    setSuccess('');
    setCreated([]);
    setRows([]);
    setFileName('');
    if (!file) return;
    if (!isPoExcelFile(file)) {
      setError('Please upload an Excel (.xlsx) or CSV (.csv) file');
      return;
    }
    setParsing(true);
    try {
      const parsed = await parsePoExcelFile(file);
      if (!parsed.length) {
        setError('No data rows found in the file');
        return;
      }
      setFileName(file.name);
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file');
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runImport = async () => {
    if (!rows.length) {
      setError('Upload a file first');
      return;
    }
    setImporting(true);
    setError('');
    setSuccess('');
    setCreated([]);
    try {
      const res = await poApi.importExcel(rows, status);
      setSuccess(
        res.message ||
          `Imported ${res.data.imported} purchase order(s) as ${res.data.defaultStatus}`
      );
      setCreated(
        (res.data.created || []).map((c) => ({
          poNumber: c.poNumber,
          lineItems: c.lineItems,
          status: c.status,
        }))
      );
      setRows([]);
      setFileName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = async () => {
    setError('');
    try {
      await poApi.downloadExcelImportTemplate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template download failed');
    }
  };

  return (
    <DashboardLayout>
      <div className="p-3 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Purchase Order Excel Import</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload an Excel/CSV file and import purchase orders directly as{' '}
            <span className="font-medium text-gray-700">Draft</span> or{' '}
            <span className="font-medium text-gray-700">Imported</span>. No validation step, no approval
            workflow, emails, or history.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer flex items-center gap-1.5"
            >
              <i className="ri-file-excel-2-line"></i>
              Download template
            </button>
            <label className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 cursor-pointer flex items-center gap-1.5">
              <i className={`ri-${parsing ? 'loader-4-line animate-spin' : 'upload-2-line'}`}></i>
              {parsing ? 'Reading…' : 'Upload .xlsx / .csv'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="hidden"
                disabled={parsing}
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
            {fileName ? (
              <span className="text-sm text-gray-600">
                <i className="ri-file-line mr-1"></i>
                {fileName} · {rows.length} row(s)
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Import status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value === 'draft' ? 'draft' : 'imported')}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="imported">Imported</option>
                <option value="draft">Draft</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Server default: {defaultStatus}</p>
            </div>
            <button
              type="button"
              disabled={!rows.length || importing || parsing}
              onClick={runImport}
              className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <i className={`ri-${importing ? 'loader-4-line animate-spin' : 'database-2-line'}`}></i>
              {importing ? 'Importing…' : 'Import to database'}
            </button>
          </div>

          <details className="text-sm text-gray-600">
            <summary className="cursor-pointer font-medium text-gray-700">Template columns</summary>
            <p className="mt-2 text-xs text-gray-500">
              No mandatory fields. Blank values use defaults (auto PO number, placeholder vendor, etc.).
              Same poNumber across rows becomes one PO with multiple line items.
            </p>
            <code className="mt-2 block text-xs bg-gray-50 border border-gray-100 rounded-lg p-3 overflow-x-auto">
              {PO_EXCEL_IMPORT_HEADERS.join(', ')}
            </code>
          </details>
        </div>

        {error ? (
          <div className="mt-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-4 px-4 py-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
            {success}
          </div>
        ) : null}

        {created.length > 0 ? (
          <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Imported purchase orders</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">PO Number</th>
                  <th className="px-4 py-2 font-medium">Line items</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {created.map((c) => (
                  <tr key={c.poNumber} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium text-gray-900">{c.poNumber}</td>
                    <td className="px-4 py-2 text-gray-700">{c.lineItems}</td>
                    <td className="px-4 py-2 text-gray-700 capitalize">{c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
