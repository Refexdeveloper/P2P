import { useState } from 'react';
import type { VendorRFQItem } from '../../../../mocks/vendor-quotation-portal-data';

interface Props {
  rfq: VendorRFQItem;
  onSubmitQuote: (rfq: VendorRFQItem) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const tabs = ['RFQ Details', 'Line Items', 'Quote History'] as const;
type Tab = typeof tabs[number];

export default function RFQDetailRow({ rfq, onSubmitQuote }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('RFQ Details');

  const canSubmit = rfq.status === 'Pending Quote' || rfq.status === 'Re-quote Requested';

  return (
    <div style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
      <div style={{ padding: '20px 32px 24px' }}>
        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: '4px', background: '#e2e8f0', borderRadius: '10px', padding: '4px', marginBottom: '20px', width: 'fit-content' }}>
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '7px 18px',
                borderRadius: '7px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab ? 700 : 500,
                background: activeTab === tab ? '#fff' : 'transparent',
                color: activeTab === tab ? '#0f766e' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {tab}
              {tab === 'Quote History' && rfq.quoteHistory.length > 0 && (
                <span style={{ marginLeft: '6px', background: '#0f766e', color: '#fff', borderRadius: '999px', padding: '1px 7px', fontSize: '11px' }}>
                  {rfq.quoteHistory.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* RFQ Details Tab */}
        {activeTab === 'RFQ Details' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            {/* Buyer Info */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Buyer Information</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>Buyer Name</p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{rfq.buyerName}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>Department</p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{rfq.buyerDepartment}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>Company</p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{rfq.company}</p>
                </div>
                <div>
                  <p style={{ fontSize: '11px', color: '#94a3b8' }}>PR Reference</p>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>{rfq.prNumber}</p>
                </div>
              </div>
            </div>

            {/* Timeline */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Key Dates</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>RFQ Issued</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{rfq.issuedDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Quote Due</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#dc2626' }}>{rfq.dueDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Delivery By</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{rfq.requiredDeliveryDate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Est. Value</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f766e' }}>{formatCurrency(rfq.estimatedValue)}</span>
                </div>
              </div>
            </div>

            {/* Terms & Attachments */}
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' }}>Terms & Attachments</p>
              <p style={{ fontSize: '12px', color: '#374151', marginBottom: '10px', lineHeight: '1.5' }}>{rfq.terms}</p>
              {rfq.specialInstructions && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px', marginBottom: '10px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '4px' }}>Special Instructions</p>
                  <p style={{ fontSize: '12px', color: '#78350f' }}>{rfq.specialInstructions}</p>
                </div>
              )}
              {rfq.attachments.length > 0 && (
                <div>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px' }}>Attached Documents</p>
                  {rfq.attachments.map(att => (
                    <div key={att} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <i className="ri-file-pdf-line" style={{ color: '#dc2626', fontSize: '13px' }}></i>
                      <span style={{ fontSize: '12px', color: '#0f766e', textDecoration: 'underline', cursor: 'pointer' }}>{att}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Re-quote notice */}
            {rfq.status === 'Re-quote Requested' && rfq.reQuoteReason && (
              <div style={{ gridColumn: '1 / -1', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '14px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                  <i className="ri-refresh-line" style={{ marginRight: '6px' }}></i>
                  Buyer Requested Re-quote — Please revise and resubmit
                </p>
                <p style={{ fontSize: '13px', color: '#78350f' }}>{rfq.reQuoteReason}</p>
                {rfq.reQuoteFields && rfq.reQuoteFields.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {rfq.reQuoteFields.map(f => (
                      <span key={f} style={{ padding: '2px 10px', background: '#fde68a', color: '#92400e', borderRadius: '999px', fontSize: '11px', fontWeight: 700 }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action button */}
            {canSubmit && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onSubmitQuote(rfq)}
                  style={{ padding: '10px 24px', background: '#0f766e', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <i className="ri-send-plane-fill"></i>
                  {rfq.status === 'Re-quote Requested' ? `Re-Submit Quotation (Round ${rfq.currentRound})` : 'Submit Quotation'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Line Items Tab */}
        {activeTab === 'Line Items' && (
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Description</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Specifications</th>
                  <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Qty</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Est. Unit Price</th>
                  {rfq.quotedValue && (
                    <>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' }}>Quoted Price</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 700, color: '#0f766e', textTransform: 'uppercase' }}>Line Total</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {rfq.lineItems.map((item, idx) => (
                  <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <p style={{ fontWeight: 600, color: '#1e293b', marginBottom: '2px' }}>{item.description}</p>
                      <p style={{ fontSize: '11px', color: '#94a3b8' }}>{item.category} · {item.unit}</p>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: '#475569', maxWidth: '280px' }}>{item.specifications}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>{item.quantity}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: '#94a3b8', fontSize: '12px' }}>{formatCurrency(item.estimatedUnitPrice)}</td>
                    {rfq.quotedValue && (
                      <>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>
                          {item.quotedUnitPrice ? formatCurrency(item.quotedUnitPrice) : '—'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>
                          {item.quotedTotal ? formatCurrency(item.quotedTotal) : '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', borderTop: '2px solid #e2e8f0' }}>
                  <td colSpan={rfq.quotedValue ? 4 : 3} style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>Total (Est.)</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>{formatCurrency(rfq.estimatedValue)}</td>
                  {rfq.quotedValue && (
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#0f766e' }}>{formatCurrency(rfq.quotedValue)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Quote History Tab */}
        {activeTab === 'Quote History' && (
          <div>
            {rfq.quoteHistory.length === 0 ? (
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '40px', textAlign: 'center' }}>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>No quote history yet. Submit your first quotation to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {rfq.quoteHistory.map(h => (
                  <div key={h.round} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: h.status === 'accepted' ? '#d1fae5' : h.status === 're-quote-requested' ? '#fef3c7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <i className={h.status === 'accepted' ? 'ri-check-line' : h.status === 're-quote-requested' ? 'ri-refresh-line' : 'ri-close-line'} style={{ color: h.status === 'accepted' ? '#059669' : h.status === 're-quote-requested' ? '#d97706' : '#dc2626', fontSize: '16px' }}></i>
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>Round {h.round} — {formatCurrency(h.totalAmount)}</p>
                          <p style={{ fontSize: '12px', color: '#94a3b8' }}>Submitted: {h.submittedDate} · Lead Time: {h.leadTimeDays} days · {h.paymentTerms}</p>
                        </div>
                      </div>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: h.status === 'accepted' ? '#d1fae5' : h.status === 're-quote-requested' ? '#fef3c7' : '#fee2e2',
                        color: h.status === 'accepted' ? '#065f46' : h.status === 're-quote-requested' ? '#92400e' : '#991b1b',
                      }}>
                        {h.status === 'accepted' ? 'Accepted' : h.status === 're-quote-requested' ? 'Re-quote Requested' : 'Rejected'}
                      </span>
                    </div>
                    {(h.rejectionReason || h.reQuoteFields) && (
                      <div style={{ marginTop: '10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 12px' }}>
                        {h.rejectionReason && <p style={{ fontSize: '12px', color: '#78350f' }}><strong>Reason:</strong> {h.rejectionReason}</p>}
                        {h.reQuoteFields && h.reQuoteFields.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                            {h.reQuoteFields.map(f => <span key={f} style={{ padding: '1px 8px', background: '#fde68a', color: '#92400e', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>{f}</span>)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
