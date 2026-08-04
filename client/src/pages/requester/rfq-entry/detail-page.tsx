import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import SendBackModal from '../../scm/rfq-entry/components/SendBackModal';
import CreateVendorForm from '../../scm/vendor-master/components/CreateVendorForm';
import { rfqApi, RfqFieldDefinition, vendorApi, VendorRecord } from '../../../services/api';

interface DraftRow {
  key: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
}

interface RfqConfig {
  fieldDefinitions: RfqFieldDefinition[];
  recommendedInvitationId: number | null;
  maxRounds: number | null;
  requesterSubmittedAt?: string | null;
  finalizedAt: string | null;
}

interface TableRow {
  id: string;
  invitationId: number;
  vendorName: string;
  inviteMode?: 'email' | 'manual';
  status: string;
  round: number;
  submissionId: number | null;
  hasActiveQuote?: boolean;
  quotationFileName: string;
  canSendBack: boolean;
  isRecommended: boolean;
  fieldValues: Record<string, unknown>;
  quotes: Array<{
    submissionId: number | null;
    round: number;
    quotedPrice: number;
    quotationFileName: string;
    fieldValues: Record<string, unknown>;
    requesterFields: Record<string, unknown>;
    status?: string;
  }>;
}

function newDraftRow(): DraftRow {
  return { key: `d-${Date.now()}-${Math.random()}`, vendorId: '', vendorName: '', vendorEmail: '' };
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function formatFieldValue(field: RfqFieldDefinition, value: unknown) {
  if (value === undefined || value === null || value === '') return '—';
  if (field.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.id === 'quotedPrice') return formatCurrency(Number(value));
  return String(value);
}

export default function RfqEntryDetailPage() {
  const { prId } = useParams<{ prId: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isScm = location.pathname.startsWith('/scm/rfq-entry');
  const listPath = isScm ? '/scm/rfq-entry' : '/requester/rfq-entry';
  const taskId = searchParams.get('taskId');

  const [mode, setMode] = useState<'entry' | 'preview'>('entry');
  const [previewRound, setPreviewRound] = useState(1);
  const [pr, setPr] = useState<{ prNumber: string; title: string; department: string; totalAmount: number } | null>(null);
  const [config, setConfig] = useState<RfqConfig | null>(null);
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [draftRows, setDraftRows] = useState<DraftRow[]>([newDraftRow()]);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldFilledBy, setNewFieldFilledBy] = useState<'vendor' | 'requester'>('vendor');
  const [newFieldType, setNewFieldType] = useState<'text' | 'number' | 'boolean'>('text');
  const [recommendedId, setRecommendedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingMail, setSendingMail] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [sendBackTarget, setSendBackTarget] = useState<TableRow | null>(null);
  const [filePreview, setFilePreview] = useState<{ url: string; fileName: string } | null>(null);
  const [manualDrafts, setManualDrafts] = useState<Record<number, Record<string, unknown>>>({});
  const [manualFiles, setManualFiles] = useState<Record<number, File | null>>({});
  const [savingManualId, setSavingManualId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [vendorCatalog, setVendorCatalog] = useState<VendorRecord[]>([]);
  const [addVendorRowKey, setAddVendorRowKey] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      const res = await vendorApi.list();
      setVendorCatalog((res.data || []).filter((v) => v.status !== 'inactive'));
    } catch {
      /* dropdown stays empty until retry */
    }
  }, []);

  const readFileAsBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const getManualValue = (invitationId: number, fieldId: string, fallback: unknown = '') => {
    const draft = manualDrafts[invitationId];
    if (draft && draft[fieldId] !== undefined) return draft[fieldId];
    return fallback;
  };

  const setManualValue = (invitationId: number, fieldId: string, value: unknown) => {
    setManualDrafts((prev) => ({
      ...prev,
      [invitationId]: { ...prev[invitationId], [fieldId]: value },
    }));
  };

  const fields = config?.fieldDefinitions || [];
  const vendorFields = fields.filter((f) => f.filledBy === 'vendor');
  const requesterFields = fields.filter((f) => f.filledBy === 'requester');
  // Requester locks after own-vendor submit; SCM continues until final finalize
  const isFinalized = isScm
    ? Boolean(config?.finalizedAt)
    : Boolean(config?.finalizedAt || config?.requesterSubmittedAt);
  const hasInvitations = tableRows.length > 0;
  const invitedVendorNames = new Set(tableRows.map((r) => r.vendorName.toLowerCase()));
  const maxRoundSeen = Math.max(1, previewRound, ...tableRows.map((r) => r.round));
  const recommendedRow = tableRows.find((r) => r.invitationId === recommendedId);
  const canSubmitRfq = Boolean(recommendedRow?.hasActiveQuote);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const loadRfq = useCallback(async () => {
    if (!prId) return;
    setLoading(true);
    try {
      const res = await rfqApi.getByPr(Number(prId));
      const data = res.data;
      setPr(data.pr as typeof pr);
      const cfg = data.config as RfqConfig;
      setConfig(cfg);
      setRecommendedId(cfg.recommendedInvitationId);
      const rows = (data.tableRows || []) as TableRow[];
      setTableRows(rows);
      if (rows.length) setPreviewRound(Math.max(...rows.map((r) => r.round)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RFQ');
    } finally {
      setLoading(false);
    }
  }, [prId]);

  useEffect(() => {
    loadRfq();
    loadVendors();
  }, [loadRfq, loadVendors]);

  useEffect(() => {
    if (!hasInvitations || isFinalized) return;
    const interval = setInterval(loadRfq, 15000);
    return () => clearInterval(interval);
  }, [hasInvitations, isFinalized, loadRfq]);

  const saveConfig = async (updates: Partial<RfqConfig>) => {
    if (!prId) return;
    const next = {
      fieldDefinitions: updates.fieldDefinitions ?? config?.fieldDefinitions ?? [],
      maxRounds: updates.maxRounds ?? config?.maxRounds ?? null,
      recommendedInvitationId: updates.recommendedInvitationId ?? recommendedId,
    };
    const res = await rfqApi.saveConfig(Number(prId), next);
    setConfig(res.data.config as RfqConfig);
  };

  const addField = async () => {
    if (!newFieldLabel.trim()) return;
    const id = newFieldLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
    const field: RfqFieldDefinition = {
      id: id || `field_${Date.now()}`,
      label: newFieldLabel.trim(),
      type: newFieldType,
      filledBy: newFieldFilledBy,
    };
    await saveConfig({ fieldDefinitions: [...fields, field] });
    setNewFieldLabel('');
    showToast('Field added');
  };

  const removeField = async (fieldId: string) => {
    const f = fields.find((x) => x.id === fieldId);
    if (f?.core) return;
    await saveConfig({ fieldDefinitions: fields.filter((x) => x.id !== fieldId) });
  };

  const inviteSelectedVendors = async (sendEmail: boolean) => {
    if (!prId) return;
    const selected = draftRows.filter((r) => r.vendorId);
    if (!selected.length) {
      setError(sendEmail ? 'Select at least one vendor to send mail' : 'Select at least one vendor for manual entry');
      return;
    }

    const vendors = selected
      .map((r) => ({ name: r.vendorName, email: r.vendorEmail }))
      .filter((v) => !invitedVendorNames.has(v.name.toLowerCase()));

    const alreadyInvited = selected.filter((r) => invitedVendorNames.has(r.vendorName.toLowerCase()));
    if (!vendors.length) {
      setError(
        alreadyInvited.length === 1
          ? `"${alreadyInvited[0].vendorName}" is already in the table. Choose a different vendor.`
          : 'Selected vendor(s) are already in the quotation table.'
      );
      return;
    }

    if (sendEmail) setSendingMail(true);
    else setAddingManual(true);
    setError('');
    try {
      const res = await rfqApi.invite(Number(prId), vendors, fields, sendEmail);
      const data = res.data as { tableRows: TableRow[]; config: RfqConfig };
      setTableRows(data.tableRows || []);
      setConfig(data.config);
      setDraftRows([newDraftRow()]);
      const msg = res.message || (sendEmail ? 'Emails sent' : 'Added for manual entry');
      if (alreadyInvited.length) {
        showToast(`${msg} (${alreadyInvited.length} already in table, skipped)`);
      } else {
        showToast(msg);
      }
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : sendEmail ? 'Failed to send mail' : 'Failed to add manual entry');
    } finally {
      setSendingMail(false);
      setAddingManual(false);
    }
  };

  const handleSendMail = () => inviteSelectedVendors(true);
  const handleAddManualEntry = () => inviteSelectedVendors(false);

  const handleResendMail = async (row: TableRow) => {
    setResendingId(row.invitationId);
    setError('');
    try {
      const res = await rfqApi.resendInviteEmail(row.invitationId);
      showToast(res.message || 'RFQ email resent');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend mail');
    } finally {
      setResendingId(null);
    }
  };

  const handleSaveManualEntry = async (row: TableRow) => {
    const draft = manualDrafts[row.invitationId] || {};
    const quotedPrice = Number(draft.quotedPrice);
    if (!quotedPrice || quotedPrice <= 0) {
      setError('Enter quoted price before saving manual entry');
      return;
    }

    setSavingManualId(row.invitationId);
    setError('');
    try {
      const file = manualFiles[row.invitationId];
      let quotationFileData: string | undefined;
      if (file) quotationFileData = await readFileAsBase64(file);

      const requesterFieldValues: Record<string, unknown> = {};
      for (const f of requesterFields) {
        if (draft[f.id] !== undefined) requesterFieldValues[f.id] = draft[f.id];
      }

      const res = await rfqApi.manualSubmit(row.invitationId, {
        quotedPrice,
        leadTime: Number(draft.leadTime) || 0,
        paymentTerms: String(draft.paymentTerms || 'Net 30'),
        warranty: String(draft.warranty || ''),
        deliveryTerms: String(draft.deliveryTerms || ''),
        compliance: draft.compliance !== false,
        vendorNotes: String(draft.vendorNotes || 'Manually entered by requester'),
        quotationFileName: file?.name,
        quotationFileData,
        requesterFields: requesterFieldValues,
        technicalScore: Number(draft.technicalScore) || 0,
        commercialScore: Number(draft.commercialScore) || 0,
        overallScore: Number(draft.overallScore) || 0,
        customFields: draft,
      });

      showToast(res.message || 'Manual quotation saved');
      setManualDrafts((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      setManualFiles((prev) => {
        const next = { ...prev };
        delete next[row.invitationId];
        return next;
      });
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save manual entry');
    } finally {
      setSavingManualId(null);
    }
  };

  const renderFieldInput = (
    field: RfqFieldDefinition,
    value: unknown,
    onChange: (val: unknown) => void,
    disabled = false
  ) => {
    if (field.type === 'boolean') {
      return (
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 accent-teal-600"
          />
          {Boolean(value) ? 'Yes' : 'No'}
        </label>
      );
    }
    if (field.id === 'paymentTerms') {
      return (
        <select
          value={String(value || 'Net 30')}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
        >
          {['Net 30', 'Net 45', 'Net 60', 'Advance 50%', 'On Delivery', 'Deviated'].map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }
    const isMoney = field.id === 'quotedPrice';
    const isNumber = field.type === 'number';
    return (
      <input
        type={isNumber ? 'number' : 'text'}
        min={isNumber ? 0 : undefined}
        step={isMoney ? '1' : undefined}
        value={value === undefined || value === null ? '' : String(value)}
        disabled={disabled}
        onChange={(e) => {
          if (isNumber) {
            const n = e.target.value === '' ? '' : Number(e.target.value);
            onChange(n === '' ? '' : Math.max(0, Number(n)));
          } else {
            onChange(e.target.value);
          }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50"
        placeholder={field.label}
      />
    );
  };

  const handleReviewFieldChange = async (submissionId: number | null, fieldId: string, value: unknown) => {
    if (!submissionId) return;
    const row = tableRows.find((r) => r.submissionId === submissionId || r.quotes?.some((q) => q.submissionId === submissionId));
    const quote = row?.quotes?.find((q) => q.submissionId === submissionId);
    const current = quote?.requesterFields || {};
    const requesterFields = { ...current, [fieldId]: value };
    await rfqApi.updateReviewFields(submissionId, requesterFields);
    setTableRows((rows) =>
      rows.map((r) => ({
        ...r,
        fieldValues: r.submissionId === submissionId ? { ...r.fieldValues, [fieldId]: value } : r.fieldValues,
        quotes: r.quotes?.map((q) =>
          q.submissionId === submissionId ? { ...q, requesterFields, fieldValues: { ...q.fieldValues, [fieldId]: value } } : q
        ),
      }))
    );
  };

  const handleSubmitRfq = async () => {
    if (!prId || !recommendedId) {
      setError('Select a recommended vendor before submitting RFQ');
      return;
    }
    const recRow = tableRows.find((r) => r.invitationId === recommendedId);
    if (!recRow?.hasActiveQuote) {
      if (recRow?.status === 'invited') {
        setError(`${recRow.vendorName} has no quotation yet. Send RFQ mail, or use Save Manual Entry in the table.`);
      } else if (recRow?.status === 'sent_back') {
        setError(`${recRow.vendorName} must re-submit quotation for Round ${recRow.round} before you can submit RFQ.`);
      } else {
        setError('Recommended vendor must have a submitted quotation. Select a vendor with a completed quote.');
      }
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await rfqApi.saveConfig(Number(prId), {
        fieldDefinitions: fields,
        recommendedInvitationId: recommendedId,
        maxRounds: config?.maxRounds ?? null,
      });
      const res = await rfqApi.finalize(Number(prId), recommendedId, taskId ? Number(taskId) : undefined);
      showToast(res.message || 'RFQ submitted for HOD vendor final approval');
      await loadRfq();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendBack = async (reason: string, backFields: string[]) => {
    if (!sendBackTarget) return;
    try {
      const res = await rfqApi.sendBack(sendBackTarget.invitationId, reason, backFields);
      setTableRows((res.data.tableRows || []) as TableRow[]);
      if (res.data.config) setConfig(res.data.config as RfqConfig);
      setSendBackTarget(null);
      showToast(`Re-quote Round ${sendBackTarget.round + 1} sent`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Send-back failed');
    }
  };

  const openFilePreview = async (submissionId: number, fileName: string) => {
    const token = localStorage.getItem('p2p_token');
    try {
      const res = await fetch(rfqApi.quotationFileUrl(submissionId), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Could not load file');
      const blob = await res.blob();
      setFilePreview({ url: URL.createObjectURL(blob), fileName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    }
  };

  const updateDraftVendor = (key: string, vendorId: string) => {
    const vendor = vendorCatalog.find((v) => String(v.id) === vendorId);
    setError('');
    setDraftRows((rows) =>
      rows.map((r) =>
        r.key === key
          ? { ...r, vendorId, vendorName: vendor?.name || '', vendorEmail: vendor?.email || '' }
          : r
      )
    );
  };

  const handleVendorCreated = async (vendor?: VendorRecord) => {
    const rowKey = addVendorRowKey;
    setAddVendorRowKey(null);
    await loadVendors();
    if (vendor && rowKey) {
      setDraftRows((rows) =>
        rows.map((r) =>
          r.key === rowKey
            ? {
                ...r,
                vendorId: String(vendor.id),
                vendorName: vendor.name || '',
                vendorEmail: vendor.email || '',
              }
            : r
        )
      );
      showToast(`Vendor ${vendor.name} added`);
    } else {
      showToast('Vendor added to master list');
    }
  };

  const getDisplayQuote = (row: TableRow) => {
    const active = row.quotes?.find(
      (q) => q.round === row.round && q.status === 'submitted' && q.quotedPrice > 0
    );
    if (active) return active;
    if (row.status === 'submitted') {
      return [...(row.quotes || [])].reverse().find((q) => q.status === 'submitted' && q.quotedPrice > 0) || null;
    }
    if (mode === 'preview') {
      return row.quotes?.find((q) => q.round === previewRound && q.quotedPrice > 0) || null;
    }
    return null;
  };

  return (
    <DashboardLayout>
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-3 bg-emerald-600 text-white text-sm font-medium rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
        <div className="flex items-start gap-3">
          <Link to={listPath} className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-300 hover:bg-gray-50">
            <i className="ri-arrow-left-line text-lg"></i>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">RFQ / Quotation Entry</h1>
            <p className="text-sm text-gray-500">
              PR: <span className="font-semibold text-teal-700">{pr?.prNumber || '—'}</span>
              {isScm && config?.requesterSubmittedAt && !config?.finalizedAt && (
                <span className="ml-2 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
                  SCM Final
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-gray-300 overflow-hidden">
            <button type="button" onClick={() => setMode('entry')} className={`px-4 py-2 text-sm font-medium ${mode === 'entry' ? 'bg-teal-600 text-white' : 'bg-white'}`}>Entry</button>
            <button type="button" onClick={() => setMode('preview')} className={`px-4 py-2 text-sm font-medium border-l border-gray-300 ${mode === 'preview' ? 'bg-teal-600 text-white' : 'bg-white'}`}>Preview</button>
          </div>
          {hasInvitations && mode === 'preview' && (
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              {Array.from({ length: maxRoundSeen }, (_, i) => i + 1).map((r) => (
                <button key={r} type="button" onClick={() => setPreviewRound(r)} className={`px-3 py-2 text-xs font-bold border-l first:border-l-0 ${previewRound === r ? 'bg-violet-600 text-white' : 'bg-white'}`}>
                  R{r}
                </button>
              ))}
            </div>
          )}
          {!isFinalized && hasInvitations && (
            <button
              type="button"
              onClick={handleSubmitRfq}
              disabled={submitting || !recommendedId || !canSubmitRfq}
              title={!canSubmitRfq && recommendedId ? 'Recommended vendor needs a submitted quotation' : undefined}
              className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : isScm ? 'Finalize RFQ' : 'Submit RFQ'}
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      {isFinalized && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          {config?.finalizedAt
            ? isScm
              ? 'RFQ finalized. Ready for next SCM step (vendor approval / Create PO).'
              : 'RFQ finalized. Task completed.'
            : 'RFQ submitted for HOD vendor final → L2 → CFO approval. Task completed.'}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-gray-500">Loading...</div>
      ) : (
        <div className="space-y-4">
          {!isFinalized && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <h2 className="text-sm font-bold text-gray-900 mb-3">Quotation Fields (dynamic)</h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {fields.map((f) => (
                  <span key={f.id} className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${f.filledBy === 'vendor' ? 'bg-teal-50 text-teal-800' : 'bg-violet-50 text-violet-800'}`}>
                    {f.label} ({f.filledBy})
                    {!f.core && (
                      <button type="button" onClick={() => removeField(f.id)} className="text-red-500 hover:text-red-700">×</button>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-end">
                <input value={newFieldLabel} onChange={(e) => setNewFieldLabel(e.target.value)} placeholder="New field label" className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <select value={newFieldFilledBy} onChange={(e) => setNewFieldFilledBy(e.target.value as 'vendor' | 'requester')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="vendor">Vendor fills</option>
                  <option value="requester">You fill after quote</option>
                </select>
                <select value={newFieldType} onChange={(e) => setNewFieldType(e.target.value as 'text' | 'number' | 'boolean')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Yes/No</option>
                </select>
                <button type="button" onClick={addField} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg">Add Field</button>
              </div>
            </div>
          )}

          {!isFinalized && (
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900">Invite Vendors</h2>
                <button type="button" onClick={() => setDraftRows((r) => [...r, newDraftRow()])} className="text-sm text-teal-700 font-medium">+ Add Row</button>
              </div>
              <div className="space-y-2 mb-3">
                {draftRows.map((row, i) => (
                  <div key={row.key} className="flex gap-2 items-center">
                    <span className="text-xs text-gray-400 w-6">{i + 1}</span>
                    <select
                      value={row.vendorId}
                      onChange={(e) => updateDraftVendor(row.key, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="">— Select vendor —</option>
                      {vendorCatalog.map((v) => {
                        const alreadyInvited = invitedVendorNames.has(v.name.toLowerCase());
                        return (
                          <option key={v.id} value={String(v.id)} disabled={alreadyInvited}>
                            {v.name}
                            {v.vendorCode ? ` (${v.vendorCode})` : ''}
                            {alreadyInvited ? ' (already invited)' : ''}
                          </option>
                        );
                      })}
                    </select>
                    <button
                      type="button"
                      onClick={() => setAddVendorRowKey(row.key)}
                      className="px-3 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 whitespace-nowrap flex items-center gap-1.5"
                    >
                      <i className="ri-user-add-line"></i>
                      Add Vendor
                    </button>
                    {draftRows.length > 1 && (
                      <button type="button" onClick={() => setDraftRows((r) => r.filter((x) => x.key !== row.key))} className="text-red-500 px-2">×</button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleSendMail} disabled={sendingMail || addingManual} className="px-5 py-2.5 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50 flex items-center gap-2">
                  <i className="ri-mail-send-line"></i>
                  {sendingMail ? 'Sending...' : 'Send Mail to Vendors'}
                </button>
                <button type="button" onClick={handleAddManualEntry} disabled={sendingMail || addingManual} className="px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                  <i className="ri-edit-line"></i>
                  {addingManual ? 'Adding...' : 'Add Manual Entry'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                <strong>Send Mail</strong> — vendor receives email and fills quotation fields (table locked until vendor submits).{' '}
                <strong>Add Manual Entry</strong> — adds row to table with no email; you fill all fields and upload file.
              </p>
            </div>
          )}

          {hasInvitations && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Vendor Quotations</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {mode === 'preview'
                      ? `Read-only view for Round ${previewRound}`
                      : 'Fill manual rows, review email quotes, then recommend one vendor'}
                  </p>
                </div>
                <div className="text-xs text-gray-500">
                  {tableRows.filter((r) => r.hasActiveQuote).length} of {tableRows.length} quoted
                </div>
              </div>

              <div className="space-y-4">
                {tableRows.map((row, i) => {
                  const quote = getDisplayQuote(row);
                  const vals = { ...quote?.fieldValues, ...quote?.requesterFields };
                  const submissionId = quote?.submissionId || row.submissionId;
                  const isManualRow = row.inviteMode === 'manual';
                  const isEmailRow = row.inviteMode !== 'manual';
                  const awaitingManualEntry = isManualRow && !row.hasActiveQuote;
                  const awaitingVendorEmail =
                    isEmailRow && !row.hasActiveQuote && (row.status === 'invited' || row.status === 'sent_back');
                  const isRecommended = recommendedId === row.invitationId || row.isRecommended;
                  const statusLabel = awaitingManualEntry
                    ? 'Manual entry'
                    : awaitingVendorEmail
                      ? row.status === 'sent_back'
                        ? 'Awaiting re-quote'
                        : 'Awaiting vendor email'
                      : row.hasActiveQuote
                        ? 'Quote received'
                        : row.status;

                  return (
                    <div
                      key={row.id}
                      className={`bg-white border rounded-xl overflow-hidden shadow-sm ${
                        isRecommended
                          ? 'border-teal-400 ring-1 ring-teal-200'
                          : awaitingManualEntry
                            ? 'border-teal-200'
                            : awaitingVendorEmail
                              ? 'border-amber-200'
                              : 'border-gray-200'
                      }`}
                    >
                      <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/80">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-sm font-bold text-gray-600 shrink-0">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900 truncate">{row.vendorName}</h3>
                              <span className="px-2 py-0.5 rounded-md bg-white border border-gray-200 text-[11px] font-semibold text-gray-600">
                                Round {mode === 'preview' ? previewRound : row.round}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                                  awaitingManualEntry
                                    ? 'bg-teal-50 text-teal-700 border border-teal-200'
                                    : awaitingVendorEmail
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : row.hasActiveQuote
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {statusLabel}
                              </span>
                              {isRecommended && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold flex items-center gap-1">
                                  <i className="ri-star-fill text-amber-500"></i>
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {isManualRow ? 'You enter quote details' : 'Vendor submits via email'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {!isFinalized && mode === 'entry' && (
                            <label
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium cursor-pointer ${
                                isRecommended
                                  ? 'bg-teal-600 text-white border-teal-600'
                                  : row.hasActiveQuote
                                    ? 'bg-white text-gray-700 border-gray-300 hover:border-teal-400'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed'
                              }`}
                              title={!row.hasActiveQuote ? 'Enter or receive vendor quote first' : 'Mark as recommended'}
                            >
                              <input
                                type="radio"
                                name="recommended"
                                className="sr-only"
                                checked={recommendedId === row.invitationId}
                                disabled={!row.hasActiveQuote}
                                onChange={() => row.hasActiveQuote && setRecommendedId(row.invitationId)}
                              />
                              <i className={`ri-star-${isRecommended ? 'fill' : 'line'}`}></i>
                              {isRecommended ? 'Recommended' : 'Recommend'}
                            </label>
                          )}

                          {mode === 'entry' && !isFinalized && awaitingManualEntry && (
                            <button
                              type="button"
                              onClick={() => handleSaveManualEntry(row)}
                              disabled={savingManualId === row.invitationId}
                              className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50"
                            >
                              {savingManualId === row.invitationId ? 'Saving...' : 'Save Entry'}
                            </button>
                          )}
                          {mode === 'entry' && !isFinalized && awaitingVendorEmail && (
                            <button
                              type="button"
                              onClick={() => handleResendMail(row)}
                              disabled={resendingId === row.invitationId}
                              className="px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-lg hover:bg-amber-600 disabled:opacity-50"
                            >
                              {resendingId === row.invitationId ? 'Sending...' : 'Resend Mail'}
                            </button>
                          )}
                          {mode === 'entry' && !isFinalized && row.canSendBack && (
                            <button
                              type="button"
                              onClick={() => setSendBackTarget(row)}
                              className="px-4 py-2 border border-amber-300 text-amber-800 text-sm font-medium rounded-lg hover:bg-amber-50"
                            >
                              Send Back
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-5">
                        {awaitingVendorEmail ? (
                          <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/40 px-4 py-6 text-center">
                            <i className="ri-mail-send-line text-2xl text-amber-500"></i>
                            <p className="text-sm font-medium text-amber-800 mt-2">Waiting for vendor quotation by email</p>
                            <p className="text-xs text-amber-700 mt-1">Fields unlock after the vendor submits. You can resend the invite if needed.</p>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Vendor fields</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {vendorFields.map((f) => (
                                  <div key={f.id} className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-gray-600">{f.label}</label>
                                    {mode === 'entry' && !isFinalized && awaitingManualEntry ? (
                                      renderFieldInput(
                                        f,
                                        getManualValue(row.invitationId, f.id, f.id === 'compliance' ? true : ''),
                                        (val) => setManualValue(row.invitationId, f.id, val)
                                      )
                                    ) : (
                                      <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-sm text-gray-900 min-h-[40px] flex items-center">
                                        {formatFieldValue(f, vals[f.id])}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {(mode === 'entry' || requesterFields.some((f) => vals[f.id] !== undefined && vals[f.id] !== '')) &&
                              requesterFields.length > 0 && (
                              <div>
                                <p className="text-xs font-bold uppercase tracking-wide text-violet-600 mb-3">Your scoring fields</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                  {requesterFields.map((f) => (
                                    <div key={f.id} className="space-y-1.5">
                                      <label className="block text-xs font-semibold text-violet-700">{f.label}</label>
                                      {mode === 'entry' && !isFinalized ? (
                                        awaitingManualEntry ? (
                                          renderFieldInput(
                                            f,
                                            getManualValue(row.invitationId, f.id, vals[f.id]),
                                            (val) => setManualValue(row.invitationId, f.id, val)
                                          )
                                        ) : f.type === 'boolean' ? (
                                          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(vals[f.id])}
                                              onChange={(e) => handleReviewFieldChange(submissionId, f.id, e.target.checked)}
                                              className="w-4 h-4 accent-violet-600"
                                            />
                                            {Boolean(vals[f.id]) ? 'Yes' : 'No'}
                                          </label>
                                        ) : (
                                          <input
                                            type={f.type === 'number' ? 'number' : 'text'}
                                            min={f.type === 'number' ? 0 : undefined}
                                            value={String(vals[f.id] ?? '')}
                                            onChange={(e) =>
                                              handleReviewFieldChange(
                                                submissionId,
                                                f.id,
                                                f.type === 'number'
                                                  ? Math.max(0, Number(e.target.value) || 0)
                                                  : e.target.value
                                              )
                                            }
                                            className="w-full px-3 py-2 border border-violet-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                                            placeholder={f.label}
                                          />
                                        )
                                      ) : (
                                        <div className="px-3 py-2 rounded-lg bg-violet-50/50 border border-violet-100 text-sm text-gray-900 min-h-[40px] flex items-center">
                                          {formatFieldValue(f, vals[f.id])}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="pt-1 border-t border-gray-100">
                              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-3">Quotation file</p>
                              {mode === 'entry' && !isFinalized && awaitingManualEntry ? (
                                <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-teal-300 rounded-lg bg-teal-50/40 cursor-pointer hover:bg-teal-50">
                                  <i className="ri-upload-2-line text-xl text-teal-700"></i>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-teal-800 truncate">
                                      {manualFiles[row.invitationId]?.name || 'Upload quotation file'}
                                    </p>
                                    <p className="text-xs text-teal-700">PDF, Word, or image</p>
                                  </div>
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                                    className="text-xs"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0] || null;
                                      setManualFiles((prev) => ({ ...prev, [row.invitationId]: file }));
                                    }}
                                  />
                                </label>
                              ) : quote?.submissionId && quote.quotationFileName ? (
                                <button
                                  type="button"
                                  onClick={() => openFilePreview(quote.submissionId!, quote.quotationFileName)}
                                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-teal-700 hover:bg-teal-50"
                                >
                                  <i className="ri-file-look-line"></i>
                                  {quote.quotationFileName}
                                  <span className="text-xs text-gray-500">Preview</span>
                                </button>
                              ) : (
                                <p className="text-sm text-gray-400">No file uploaded</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {sendBackTarget && (
        <SendBackModal vendorName={sendBackTarget.vendorName} currentRound={sendBackTarget.round} onConfirm={handleSendBack} onClose={() => setSendBackTarget(null)} />
      )}

      {addVendorRowKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <CreateVendorForm
              compact
              onSuccess={handleVendorCreated}
              onCancel={() => setAddVendorRowKey(null)}
            />
          </div>
        </div>
      )}

      {filePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between">
              <span className="font-semibold">{filePreview.fileName}</span>
              <button type="button" onClick={() => { URL.revokeObjectURL(filePreview.url); setFilePreview(null); }}>×</button>
            </div>
            <div className="p-4 flex-1">
              {/\.pdf$/i.test(filePreview.fileName) ? (
                <iframe title="preview" src={filePreview.url} className="w-full h-[70vh] border rounded" />
              ) : (
                <img src={filePreview.url} alt="" className="max-h-[70vh] mx-auto" />
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
