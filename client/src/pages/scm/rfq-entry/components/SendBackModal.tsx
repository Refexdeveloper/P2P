import { useState } from 'react';

interface SendBackModalProps {
  vendorName: string;
  currentRound: number;
  onConfirm: (reason: string, fields: string[]) => void;
  onClose: () => void;
}

const clarificationFields = [
  'Price too high — need better rates',
  'Lead time not acceptable',
  'Payment terms need revision',
  'Technical specifications incomplete',
  'Compliance documents missing',
  'Warranty terms unclear',
  'Delivery terms need clarification',
  'Need itemized cost breakdown',
];

export default function SendBackModal({ vendorName, currentRound, onConfirm, onClose }: SendBackModalProps) {
  const [reason, setReason] = useState('');
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const toggleField = (field: string) => {
    setSelectedFields(prev =>
      prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field],
    );
  };

  const handleConfirm = () => {
    if (!reason.trim() && selectedFields.length === 0) return;
    onConfirm(reason, selectedFields);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center bg-amber-100 rounded-lg">
              <i className="ri-send-backward text-amber-600 text-base"></i>
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Send Back for Re-quote</h3>
              <p className="text-xs text-gray-500">{vendorName} — Round {currentRound} → Round {currentRound + 1}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Clarification checkboxes */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Clarification Required On</p>
            <div className="grid grid-cols-2 gap-2">
              {clarificationFields.map(field => (
                <label
                  key={field}
                  className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors text-xs ${
                    selectedFields.includes(field)
                      ? 'border-amber-400 bg-amber-50 text-amber-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFields.includes(field)}
                    onChange={() => toggleField(field)}
                    className="mt-0.5 accent-amber-500 cursor-pointer"
                  />
                  {field}
                </label>
              ))}
            </div>
          </div>

          {/* Reason textarea */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Additional Comments <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="e.g., Please revise your price to be competitive with market rates and include a full itemized breakdown..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 resize-none"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{reason.length}/500</p>
          </div>

          {/* Round info pill */}
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3">
            <i className="ri-information-line text-teal-600"></i>
            <p className="text-xs text-teal-700">
              Current <span className="font-semibold">Round {currentRound}</span> will be archived. A new editable{' '}
              <span className="font-semibold">Round {currentRound + 1}</span> will be created.
            </p>
          </div>
        </div>

        <div className="px-6 pb-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium whitespace-nowrap cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedFields.length === 0 && !reason.trim()}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium whitespace-nowrap cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <i className="ri-send-backward"></i>
            Send Back for Round {currentRound + 1}
          </button>
        </div>
      </div>
    </div>
  );
}
