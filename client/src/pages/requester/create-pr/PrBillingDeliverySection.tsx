import { useEffect, useState } from 'react';
import type { EntityLocationRecord, EntityRecord, PoSiteLookupRecord } from '../../../services/api';
import { masterApi } from '../../../services/api';
import AddableSelect from '../../../components/base/AddableSelect';
import {
  PR_DELIVERY_TIMELINE_OPTIONS,
  PR_PAYMENT_TERM_OPTIONS,
} from '../../../constants/prRequisition';
import {
  mergeProjectManagers,
  mergeSiteContacts,
  upsertSiteLookup,
} from '../../../constants/poSiteLookups';
import {
  PM_CARD,
  PM_CARD_HEADER,
  PM_ICON_CHIP_SOLID,
  PM_INPUT,
  PM_LABEL,
} from '../../../constants/pmTheme';

export type PrBillingDeliveryValue = {
  billingLocationId: number | '';
  billingLocation: string;
  billingGstNo: string;
  billingAddress: string;
  deliveryPoc: string;
  deliveryPocEmail?: string;
  deliveryPocPhone?: string;
  projectManagerHo?: string;
  projectManagerContact?: string;
  projectManagerEmail?: string;
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
  /** When Payment Terms is shown elsewhere (e.g. above Business Justification). */
  hidePaymentTerms?: boolean;
  onChange: (patch: Partial<PrBillingDeliveryValue>) => void;
  onClearError?: (key: string) => void;
}

const inputClass = `${PM_INPUT} disabled:bg-slate-50`;

export default function PrBillingDeliverySection({
  value,
  selectedEntity,
  billingLocations,
  errors = {},
  requireBillingCore = false,
  disabled = false,
  hint,
  hidePaymentTerms = false,
  onChange,
  onClearError,
}: Props) {
  const [siteContacts, setSiteContacts] = useState<PoSiteLookupRecord[]>(() => mergeSiteContacts([]));
  const [projectManagers, setProjectManagers] = useState<PoSiteLookupRecord[]>(() => mergeProjectManagers([]));
  const [addingSiteContact, setAddingSiteContact] = useState(false);
  const [addingProjectManager, setAddingProjectManager] = useState(false);
  const [savingLookup, setSavingLookup] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [newSiteContact, setNewSiteContact] = useState({ label: '', email: '', phone: '' });
  const [newProjectManager, setNewProjectManager] = useState({ label: '', email: '', phone: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [contactRes, pmRes] = await Promise.all([
          masterApi.listPoSiteLookups('site_contact'),
          masterApi.listPoSiteLookups('project_manager'),
        ]);
        if (cancelled) return;
        setSiteContacts(mergeSiteContacts(contactRes.data || []));
        setProjectManagers(mergeProjectManagers(pmRes.data || []));
      } catch {
        if (!cancelled) {
          setSiteContacts(mergeSiteContacts([]));
          setProjectManagers(mergeProjectManagers([]));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyRegion = (id: number | '', loc?: EntityLocationRecord) => {
    const nextBilling = (loc?.billingAddress || '').trim() || loc?.location || '';
    const nextSite = (loc?.siteAddress || '').trim();

    onChange({
      billingLocationId: id,
      billingLocation: loc?.location || '',
      billingGstNo: (loc?.gstNo || '').toUpperCase(),
      billingAddress: nextBilling,
      ...(nextSite ? { placeOfDelivery: nextSite } : {}),
    });
    onClearError?.('billingLocationId');
  };

  const saveSiteContact = async () => {
    const label = newSiteContact.label.trim();
    if (!label) {
      setLookupError('Contact name is required');
      return;
    }
    setSavingLookup(true);
    setLookupError('');
    try {
      const res = await masterApi.createPoSiteLookup({
        type: 'site_contact',
        label,
        email: newSiteContact.email.trim(),
        phone: newSiteContact.phone.trim(),
      });
      const saved = res.data;
      setSiteContacts((prev) => upsertSiteLookup(prev, saved));
      onChange({
        deliveryPoc: saved.label,
        deliveryPocEmail: saved.email || '',
        deliveryPocPhone: saved.phone || '',
      });
      onClearError?.('deliveryPoc');
      setNewSiteContact({ label: '', email: '', phone: '' });
      setAddingSiteContact(false);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Could not save site contact');
    } finally {
      setSavingLookup(false);
    }
  };

  const saveProjectManager = async () => {
    const label = newProjectManager.label.trim();
    if (!label) {
      setLookupError('Project manager name is required');
      return;
    }
    setSavingLookup(true);
    setLookupError('');
    try {
      const res = await masterApi.createPoSiteLookup({
        type: 'project_manager',
        label,
        email: newProjectManager.email.trim(),
        phone: newProjectManager.phone.trim(),
      });
      const saved = res.data;
      setProjectManagers((prev) => upsertSiteLookup(prev, saved));
      onChange({
        projectManagerHo: saved.label,
        projectManagerEmail: saved.email || '',
        projectManagerContact: saved.phone || '',
      });
      onClearError?.('projectManagerHo');
      setNewProjectManager({ label: '', email: '', phone: '' });
      setAddingProjectManager(false);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Could not save project manager');
    } finally {
      setSavingLookup(false);
    }
  };

  return (
    <div className={PM_CARD}>
      <div className={PM_CARD_HEADER}>
        <div className={PM_ICON_CHIP_SOLID}>
          <i className="ri-map-pin-line text-sm"></i>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-[#0F172A]">Billing &amp; Delivery</h2>
          <p className="text-xs text-[#64748B]">
            {hint || 'SCM mandatory — billing GSTIN is filled from the entity region and can be edited.'}
          </p>
        </div>
      </div>

      <div className="relative z-[1] grid grid-cols-1 items-start gap-x-6 gap-y-5 p-4 sm:grid-cols-2 sm:p-6">
        <div>
          <label className={PM_LABEL}>
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
              className={`h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm focus:border-[#1E88E5] focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 ${
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
              className={inputClass}
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
          <label className="block text-xs font-semibold text-[#7F8C8D] uppercase tracking-wider mb-2">
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
              className="w-full pl-9 pr-4 py-2.5 border border-transparent rounded-xl text-sm font-mono tracking-wide focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5] bg-white disabled:bg-slate-50"
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Auto-filled from the region. Change it if this PR needs a different GSTIN.
          </p>
        </div>

        <div className="md:col-span-2" data-field="billingAddress">
          <label className="block text-xs font-semibold text-[#7F8C8D] uppercase tracking-wider mb-2">
            Billing Address
            {requireBillingCore ? <span className="text-red-500"> *</span> : null}
          </label>
          <textarea
            value={value.billingAddress}
            onChange={(e) => {
              onChange({ billingAddress: e.target.value });
              onClearError?.('billingAddress');
            }}
            disabled={disabled}
            rows={3}
            placeholder="Auto-filled from Entity Master location (editable)"
            className={`h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm focus:border-[#1E88E5] focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 resize-none ${
              errors.billingAddress ? 'border-red-400 bg-red-50' : 'border-transparent'
            }`}
          />
          {errors.billingAddress && <p className="text-xs text-red-500 mt-1">{errors.billingAddress}</p>}
          <p className="text-[11px] text-gray-400 mt-1">
            Filled from the selected region. Edit the full billing address if needed.
          </p>
        </div>

        <div data-field="deliveryPoc" className="min-w-0">
          <AddableSelect
            variant="compact"
            label="POC for Delivery"
            value={value.deliveryPoc}
            placeholder="Select site contact person"
            disabled={disabled}
            options={siteContacts.map((opt) => ({
              id: opt.id,
              label: opt.label,
              subLabel: [opt.email, opt.phone].filter(Boolean).join(' · '),
              email: opt.email,
              phone: opt.phone,
            }))}
            adding={addingSiteContact}
            onOpenAdd={() => {
              setLookupError('');
              setAddingProjectManager(false);
              setAddingSiteContact(true);
              setNewSiteContact({
                label: value.deliveryPoc || '',
                email: value.deliveryPocEmail || '',
                phone: value.deliveryPocPhone || '',
              });
            }}
            onCloseAdd={() => {
              setAddingSiteContact(false);
              setLookupError('');
            }}
            onSelect={(opt) => {
              onChange({
                deliveryPoc: opt.label,
                deliveryPocEmail: opt.email || '',
                deliveryPocPhone: opt.phone || '',
              });
              onClearError?.('deliveryPoc');
            }}
            addForm={
              <>
                <input
                  type="text"
                  value={newSiteContact.label}
                  onChange={(e) => setNewSiteContact((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Contact name"
                  className="w-full px-2.5 py-1.5 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]"
                />
                <input
                  type="email"
                  value={newSiteContact.email}
                  onChange={(e) => setNewSiteContact((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="w-full px-2.5 py-1.5 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]"
                />
                <input
                  type="text"
                  value={newSiteContact.phone}
                  onChange={(e) => setNewSiteContact((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full px-2.5 py-1.5 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]"
                />
                {lookupError && addingSiteContact ? <p className="text-xs text-red-600">{lookupError}</p> : null}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSiteContact(false);
                      setLookupError('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveSiteContact()}
                    disabled={savingLookup}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E88E5] hover:bg-[#1565C0] rounded-md disabled:opacity-60 cursor-pointer"
                  >
                    {savingLookup ? 'Saving...' : 'Add'}
                  </button>
                </div>
              </>
            }
          />
        </div>

        <div data-field="projectManagerHo" className="min-w-0">
          <AddableSelect
            variant="compact"
            label="Project Manager HO"
            value={value.projectManagerHo || ''}
            placeholder="Select project manager"
            disabled={disabled}
            options={projectManagers.map((opt) => ({
              id: opt.id,
              label: opt.label,
              subLabel: [opt.email, opt.phone].filter(Boolean).join(' · '),
              email: opt.email,
              phone: opt.phone,
            }))}
            adding={addingProjectManager}
            onOpenAdd={() => {
              setLookupError('');
              setAddingSiteContact(false);
              setAddingProjectManager(true);
              setNewProjectManager({
                label: value.projectManagerHo || '',
                email: value.projectManagerEmail || '',
                phone: value.projectManagerContact || '',
              });
            }}
            onCloseAdd={() => {
              setAddingProjectManager(false);
              setLookupError('');
            }}
            onSelect={(opt) => {
              onChange({
                projectManagerHo: opt.label,
                projectManagerEmail: opt.email || '',
                projectManagerContact: opt.phone || '',
              });
              onClearError?.('projectManagerHo');
            }}
            addForm={
              <>
                <input
                  type="text"
                  value={newProjectManager.label}
                  onChange={(e) => setNewProjectManager((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Project manager name"
                  className="w-full px-2.5 py-1.5 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]"
                />
                <input
                  type="email"
                  value={newProjectManager.email}
                  onChange={(e) => setNewProjectManager((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email"
                  className="w-full px-2.5 py-1.5 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]"
                />
                <input
                  type="text"
                  value={newProjectManager.phone}
                  onChange={(e) => setNewProjectManager((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="Phone"
                  className="w-full px-2.5 py-1.5 border border-transparent rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E88E5]/30 focus:border-[#1E88E5]"
                />
                {lookupError && addingProjectManager ? <p className="text-xs text-red-600">{lookupError}</p> : null}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAddingProjectManager(false);
                      setLookupError('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveProjectManager()}
                    disabled={savingLookup}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#1E88E5] hover:bg-[#1565C0] rounded-md disabled:opacity-60 cursor-pointer"
                  >
                    {savingLookup ? 'Saving...' : 'Add'}
                  </button>
                </div>
              </>
            }
          />
        </div>

        <div data-field="placeOfDelivery">
          <label className="block text-xs font-semibold text-[#7F8C8D] uppercase tracking-wider mb-2">
            Site / Place of Delivery
          </label>
          <textarea
            value={value.placeOfDelivery}
            onChange={(e) => {
              onChange({ placeOfDelivery: e.target.value });
              onClearError?.('placeOfDelivery');
            }}
            disabled={disabled}
            rows={3}
            placeholder="Site address (auto-filled from Entity Master location)"
            className={`${inputClass} resize-y`}
          />
        </div>

        <div data-field="expectedDeliveryTimeline">
          <label className="block text-xs font-semibold text-[#7F8C8D] uppercase tracking-wider mb-2">
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
            className={inputClass}
          />
          <datalist id="pr-billing-delivery-timeline">
            {PR_DELIVERY_TIMELINE_OPTIONS.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </div>

        {!hidePaymentTerms && (
        <div data-field="paymentTerms" className="md:col-span-2 lg:col-span-3">
          <label className="block text-xs font-semibold text-[#7F8C8D] uppercase tracking-wider mb-2">
            Payment Terms
          </label>
          <textarea
            value={value.paymentTerms}
            onChange={(e) => {
              onChange({ paymentTerms: e.target.value });
              onClearError?.('paymentTerms');
            }}
            disabled={disabled}
            rows={4}
            placeholder={"e.g. Net 30 Days\nAdvance 30%, balance on delivery\nInclude milestones if needed..."}
            className={`${inputClass} resize-none min-h-[96px]`}
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Suggestions: {PR_PAYMENT_TERM_OPTIONS.slice(0, 4).join(' · ')}
          </p>
        </div>
        )}
      </div>
    </div>
  );
}
