import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import RichTextEditor from '../../../components/base/RichTextEditor';
import {
  poApi,
  prApi,
  rfqApi,
  poLetterheadApi,
  letterheadMasterApi,
  triggerBlobDownload,
  PoType,
  PoLetterheadClause,
  LetterheadMasterRecord,
  LetterheadLocationRecord,
} from '../../../services/api';
import {
  consumePoCsvImport,
  type PoCsvImportPayload,
} from '../../../utils/poCsvImport';
import { numberToIndianWords } from '../../../utils/amountInWords';

interface LineItem {
  id: string | number;
  itemName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxPercentage: number;
  total: number;
  unit?: string;
}

function plainTextFromHtml(html: string) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calcLineTotal(quantity: number, unitPrice: number) {
  const gross = (Number(quantity) || 0) * (Number(unitPrice) || 0);
  return Math.round(gross * 100) / 100;
}

function calcLineTax(total: number, taxPercentage: number) {
  return Math.round(((Number(total) || 0) * (Number(taxPercentage) || 0)) / 100 * 100) / 100;
}

const PAYMENT_TERMS_OPTIONS = [
  'Net 15 Days',
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
  'Advance Payment',
  '50% Advance, 50% on Delivery',
];

const EMPTY_PO_TERMS_DETAILS = {
  paymentTermsText: '',
  siteAddress: '',
  siteContactPerson: '',
  siteContactPhone: '',
  siteContactEmail: '',
  projectManagerHo: '',
  projectManagerContact: '',
  projectManagerEmail: '',
  invoicingAddress: '',
  mailingAddress: '',
  reasonForCancellation: '',
  subject: '',
  locationName: '',
  buyerGstNo: '',
  letterheadLocationId: '',
};

function letterheadLocKey(loc: LetterheadLocationRecord, index = 0) {
  if (loc.id != null) return String(loc.id);
  return `name:${loc.location || index}`;
}

function buildInvoicingAddressFromLocation(loc: LetterheadLocationRecord) {
  return [loc.location?.trim(), loc.gstNo?.trim() ? `GSTIN: ${loc.gstNo.trim()}` : '']
    .filter(Boolean)
    .join('\n');
}

type PoTermsDetails = typeof EMPTY_PO_TERMS_DETAILS;

const INCOTERMS_OPTIONS = ['EXW', 'FOB', 'CIF', 'DDP', 'DAP', 'FCA'];

const PO_TYPE_OPTIONS: { id: PoType; label: string }[] = [
  { id: 'short_po', label: 'Short PO' },
  { id: 'long_po', label: 'Long PO' },
];

type EditableClauseRow = PoLetterheadClause & { clientKey: string };

function makeClauseClientKey() {
  return `clause-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyClauseRow(): EditableClauseRow {
  return { clientKey: makeClauseClientKey(), termsHeader: '', termsDescription: '' };
}

function toEditableClauseRows(clauses: PoLetterheadClause[]): EditableClauseRow[] {
  if (!clauses.length) return [emptyClauseRow()];
  return clauses.map((clause) => ({
    ...clause,
    clientKey: clause.id ? `db-${clause.id}` : makeClauseClientKey(),
  }));
}

function filterNonEmptyClauses(clauses: PoLetterheadClause[]): PoLetterheadClause[] {
  return clauses
    .filter(
      (clause) =>
        plainTextFromHtml(String(clause.termsHeader || '')) ||
        plainTextFromHtml(String(clause.termsDescription || ''))
    )
    .map((clause, index) => ({ ...clause, sortOrder: index }));
}

function clauseListSignature(clauses: PoLetterheadClause[]) {
  return JSON.stringify(
    (clauses || []).map((c) => [c.id ?? null, c.termsHeader || '', c.termsDescription || '', c.sortOrder ?? null])
  );
}

function ClauseTableEditor({
  title,
  headerColumnLabel,
  descriptionColumnLabel,
  headerPlaceholder,
  descriptionPlaceholder,
  emptyHint,
  clauses,
  onChange,
  onReloadFromMaster,
  reloadDisabled,
}: {
  title: string;
  headerColumnLabel: string;
  descriptionColumnLabel: string;
  headerPlaceholder: string;
  descriptionPlaceholder: string;
  emptyHint: string;
  clauses: PoLetterheadClause[];
  onChange: (next: PoLetterheadClause[]) => void;
  onReloadFromMaster?: () => void;
  reloadDisabled?: boolean;
}) {
  const [rows, setRows] = useState<EditableClauseRow[]>(() => toEditableClauseRows(clauses));
  const lastExternalSig = useRef(clauseListSignature(clauses));

  useEffect(() => {
    const sig = clauseListSignature(clauses);
    if (sig === lastExternalSig.current) return;
    lastExternalSig.current = sig;
    setRows(toEditableClauseRows(clauses));
  }, [clauses]);

  const commit = (nextRows: EditableClauseRow[]) => {
    setRows(nextRows);
    const payload = nextRows.map(({ clientKey: _key, ...clause }, index) => ({
      ...clause,
      sortOrder: index,
    }));
    lastExternalSig.current = clauseListSignature(payload);
    onChange(payload);
  };

  const updateRow = (index: number, patch: Partial<EditableClauseRow>) => {
    commit(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const addRow = () => commit([...rows, emptyClauseRow()]);

  const removeRow = (index: number) => {
    if (rows.length <= 1) {
      commit([emptyClauseRow()]);
      return;
    }
    commit(rows.filter((_, i) => i !== index));
  };

  const moveRow = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm w-full">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900">{title}</h3>
          <span className="px-2 py-0.5 text-xs font-medium bg-white border border-gray-200 rounded-full text-gray-500">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
          <span className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">
            Editable · shown on PO PDF
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onReloadFromMaster ? (
            <button
              type="button"
              onClick={onReloadFromMaster}
              disabled={reloadDisabled}
              className="text-xs font-medium text-teal-700 hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reload from Master
            </button>
          ) : null}
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 cursor-pointer"
          >
            <i className="ri-add-line"></i>
            Add Row
          </button>
        </div>
      </div>

      {!clauses.length ? (
        <p className="px-5 pt-3 text-xs text-gray-400 italic">{emptyHint}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 bg-white border-b border-gray-100">
              <th className="px-5 py-3 w-12">#</th>
              <th className="px-5 py-3 w-[280px]">{headerColumnLabel}</th>
              <th className="px-5 py-3">{descriptionColumnLabel}</th>
              <th className="px-5 py-3 w-28 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.clientKey} className="border-b border-gray-50 align-top hover:bg-gray-50/40">
                <td className="px-5 py-4 text-sm text-gray-400">{index + 1}</td>
                <td className="px-5 py-4">
                  <label className="block text-xs text-gray-400 mb-1">Header</label>
                  <RichTextEditor
                    editorKey={`${row.clientKey}-header`}
                    value={row.termsHeader || ''}
                    onChange={(html) => updateRow(index, { termsHeader: html })}
                    placeholder={headerPlaceholder}
                    minHeight={72}
                  />
                </td>
                <td className="px-5 py-4">
                  <label className="block text-xs text-gray-400 mb-1">Description</label>
                  <RichTextEditor
                    editorKey={`${row.clientKey}-desc`}
                    value={row.termsDescription || ''}
                    onChange={(html) => updateRow(index, { termsDescription: html })}
                    placeholder={descriptionPlaceholder}
                    minHeight={100}
                  />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-1 pt-5">
                    <button
                      type="button"
                      onClick={() => moveRow(index, -1)}
                      disabled={index === 0}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <i className="ri-arrow-up-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => moveRow(index, 1)}
                      disabled={index === rows.length - 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <i className="ri-arrow-down-line"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(index)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      title="Remove row"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function CreatePOPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prIdParam = searchParams.get('prId');
  const poIdParam = searchParams.get('poId');
  const refPoParam = searchParams.get('refPo');
  const fromCsvParam = searchParams.get('from');
  const numericPrId = prIdParam ? Number(prIdParam) : null;
  const editPoId = poIdParam ? Number(poIdParam) : null;
  const isEditMode = !!editPoId && !Number.isNaN(editPoId);
  const editReturnPath =
    searchParams.get('from') === 'buyer-verify' ? '/scm/buyer-final-verify' : '/scm/po-approval';
  const isBuyerVerifyEdit = searchParams.get('from') === 'buyer-verify';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pr, setPr] = useState<{
    id: number;
    prNumber: string;
    title: string;
    department: string;
    entityId?: number | null;
    entityName?: string;
    entityCode?: string;
    requester: string;
    recommendedVendor: string;
    vendorEmail: string;
    lineItems: Array<{ id: number; description: string; quantity: number; unitPrice: number; category?: string }>;
    requiredDate?: string;
    amount?: number;
    requestType?: string;
    purchaseType?: 'purchase_order' | 'work_order';
    purchaseTypeLabel?: string;
    priority?: string;
  } | null>(null);

  const [poNumber, setPoNumber] = useState('');
  const [referencePoNumber, setReferencePoNumber] = useState('');
  const [referencePoLoading, setReferencePoLoading] = useState(false);
  const [referencePoError, setReferencePoError] = useState('');
  const [referencePoLoaded, setReferencePoLoaded] = useState<{
    poNumber: string;
    vendorName: string;
    prNumber: string;
    grandTotal: number;
  } | null>(null);
  const [createdPoId, setCreatedPoId] = useState<number | null>(null);
  const [vendorMeta, setVendorMeta] = useState({
    name: '',
    email: '',
    quotedPrice: 0,
    leadTime: 30,
    paymentTerms: 'Net 30 Days',
    overallScore: 85,
    technicalScore: 85,
    commercialScore: 85,
    compliance: 'Yes',
  });

  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('Plot No. 42, Industrial Area Phase II, Chandigarh - 160002');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [incoterms, setIncoterms] = useState('DDP');
  const [specialInstructions, setSpecialInstructions] = useState('');
  /** Effective GST % derived from line taxes (stored on PO for compatibility) */
  const [gstPercentage, setGstPercentage] = useState(18);
  const [poType, setPoType] = useState<PoType>('short_po');
  const [letterheadHeader, setLetterheadHeader] = useState('');
  const [letterheadOptions, setLetterheadOptions] = useState<LetterheadMasterRecord[]>([]);
  const [letterheadId, setLetterheadId] = useState<number | ''>('');
  const [letterheadLocationKey, setLetterheadLocationKey] = useState('');
  const [locationGstNo, setLocationGstNo] = useState('');
  const [entity, setEntity] = useState('');
  const [headerLogo, setHeaderLogo] = useState('');
  const [footerLogo, setFooterLogo] = useState('');
  const [termsClauses, setTermsClauses] = useState<PoLetterheadClause[]>([]);
  const [annexureClauses, setAnnexureClauses] = useState<PoLetterheadClause[]>([]);
  const [poTermsDetails, setPoTermsDetails] = useState<PoTermsDetails>({ ...EMPTY_PO_TERMS_DETAILS });
  const [letterheadLoading, setLetterheadLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'terms' | 'preview'>('details');
  const [draftSaved, setDraftSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageMode, setPageMode] = useState<'form' | 'pdf'>('form');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [previewHtmlUrl, setPreviewHtmlUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pickerItems, setPickerItems] = useState<Array<{ prId: number; prNumber: string; title: string; department: string; requester: string; totalAmount: number; recommendedVendor: string }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [letterheadLocked, setLetterheadLocked] = useState(false);
  const [skipApproval, setSkipApproval] = useState(
    searchParams.get('legacy') === '1' || searchParams.get('skipApproval') === '1'
  );
  const [importedPoNumber, setImportedPoNumber] = useState('');
  const [importedVendorName, setImportedVendorName] = useState('');
  const [importedVendorEmail, setImportedVendorEmail] = useState('');
  const csvAppliedRef = useRef(false);
  const brandingAutoApplied = useRef(false);
  const skipNextLetterheadLoad = useRef(false);

  const loadLetterhead = useCallback(async (type: PoType) => {
    setLetterheadLoading(true);
    try {
      const res = await poLetterheadApi.get(type);
      setLetterheadHeader(res.data.letterheadHeader || '');
      setTermsClauses(res.data.terms || []);
      setAnnexureClauses(res.data.annexure || []);
    } catch {
      setLetterheadHeader('');
      setTermsClauses([]);
      setAnnexureClauses([]);
    } finally {
      setLetterheadLoading(false);
    }
  }, []);

  const selectedLetterhead = useMemo(
    () => letterheadOptions.find((o) => o.id === letterheadId) || null,
    [letterheadOptions, letterheadId]
  );
  const letterheadLocations = useMemo(() => {
    const locs = selectedLetterhead?.locations || [];
    if (locs.length) return locs;
    // Fallback: single location from master columns
    if (selectedLetterhead?.location || selectedLetterhead?.gstNo) {
      return [
        {
          id: selectedLetterhead.id,
          location: selectedLetterhead.location || '',
          gstNo: selectedLetterhead.gstNo || '',
          footerLogo: selectedLetterhead.footerLogo || '',
        },
      ];
    }
    return [];
  }, [selectedLetterhead]);

  const applyLetterheadLocation = useCallback(
    (loc: LetterheadLocationRecord | null, index = 0) => {
      if (!loc) {
        setLetterheadLocationKey('');
        setLocationGstNo('');
        setPoTermsDetails((prev) => ({
          ...prev,
          locationName: '',
          buyerGstNo: '',
          letterheadLocationId: '',
        }));
        return;
      }
      const key = letterheadLocKey(loc, index);
      setLetterheadLocationKey(key);
      setLocationGstNo(loc.gstNo || '');
      if (loc.footerLogo) setFooterLogo(loc.footerLogo);
      const invoicing = buildInvoicingAddressFromLocation(loc);
      setPoTermsDetails((prev) => ({
        ...prev,
        locationName: loc.location || '',
        buyerGstNo: loc.gstNo || '',
        letterheadLocationId: loc.id != null ? String(loc.id) : key,
        invoicingAddress: invoicing || prev.invoicingAddress,
      }));
    },
    []
  );

  const applyLetterheadBranding = useCallback(
    (row: LetterheadMasterRecord | null, opts?: { keepLocation?: boolean }) => {
      if (!row) {
        setLetterheadId('');
        setEntity('');
        setHeaderLogo('');
        setFooterLogo('');
        if (!opts?.keepLocation) applyLetterheadLocation(null);
        return;
      }
      setLetterheadId(row.id);
      setEntity(row.entity || '');
      setHeaderLogo(row.headerLogo || '');
      const locs = row.locations?.length
        ? row.locations
        : row.location || row.gstNo
          ? [
              {
                id: row.id,
                location: row.location || '',
                gstNo: row.gstNo || '',
                footerLogo: row.footerLogo || '',
              },
            ]
          : [];
      if (locs.length) {
        if (opts?.keepLocation) {
          // Refresh header/entity only; keep current location selection & its footer
          setLetterheadLocationKey((currentKey) => {
            if (!currentKey) {
              setFooterLogo(row.footerLogo || locs[0].footerLogo || '');
              return currentKey;
            }
            const idx = locs.findIndex(
              (l, i) =>
                letterheadLocKey(l, i) === currentKey ||
                String(l.id) === currentKey ||
                l.location === currentKey
            );
            if (idx >= 0) {
              const loc = locs[idx];
              setFooterLogo(loc.footerLogo || row.footerLogo || '');
              setLocationGstNo(loc.gstNo || '');
              return letterheadLocKey(loc, idx);
            }
            setFooterLogo(row.footerLogo || locs[0].footerLogo || '');
            return currentKey;
          });
          return;
        }
        applyLetterheadLocation(locs[0], 0);
        if (!locs[0].footerLogo) setFooterLogo(row.footerLogo || '');
      } else {
        setFooterLogo(row.footerLogo || '');
        if (!opts?.keepLocation) applyLetterheadLocation(null);
      }
    },
    [applyLetterheadLocation]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await letterheadMasterApi.list({ status: 'active' });
        if (cancelled) return;
        const options = res.data || [];
        setLetterheadOptions(options);
        if (!isEditMode && options.length && !brandingAutoApplied.current) {
          brandingAutoApplied.current = true;
          applyLetterheadBranding(options[0]);
        }
      } catch {
        if (!cancelled) setLetterheadOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, applyLetterheadBranding]);

  /** Keep logos/entity in sync with Letterhead Master when id is set (do not reset location pick). */
  useEffect(() => {
    if (!letterheadId) return;
    let cancelled = false;
    (async () => {
      try {
        const match = letterheadOptions.find((o) => o.id === letterheadId);
        if (match?.headerLogo || match?.footerLogo || match?.entity || match?.locations?.length) {
          if (!cancelled) applyLetterheadBranding(match, { keepLocation: true });
          return;
        }
        const res = await letterheadMasterApi.get(Number(letterheadId));
        if (cancelled) return;
        setLetterheadOptions((prev) =>
          prev.some((p) => p.id === res.data.id)
            ? prev.map((p) => (p.id === res.data.id ? res.data : p))
            : [...prev, res.data]
        );
        applyLetterheadBranding(res.data, { keepLocation: true });
      } catch {
        /* keep existing snapshot */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-run when letterheadId or options list identity changes meaningfully
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letterheadId, letterheadOptions.length]);

  useEffect(() => {
    if (letterheadLocked) return;
    if (skipNextLetterheadLoad.current) {
      skipNextLetterheadLoad.current = false;
      return;
    }
    loadLetterhead(poType);
  }, [poType, loadLetterhead, letterheadLocked]);

  const reloadClausesFromMaster = useCallback(async () => {
    setLetterheadLoading(true);
    try {
      const res = await poLetterheadApi.get(poType);
      setLetterheadHeader(res.data.letterheadHeader || '');
      setTermsClauses(res.data.terms || []);
      setAnnexureClauses(res.data.annexure || []);
    } catch {
      /* keep current clauses */
    } finally {
      setLetterheadLoading(false);
    }
  }, [poType]);

  const loadExistingPo = useCallback(async () => {
    if (!isEditMode || !editPoId) return;
    skipNextLetterheadLoad.current = true;
    setLetterheadLocked(false);
    setLoading(true);
    try {
      const res = await poApi.get(editPoId);
      const po = res.data as Record<string, unknown>;
      const statusRaw = String(po.statusRaw || '');
      const allowBuyerVerifyEdit =
        searchParams.get('from') === 'buyer-verify' && statusRaw === 'pending_buyer_verify';
      if (statusRaw !== 'pending_approval' && !allowBuyerVerifyEdit) {
        setLoadError('Only pending or buyer-verify POs can be edited');
        setPr(null);
        return;
      }

      // Buyer final-verify edit uses the same manual create-PO form layout
      if (allowBuyerVerifyEdit || searchParams.get('mode') === 'manual') {
        setPoEntryMode('manual');
      }

      const prDbId = Number(po.prId);
      setCreatedPoId(editPoId);
      setPoNumber(String(po.poNumber || ''));
      setReferencePoNumber(String(po.referencePoNumber || ''));
      if (po.referencePoNumber) {
        setReferencePoLoaded({
          poNumber: String(po.referencePoNumber),
          vendorName: '',
          prNumber: '',
          grandTotal: 0,
        });
      }
      setDeliveryAddress(String(po.deliveryAddress || ''));
      setExpectedDeliveryDate(String(po.expectedDeliveryDate || ''));
      setPaymentTerms(String(po.paymentTerms || 'Net 30 Days'));
      setIncoterms(String(po.incoterms || 'DDP'));
      setSpecialInstructions(String(po.specialInstructions || ''));
      setGstPercentage(Number(po.gstPercentage) || 18);
      setPoType((po.poType as PoType) || 'short_po');
      setLetterheadHeader(String(po.letterheadHeader || ''));
      setLetterheadId(po.letterheadId ? Number(po.letterheadId) : '');
      setEntity(String(po.entity || ''));
      setHeaderLogo(String(po.headerLogo || ''));
      setFooterLogo(String(po.footerLogo || ''));
      const loadedTerms = (po.termsClauses as PoLetterheadClause[]) || [];
      const loadedAnnexure = (po.annexureClauses as PoLetterheadClause[]) || [];
      const loadedType = ((po.poType as PoType) || 'short_po');
      setTermsClauses(loadedTerms);
      setAnnexureClauses(loadedAnnexure);
      {
        const loadedDetails = { ...EMPTY_PO_TERMS_DETAILS, ...((po.poTermsDetails as PoTermsDetails) || {}) };
        setPoTermsDetails({
          ...loadedDetails,
          paymentTermsText: loadedDetails.paymentTermsText || String(po.paymentTerms || ''),
          siteAddress: loadedDetails.siteAddress || String(po.deliveryAddress || ''),
        });
        setLocationGstNo(loadedDetails.buyerGstNo || '');
        setLetterheadLocationKey(loadedDetails.letterheadLocationId || '');
      }

      // If PO has no saved clauses, pull defaults from PO Type Master
      if (!loadedTerms.length || !loadedAnnexure.length || !po.letterheadHeader) {
        try {
          const masterRes = await poLetterheadApi.get(loadedType);
          const master = masterRes.data;
          if (!po.letterheadHeader) setLetterheadHeader(master.letterheadHeader || '');
          if (!loadedTerms.length) setTermsClauses(master.terms || []);
          if (!loadedAnnexure.length) setAnnexureClauses(master.annexure || []);
        } catch {
          /* keep empty if master missing */
        }
      }
      setLineItems(
        ((po.lineItems as Array<Record<string, unknown>>) || []).map((li) => {
          const quantity = Number(li.quantity) || 0;
          const unitPrice = Number(li.unitPrice) || 0;
          const taxPercentage = Math.max(0, Number(li.taxPercentage ?? li.tax_percentage ?? po.gstPercentage) || 18);
          const description = String(li.description || '');
          const itemName = String(li.itemName || li.name || '').trim() || plainTextFromHtml(description);
          return {
            id: Number(li.id) || `li-${itemName || description}`,
            itemName,
            description,
            quantity,
            unitPrice,
            taxPercentage,
            total: Number(li.total) || calcLineTotal(quantity, unitPrice),
          };
        })
      );
      setPr({
        id: prDbId,
        prNumber: String(po.prNumber || ''),
        title: String(po.prTitle || ''),
        department: String(po.department || ''),
        requester: String(po.requester || ''),
        recommendedVendor: String(po.vendorName || ''),
        vendorEmail: String(po.vendorEmail || ''),
        lineItems: ((po.lineItems as Array<Record<string, unknown>>) || []).map((li) => ({
          id: Number(li.id) || 0,
          description: String(li.description || ''),
          quantity: Number(li.quantity) || 0,
          unitPrice: Number(li.unitPrice) || 0,
          category: String(li.category || ''),
        })),
        requiredDate: String(po.expectedDeliveryDate || ''),
        amount: Number(po.grandTotal) || Number(po.subtotal) || 0,
        requestType: 'Opex',
        purchaseType: po.purchaseType === 'work_order' ? 'work_order' : 'purchase_order',
        purchaseTypeLabel:
          String(po.purchaseTypeLabel || '') ||
          (po.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order'),
        priority: String(po.priority || 'medium'),
      });
      setVendorMeta({
        name: String(po.vendorName || ''),
        email: String(po.vendorEmail || ''),
        quotedPrice: Number(po.grandTotal) || 0,
        leadTime: 30,
        paymentTerms: String(po.paymentTerms || 'Net 30 Days'),
        overallScore: 85,
        technicalScore: 85,
        commercialScore: 85,
        compliance: 'Yes',
      });
      setLoadError('');
      try {
        const blob = await poApi.fetchPdfBlob(editPoId);
        setPdfPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      } catch {
        /* draft PDF may not exist yet */
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load PO');
      setPr(null);
    } finally {
      setLoading(false);
    }
  }, [isEditMode, editPoId, searchParams]);

  useEffect(() => {
    if (isEditMode) {
      loadExistingPo();
    }
  }, [isEditMode, loadExistingPo]);

  const loadContext = useCallback(async () => {
    if (isEditMode || !numericPrId) {
      if (!isEditMode) setLoading(false);
      return;
    }
    try {
      const res = await poApi.getCreateContext(numericPrId);
      const prData = res.data.pr as {
        id: number;
        prNumber: string;
        title: string;
        department: string;
        entityId?: number;
        entityName?: string;
        entityCode?: string;
        requester: string;
        purchaseType?: 'purchase_order' | 'work_order';
        purchaseTypeLabel?: string;
        lineItems: Array<{ id: number; description: string; quantity: number; unitCost: number; category?: string }>;
      };
      const vendor = res.data.vendor as { name: string; email: string; paymentTerms: string; deliveryTerms: string };
      setPr({
        id: prData.id,
        prNumber: prData.prNumber,
        title: prData.title,
        department: prData.department,
        entityId: prData.entityId || null,
        entityName: prData.entityName || '',
        entityCode: prData.entityCode || '',
        requester: prData.requester,
        purchaseType: prData.purchaseType === 'work_order' ? 'work_order' : 'purchase_order',
        purchaseTypeLabel: prData.purchaseTypeLabel || (prData.purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order'),
        recommendedVendor: vendor.name,
        vendorEmail: vendor.email,
        lineItems: prData.lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitCost,
          category: li.category,
        })),
      });
      setPaymentTerms(vendor.paymentTerms || 'Net 30 Days');
      setIncoterms(vendor.deliveryTerms?.includes('DDP') ? 'DDP' : vendor.deliveryTerms || 'DDP');
      setVendorMeta({
        name: vendor.name,
        email: vendor.email,
        quotedPrice: Number(vendor.quotedPrice) || 0,
        leadTime: 30,
        paymentTerms: vendor.paymentTerms || 'Net 30 Days',
        overallScore: 85,
        technicalScore: 85,
        commercialScore: 85,
        compliance: 'Yes',
      });
      setLoadError('');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load PR');
      setPr(null);
    } finally {
      setLoading(false);
    }
  }, [numericPrId, isEditMode]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (numericPrId || isEditMode) return;
    setPickerLoading(true);
    Promise.all([prApi.listScmBucket(), rfqApi.listPostApprovalPending()])
      .then(([prRes, rfqRes]) => {
        const prRows = (prRes.data as Array<Record<string, unknown>>).map((p) => ({
          prId: Number(p.id),
          prNumber: String(p.prNumber),
          title: String(p.title),
          department: String(p.department),
          requester: String(p.requester),
          totalAmount: Number(p.totalAmount),
          recommendedVendor: String(p.recommendedVendor || ''),
        }));
        const rfqRows = (rfqRes.data as Array<{ prId: number; prNumber: string; title: string; department: string; requester: string; totalAmount: number; recommendedVendor: string }>).map((p) => ({
          prId: p.prId,
          prNumber: p.prNumber,
          title: p.title,
          department: p.department,
          requester: p.requester,
          totalAmount: p.totalAmount,
          recommendedVendor: p.recommendedVendor || '',
        }));
        const merged = new Map<number, (typeof prRows)[0]>();
        [...prRows, ...rfqRows].forEach((row) => {
          const prev = merged.get(row.prId);
          merged.set(row.prId, {
            ...prev,
            ...row,
            recommendedVendor: row.recommendedVendor || prev?.recommendedVendor || '',
          });
        });
        setPickerItems([...merged.values()]);
      })
      .catch(() => setPickerItems([]))
      .finally(() => setPickerLoading(false));
  }, [numericPrId, isEditMode]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  const updatePoTermsField = (key: keyof PoTermsDetails, value: string) => {
    setPoTermsDetails((prev) => ({ ...prev, [key]: value }));
    if (key === 'paymentTermsText') {
      const firstLine = value.trim().split('\n')[0]?.trim();
      if (firstLine) setPaymentTerms(firstLine.slice(0, 120));
    }
  };

  const subtotal = useMemo(() => lineItems.reduce((s, i) => s + i.total, 0), [lineItems]);
  const taxAmount = useMemo(
    () => lineItems.reduce((s, i) => s + calcLineTax(i.total, i.taxPercentage), 0),
    [lineItems]
  );
  const grandTotal = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);
  const amountInWords = useMemo(() => numberToIndianWords(grandTotal), [grandTotal]);
  const effectiveGstPercentage = useMemo(
    () => (subtotal > 0 ? Math.round((taxAmount / subtotal) * 10000) / 100 : 0),
    [subtotal, taxAmount]
  );

  useEffect(() => {
    setGstPercentage(effectiveGstPercentage);
  }, [effectiveGstPercentage]);

  const buildPreviewPayload = useCallback(() => ({
    poNumber: poNumber || undefined,
    lineItems: lineItems.map((i) => ({
      itemName: i.itemName || '',
      description: i.description,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxPercentage: i.taxPercentage || 0,
      discount: 0,
    })),
    deliveryAddress,
    expectedDeliveryDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage: effectiveGstPercentage,
    poType,
    letterheadHeader,
    letterheadId: letterheadId || undefined,
    letterheadLocationId: poTermsDetails.letterheadLocationId || letterheadLocationKey || undefined,
    locationName: poTermsDetails.locationName || undefined,
    entity,
    headerLogo,
    footerLogo,
    terms: termsClauses,
    annexure: annexureClauses,
    poTermsDetails,
  }), [
    poNumber,
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    effectiveGstPercentage,
    poType,
    letterheadHeader,
    letterheadId,
    letterheadLocationKey,
    entity,
    headerLogo,
    footerLogo,
    termsClauses,
    annexureClauses,
    poTermsDetails,
  ]);

  useEffect(() => {
    if (activeTab !== 'preview' || (!numericPrId && !editPoId)) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    const loadPreview = async () => {
      setPreviewLoading(true);
      setPreviewError('');
      try {
        const html = isEditMode && editPoId
          ? await poApi.previewDocumentHtmlByPoId(editPoId, buildPreviewPayload())
          : await poApi.previewDocumentHtml(numericPrId!, buildPreviewPayload());
        if (cancelled) return;
        objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        setPreviewHtmlUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return objectUrl;
        });
      } catch (err) {
        if (!cancelled) {
          setPreviewError(err instanceof Error ? err.message : 'Could not load preview');
          setPreviewHtmlUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [activeTab, numericPrId, editPoId, isEditMode, buildPreviewPayload]);

  useEffect(() => {
    return () => {
      if (previewHtmlUrl) URL.revokeObjectURL(previewHtmlUrl);
    };
  }, [previewHtmlUrl]);

  const handleQtyChange = (id: string | number, val: number) =>
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: val, total: calcLineTotal(val, item.unitPrice) }
          : item
      )
    );

  const handlePriceChange = (id: string | number, val: number) =>
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, unitPrice: val, total: calcLineTotal(item.quantity, val) }
          : item
      )
    );

  const handleTaxPercentageChange = (id: string | number, val: number) =>
    setLineItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, taxPercentage: Math.min(100, Math.max(0, val)) }
          : item
      )
    );

  const handleItemNameChange = (id: string | number, val: string) =>
    setLineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, itemName: val } : item))
    );

  const handleDescriptionChange = (id: string | number, val: string) =>
    setLineItems(prev =>
      prev.map(item => item.id === id ? { ...item, description: val } : item)
    );

  const handleAddLineItem = () => {
    const newId = `new-${Date.now()}`;
    setLineItems(prev => [
      ...prev,
      {
        id: newId,
        itemName: '',
        description: '',
        quantity: 1,
        unitPrice: 0,
        taxPercentage: 18,
        total: 0,
        unit: 'Nos',
      },
    ]);
  };

  const handleDeleteLineItem = (id: string | number) => {
    setLineItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveDraft = () => {
    setDraftSaved(true);
    setTimeout(() => setDraftSaved(false), 3000);
  };

  const applyReferencePoDetails = useCallback((po: Record<string, unknown>) => {
    const refNo = String(po.poNumber || '').trim();
    setReferencePoNumber(refNo);
    setLetterheadLocked(true);
    setDeliveryAddress(String(po.deliveryAddress || ''));
    if (po.expectedDeliveryDate) {
      setExpectedDeliveryDate(String(po.expectedDeliveryDate));
    }
    setPaymentTerms(String(po.paymentTerms || 'Net 30 Days'));
    setIncoterms(String(po.incoterms || 'DDP'));
    setSpecialInstructions(String(po.specialInstructions || ''));
    setGstPercentage(Number(po.gstPercentage) || 18);
    setPoType((po.poType as PoType) || 'short_po');
    setLetterheadHeader(String(po.letterheadHeader || ''));
    setLetterheadId(po.letterheadId ? Number(po.letterheadId) : '');
    setEntity(String(po.entity || ''));
    setHeaderLogo(String(po.headerLogo || ''));
    setFooterLogo(String(po.footerLogo || ''));
    setTermsClauses((po.termsClauses as PoLetterheadClause[]) || []);
    setAnnexureClauses((po.annexureClauses as PoLetterheadClause[]) || []);
    {
      const loadedDetails = { ...EMPTY_PO_TERMS_DETAILS, ...((po.poTermsDetails as PoTermsDetails) || {}) };
      setPoTermsDetails({
        ...loadedDetails,
        paymentTermsText: loadedDetails.paymentTermsText || String(po.paymentTerms || ''),
        siteAddress: loadedDetails.siteAddress || String(po.deliveryAddress || ''),
      });
    }

    const refLineItems = ((po.lineItems as Array<Record<string, unknown>>) || []).map((li, index) => {
      const qty = Number(li.quantity) || 0;
      const unitPrice = Number(li.unitPrice) || 0;
      const taxPercentage = Math.max(0, Number(li.taxPercentage ?? li.tax_percentage ?? po.gstPercentage) || 18);
      const description = String(li.description || '');
      const itemName = String(li.itemName || li.name || '').trim() || plainTextFromHtml(description);
      return {
        id: `ref-${index}-${Date.now()}`,
        itemName,
        description,
        quantity: qty,
        unitPrice,
        taxPercentage,
        total: Number(li.total) || calcLineTotal(qty, unitPrice),
      };
    });
    if (refLineItems.length) {
      setLineItems(refLineItems);
    }

    setReferencePoLoaded({
      poNumber: refNo,
      vendorName: String(po.vendorName || ''),
      prNumber: String(po.prNumber || ''),
      grandTotal: Number(po.grandTotal) || 0,
    });
  }, []);

  /** Enter existing PO number → auto-fill PO Details / Terms / line items */
  const loadPoDetailsByNumber = useCallback(
    async (rawNumber?: string) => {
      const num = String(rawNumber ?? referencePoNumber).trim();
      if (!num) {
        setReferencePoError('Enter a PO number to auto-fill details');
        return false;
      }
      setReferencePoNumber(num);
      setReferencePoLoading(true);
      setReferencePoError('');
      try {
        const res = await poApi.getByNumber(num);
        const po = res.data as Record<string, unknown>;
        if (!po?.poNumber) throw new Error('PO not found');
        applyReferencePoDetails(po);
        return true;
      } catch (err) {
        setReferencePoLoaded(null);
        setReferencePoError(err instanceof Error ? err.message : 'PO not found');
        return false;
      } finally {
        setReferencePoLoading(false);
      }
    },
    [referencePoNumber, applyReferencePoDetails]
  );

  const applyCsvImportPayload = useCallback((payload: PoCsvImportPayload) => {
    if (payload.lineItems?.length) {
      setLineItems(
        payload.lineItems.map((item) => ({
          id: item.id,
          itemName: item.itemName || '',
          description: item.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxPercentage: item.taxPercentage ?? payload.gstPercentage ?? 18,
          total: item.total ?? calcLineTotal(item.quantity, item.unitPrice),
          unit: item.unit,
        }))
      );
    }
    if (payload.deliveryAddress) setDeliveryAddress(payload.deliveryAddress);
    if (payload.expectedDeliveryDate) setExpectedDeliveryDate(payload.expectedDeliveryDate);
    if (payload.paymentTerms) setPaymentTerms(payload.paymentTerms);
    if (payload.incoterms) setIncoterms(payload.incoterms);
    if (payload.gstPercentage != null) setGstPercentage(payload.gstPercentage);
    if (payload.specialInstructions) setSpecialInstructions(payload.specialInstructions);
    if (payload.poType) setPoType(payload.poType);
    if (payload.entity) setEntity(payload.entity);
    if (payload.letterheadHeader) setLetterheadHeader(payload.letterheadHeader);
    if (payload.referencePoNumber) setReferencePoNumber(payload.referencePoNumber);
    if (payload.termsClauses?.length) setTermsClauses(payload.termsClauses);
    if (payload.annexureClauses?.length) setAnnexureClauses(payload.annexureClauses);
    if (payload.poNumber) setImportedPoNumber(payload.poNumber);
    if (payload.vendorName) setImportedVendorName(payload.vendorName);
    if (payload.vendorEmail) setImportedVendorEmail(payload.vendorEmail);
    if (payload.skipApproval) setSkipApproval(true);
  }, []);

  useEffect(() => {
    if (isEditMode || !pr) return;

    // CSV import from Purchase Requests takes priority over PR line items
    if (fromCsvParam === 'csv' && !csvAppliedRef.current) {
      const payload = consumePoCsvImport();
      if (payload) {
        csvAppliedRef.current = true;
        applyCsvImportPayload(payload);
        return;
      }
    }

    // Reference PO path will load its own line items
    if (refPoParam?.trim()) return;

    if (!pr.lineItems?.length) return;
    setLineItems(
      pr.lineItems.map((item) => ({
        id: item.id,
        itemName: plainTextFromHtml(item.description || ''),
        description: item.description || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxPercentage: 18,
        total: calcLineTotal(item.quantity, item.unitPrice),
      }))
    );
  }, [pr, isEditMode, fromCsvParam, refPoParam, applyCsvImportPayload]);

  // Auto-import reference PO when opened from Purchase Requests with ?refPo=
  useEffect(() => {
    if (isEditMode || !pr || !refPoParam?.trim() || referencePoLoaded) return;
    void loadPoDetailsByNumber(refPoParam.trim());
  }, [isEditMode, pr, refPoParam, referencePoLoaded, loadPoDetailsByNumber]);

  const handleSendForApproval = async () => {
    if ((!numericPrId && !editPoId) || !pr) return;
    if (!skipApproval && !letterheadId) {
      alert('Please select a letterhead entity');
      return;
    }
    if (!skipApproval && letterheadLocations.length > 0 && !letterheadLocationKey) {
      alert('Please select a location for the letterhead entity');
      return;
    }
    if (!deliveryAddress.trim()) {
      alert('Please enter delivery address');
      return;
    }
    if (!expectedDeliveryDate) {
      alert('Please select expected delivery date');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        lineItems: lineItems.map((i) => ({
          itemName: i.itemName || '',
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          taxPercentage: i.taxPercentage || 0,
          discount: 0,
        })),
        deliveryAddress,
        expectedDeliveryDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        gstPercentage: effectiveGstPercentage,
        poType,
        letterheadHeader,
        letterheadId: letterheadId || undefined,
        letterheadLocationId: poTermsDetails.letterheadLocationId || letterheadLocationKey || undefined,
        locationName: poTermsDetails.locationName || undefined,
        entity,
        headerLogo,
        footerLogo,
        terms: filterNonEmptyClauses(termsClauses),
        annexure: filterNonEmptyClauses(annexureClauses),
        poTermsDetails: {
          ...poTermsDetails,
          paymentTermsText: poTermsDetails.paymentTermsText || paymentTerms,
          siteAddress: poTermsDetails.siteAddress || deliveryAddress,
          letterheadLocationId:
            poTermsDetails.letterheadLocationId || letterheadLocationKey || '',
          buyerGstNo: poTermsDetails.buyerGstNo || locationGstNo || '',
        },
        referencePoNumber: referencePoNumber.trim() || undefined,
        changeSummary: changeSummary.trim() || undefined,
        purchaseType: pr?.purchaseType || 'purchase_order',
      };

      if (skipApproval) {
        payload.skipApproval = true;
        payload.legacyImport = true;
        if (importedPoNumber.trim()) payload.poNumber = importedPoNumber.trim();
        if (importedVendorName.trim()) payload.vendorName = importedVendorName.trim();
        if (importedVendorEmail.trim()) payload.vendorEmail = importedVendorEmail.trim();
      }

      if (isEditMode && editPoId) {
        await poApi.update(editPoId, payload);
        navigate(editReturnPath);
        return;
      }

      const res = await poApi.create(numericPrId!, payload);
      const data = res.data as { poNumber: string; id: number };
      setPoNumber(data.poNumber);
      setCreatedPoId(data.id);
      try {
        const blob = await poApi.fetchPdfBlob(data.id);
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(URL.createObjectURL(blob));
        setPageMode('pdf');
      } catch (pdfErr) {
        // PO created successfully; PDF may still be regenerating
        setShowSuccessModal(true);
        alert(
          pdfErr instanceof Error
            ? `PO created, but PDF could not be opened: ${pdfErr.message}`
            : 'PO created, but PDF could not be opened'
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

  const isWorkOrder = pr?.purchaseType === 'work_order';
  const docLabel = isWorkOrder ? 'Work Order' : 'Purchase Order';
  const docNoLabel = isWorkOrder ? 'WO No' : 'PO No';

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96 text-gray-500">Loading PR details...</div>
      </DashboardLayout>
    );
  }

  if (!numericPrId && !isEditMode) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Purchase Order / Work Order</h1>
          <p className="text-sm text-gray-600 mb-6">Select a purchase request ready for PO or Work Order creation</p>
          {pickerLoading ? (
            <p className="text-sm text-gray-500">Loading PRs...</p>
          ) : pickerItems.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <i className="ri-inbox-line text-4xl text-gray-300"></i>
              <p className="text-gray-600 mt-3">No PRs ready for PO creation</p>
              <p className="text-xs text-gray-500 mt-1">Complete RFQ CFO approval first</p>
              <button onClick={() => navigate('/rfq-approval')} className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">
                Go to RFQ PO Approval
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['PR Number', 'Title', 'Department', 'Requester', 'Vendor', 'Amount', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pickerItems.map((item) => (
                    <tr key={item.prId} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-bold text-teal-600">{item.prNumber}</td>
                      <td className="px-4 py-3 text-sm">{item.title}</td>
                      <td className="px-4 py-3 text-sm">{item.department}</td>
                      <td className="px-4 py-3 text-sm">{item.requester}</td>
                      <td className="px-4 py-3 text-sm">{item.recommendedVendor || '—'}</td>
                      <td className="px-4 py-3 text-sm font-semibold">{fmt(item.totalAmount)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/scm/create-po?prId=${item.prId}`)}
                            className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-semibold"
                          >
                            Create PO
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const ref = window.prompt('Enter reference PO number to import (e.g. PO-2026-0001)');
                              if (!ref?.trim()) return;
                              navigate(`/scm/create-po?prId=${item.prId}&refPo=${encodeURIComponent(ref.trim())}`);
                            }}
                            className="px-3 py-1.5 border border-violet-300 text-violet-700 rounded-lg text-xs font-semibold hover:bg-violet-50"
                          >
                            Import
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (pageMode === 'pdf' && pdfPreviewUrl && createdPoId) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-gray-100 flex flex-col">
          <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{poNumber}</h1>
              <p className="text-sm text-gray-500">Refex PO document — sent for SCM Manager approval</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => navigate('/scm/purchase-requests')} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                Back to PRs
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setPdfDownloading(true);
                    const blob = await poApi.fetchPdfBlob(createdPoId);
                    triggerBlobDownload(blob, `${poNumber || 'PO'}.pdf`);
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Could not download PDF');
                  } finally {
                    setPdfDownloading(false);
                  }
                }}
                disabled={pdfDownloading}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {pdfDownloading ? 'Preparing…' : 'Download PDF'}
              </button>
            </div>
          </div>
          <iframe title="PO PDF Preview" src={pdfPreviewUrl} className="flex-1 w-full min-h-[calc(100vh-120px)] border-0" />
        </div>
      </DashboardLayout>
    );
  }

  if (!pr || loadError) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="ri-error-warning-line text-3xl text-amber-500"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Purchase Request Not Found</h2>
            <p className="text-gray-500 text-sm mb-6">{loadError || "The PR you're trying to create a PO for doesn't exist."}</p>
            <button
              onClick={() => navigate('/scm/purchase-requests')}
              className="px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium"
            >
              Back to Purchase Requests
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const vendor = vendorMeta;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/60">
        {/* ── Top Header Bar ── */}
        <div className="bg-white border-b border-gray-200 px-3 sm:px-6 lg:px-8 py-3 sm:py-4 sticky top-0 z-20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <button
                onClick={() => navigate(isEditMode ? editReturnPath : '/scm/purchase-requests')}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-gray-500 shrink-0"
              >
                <i className="ri-arrow-left-line text-lg"></i>
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <h1 className="text-base sm:text-lg font-bold text-gray-900">
                    {isEditMode ? `Edit ${docLabel}` : `Create ${docLabel}`}
                  </h1>
                  <span className={`px-2.5 py-0.5 border rounded-full text-xs font-semibold tracking-wide ${
                    isBuyerVerifyEdit
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : isEditMode
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}>
                    {isBuyerVerifyEdit ? 'BUYER FINAL VERIFY' : isEditMode ? 'PENDING REVIEW' : 'DRAFT'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                  <span className="text-xs text-gray-500">
                    {docNoLabel}: <span className="font-semibold text-teal-600">{poNumber || 'Auto on save'}</span>
                  </span>
                  <span className="text-gray-300 text-xs hidden sm:inline">•</span>
                  <span className="text-xs text-gray-500">
                    PR Ref: <span className="font-semibold text-gray-700">{pr.prNumber}</span>
                  </span>
                  <span className="text-gray-300 text-xs hidden md:inline">•</span>
                  <span className="text-xs text-gray-500 truncate max-w-full md:max-w-[240px]">
                    Vendor: <span className="font-semibold text-gray-700">{pr.recommendedVendor}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              {draftSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium animate-pulse">
                  <i className="ri-checkbox-circle-fill"></i> Draft saved
                </span>
              )}
              {!isEditMode && (
                <button
                  onClick={handleSaveDraft}
                  className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium flex items-center gap-2"
                >
                  <i className="ri-save-line"></i> Save Draft
                </button>
              )}
              {isEditMode && pdfPreviewUrl && (
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
                >
                  <i className="ri-file-pdf-line"></i> View PDF
                </a>
              )}
              {isEditMode && (
                <input
                  type="text"
                  value={changeSummary}
                  onChange={(e) => setChangeSummary(e.target.value)}
                  placeholder="Change summary (optional)"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-full sm:w-64 max-w-full"
                />
              )}
              <button
                onClick={handleSendForApproval}
                disabled={submitting}
                className="px-4 sm:px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-semibold flex items-center gap-2 shadow-sm disabled:opacity-60"
              >
                <i className={isEditMode ? 'ri-save-3-line' : 'ri-send-plane-fill'}></i>
                {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : skipApproval ? 'Create PO Only' : 'Send for Approval'}
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-0 mt-3 sm:mt-4 overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            {[
              { key: 'details', label: 'PO Details', icon: 'ri-file-list-3-line', step: 1 },
              { key: 'terms', label: 'Terms & Conditions', icon: 'ri-file-text-line', step: 2 },
              { key: 'preview', label: 'Preview & Submit', icon: 'ri-eye-line', step: 3 },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2 shrink-0 ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                  activeTab === tab.key ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{tab.step}</span>
                <i className={`${tab.icon} text-base`}></i>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* ══════════════════════════════════════════
              TAB 1 — PO DETAILS
          ══════════════════════════════════════════ */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* LEFT — 2/3 */}
              <div className="lg:col-span-2 space-y-5">

                {/* PR Info Banner */}
                <div className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-xl p-5 text-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-teal-100 text-xs font-medium uppercase tracking-wider mb-1">Purchase Request</p>
                      <h2 className="text-lg font-bold">{pr.title}</h2>
                      <div className="flex items-center gap-4 mt-2 text-sm text-teal-100 flex-wrap">
                        <span className="flex items-center gap-1.5"><i className="ri-hashtag"></i>{pr.prNumber}</span>
                        {(pr.entityCode || pr.entityName) && (
                          <span className="flex items-center gap-1.5">
                            <i className="ri-building-2-line"></i>
                            {pr.entityCode ? `${pr.entityCode}${pr.entityName ? ` — ${pr.entityName}` : ''}` : pr.entityName}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5"><i className="ri-building-line"></i>{pr.department}</span>
                        <span className="flex items-center gap-1.5"><i className="ri-user-line"></i>{pr.requester}</span>
                        <span className="flex items-center gap-1.5"><i className="ri-calendar-line"></i>Required: {pr.requiredDate}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-teal-100 text-xs mb-1">Estimated Value</p>
                      <p className="text-2xl font-bold">{fmt(pr.amount ?? grandTotal)}</p>
                      <span className="inline-block mt-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                        {pr.requestType}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Load existing PO → auto-fill PO Details */}
                <div className="bg-white rounded-xl border border-teal-200 p-5 shadow-sm">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 flex items-center justify-center bg-teal-50 rounded-lg shrink-0">
                      <i className="ri-search-eye-line text-teal-600 text-lg"></i>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900">Load PO Details by PO Number</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enter an existing PO number to auto-fill delivery, terms, letterhead, line items and POD fields
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={referencePoNumber}
                      onChange={(e) => {
                        setReferencePoNumber(e.target.value);
                        setReferencePoError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void loadPoDetailsByNumber();
                        }
                      }}
                      placeholder="e.g. PO-RIL-2026-27-0001"
                      className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                      disabled={referencePoLoading}
                    />
                    <button
                      type="button"
                      onClick={() => void loadPoDetailsByNumber()}
                      disabled={referencePoLoading || !referencePoNumber.trim()}
                      className="px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-sm font-semibold whitespace-nowrap disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {referencePoLoading ? (
                        <>
                          <i className="ri-loader-4-line animate-spin"></i> Loading...
                        </>
                      ) : (
                        <>
                          <i className="ri-download-cloud-2-line"></i> Auto Fill
                        </>
                      )}
                    </button>
                  </div>
                  {referencePoError && (
                    <p className="mt-2 text-xs text-red-600 flex items-center gap-1.5">
                      <i className="ri-error-warning-line"></i>
                      {referencePoError}
                    </p>
                  )}
                  {referencePoLoaded && !referencePoError && (
                    <p className="mt-2 text-xs text-emerald-700 flex items-center gap-1.5 flex-wrap">
                      <i className="ri-checkbox-circle-fill"></i>
                      Loaded <span className="font-semibold">{referencePoLoaded.poNumber}</span>
                      {referencePoLoaded.vendorName ? (
                        <span className="text-gray-500">· {referencePoLoaded.vendorName}</span>
                      ) : null}
                      {referencePoLoaded.prNumber ? (
                        <span className="text-gray-500">· PR {referencePoLoaded.prNumber}</span>
                      ) : null}
                      {referencePoLoaded.grandTotal ? (
                        <span className="text-gray-500">· {fmt(referencePoLoaded.grandTotal)}</span>
                      ) : null}
                    </p>
                  )}
                </div>

                {/* PO Type */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">PO Type</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Terms and annexure load from PO Type Master
                      </p>
                    </div>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                      {PO_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPoType(option.id)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                            poType === option.id
                              ? 'bg-white text-teal-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {letterheadLoading ? (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1.5">
                      <i className="ri-loader-4-line animate-spin"></i>
                      Loading letterhead template...
                    </p>
                  ) : letterheadHeader ? (
                    <div
                      className="mt-4 p-4 bg-teal-50/50 border border-teal-100 rounded-lg text-sm text-gray-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: letterheadHeader }}
                    />
                  ) : null}
                </div>

                {/* Letterhead / Entity */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Letterhead / Entity</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Select entity from Letterhead Master — header and footer logos appear on the PO PDF
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Entity <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={letterheadId === '' ? '' : String(letterheadId)}
                      onChange={(e) => {
                        const id = e.target.value ? Number(e.target.value) : '';
                        if (!id) {
                          applyLetterheadBranding(null);
                          return;
                        }
                        const selected = letterheadOptions.find((o) => o.id === id) || null;
                        applyLetterheadBranding(selected);
                      }}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                    >
                      <option value="">Select letterhead entity...</option>
                      {letterheadOptions.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.entity ? `${opt.name} — ${opt.entity}` : opt.name}
                        </option>
                      ))}
                    </select>
                    {!letterheadOptions.length && (
                      <p className="text-xs text-amber-600 mt-2">
                        No active letterheads. Add one in Masters → Letterhead Master.
                      </p>
                    )}
                  </div>

                  {letterheadLocations.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Location <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={letterheadLocationKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          const idx = letterheadLocations.findIndex(
                            (l, i) => letterheadLocKey(l, i) === key
                          );
                          if (idx < 0) {
                            applyLetterheadLocation(null);
                            return;
                          }
                          applyLetterheadLocation(letterheadLocations[idx], idx);
                        }}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                      >
                        <option value="">Select location...</option>
                        {letterheadLocations.map((loc, idx) => (
                          <option key={letterheadLocKey(loc, idx)} value={letterheadLocKey(loc, idx)}>
                            {loc.location}
                            {loc.gstNo ? ` — ${loc.gstNo}` : ''}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1.5">
                        Selecting a location fills GSTIN &amp; footer into Invoicing Address (Terms tab) and PO PDF footer.
                      </p>
                    </div>
                  )}

                  {(entity || headerLogo || footerLogo || locationGstNo) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Entity</p>
                        <p className="text-sm text-gray-800">{entity || '—'}</p>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">GSTIN</p>
                        <p className="text-sm font-mono text-gray-800">{locationGstNo || '—'}</p>
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Header Logo</p>
                        {headerLogo && (headerLogo.startsWith('data:image/') || /^https?:\/\//i.test(headerLogo)) ? (
                          <img src={headerLogo} alt="Header logo" className="max-h-12 max-w-full object-contain" />
                        ) : headerLogo && /<[a-z]/i.test(headerLogo) ? (
                          <div className="text-xs" dangerouslySetInnerHTML={{ __html: headerLogo }} />
                        ) : (
                          <p className="text-sm text-gray-400">—</p>
                        )}
                      </div>
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Footer Logo</p>
                        {footerLogo && (footerLogo.startsWith('data:image/') || /^https?:\/\//i.test(footerLogo)) ? (
                          <img src={footerLogo} alt="Footer logo" className="max-h-12 max-w-full object-contain" />
                        ) : footerLogo && /<[a-z]/i.test(footerLogo) ? (
                          <div className="text-xs" dangerouslySetInnerHTML={{ __html: footerLogo }} />
                        ) : (
                          <p className="text-sm text-gray-400">—</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* RIGHT — 1/3 */}
              <div className="space-y-5">
                {/* Vendor Card */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-5 py-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Selected Vendor</p>
                      <span className="px-2 py-0.5 bg-white/20 text-white rounded-full text-xs font-semibold">✓ Winner</span>
                    </div>
                    <h3 className="text-white font-bold text-base leading-tight">{pr.recommendedVendor}</h3>
                    <div className="flex items-center gap-1 mt-2">
                      {[1,2,3,4,5].map(s => (
                        <i key={s} className={`ri-star-fill text-xs ${s <= Math.round(vendor.overallScore / 20) ? 'text-yellow-300' : 'text-white/30'}`}></i>
                      ))}
                      <span className="text-white/80 text-xs ml-1">{vendor.overallScore}/100</span>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Quoted Price</p>
                        <p className="text-sm font-bold text-gray-900">{fmt(vendor.quotedPrice)}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500 mb-0.5">Lead Time</p>
                        <p className="text-sm font-bold text-gray-900">{vendor.leadTime} days</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-0.5">Payment Terms</p>
                      <p className="text-sm font-semibold text-gray-900">{vendor.paymentTerms}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Compliance</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${vendor.compliance === 'Yes' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {vendor.compliance === 'Yes' ? '✓ Compliant' : '✗ Non-Compliant'}
                      </span>
                    </div>
                    <div className="pt-2 space-y-2.5">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Technical Score</span>
                          <span className="font-semibold text-gray-700">{vendor.technicalScore}/100</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${vendor.technicalScore}%` }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">Commercial Score</span>
                          <span className="font-semibold text-gray-700">{vendor.commercialScore}/100</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${vendor.commercialScore}%` }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PO Summary Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg">
                      <i className="ri-receipt-line text-gray-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">PO Summary</h3>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                      <span className="text-xs text-gray-500">PO Number</span>
                      <span className="text-xs font-semibold text-teal-600">{poNumber || 'Auto on save'}</span>
                    </div>
                    <div className="py-1.5 border-b border-gray-50 space-y-1.5">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">Reference PO</span>
                        <button
                          type="button"
                          onClick={() => void loadPoDetailsByNumber()}
                          disabled={referencePoLoading || !referencePoNumber.trim()}
                          className="text-[11px] font-semibold text-teal-600 hover:text-teal-700 disabled:opacity-40 cursor-pointer"
                        >
                          {referencePoLoading ? 'Loading…' : 'Fill'}
                        </button>
                      </div>
                      <input
                        type="text"
                        value={referencePoNumber}
                        onChange={(e) => {
                          setReferencePoNumber(e.target.value);
                          setReferencePoError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void loadPoDetailsByNumber();
                          }
                        }}
                        placeholder="Type PO no. + Fill"
                        className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={referencePoLoading}
                      />
                    </div>
                    {[
                      { label: 'PR Reference', value: pr.prNumber },
                      { label: 'Department', value: pr.department },
                      { label: 'Requester', value: pr.requester },
                      { label: 'Priority', value: pr.priority },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500">{row.label}</span>
                        <span className="text-xs font-semibold text-gray-800">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Line Items — full width */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Line Items</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{lineItems.length} item{lineItems.length !== 1 ? 's' : ''} — edit qty & price as needed</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                      {lineItems.length} Items
                    </span>
                    <button
                      onClick={handleAddLineItem}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap"
                    >
                      <i className="ri-add-line text-sm"></i> Add Item
                    </button>
                  </div>
                </div>

                <div className="w-full overflow-x-hidden">
                  <table className="w-full table-fixed">
                    <colgroup>
                      <col className="w-9" />
                      <col className="w-[18%]" />
                      <col className="w-[32%]" />
                      <col className="w-[8%]" />
                      <col className="w-[14%]" />
                      <col className="w-[10%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">#</th>
                        <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Item Name</th>
                        <th className="px-2 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Item Description</th>
                        <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Qty</th>
                        <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Unit Price</th>
                        <th className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Tax %</th>
                        <th className="px-2 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lineItems.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-gray-50/60 transition-colors group align-top">
                          <td className="px-2 py-2.5 align-top">
                            <span className="mt-1 w-6 h-6 flex items-center justify-center bg-teal-50 text-teal-700 rounded-full text-xs font-bold">
                              {idx + 1}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <input
                              type="text"
                              value={item.itemName || ''}
                              onChange={(e) => handleItemNameChange(item.id, e.target.value)}
                              placeholder="Item name"
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <RichTextEditor
                              editorKey={`li-desc-${item.id}`}
                              value={item.description || ''}
                              onChange={(html) => handleDescriptionChange(item.id, html)}
                              placeholder="Item description..."
                              minHeight={56}
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={e => handleQtyChange(item.id, parseInt(e.target.value) || 1)}
                              className="w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                            />
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={e => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                                className="w-full pl-5 pr-2 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                              />
                            </div>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={item.taxPercentage}
                                onChange={(e) =>
                                  handleTaxPercentageChange(item.id, parseFloat(e.target.value) || 0)
                                }
                                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">%</span>
                            </div>
                          </td>
                          <td className="px-2 py-2.5 align-top">
                            <div className="flex items-start justify-end gap-1.5 pt-1">
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900 tabular-nums leading-6">{fmt(item.total)}</p>
                                <p className="text-[10px] text-gray-400 tabular-nums">
                                  Tax {fmt(calcLineTax(item.total, item.taxPercentage))}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteLineItem(item.id)}
                                className="w-6 h-6 flex items-center justify-center rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100 shrink-0"
                                title="Remove item"
                              >
                                <i className="ri-delete-bin-line text-sm"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {lineItems.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-10 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-full">
                                <i className="ri-file-list-3-line text-gray-400 text-lg"></i>
                              </div>
                              <p className="text-sm text-gray-400">No line items yet</p>
                              <button
                                onClick={handleAddLineItem}
                                className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap"
                              >
                                <i className="ri-add-line"></i> Add First Item
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <button
                      onClick={handleAddLineItem}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 border border-dashed border-teal-400 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer text-xs font-medium whitespace-nowrap"
                    >
                      <i className="ri-add-line text-sm"></i> Add Another Item
                    </button>
                    <div className="w-full sm:w-72 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Subtotal</span>
                        <span className="font-semibold text-gray-900">{fmt(subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Tax (per line)</span>
                        <span className="font-semibold text-gray-900">{fmt(taxAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                        <span className="text-sm font-bold text-gray-900">Grand Total</span>
                        <span className="text-lg font-bold text-teal-600">{fmt(grandTotal)}</span>
                      </div>
                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Amount In Words</p>
                        <p className="text-xs text-gray-700 leading-relaxed">{amountInWords}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Delivery — full width */}
              <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-5">
                  <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                    <i className="ri-map-pin-line text-teal-600"></i>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900">Delivery Information</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Delivery Address <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={deliveryAddress}
                      onChange={e => setDeliveryAddress(e.target.value)}
                      rows={2}
                      placeholder="Enter complete delivery address..."
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none bg-gray-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                      Expected Delivery Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={expectedDeliveryDate}
                      onChange={e => setExpectedDeliveryDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">Incoterms</label>
                    <select
                      value={incoterms}
                      onChange={e => setIncoterms(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50/50 cursor-pointer"
                    >
                      {INCOTERMS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 2 — TERMS & CONDITIONS
          ══════════════════════════════════════════ */}
          {activeTab === 'terms' && (
            <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 space-y-5">
                {/* Quick load POD fields from existing PO */}
                <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-xs font-semibold text-teal-800 mb-1.5">
                        PO Number — auto-fill POD details
                      </label>
                      <input
                        type="text"
                        value={referencePoNumber}
                        onChange={(e) => {
                          setReferencePoNumber(e.target.value);
                          setReferencePoError('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void loadPoDetailsByNumber();
                          }
                        }}
                        placeholder="Enter existing PO number"
                        className="w-full px-3 py-2 border border-teal-200 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                        disabled={referencePoLoading}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadPoDetailsByNumber()}
                      disabled={referencePoLoading || !referencePoNumber.trim()}
                      className="px-4 py-2 bg-teal-600 text-white rounded-md hover:bg-teal-700 text-sm font-semibold whitespace-nowrap disabled:opacity-60 cursor-pointer"
                    >
                      {referencePoLoading ? 'Loading...' : 'Auto Fill Fields'}
                    </button>
                  </div>
                  {referencePoError && (
                    <p className="mt-2 text-xs text-red-600">{referencePoError}</p>
                  )}
                  {referencePoLoaded && !referencePoError && (
                    <p className="mt-2 text-xs text-emerald-700">
                      POD fields filled from {referencePoLoaded.poNumber}
                    </p>
                  )}
                </div>

                {/* PO Terms & Conditions Details — matches ERP form layout */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                      <i className="ri-file-list-3-line text-teal-600"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">PO Terms &amp; Conditions Details</h3>
                      <p className="text-xs text-gray-500">Site, project manager, invoicing and mailing details</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Payment Terms — full width */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-gray-700">Payment Terms</label>
                      <textarea
                        value={poTermsDetails.paymentTermsText || paymentTerms}
                        onChange={(e) => updatePoTermsField('paymentTermsText', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                      />
                    </div>

                    {/* Site address + contact stack side by side */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Site Address</label>
                        <textarea
                          value={poTermsDetails.siteAddress}
                          onChange={(e) => updatePoTermsField('siteAddress', e.target.value)}
                          rows={5}
                          className="w-full h-full min-h-[132px] px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Site Contact Person</label>
                          <input
                            type="text"
                            value={poTermsDetails.siteContactPerson}
                            onChange={(e) => updatePoTermsField('siteContactPerson', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Site Contact Person&apos;s Mail</label>
                          <input
                            type="email"
                            value={poTermsDetails.siteContactEmail}
                            onChange={(e) => updatePoTermsField('siteContactEmail', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="block text-xs font-semibold text-gray-700">Site Contact Person Phone No</label>
                          <input
                            type="text"
                            value={poTermsDetails.siteContactPhone}
                            onChange={(e) => updatePoTermsField('siteContactPhone', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Project manager fields — equal 2-col pairs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Project Manager at HO</label>
                        <input
                          type="text"
                          value={poTermsDetails.projectManagerHo}
                          onChange={(e) => updatePoTermsField('projectManagerHo', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Project Manager&apos;s Contact</label>
                        <input
                          type="text"
                          value={poTermsDetails.projectManagerContact}
                          onChange={(e) => updatePoTermsField('projectManagerContact', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-700">Project Manager&apos;s Email</label>
                        <input
                          type="email"
                          value={poTermsDetails.projectManagerEmail}
                          onChange={(e) => updatePoTermsField('projectManagerEmail', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        />
                      </div>
                    </div>

                    {/* Addresses — equal height textareas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Invoicing Address</label>
                        {(poTermsDetails.locationName || poTermsDetails.buyerGstNo || locationGstNo) && (
                          <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2 text-xs text-teal-900 space-y-1">
                            {poTermsDetails.locationName && (
                              <p>
                                <span className="font-semibold">Location:</span> {poTermsDetails.locationName}
                              </p>
                            )}
                            <p>
                              <span className="font-semibold">GSTIN:</span>{' '}
                              <span className="font-mono">
                                {poTermsDetails.buyerGstNo || locationGstNo || '—'}
                              </span>
                            </p>
                            {footerLogo &&
                              (footerLogo.startsWith('data:image/') ||
                                /^https?:\/\//i.test(footerLogo)) && (
                                <div className="pt-1">
                                  <p className="font-semibold mb-1">Footer (from location)</p>
                                  <img
                                    src={footerLogo}
                                    alt="Location footer"
                                    className="max-h-10 max-w-[180px] object-contain"
                                  />
                                </div>
                              )}
                          </div>
                        )}
                        <textarea
                          value={poTermsDetails.invoicingAddress}
                          onChange={(e) => updatePoTermsField('invoicingAddress', e.target.value)}
                          rows={3}
                          placeholder="Auto-filled from selected location + GSTIN"
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Mailing Address</label>
                        <textarea
                          value={poTermsDetails.mailingAddress}
                          onChange={(e) => updatePoTermsField('mailingAddress', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Reason For Cancellation</label>
                        <textarea
                          value={poTermsDetails.reasonForCancellation}
                          onChange={(e) => updatePoTermsField('reasonForCancellation', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-gray-700">Subject</label>
                        <textarea
                          value={poTermsDetails.subject}
                          onChange={(e) => updatePoTermsField('subject', e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">PO Type</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Switch type to load different terms &amp; annexure</p>
                    </div>
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                      {PO_TYPE_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setPoType(option.id)}
                          className={`px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                            poType === option.id
                              ? 'bg-white text-teal-700 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Payment & Commercial Terms */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                      <i className="ri-bank-card-line text-teal-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Payment &amp; Commercial Terms</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Terms (quick select)</label>
                      <select
                        value={paymentTerms}
                        onChange={(e) => {
                          setPaymentTerms(e.target.value);
                          updatePoTermsField('paymentTermsText', e.target.value);
                        }}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                      >
                        {PAYMENT_TERMS_OPTIONS.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Incoterms</label>
                      <select
                        value={incoterms}
                        onChange={(e) => setIncoterms(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                      >
                        {INCOTERMS_OPTIONS.map((o) => (
                          <option key={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                        Expected Delivery Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={expectedDeliveryDate}
                        onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                      <i className="ri-map-pin-2-line text-teal-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Delivery Address</h3>
                  </div>
                  <textarea
                    value={deliveryAddress}
                    onChange={e => setDeliveryAddress(e.target.value)}
                    rows={3}
                    placeholder="Enter complete delivery address..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-gray-50/50"
                  />
                </div>

                {/* Special Instructions */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center bg-amber-50 rounded-lg">
                      <i className="ri-sticky-note-line text-amber-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Special Instructions &amp; Notes</h3>
                  </div>
                  <textarea
                    value={specialInstructions}
                    onChange={e => setSpecialInstructions(e.target.value)}
                    rows={5}
                    placeholder="Add any special instructions, quality requirements, packaging notes, or conditions for the vendor..."
                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-gray-50/50"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">{specialInstructions.length}/500 characters</p>
                </div>
              </div>

              {/* Right sidebar summary */}
              <div className="space-y-5">
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Financial Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Subtotal</span>
                      <span className="font-semibold">{fmt(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tax (per line)</span>
                      <span className="font-semibold">{fmt(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-900">Grand Total</span>
                      <span className="text-xl font-bold text-teal-600">{fmt(grandTotal)}</span>
                    </div>
                    <div className="pt-3 border-t border-gray-100">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Amount In Words</p>
                      <p className="text-xs text-gray-700 leading-relaxed">{amountInWords}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2.5">
                    <i className="ri-information-line text-amber-600 text-lg flex-shrink-0 mt-0.5"></i>
                    <div>
                      <p className="text-xs font-semibold text-amber-800 mb-1">Before Submitting</p>
                      <ul className="text-xs text-amber-700 space-y-1">
                        <li>• Edit Terms &amp; Annexure — they print on the PO PDF</li>
                        <li>• Verify all line item quantities and prices</li>
                        <li>• Confirm delivery address is correct</li>
                        <li>• Set expected delivery date</li>
                        <li>• Review payment terms with vendor</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('preview')}
                  className="w-full py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors cursor-pointer text-sm font-semibold flex items-center justify-center gap-2 shadow-sm"
                >
                  <i className="ri-eye-line"></i> Preview PO Document
                </button>
              </div>
            </div>

            {/* Terms & Annexure — full width below the form + sidebar */}
            {letterheadLoading ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm w-full">
                <p className="text-sm text-gray-400 flex items-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Loading terms &amp; annexure...
                </p>
              </div>
            ) : (
              <div className="w-full space-y-5">
                <ClauseTableEditor
                  title="Terms & Conditions"
                  headerColumnLabel="Terms Header"
                  descriptionColumnLabel="Terms Description"
                  headerPlaceholder="e.g. Payment Terms"
                  descriptionPlaceholder="Clause details (shown on PO PDF)"
                  emptyHint="No terms yet — reload from master or add rows. Edits appear on the PO PDF."
                  clauses={termsClauses}
                  onChange={setTermsClauses}
                  onReloadFromMaster={reloadClausesFromMaster}
                  reloadDisabled={letterheadLoading}
                />
                <ClauseTableEditor
                  title="Annexure"
                  headerColumnLabel="Annexure Header"
                  descriptionColumnLabel="Annexure Description"
                  headerPlaceholder="e.g. Scope of Work"
                  descriptionPlaceholder="Annexure details (shown on PO PDF)"
                  emptyHint="No annexure yet — reload from master or add rows. Edits appear on the PO PDF."
                  clauses={annexureClauses}
                  onChange={setAnnexureClauses}
                  onReloadFromMaster={reloadClausesFromMaster}
                  reloadDisabled={letterheadLoading}
                />
              </div>
            )}
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 3 — PREVIEW
          ══════════════════════════════════════════ */}
          {activeTab === 'preview' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">PO Document Preview</h3>
                    <p className="text-xs text-gray-500">Refex letterhead format with line items, terms, and annexure</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={pdfDownloading || previewLoading || (!numericPrId && !editPoId)}
                      onClick={async () => {
                        try {
                          setPdfDownloading(true);
                          const blob =
                            isEditMode && editPoId
                              ? await poApi.previewPdfBlobByPoId(editPoId, buildPreviewPayload())
                              : await poApi.previewPdfBlob(numericPrId!, buildPreviewPayload());
                          triggerBlobDownload(
                            blob,
                            `${poNumber || pr?.prNumber || 'PO'}_preview.pdf`
                          );
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Could not download PDF');
                        } finally {
                          setPdfDownloading(false);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 cursor-pointer disabled:opacity-50"
                    >
                      <i className="ri-download-2-line mr-1"></i>
                      {pdfDownloading ? 'Generating PDF…' : 'Download PDF'}
                    </button>
                    {isEditMode && editPoId && (
                      <button
                        type="button"
                        disabled={pdfDownloading}
                        onClick={async () => {
                          try {
                            setPdfDownloading(true);
                            const blob = await poApi.fetchPdfBlob(editPoId);
                            triggerBlobDownload(blob, `${poNumber || 'PO'}.pdf`);
                          } catch (err) {
                            alert(err instanceof Error ? err.message : 'Could not download saved PDF');
                          } finally {
                            setPdfDownloading(false);
                          }
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                      >
                        Download saved PDF
                      </button>
                    )}
                    {previewHtmlUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          const win = window.open(previewHtmlUrl, '_blank');
                          win?.focus();
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-50 cursor-pointer"
                      >
                        Open in new tab
                      </button>
                    )}
                  </div>
                </div>
                {previewLoading ? (
                  <div className="py-24 text-center text-gray-400">
                    <i className="ri-loader-4-line animate-spin text-2xl"></i>
                    <p className="mt-2 text-sm">Loading PO document preview...</p>
                  </div>
                ) : previewHtmlUrl ? (
                  <iframe
                    title="PO Document Preview"
                    src={previewHtmlUrl}
                    className="w-full h-[820px] border-0 bg-white"
                  />
                ) : pdfPreviewUrl ? (
                  <iframe
                    title="PO PDF Preview"
                    src={pdfPreviewUrl}
                    className="w-full h-[820px] border-0 bg-white"
                  />
                ) : (
                  <div className="py-24 text-center text-gray-500 text-sm">
                    <p>Could not load document preview. Check line items and try again.</p>
                    {previewError && <p className="text-xs text-red-500 mt-2">{previewError}</p>}
                  </div>
                )}
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center bg-teal-50 rounded-lg">
                    <i className="ri-checkbox-circle-line text-teal-600 text-xl"></i>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {isEditMode ? 'Save your changes?' : 'Ready to Submit?'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isEditMode
                        ? isBuyerVerifyEdit
                          ? 'Changes update the signed PO before you verify and send to vendor'
                          : 'Updated PO stays pending until you sign from PO Approval'
                        : 'PO will be sent to SCM Manager for approval'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {!isEditMode && (
                    <button
                      onClick={handleSaveDraft}
                      className="px-5 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
                    >
                      <i className="ri-save-line mr-1.5"></i> Save Draft
                    </button>
                  )}
                  <button
                    onClick={handleSendForApproval}
                    disabled={submitting}
                    className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-sm font-bold whitespace-nowrap shadow-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <i className={isEditMode ? 'ri-save-3-line' : 'ri-send-plane-fill'}></i>
                    {submitting
                      ? isEditMode ? 'Saving...' : 'Creating PO...'
                      : isEditMode ? 'Save Changes' : skipApproval ? 'Create PO Only' : 'Send for Approval'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Success Modal ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 px-8 py-8 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="ri-checkbox-circle-fill text-4xl text-white"></i>
              </div>
              <h3 className="text-xl font-bold text-white">Purchase Order Created!</h3>
              <p className="text-emerald-100 text-sm mt-1">Sent for SCM Manager approval</p>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2.5">
                {[
                  { label: 'PO Number', value: poNumber, highlight: true },
                  { label: 'Vendor', value: pr.recommendedVendor },
                  { label: 'Grand Total', value: fmt(grandTotal) },
                  { label: 'Payment Terms', value: paymentTerms },
                ].map(row => (
                  <div key={row.label} className="flex justify-between text-sm">
                    <span className="text-gray-500">{row.label}</span>
                    <span className={`font-semibold ${row.highlight ? 'text-teal-600' : 'text-gray-900'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setPageMode('pdf');
                  }}
                  className="flex-1 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer text-sm font-semibold whitespace-nowrap"
                >
                  View PO PDF
                </button>
                <button
                  onClick={() => { setShowSuccessModal(false); navigate('/scm/purchase-requests'); }}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer text-sm font-medium whitespace-nowrap"
                >
                  Back to PRs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
