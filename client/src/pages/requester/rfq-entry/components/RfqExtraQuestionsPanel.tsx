import { useState } from 'react';
import type { RfqFieldDefinition } from '../../../../services/api';

const PRESET_HINTS: Record<string, string> = {
  make: 'Brand or manufacturer',
  hdg: 'Coating details',
  freight: 'Shipping or freight charge',
  leadTime: 'Days to deliver',
  paymentTerms: 'When payment is due',
  warranty: 'How long it is covered',
  deliveryTerms: 'How it will be delivered',
  compliance: 'Does it meet your specification?',
  vendorNotes: 'Any extra vendor comments',
};

function guessCustomField(label: string): Pick<RfqFieldDefinition, 'type' | 'showIn'> {
  const t = label.toLowerCase();
  if (/gst|price|freight|amount|cost|rate|charge/.test(t)) return { type: 'number', showIn: 'commercial' };
  if (/day|lead time|qty|quantity/.test(t)) return { type: 'number', showIn: 'technical' };
  if (/comply|compliance|included|available/.test(t)) return { type: 'boolean', showIn: 'technical' };
  if (/make|brand|hdg/.test(t)) return { type: 'text', showIn: 'commercial' };
  return { type: 'text', showIn: 'technical' };
}

interface Props {
  open: boolean;
  onToggle: () => void;
  fields: RfqFieldDefinition[];
  presets: RfqFieldDefinition[];
  onAdd: (field: RfqFieldDefinition) => void;
  onRemove: (fieldId: string) => void;
}

export default function RfqExtraQuestionsPanel({
  open,
  onToggle,
  fields,
  presets,
  onAdd,
  onRemove,
}: Props) {
  const [ownQuestion, setOwnQuestion] = useState('');

  const fieldIds = new Set(fields.map((f) => f.id));
  const customFields = fields.filter(
    (f) => f.id !== 'quotedPrice' && !f.core && !presets.some((p) => p.id === f.id)
  );
  const selectedCount = fields.filter((f) => f.id !== 'quotedPrice').length;
  const summary =
    selectedCount === 0
      ? 'Only price will be compared'
      : `${selectedCount} extra point${selectedCount === 1 ? '' : 's'} will be compared`;

  const addOwnQuestion = () => {
    const label = ownQuestion.trim();
    if (!label) return;
    const id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) || `field_${Date.now()}`;
    if (fieldIds.has(id)) {
      setOwnQuestion('');
      return;
    }
    const guessed = guessCustomField(label);
    onAdd({
      id,
      label,
      type: guessed.type,
      filledBy: 'vendor',
      showIn: guessed.showIn,
    });
    setOwnQuestion('');
  };

  const togglePreset = (preset: RfqFieldDefinition) => {
    if (fieldIds.has(preset.id)) onRemove(preset.id);
    else onAdd(preset);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-5 py-4">
      <button type="button" onClick={onToggle} className="w-full flex items-start justify-between gap-3 text-left">
        <div>
          <p className="text-sm font-semibold text-gray-900">What do you want to compare?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Price is always compared. Tick anything else you want to see side by side for every vendor.
          </p>
          <p className="text-xs text-teal-700 mt-1.5 font-medium">{summary}</p>
        </div>
        <i className={`${open ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} text-xl text-gray-400 mt-0.5`} />
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-5">
          <label className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/60 px-3 py-3">
            <input type="checkbox" checked disabled className="mt-0.5 w-4 h-4 accent-teal-600" />
            <span>
              <span className="block text-sm font-semibold text-gray-900">Quoted price</span>
              <span className="block text-xs text-gray-500">Always compared. You cannot turn this off.</span>
            </span>
          </label>

          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Tick what else to compare</p>
            <p className="text-xs text-gray-500 mb-3">Vendors will answer these on their quote. Untick to remove.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presets.map((p) => {
                const on = fieldIds.has(p.id);
                return (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                      on ? 'border-teal-300 bg-teal-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => togglePreset(p)}
                      className="mt-0.5 w-4 h-4 accent-teal-600"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">{p.label}</span>
                      <span className="block text-xs text-gray-500">{PRESET_HINTS[p.id] || 'Add to comparison'}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {customFields.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Your own questions</p>
              <div className="space-y-2">
                {customFields.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{f.label}</p>
                    <button
                      type="button"
                      onClick={() => onRemove(f.id)}
                      className="text-sm text-red-500 hover:text-red-700 font-medium shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-800 mb-1">Add your own question</p>
            <p className="text-xs text-gray-500 mb-2">Example: Installation included? or GST extra?</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={ownQuestion}
                onChange={(e) => setOwnQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addOwnQuestion();
                  }
                }}
                placeholder="Type a question"
                className="flex-1 h-11 px-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="button"
                onClick={addOwnQuestion}
                disabled={!ownQuestion.trim()}
                className="h-11 px-5 bg-[#12284A] text-white text-sm font-semibold rounded-xl disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
