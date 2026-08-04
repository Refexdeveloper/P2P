import type { VendorPOData } from '../../../../mocks/vendor-po-acceptance-data';

interface PODocumentViewProps {
  po: VendorPOData;
  onAccept?: () => void;
  onReject?: () => void;
  onPartial?: () => void;
  isPending: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const watermarkConfig: Record<string, { text: string; color: string }> = {
  Accepted: { text: 'ACCEPTED', color: '#10b981' },
  Rejected: { text: 'REJECTED', color: '#ef4444' },
  'Partially Accepted': { text: 'PARTIAL', color: '#f59e0b' },
  'Pending Acceptance': { text: 'PENDING', color: '#9ca3af' },
};

export default function PODocumentView({ po, onAccept, onReject, onPartial, isPending }: PODocumentViewProps) {
  const wm = watermarkConfig[po.status] ?? { text: 'DRAFT', color: '#9ca3af' };

  const handlePrint = () => {
    const el = document.getElementById(`po-doc-print-${po.poNumber}`);
    if (!el) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>PO - ${po.poNumber}</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;padding:32px}
        .wm{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-45deg);font-size:90px;font-weight:900;opacity:.07;pointer-events:none;z-index:0}
        .hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:4px solid #0d9488;padding-bottom:20px;margin-bottom:24px}
        .htitle{font-size:30px;font-weight:900;color:#111}
        .badge{background:#0d9488;color:#fff;padding:8px 16px;border-radius:8px;text-align:center}
        .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:20px}
        .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
        .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:20px}
        .cell{background:#f1f5f9;border-radius:6px;padding:10px}
        .slabel{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700}
        .sval{font-size:12px;font-weight:700;color:#111;margin-top:2px}
        .box{background:#f9fafb;border-radius:8px;padding:14px;margin-bottom:16px}
        .sec{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;font-weight:700;border-bottom:1px solid #e5e7eb;padding-bottom:5px;margin-bottom:10px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px}
        th{background:#f3f4f6;border:1px solid #d1d5db;padding:7px 10px;font-size:9px;text-transform:uppercase;font-weight:700;color:#374151}
        td{border:1px solid #e5e7eb;padding:7px 10px;font-size:11px;color:#374151}
        .tr{font-weight:700}
        .total{background:#f0fdfa;font-weight:800;border-color:#99f6e4}
        .gtotal{background:#0d9488;color:#fff;font-weight:900}
        .bill{display:flex;justify-content:flex-end;margin-bottom:20px}
        .billbox{width:260px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden}
        .billrow{display:flex;justify-content:space-between;padding:7px 14px;border-bottom:1px solid #f3f4f6;font-size:12px}
        .billtot{display:flex;justify-content:space-between;padding:10px 14px;background:#0d9488;color:#fff;font-size:14px;font-weight:800}
        .sigs{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:32px;padding-top:24px;border-top:2px solid #e5e7eb}
        .sigline{border-bottom:2px solid #374151;height:40px;margin-bottom:6px}
        .footer{text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af}
        @media print{body{padding:16px}}
      </style></head><body>
      <div class="wm">${wm.text}</div>
      ${el.innerHTML}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <i className="ri-file-pdf-line text-red-500 text-base"></i>
          <span className="font-semibold text-gray-800">Purchase Order Document</span>
          <span className="text-gray-300 mx-1">|</span>
          <span className="text-teal-600 font-semibold">{po.poNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <>
              <button
                onClick={onPartial}
                className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-git-commit-line"></i> Partial Accept
              </button>
              <button
                onClick={onReject}
                className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-close-circle-line"></i> Reject
              </button>
              <button
                onClick={onAccept}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <i className="ri-check-double-line"></i> Accept PO
              </button>
            </>
          )}
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <i className="ri-printer-line"></i> Print / PDF
          </button>
        </div>
      </div>

      {/* Document Area */}
      <div className="bg-slate-100 p-8">
        <div
          id={`po-doc-print-${po.poNumber}`}
          className="bg-white mx-auto"
          style={{ maxWidth: 860, position: 'relative' }}
        >
          {/* Watermark */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 0,
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                fontSize: 110,
                fontWeight: 900,
                color: wm.color,
                opacity: 0.06,
                transform: 'rotate(-45deg)',
                letterSpacing: '-4px',
                lineHeight: 1,
                userSelect: 'none',
              }}
            >
              {wm.text}
            </span>
          </div>

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 1, padding: '48px' }}>

            {/* ── Header ── */}
            <div style={{ borderBottom: '4px solid #0d9488', paddingBottom: 24, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#111', letterSpacing: '-1px' }}>PURCHASE ORDER</div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '2px', marginTop: 4 }}>Official Procurement Document</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ background: '#0d9488', color: '#fff', padding: '10px 20px', borderRadius: 10, display: 'inline-block', marginBottom: 10 }}>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '1.5px', opacity: 0.8 }}>PO Number</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{po.poNumber}</div>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Date Issued: <strong style={{ color: '#111' }}>{po.issuedDate}</strong></div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>PR Ref: <strong style={{ color: '#0d9488' }}>{po.prId}</strong></div>
              </div>
            </div>

            {/* ── Status Banner ── */}
            {!isPending && (
              <div style={{
                marginBottom: 24,
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${po.status === 'Accepted' ? '#6ee7b7' : po.status === 'Rejected' ? '#fca5a5' : '#fcd34d'}`,
                background: po.status === 'Accepted' ? '#ecfdf5' : po.status === 'Rejected' ? '#fef2f2' : '#fffbeb',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}>
                <i className={`text-lg mt-0.5 ${po.status === 'Accepted' ? 'ri-check-double-line text-emerald-600' : po.status === 'Rejected' ? 'ri-close-circle-line text-red-600' : 'ri-git-commit-line text-amber-600'}`}></i>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: po.status === 'Accepted' ? '#065f46' : po.status === 'Rejected' ? '#991b1b' : '#92400e' }}>
                    {po.status}{po.acceptanceDate ? ` — Responded on ${po.acceptanceDate}` : ''}
                  </div>
                  {(po.acceptanceRemarks || po.rejectionReason) && (
                    <div style={{ fontSize: 11, color: '#4b5563', marginTop: 3 }}>{po.rejectionReason || po.acceptanceRemarks}</div>
                  )}
                </div>
              </div>
            )}

            {/* ── Summary Strip ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
              {[
                { label: 'Acceptance Due', value: po.acceptanceDueDate, icon: 'ri-time-line' },
                { label: 'Expected Delivery', value: po.expectedDeliveryDate, icon: 'ri-truck-line' },
                { label: 'Payment Terms', value: po.paymentTerms, icon: 'ri-bank-card-line' },
                { label: 'Department', value: po.department, icon: 'ri-building-4-line' },
              ].map((item) => (
                <div key={item.label} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 9, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className={`${item.icon} text-teal-400`} style={{ fontSize: 11 }}></i>{item.label}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* ── From / To ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 10 }}>From (Buyer)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 4 }}>Your Company Name</div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6 }}>Tech Park, Building A, 3rd Floor<br />Whitefield, Bangalore — 560066, Karnataka</div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>GSTIN: 29XXXXX1234X1ZX · PAN: XXXXX1234X</div>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 10 }}>To (Vendor)</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111', marginBottom: 4 }}>{po.vendorName}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Code: <span style={{ color: '#0d9488', fontWeight: 600 }}>{po.vendorCode}</span></div>
                <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>Contact: {po.vendorContact}</div>
                <div style={{ fontSize: 12, color: '#374151' }}>Email: {po.vendorEmail}</div>
              </div>
            </div>

            {/* ── Delivery Address ── */}
            <div style={{ background: '#f0fdfa', border: '1px solid #99f6e4', borderRadius: 10, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <i className="ri-map-pin-2-line text-teal-600" style={{ fontSize: 16, marginTop: 1 }}></i>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#0f766e', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 3 }}>Delivery Address</div>
                <div style={{ fontSize: 12, color: '#374151' }}>{po.deliveryAddress}</div>
              </div>
            </div>

            {/* ── PR Reference ── */}
            <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, marginBottom: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', marginBottom: 10 }}>Purchase Request Reference</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'PR Title', value: po.prTitle },
                  { label: 'Requester', value: po.requester },
                  { label: 'Issued By', value: `${po.issuedBy} · ${po.issuedByRole}` },
                ].map((item) => (
                  <div key={item.label}>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Line Items ── */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', marginBottom: 10 }}>Line Items</div>
              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {[
                      { label: 'S.No', align: 'center' as const },
                      { label: 'Description', align: 'left' as const },
                      { label: 'Specifications', align: 'left' as const },
                      { label: 'Unit', align: 'left' as const },
                      { label: 'Qty', align: 'center' as const },
                      { label: 'Unit Price', align: 'right' as const },
                      { label: 'Total', align: 'right' as const },
                    ].map((h) => (
                      <th
                        key={h.label}
                        style={{ border: '1px solid #d1d5db', padding: '8px 10px', textAlign: h.align, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#374151' }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {po.lineItems.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', textAlign: 'center', color: '#6b7280' }}>{idx + 1}</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', fontWeight: 600, color: '#111' }}>{item.description}</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', fontSize: 11, color: '#6b7280', maxWidth: 180 }}>{item.specifications || '—'}</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', color: '#374151' }}>{item.unit}</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', textAlign: 'center', fontWeight: 600 }}>{item.quantity}</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                      <td style={{ border: '1px solid #e5e7eb', padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Billing Summary ── */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
              <div style={{ width: 280, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ background: '#f3f4f6', padding: '10px 16px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#6b7280' }}>Billing Summary</div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>Subtotal</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(po.subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
                    <span style={{ color: '#6b7280' }}>GST ({po.gstPercentage}%)</span>
                    <span style={{ fontWeight: 600 }}>{formatCurrency(po.taxAmount)}</span>
                  </div>
                  <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Grand Total</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#0d9488' }}>{formatCurrency(po.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Terms & Conditions ── */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#9ca3af', borderBottom: '1px solid #e5e7eb', paddingBottom: 6, marginBottom: 12 }}>Terms &amp; Conditions</div>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {[
                  'All goods must be delivered in accordance with the specifications mentioned in this PO.',
                  'Payment will be processed as per the agreed payment terms after successful delivery and inspection.',
                  'Any defective or damaged goods must be replaced at vendor\'s cost within 7 working days.',
                  'Vendor must provide warranty/guarantee as per industry standards for all supplied items.',
                  'This PO is subject to the terms and conditions of the master agreement between both parties.',
                ].map((tc, i) => (
                  <li key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 11, color: '#4b5563' }}>
                    <span style={{ color: '#0d9488', fontWeight: 700 }}>•</span>
                    <span>{tc}</span>
                  </li>
                ))}
              </ul>
              {po.specialInstructions && (
                <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 5 }}>Special Instructions</div>
                  <div style={{ fontSize: 12, color: '#374151' }}>{po.specialInstructions}</div>
                </div>
              )}
            </div>

            {/* ── Signatures ── */}
            <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: 28, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64 }}>
              <div>
                <div style={{ borderBottom: '2px solid #374151', height: 44, marginBottom: 6, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{po.issuedBy}</span>
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{po.issuedByRole}</div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Date: {po.issuedDate}</div>
              </div>
              <div>
                <div style={{ borderBottom: '2px solid #374151', height: 44, marginBottom: 6, display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
                  {po.status === 'Accepted' && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{po.vendorContact}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>Vendor Authorized Signatory</div>
                {po.acceptanceDate && (
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>Date: {po.acceptanceDate}</div>
                )}
              </div>
            </div>

            {/* ── Footer ── */}
            <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>
                This is a system-generated document · For queries: procurement@yourcompany.com
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
