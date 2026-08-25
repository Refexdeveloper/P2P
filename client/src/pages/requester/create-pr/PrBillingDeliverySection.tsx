import type { EntityLocationRecord, EntityRecord } from '../../../services/api';
import {
  PR_DELIVERY_TIMELINE_OPTIONS,
  PR_PAYMENT_TERM_OPTIONS,
} from '../../../constants/prRequisition';

export type PrBillingDeliveryValue = {
  billingLocationId: number | '';
  billingLocation: string;
  billingGstNo: string;
  billingAddress: string;
  deliveryPoc: string;
  placeOfDelivery: string;
  expectedDeliveryTimeline: string;
  paymentTerms: string;
};

interface Props {
  value: PrBillingDeliveryValue;
  selectedEntity: EntityRecord | null;
  billingLocations: EntityLocationRecord[];
  errors?: Record<string, string>;
  requireBillingCore?: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (patch: Partial<PrBillingDeliveryValue>) => void;
  onClearError?: (key: string) => void;
}

export default function PrBillingDeliverySection({
  value,
  selectedEntity,
  billingLocations,
  errors = {},
  requireBillingCore = false,
  disabled = false,
  hint,
  onChange,
  onClearError,
}: Props) {
  const applyRegion = (id: number | '', loc?: EntityLocationRecord) => {
    const previousLocation = value.billingLocation;
    onChange({
      billingLocationId: id,
      billingLocation: loc?.location || '',
      billingGstNo: (loc?.gstNo || '').toUpperCase(),
      billingAddress: (() => {
        const trimmed = value.billingAddress.trim();
        if (!trimmed || trimmed === previousLocation) return loc?.location || '';
        return value.billingAddress;
      })(),
    });
    onClearError?.('billingLocationId');
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <div className="w-8 h-8 flex items-center justify-center bg-slate-800 rounded-lg">
          <i className="ri-map-pin-line text-white text-sm"></i>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Billing Address &amp; Delivery</h2>
          <p className="text-xs text-gray-500">
            {hint || 'Billing GSTIN is filled from the entity region and can be edited.'}
          </p>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Billing Region / GST
            {requireBillingCore ? <span className="text-red-500"> *</span> : null}
          </label>
          {billingLocations.length > 0 ? (
            <select
              value={value.billingLocationId}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : '';
                const loc = billingLocations.find((row) => Number(row.id) === Number(id));
                applyRegion(id, loc);
              }}
              disabled={disabled || !selectedEntity}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${
                errors.billingLocationId ? 'border-red-400 bg-red-50' : 'border-gray-200'
              }`}
            >
              <option value="">{selectedEntity ? 'Select billing region…' : 'Select entity first'}</option>
              {billingLocations.map((loc) => (
                <option key={loc.id || loc.location} value={loc.id}>
                  {loc.location}
                  {loc.gstNo ? ` — ${loc.gstNo}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={value.billingLocation}
              onChange={(e) => onChange({ billingLocation: e.target.value })}
              disabled={disabled || !selectedEntity}
              placeholder={
                selectedEntity ? 'No regions in entity master — enter billing location' : 'Select entity first'
              }
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50"
            />
          )}
          {errors.billingLocationId && (
            <p className="text-xs text-red-500 mt-1">{errors.billingLocationId}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">
            GSTIN is filled from the selected region. You can edit it after it appears.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Billing GSTIN
          </label>
          <div className="relative">
            <i className="ri-shield-check-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none"></i>
            <input
              type="text"
              value={value.billingGstNo}
              onChange={(e) => onChange({ billingGstNo: e.target.value.toUpperCase().replace(/\s/g, '') })}
              disabled={disabled || !selectedEntity}
              placeholder={
                selectedEntity
                  ? value.billingLocationId || value.billingLocation
                    ? 'Edit GSTIN if needed'
                    : 'Select billing region to auto-fill, then edit'
                  : 'Select entity first'
              }
              maxLength={15}
              autoComplete="off"
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white disabled:bg-slate-50"
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Auto-filled from the region. Change it if this PR needs a different GSTIN.
          </p>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Billing Address
            {requireBillingCore ? <span className="text-red-500"> *</span> : null}
          </label>
          <textarea
            value={value.billingAddress}
            onChange={(e) => {
              onChange({ billingAddress: e.target.value });
              onClearError?.('billingAddress');
            }}
            rows={3}
            disabled={disabled}
            placeholder="Enter billing / invoicing address"
            className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white resize-none ${
              errors.billingAddress ? 'border-red-400 bg-red-50' : 'border-gray-200'
            }`}
          />
          {errors.billingAddress && <p className="text-xs text-red-500 mt-1">{errors.billingAddress}</p>}
          <p className="text-[11px] text-gray-400 mt-1">
            Filled from the selected region. Edit the full billing address if needed.
          </p>
        </div>

        <div data-field="deliveryPoc">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            POC for Delivery
          </label>
          <input
            type="text"
            value={value.deliveryPoc}
            onChange={(e) => {
              onChange({ deliveryPoc: e.target.value });
              onClearError?.('deliveryPoc');
            }}
            disabled={disabled}
            placeholder="Name / phone of site contact"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          />
        </div>

        <div data-field="placeOfDelivery">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Place of Delivery
          </label>
          <input
            type="text"
            value={value.placeOfDelivery}
            onChange={(e) => {
              onChange({ placeOfDelivery: e.target.value });
              onClearError?.('placeOfDelivery');
            }}
            disabled={disabled}
            placeholder="Site / warehouse address (can differ from billing)"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          />
        </div>

        <div data-field="expectedDeliveryTimeline">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Expected Delivery Timeline
          </label>
          <input
            list="pr-billing-delivery-timeline"
            value={value.expectedDeliveryTimeline}
            onChange={(e) => {
              onChange({ expectedDeliveryTimeline: e.target.value });
              onClearError?.('expectedDeliveryTimeline');
            }}
            disabled={disabled}
            placeholder="e.g. Within 30 days"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          />
          <datalist id="pr-billing-delivery-timeline">
            {PR_DELIVERY_TIMELINE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </div>

        <div data-field="paymentTerms">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Payment Terms
          </label>
          <input
            list="pr-billing-payment-terms"
            value={value.paymentTerms}
            onChange={(e) => {
              onChange({ paymentTerms: e.target.value });
              onClearError?.('paymentTerms');
            }}
            disabled={disabled}
            placeholder="e.g. Net 30 Days"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white"
          />
          <datalist id="pr-billing-payment-terms">
            {PR_PAYMENT_TERM_OPTIONS.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}
