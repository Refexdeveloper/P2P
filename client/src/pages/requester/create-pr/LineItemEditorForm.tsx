import { useEffect, useState } from 'react';
import { CategoryRecord, ItemRecord } from '../../../services/api';
import { CurrencyCode, formatMoney } from '../../../constants/currency';
import ItemCombobox from './ItemCombobox';
import CategoryCombobox from './CategoryCombobox';

export interface LineItem {
  id: string;
  itemId?: number | null;
  itemName?: string;
  description: string;
  quantity: number;
  estimatedCost: number;
  category: string;
  unit?: string;
  hsnCode?: string;
  gstPercentage?: number;
}

const SYSTEM_ITEM_DESC = /^created from create pr by /i;
const noSpinnerClass =
  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';

export function createEmptyLineItem(): LineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemId: null,
    itemName: '',
    description: '',
    quantity: 1,
    estimatedCost: 0,
    category: '',
    unit: 'Nos',
    hsnCode: '',
    gstPercentage: undefined,
  };
}

function isSystemDescription(value?: string) {
  return SYSTEM_ITEM_DESC.test((value || '').trim());
}

function usefulMasterDescription(master: ItemRecord) {
  const desc = (master.description || '').trim();
  if (!desc || isSystemDescription(desc) || desc.toLowerCase() === master.name.toLowerCase()) {
    return '';
  }
  return desc;
}

function applyMasterToDraft(
  draft: LineItem,
  master: ItemRecord | null,
  options?: { created?: boolean }
): LineItem {
  if (!master) {
    return {
      ...draft,
      itemId: null,
      itemName: '',
    };
  }

  const userDesc = draft.description.trim();
  const keepUserDesc = Boolean(userDesc) && !isSystemDescription(userDesc);
  let description = draft.description;
  if (options?.created) {
    description = keepUserDesc ? draft.description : '';
  } else if (!keepUserDesc) {
    description = usefulMasterDescription(master);
  }

  const masterGst = Number(master.gstPercentage);
  const gstPercentage = options?.created
    ? draft.gstPercentage
    : Number.isFinite(masterGst)
      ? masterGst
      : draft.gstPercentage;

  return {
    ...draft,
    itemId: master.id,
    itemName: master.name,
    description,
    category: master.categoryName || draft.category,
    unit: master.unit || 'Nos',
    hsnCode: options?.created ? draft.hsnCode || '' : master.hsnCode || draft.hsnCode || '',
    gstPercentage,
  };
}

interface Props {
  mode: 'add' | 'edit';
  initial: LineItem;
  masterItems: ItemRecord[];
  masterCategories: CategoryRecord[];
  requestType: string;
  currency: CurrencyCode;
  moneySymbol: string;
  onSave: (item: LineItem) => void;
  onCancel: () => void;
  onMasterItemCreated: (item: ItemRecord) => void;
  onCategoryCreated: (category: CategoryRecord) => void;
}

export default function LineItemEditorForm({
  mode,
  initial,
  masterItems,
  masterCategories,
  requestType,
  currency,
  moneySymbol,
  onSave,
  onCancel,
  onMasterItemCreated,
  onCategoryCreated,
}: Props) {
  const [draft, setDraft] = useState<LineItem>(initial);
  const [qtyInput, setQtyInput] = useState(initial.quantity > 0 ? String(initial.quantity) : '');
  const [gstInput, setGstInput] = useState(
    initial.gstPercentage == null ? '' : String(initial.gstPercentage)
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(initial);
    setQtyInput(initial.quantity > 0 ? String(initial.quantity) : '');
    setGstInput(initial.gstPercentage == null ? '' : String(initial.gstPercentage));
    setErrors({});
  }, [initial]);

  const updateDraft = (patch: Partial<LineItem>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  const applyMaster = (master: ItemRecord | null, created = false) => {
    setDraft((prev) => applyMasterToDraft(prev, master, { created }));
    if (created || !master) return;
    const gst = Number(master.gstPercentage);
    setGstInput(Number.isFinite(gst) ? String(gst) : '');
  };

  const parsedQty = parseInt(qtyInput, 10);
  const quantity = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0;
  const parsedGst = gstInput.trim() === '' ? undefined : parseFloat(gstInput);
  const gstPercentage =
    parsedGst != null && Number.isFinite(parsedGst) ? Math.min(100, Math.max(0, parsedGst)) : undefined;

  const validate = () => {
    const next: Record<string, string> = {};
    if (!draft.itemId && !draft.description.trim() && !draft.itemName?.trim()) {
      next.itemName = 'Search an item or type a new name and save it';
    } else if (!draft.description.trim()) {
      next.description = 'Item description is required';
    }
    if (!draft.category) next.category = 'Category is required';
    if (!(quantity >= 1)) next.quantity = 'Enter a quantity of 1 or more';
    if (!(draft.estimatedCost > 0)) next.cost = 'Unit price must be greater than 0';
    if (gstInput.trim() !== '' && (parsedGst == null || !Number.isFinite(parsedGst) || parsedGst < 0 || parsedGst > 100)) {
      next.gst = 'Enter GST between 0 and 100';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave({
      ...draft,
      itemName: draft.itemName || draft.description,
      description: draft.description.trim(),
      quantity,
      unit: draft.unit || 'Nos',
      gstPercentage,
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 flex items-center justify-center bg-slate-800 text-white text-xs font-bold rounded-full">
            <i className={mode === 'edit' ? 'ri-pencil-line text-[11px]' : 'ri-add-line text-[11px]'}></i>
          </span>
          <span className="text-xs font-semibold text-slate-700">
            {mode === 'edit' ? 'Edit Line Item' : 'Add Line Item'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition-colors cursor-pointer"
          aria-label="Close form"
        >
          <i className="ri-close-line text-sm"></i>
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Item Name <span className="text-red-500">*</span>
          </label>
          <ItemCombobox
            key={`item-name-${draft.id}`}
            instanceKey={draft.id}
            items={masterItems}
            selectedId={draft.itemId}
            selectedName={draft.itemName || draft.description}
            hasError={Boolean(errors.itemName)}
            categoryId={masterCategories.find((c) => c.name === draft.category)?.id || null}
            onSelect={(master) => applyMaster(master)}
            onClear={() => applyMaster(null)}
            onCreated={(created) => {
              onMasterItemCreated(created);
              applyMaster(created, true);
            }}
          />
          {errors.itemName && <p className="text-xs text-red-500 mt-1">{errors.itemName}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Category <span className="text-red-500">*</span>
          </label>
          <CategoryCombobox
            categories={masterCategories}
            selectedName={draft.category}
            hasError={Boolean(errors.category)}
            requestType={requestType}
            onSelect={(cat) => updateDraft({ category: cat.name })}
            onClear={() => updateDraft({ category: '' })}
            onCreated={(created) => {
              onCategoryCreated(created);
              updateDraft({ category: created.name });
            }}
          />
          {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Quantity <span className="text-red-500">*</span>
          </label>
          <div className={`flex items-center border rounded-lg overflow-hidden ${errors.quantity ? 'border-red-400' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={() => {
                const next = Math.max(1, (Number.isFinite(parsedQty) ? parsedQty : 1) - 1);
                setQtyInput(String(next));
              }}
              className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-subtract-line text-sm"></i>
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={qtyInput}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                if (digits === '' || digits === '0') {
                  setQtyInput('');
                  return;
                }
                setQtyInput(String(parseInt(digits, 10)));
              }}
              onBlur={() => {
                if (!qtyInput) setQtyInput('1');
              }}
              placeholder="1"
              className={`flex-1 px-2 py-2 text-center text-sm focus:outline-none border-x border-gray-200 ${noSpinnerClass}`}
              aria-label="Quantity"
            />
            <button
              type="button"
              onClick={() => {
                const next = (Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 0) + 1;
                setQtyInput(String(next));
              }}
              className="px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer"
            >
              <i className="ri-add-line text-sm"></i>
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Unit: {draft.unit || 'Nos'} · Minimum 1</p>
          {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Unit Price ({moneySymbol}) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-semibold pointer-events-none">
              {moneySymbol}
            </span>
            <input
              type="number"
              value={draft.estimatedCost || ''}
              onChange={(e) => {
                const raw = e.target.value;
                const parsed = raw === '' || raw === '.' ? 0 : parseFloat(raw);
                updateDraft({ estimatedCost: Number.isFinite(parsed) ? Math.max(0, parsed) : 0 });
              }}
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              className={`w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white ${noSpinnerClass} ${errors.cost ? 'border-red-400' : 'border-gray-200'}`}
              title="Unit Price"
              aria-label="Unit Price"
            />
          </div>
          {errors.cost && <p className="text-xs text-red-500 mt-1">{errors.cost}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">HSN Code</label>
          <input
            type="text"
            value={draft.hsnCode || ''}
            onChange={(e) => updateDraft({ hsnCode: e.target.value })}
            placeholder="From Item Master"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">GST %</label>
          <input
            type="text"
            inputMode="decimal"
            value={gstInput}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                setGstInput('');
                return;
              }
              if (!/^\d{0,3}(\.\d{0,2})?$/.test(raw)) return;
              const parsed = parseFloat(raw);
              if (Number.isFinite(parsed) && parsed > 100) {
                setGstInput('100');
                return;
              }
              setGstInput(raw);
            }}
            placeholder="Enter GST % (e.g. 18)"
            className={`w-full px-3 py-2 border rounded-lg text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-400 ${errors.gst ? 'border-red-400' : 'border-gray-200'}`}
          />
          <p className="text-[11px] text-gray-400 mt-1">Type 0 for GST-exempt items</p>
          {errors.gst && <p className="text-xs text-red-500 mt-1">{errors.gst}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1.5">Estimated Total</label>
          <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-sm font-bold text-emerald-700">
              {formatMoney((quantity || 0) * draft.estimatedCost, currency, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        <div className="md:col-span-2 lg:col-span-4">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Item Description <span className="text-red-500">*</span>
          </label>
          <textarea
            value={draft.description}
            onChange={(e) => updateDraft({ description: e.target.value })}
            rows={3}
            placeholder="Type the item description…"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 resize-none ${errors.description ? 'border-red-400' : 'border-gray-200'}`}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/70">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-xs font-semibold rounded-xl hover:bg-white transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
        >
          {mode === 'edit' ? 'Update' : 'Add'}
        </button>
      </div>
    </div>
  );
}
