import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../../components/feature/DashboardLayout';
import { poApi, prApi, rfqApi, poLetterheadApi, letterheadMasterApi, PoType, PoLetterheadClause, LetterheadMasterRecord } from '../../../services/api';
import {
  consumePoCsvImport,
  downloadPoImportSampleCsv,
  parsePoImportCsv,
  type PoCsvImportPayload,
} from '../../../utils/poCsvImport';

interface LineItem {
  id: string | number;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;
  unit?: string;
}

const PAYMENT_TERMS_OPTIONS = [
  'Net 15 Days',
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
  'Advance Payment',
  '50% Advance, 50% on Delivery',
];

const INCOTERMS_OPTIONS = ['EXW', 'FOB', 'CIF', 'DDP', 'DAP', 'FCA'];

const PO_TYPE_OPTIONS: { id: PoType; label: string }[] = [
  { id: 'short_po', label: 'Short PO' },
  { id: 'long_po', label: 'Long PO' },
];

function ClausePreviewList({
  clauses,
  emptyText,
}: {
  clauses: PoLetterheadClause[];
  emptyText: string;
}) {
  if (!clauses.length) {
    return <p className="text-sm text-gray-400 italic">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {clauses.map((clause, index) => (
        <div key={index} className="border border-gray-100 rounded-lg p-4 bg-gray-50/40">
          <p className="text-sm font-semibold text-gray-900 mb-2">
            {index + 1}. {clause.termsHeader || 'Untitled'}
          </p>
          {clause.termsDescription ? (
            <div
              className="text-sm text-gray-600 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: clause.termsDescription }}
            />
          ) : (
            <p className="text-sm text-gray-400 italic">No description</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreatePOPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const prIdParam = searchParams.get('prId');
  const poIdParam = searchParams.get('poId');
  const refPoParam = searchParams.get('refPo');
  const modeParam = searchParams.get('mode');
  const fromCsvParam = searchParams.get('from');
  const numericPrId = prIdParam ? Number(prIdParam) : null;
  const editPoId = poIdParam ? Number(poIdParam) : null;
  const isEditMode = !!editPoId && !Number.isNaN(editPoId);

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
  const [gstPercentage, setGstPercentage] = useState(18);
  const [poType, setPoType] = useState<PoType>('short_po');
  const [letterheadHeader, setLetterheadHeader] = useState('');
  const [letterheadOptions, setLetterheadOptions] = useState<LetterheadMasterRecord[]>([]);
  const [letterheadId, setLetterheadId] = useState<number | ''>('');
  const [entity, setEntity] = useState('');
  const [headerLogo, setHeaderLogo] = useState('');
  const [footerLogo, setFooterLogo] = useState('');
  const [termsClauses, setTermsClauses] = useState<PoLetterheadClause[]>([]);
  const [annexureClauses, setAnnexureClauses] = useState<PoLetterheadClause[]>([]);
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
  const [pickerItems, setPickerItems] = useState<Array<{ prId: number; prNumber: string; title: string; department: string; requester: string; totalAmount: number; recommendedVendor: string }>>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [changeSummary, setChangeSummary] = useState('');
  const [letterheadLocked, setLetterheadLocked] = useState(false);
  const [poEntryMode, setPoEntryMode] = useState<'manual' | 'import'>(
    refPoParam?.trim() || fromCsvParam === 'csv' || modeParam === 'import' ? 'import' : 'manual'
  );
  const [csvImportNote, setCsvImportNote] = useState('');
  const [csvImportError, setCsvImportError] = useState('');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const csvAppliedRef = useRef(false);
  const brandingAutoApplied = useRef(false);

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

  const applyLetterheadBranding = useCallback((row: LetterheadMasterRecord | null) => {
    if (!row) {
      setLetterheadId('');
      setEntity('');
      setHeaderLogo('');
      setFooterLogo('');
      return;
    }
    setLetterheadId(row.id);
    setEntity(row.entity || '');
    setHeaderLogo(row.headerLogo || '');
    setFooterLogo(row.footerLogo || '');
  }, []);

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

  useEffect(() => {
    if (!letterheadId) return;
    if (letterheadOptions.some((o) => o.id === letterheadId)) return;
    let cancelled = false;
    letterheadMasterApi
      .get(Number(letterheadId))
      .then((res) => {
        if (cancelled) return;
        setLetterheadOptions((prev) =>
          prev.some((p) => p.id === res.data.id) ? prev : [...prev, res.data]
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [letterheadId, letterheadOptions]);

  useEffect(() => {
    if (letterheadLocked || isEditMode) return;
    loadLetterhead(poType);
  }, [poType, loadLetterhead, letterheadLocked, isEditMode]);

  const loadExistingPo = useCallback(async () => {
    if (!isEditMode || !editPoId) return;
    setLetterheadLocked(true);
    setLoading(true);
    try {
      const res = await poApi.get(editPoId);
      const po = res.data as Record<string, unknown>;
      if (po.statusRaw !== 'pending_approval') {
        setLoadError('Only pending POs can be edited');
        setPr(null);
        return;
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
      setTermsClauses((po.termsClauses as PoLetterheadClause[]) || []);
      setAnnexureClauses((po.annexureClauses as PoLetterheadClause[]) || []);
      setLineItems(
        ((po.lineItems as Array<Record<string, unknown>>) || []).map((li) => ({
          id: Number(li.id) || `li-${li.description}`,
          description: String(li.description || ''),
          quantity: Number(li.quantity) || 0,
          unitPrice: Number(li.unitPrice) || 0,
          total: Number(li.total) || Number(li.quantity) * Number(li.unitPrice) || 0,
          category: String(li.category || ''),
        }))
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
  }, [isEditMode, editPoId]);

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
          recommendedVendor: '',
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
        [...prRows, ...rfqRows].forEach((row) => merged.set(row.prId, { ...merged.get(row.prId), ...row }));
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

  const subtotal = useMemo(() => lineItems.reduce((s, i) => s + i.total, 0), [lineItems]);
  const taxAmount = useMemo(() => (subtotal * gstPercentage) / 100, [subtotal, gstPercentage]);
  const grandTotal = useMemo(() => subtotal + taxAmount, [subtotal, taxAmount]);

  const buildPreviewPayload = useCallback(() => ({
    poNumber: poNumber || undefined,
    lineItems: lineItems.map((i) => ({
      description: i.description,
      category: i.category || '',
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    deliveryAddress,
    expectedDeliveryDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage,
    poType,
    letterheadHeader,
    letterheadId: letterheadId || undefined,
    entity,
    headerLogo,
    footerLogo,
    terms: termsClauses,
    annexure: annexureClauses,
  }), [
    poNumber,
    lineItems,
    deliveryAddress,
    expectedDeliveryDate,
    paymentTerms,
    incoterms,
    specialInstructions,
    gstPercentage,
    poType,
    letterheadHeader,
    letterheadId,
    entity,
    headerLogo,
    footerLogo,
    termsClauses,
    annexureClauses,
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
    setLineItems(prev =>
      prev.map(item => item.id === id ? { ...item, quantity: val, total: val * item.unitPrice } : item)
    );

  const handlePriceChange = (id: string | number, val: number) =>
    setLineItems(prev =>
      prev.map(item => item.id === id ? { ...item, unitPrice: val, total: item.quantity * val } : item)
    );

  const handleDescriptionChange = (id: string | number, val: string) =>
    setLineItems(prev =>
      prev.map(item => item.id === id ? { ...item, description: val } : item)
    );

  const handleCategoryChange = (id: string | number, val: string) =>
    setLineItems(prev =>
      prev.map(item => item.id === id ? { ...item, category: val } : item)
    );

  const handleAddLineItem = () => {
    const newId = `new-${Date.now()}`;
    setLineItems(prev => [
      ...prev,
      { id: newId, description: '', quantity: 1, unitPrice: 0, total: 0, category: '', unit: 'Nos' },
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

    const refLineItems = ((po.lineItems as Array<Record<string, unknown>>) || []).map((li, index) => {
      const qty = Number(li.quantity) || 0;
      const unitPrice = Number(li.unitPrice) || 0;
      return {
        id: `ref-${index}-${Date.now()}`,
        description: String(li.description || ''),
        quantity: qty,
        unitPrice,
        total: Number(li.total) || qty * unitPrice,
        category: String(li.category || ''),
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

  const applyCsvImportPayload = useCallback((payload: PoCsvImportPayload) => {
    setPoEntryMode('import');
    if (payload.lineItems?.length) setLineItems(payload.lineItems);
    if (payload.deliveryAddress) setDeliveryAddress(payload.deliveryAddress);
    if (payload.expectedDeliveryDate) setExpectedDeliveryDate(payload.expectedDeliveryDate);
    if (payload.paymentTerms) setPaymentTerms(payload.paymentTerms);
    if (payload.incoterms) setIncoterms(payload.incoterms);
    if (payload.gstPercentage != null) setGstPercentage(payload.gstPercentage);
    if (payload.specialInstructions) setSpecialInstructions(payload.specialInstructions);
    setCsvImportNote(`Imported ${payload.lineItems.length} line item(s) from CSV`);
    setCsvImportError('');
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
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        category: item.category,
      }))
    );
  }, [pr, isEditMode, fromCsvParam, refPoParam, applyCsvImportPayload]);

  const handleLookupReferencePo = async () => {
    const value = referencePoNumber.trim();
    if (!value) {
      setReferencePoError('Enter a PO number to look up');
      setReferencePoLoaded(null);
      return;
    }
    setReferencePoLoading(true);
    setReferencePoError('');
    try {
      const res = await poApi.getByNumber(value);
      const po = res.data as Record<string, unknown>;
      if (!po?.poNumber) {
        throw new Error('PO not found');
      }
      // Do not allow referencing the PO currently being edited
      if (isEditMode && String(po.poNumber) === poNumber) {
        throw new Error('Cannot use the current PO as its own reference');
      }
      applyReferencePoDetails(po);
    } catch (err) {
      setReferencePoLoaded(null);
      setReferencePoError(err instanceof Error ? err.message : 'PO not found');
    } finally {
      setReferencePoLoading(false);
    }
  };

  // Auto-import reference PO when opened from Purchase Requests with ?refPo=
  useEffect(() => {
    if (isEditMode || !pr || !refPoParam?.trim() || referencePoLoaded) return;
    let cancelled = false;
    const run = async () => {
      setReferencePoNumber(refPoParam.trim());
      setReferencePoLoading(true);
      setReferencePoError('');
      try {
        const res = await poApi.getByNumber(refPoParam.trim());
        if (cancelled) return;
        const po = res.data as Record<string, unknown>;
        if (!po?.poNumber) throw new Error('PO not found');
        applyReferencePoDetails(po);
      } catch (err) {
        if (!cancelled) {
          setReferencePoLoaded(null);
          setReferencePoError(err instanceof Error ? err.message : 'PO not found');
        }
      } finally {
        if (!cancelled) setReferencePoLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, pr, refPoParam, referencePoLoaded, applyReferencePoDetails]);

  const handleCsvFileOnForm = async (file: File | null) => {
    if (!file) return;
    setCsvImportError('');
    try {
      const text = await file.text();
      const payload = parsePoImportCsv(text);
      applyCsvImportPayload(payload);
    } catch (err) {
      setCsvImportError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleSendForApproval = async () => {
    if ((!numericPrId && !editPoId) || !pr) return;
    if (!letterheadId) {
      alert('Please select a letterhead entity');
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
      const payload = {
        lineItems: lineItems.map((i) => ({
          description: i.description,
          category: i.category || '',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        deliveryAddress,
        expectedDeliveryDate,
        paymentTerms,
        incoterms,
        specialInstructions,
        gstPercentage,
        poType,
        letterheadHeader,
        letterheadId: letterheadId || undefined,
        entity,
        headerLogo,
        footerLogo,
        terms: termsClauses,
        annexure: annexureClauses,
        referencePoNumber: referencePoNumber.trim() || undefined,
        changeSummary: changeSummary.trim() || undefined,
      };

      if (isEditMode && editPoId) {
        await poApi.update(editPoId, payload);
        navigate('/scm/po-approval');
        return;
      }

      const res = await poApi.create(numericPrId!, payload);
      const data = res.data as { poNumber: string; id: number };
      setPoNumber(data.poNumber);
      setCreatedPoId(data.id);
      const blob = await poApi.fetchPdfBlob(data.id);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(URL.createObjectURL(blob));
      setPageMode('pdf');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create PO');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Create Purchase Order</h1>
          <p className="text-sm text-gray-600 mb-6">Select a purchase request ready for PO creation</p>
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
              <a href={pdfPreviewUrl} download={`${poNumber}.pdf`} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">
                Download PDF
              </a>
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
        <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(isEditMode ? '/scm/po-approval' : '/scm/purchase-requests')}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer text-gray-500"
              >
                <i className="ri-arrow-left-line text-lg"></i>
              </button>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg font-bold text-gray-900">
                    {isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}
                  </h1>
                  <span className={`px-2.5 py-0.5 border rounded-full text-xs font-semibold tracking-wide ${
                    isEditMode
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-teal-50 text-teal-700 border-teal-200'
                  }`}>
                    {isEditMode ? 'PENDING REVIEW' : 'DRAFT'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-gray-500">
                    PO No: <span className="font-semibold text-teal-600">{poNumber}</span>
                  </span>
                  <span className="text-gray-300 text-xs">•</span>
                  <span className="text-xs text-gray-500">
                    PR Ref: <span className="font-semibold text-gray-700">{pr.prNumber}</span>
                  </span>
                  <span className="text-gray-300 text-xs">•</span>
                  <span className="text-xs text-gray-500">
                    Vendor: <span className="font-semibold text-gray-700">{pr.recommendedVendor}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {draftSaved && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium animate-pulse">
                  <i className="ri-checkbox-circle-fill"></i> Draft saved
                </span>
              )}
              {!isEditMode && (
                <button
                  onClick={handleSaveDraft}
                  className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap text-sm font-medium flex items-center gap-2"
                >
                  <i className="ri-save-line"></i> Save Draft
                </button>
              )}
              {isEditMode && pdfPreviewUrl && (
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium flex items-center gap-2"
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
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64"
                />
              )}
              <button
                onClick={handleSendForApproval}
                disabled={submitting}
                className="px-5 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors cursor-pointer whitespace-nowrap text-sm font-semibold flex items-center gap-2 shadow-sm disabled:opacity-60"
              >
                <i className={isEditMode ? 'ri-save-3-line' : 'ri-send-plane-fill'}></i>
                {submitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Send for Approval'}
              </button>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-0 mt-4">
            {[
              { key: 'details', label: 'PO Details', icon: 'ri-file-list-3-line', step: 1 },
              { key: 'terms', label: 'Terms & Conditions', icon: 'ri-file-text-line', step: 2 },
              { key: 'preview', label: 'Preview & Submit', icon: 'ri-eye-line', step: 3 },
            ].map((tab, idx) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                  activeTab === tab.key
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold ${
                  activeTab === tab.key ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{tab.step}</span>
                <i className={`${tab.icon} text-base`}></i>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          {/* ══════════════════════════════════════════
              TAB 1 — PO DETAILS
          ══════════════════════════════════════════ */}
          {activeTab === 'details' && (
            <div className="grid grid-cols-3 gap-6">
              {/* LEFT — 2/3 */}
              <div className="col-span-2 space-y-5">

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

                {/* Create PO: Import + Manual entry */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                        <i className="ri-file-add-line text-teal-600"></i>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Create PO</h3>
                        <p className="text-xs text-gray-500">Import from an existing PO, or enter details manually</p>
                      </div>
                    </div>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setPoEntryMode('manual')}
                        className={`px-3.5 py-2 text-xs font-semibold ${
                          poEntryMode === 'manual' ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <i className="ri-edit-line mr-1"></i>
                        Manual Entry
                      </button>
                      <button
                        type="button"
                        onClick={() => setPoEntryMode('import')}
                        className={`px-3.5 py-2 text-xs font-semibold border-l border-gray-200 ${
                          poEntryMode === 'import' ? 'bg-violet-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <i className="ri-download-2-line mr-1"></i>
                        Import
                      </button>
                    </div>
                  </div>

                  {poEntryMode === 'import' && (
                    <div className="space-y-4 mb-4">
                      <div className="p-4 rounded-lg bg-violet-50/50 border border-violet-100 space-y-3">
                        <p className="text-xs font-semibold text-violet-800 uppercase tracking-wide">Import CSV (sample)</p>
                        <p className="text-xs text-violet-700">Download sample, fill line items, then upload to create this PO.</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={downloadPoImportSampleCsv}
                            className="px-4 py-2.5 border border-emerald-300 text-emerald-800 rounded-lg text-sm font-semibold hover:bg-white flex items-center gap-1.5"
                          >
                            <i className="ri-file-excel-2-line"></i>
                            Sample CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => csvInputRef.current?.click()}
                            className="px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 flex items-center gap-1.5"
                          >
                            <i className="ri-upload-2-line"></i>
                            Upload CSV
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveTab('terms')}
                            className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 flex items-center gap-1.5"
                          >
                            <i className="ri-shopping-cart-2-line"></i>
                            Create PO
                          </button>
                          <input
                            ref={csvInputRef}
                            type="file"
                            accept=".csv,text/csv"
                            className="hidden"
                            onChange={(e) => handleCsvFileOnForm(e.target.files?.[0] || null)}
                          />
                        </div>
                        {csvImportNote && (
                          <p className="text-xs text-emerald-700 flex items-center gap-1">
                            <i className="ri-checkbox-circle-fill"></i>
                            {csvImportNote}
                          </p>
                        )}
                        {csvImportError && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <i className="ri-error-warning-line"></i>
                            {csvImportError}
                          </p>
                        )}
                      </div>

                      <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Or import from Reference PO</p>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={referencePoNumber}
                            onChange={(e) => {
                              setReferencePoNumber(e.target.value);
                              setReferencePoError('');
                              if (!e.target.value.trim()) setReferencePoLoaded(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleLookupReferencePo();
                              }
                            }}
                            placeholder="e.g. PO-2026-0001"
                            className="flex-1 min-w-[180px] px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleLookupReferencePo}
                            disabled={referencePoLoading}
                            className="px-4 py-2.5 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-60 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                          >
                            {referencePoLoading ? (
                              <i className="ri-loader-4-line animate-spin"></i>
                            ) : (
                              <i className="ri-download-2-line"></i>
                            )}
                            Import PO
                          </button>
                        </div>
                        {referencePoError && (
                          <p className="text-xs text-red-600 flex items-center gap-1">
                            <i className="ri-error-warning-line"></i>
                            {referencePoError}
                          </p>
                        )}
                        {referencePoLoaded && !referencePoError && (
                          <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800">
                            <p className="font-semibold flex items-center gap-1.5">
                              <i className="ri-checkbox-circle-fill"></i>
                              Loaded from {referencePoLoaded.poNumber}
                            </p>
                            <p className="mt-1 text-emerald-700">
                              {[
                                referencePoLoaded.prNumber && `PR ${referencePoLoaded.prNumber}`,
                                referencePoLoaded.vendorName && `Vendor: ${referencePoLoaded.vendorName}`,
                                referencePoLoaded.grandTotal
                                  ? `Amount: ${fmt(referencePoLoaded.grandTotal)}`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {poEntryMode === 'manual' && (
                    <div className="space-y-4 mb-4 p-4 rounded-lg bg-teal-50/40 border border-teal-100">
                      <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide">Manual entry fields</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Delivery address</label>
                          <textarea
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                            placeholder="Ship-to address"
                          />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Expected delivery date</label>
                            <input
                              type="date"
                              value={expectedDeliveryDate}
                              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Payment terms</label>
                            <select
                              value={paymentTerms}
                              onChange={(e) => setPaymentTerms(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                            >
                              {['Net 30 Days', 'Net 45 Days', 'Net 60 Days', 'Advance 50%', 'On Delivery'].map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Incoterms</label>
                          <select
                            value={incoterms}
                            onChange={(e) => setIncoterms(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                          >
                            {['DDP', 'FOB', 'CIF', 'EXW', 'DAP'].map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">GST %</label>
                          <input
                            type="number"
                            min={0}
                            value={gstPercentage}
                            onChange={(e) => setGstPercentage(Math.max(0, Number(e.target.value) || 0))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold text-gray-600 mb-1">Special instructions</label>
                          <input
                            type="text"
                            value={specialInstructions}
                            onChange={(e) => setSpecialInstructions(e.target.value)}
                            placeholder="Optional notes for vendor"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-teal-700">
                        Edit line items below as needed, then continue with Create PO.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveTab('terms')}
                          className="px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                        >
                          <i className="ri-shopping-cart-2-line"></i>
                          Create PO
                        </button>
                        <button
                          type="button"
                          onClick={() => setPoEntryMode('import')}
                          className="px-4 py-2.5 border border-violet-300 text-violet-700 rounded-lg text-sm font-semibold hover:bg-violet-50 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                        >
                          <i className="ri-download-2-line"></i>
                          Switch to Import
                        </button>
                      </div>
                    </div>
                  )}

                  {poEntryMode === 'import' && referencePoLoaded && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setPoEntryMode('manual')}
                        className="text-xs font-medium text-teal-700 hover:underline"
                      >
                        Review / edit imported fields manually
                      </button>
                    </div>
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
                  {(entity || headerLogo || footerLogo) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Entity</p>
                        <p className="text-sm text-gray-800">{entity || '—'}</p>
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

                {/* Line Items */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-10">#</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Category</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Total</th>
                          <th className="px-4 py-3 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {lineItems.map((item, idx) => (
                          <tr key={item.id} className="hover:bg-gray-50/60 transition-colors group">
                            <td className="px-4 py-3">
                              <span className="w-6 h-6 flex items-center justify-center bg-teal-50 text-teal-700 rounded-full text-xs font-bold">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.description}
                                onChange={e => handleDescriptionChange(item.id, e.target.value)}
                                placeholder="Enter item description..."
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50 min-w-[180px]"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={item.category || ''}
                                onChange={e => handleCategoryChange(item.id, e.target.value)}
                                placeholder="Category"
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={e => handleQtyChange(item.id, parseInt(e.target.value) || 1)}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-medium">₹</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={e => handlePriceChange(item.id, parseFloat(e.target.value) || 0)}
                                  className="w-full pl-6 pr-2.5 py-1.5 border border-gray-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-gray-50"
                                />
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <p className="text-sm font-bold text-gray-900">{fmt(item.total)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDeleteLineItem(item.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                                title="Remove item"
                              >
                                <i className="ri-delete-bin-line text-sm"></i>
                              </button>
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

                  {/* Totals Footer */}
                  <div className="border-t border-gray-100 bg-gray-50/80 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={handleAddLineItem}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 border border-dashed border-teal-400 text-teal-600 rounded-lg hover:bg-teal-50 transition-colors cursor-pointer text-xs font-medium whitespace-nowrap"
                      >
                        <i className="ri-add-line text-sm"></i> Add Another Item
                      </button>
                      <div className="w-72 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Subtotal</span>
                          <span className="font-semibold text-gray-900">{fmt(subtotal)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500">GST</span>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={gstPercentage}
                                onChange={e => setGstPercentage(parseFloat(e.target.value) || 0)}
                                className="w-14 px-2 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                              />
                              <span className="text-gray-400 text-xs">%</span>
                            </div>
                          </div>
                          <span className="font-semibold text-gray-900">{fmt(taxAmount)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-sm font-bold text-gray-900">Grand Total</span>
                          <span className="text-lg font-bold text-teal-600">{fmt(grandTotal)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Details */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 flex items-center justify-center bg-teal-50 rounded-lg">
                      <i className="ri-map-pin-line text-teal-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Delivery Information</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-5">
                    <div className="col-span-2">
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
                    {[
                      { label: 'PO Number', value: poNumber, highlight: true },
                      { label: 'Reference PO', value: referencePoNumber || '—' },
                      { label: 'PR Reference', value: pr.prNumber },
                      { label: 'Department', value: pr.department },
                      { label: 'Requester', value: pr.requester },
                      { label: 'Priority', value: pr.priority },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500">{row.label}</span>
                        <span className={`text-xs font-semibold ${row.highlight ? 'text-teal-600' : 'text-gray-800'}`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Quick Actions</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveTab('terms')}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg text-sm text-gray-700 transition-colors cursor-pointer"
                    >
                      <i className="ri-file-text-line text-base"></i>
                      <span className="font-medium">Add Terms &amp; Conditions</span>
                      <i className="ri-arrow-right-line ml-auto text-gray-400"></i>
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 hover:bg-teal-50 hover:text-teal-700 rounded-lg text-sm text-gray-700 transition-colors cursor-pointer"
                    >
                      <i className="ri-eye-line text-base"></i>
                      <span className="font-medium">Preview PO Document</span>
                      <i className="ri-arrow-right-line ml-auto text-gray-400"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════
              TAB 2 — TERMS & CONDITIONS
          ══════════════════════════════════════════ */}
          {activeTab === 'terms' && (
            <div className="grid grid-cols-3 gap-6">
              <div className="col-span-2 space-y-5">
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
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Payment Terms</label>
                      <select
                        value={paymentTerms}
                        onChange={e => setPaymentTerms(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                      >
                        {PAYMENT_TERMS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Incoterms</label>
                      <select
                        value={incoterms}
                        onChange={e => setIncoterms(e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50 cursor-pointer"
                      >
                        {INCOTERMS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">GST Rate (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={gstPercentage}
                        onChange={e => setGstPercentage(parseFloat(e.target.value) || 0)}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-gray-50/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1.5">Expected Delivery Date <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={expectedDeliveryDate}
                        onChange={e => setExpectedDeliveryDate(e.target.value)}
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

                {/* Terms from Master */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg">
                      <i className="ri-shield-check-line text-gray-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Terms &amp; Conditions</h3>
                    <span className="ml-auto px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">
                      From PO Type Master
                    </span>
                  </div>
                  {letterheadLoading ? (
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <i className="ri-loader-4-line animate-spin"></i>
                      Loading terms...
                    </p>
                  ) : (
                    <ClausePreviewList clauses={termsClauses} emptyText="No terms configured for this PO type." />
                  )}
                </div>

                {/* Annexure from Master */}
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 flex items-center justify-center bg-indigo-50 rounded-lg">
                      <i className="ri-attachment-2 text-indigo-600"></i>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900">Annexure</h3>
                    <span className="ml-auto px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">
                      From PO Type Master
                    </span>
                  </div>
                  {letterheadLoading ? (
                    <p className="text-sm text-gray-400 flex items-center gap-2">
                      <i className="ri-loader-4-line animate-spin"></i>
                      Loading annexure...
                    </p>
                  ) : (
                    <ClausePreviewList clauses={annexureClauses} emptyText="No annexure configured for this PO type." />
                  )}
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
                      <span className="text-gray-500">GST ({gstPercentage}%)</span>
                      <span className="font-semibold">{fmt(taxAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                      <span className="text-sm font-bold text-gray-900">Grand Total</span>
                      <span className="text-xl font-bold text-teal-600">{fmt(grandTotal)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-2.5">
                    <i className="ri-information-line text-amber-600 text-lg flex-shrink-0 mt-0.5"></i>
                    <div>
                      <p className="text-xs font-semibold text-amber-800 mb-1">Before Submitting</p>
                      <ul className="text-xs text-amber-700 space-y-1">
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
                    {isEditMode && pdfPreviewUrl && (
                      <a
                        href={pdfPreviewUrl}
                        download={`${poNumber || 'PO'}.pdf`}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-100"
                      >
                        Download saved PDF
                      </a>
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
                        ? 'Updated PO stays pending until you sign from PO Approval'
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
                      : isEditMode ? 'Save Changes' : 'Send for Approval'}
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
