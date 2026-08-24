import { useMemo, useState } from 'react';
import { CategoryRecord, DepartmentRecord, EntityRecord, ItemRecord } from '../../../services/api';
import { CurrencyCode, formatMoney } from '../../../constants/currency';
import {
  ConversationLineItem,
  FIELD_LABELS,
  LINE_ITEM_QUESTIONS,
  LineItemField,
  PR_HEADER_QUESTIONS,
  PrConversationAnswers,
  PrHeaderField,
  emptyConversationLineItem,
  formatHeaderAnswer,
  requestTypeChoices,
} from './prConversationConfig';
import ItemCombobox from './ItemCombobox';
import DepartmentCombobox from './DepartmentCombobox';
import CategoryCombobox from './CategoryCombobox';
import SearchCreateField from './SearchCreateField';

type Step =
  | { type: 'q'; index: number }
  | { type: 'add-items' }
  | { type: 'line'; itemIndex: number; qIndex: number }
  | { type: 'another'; itemIndex: number }
  | { type: 'summary' };

type ChatMsg = { id: string; role: 'bot' | 'user'; text: string };

export interface PrConversationResult {
  answers: PrConversationAnswers;
  skipped: PrHeaderField[];
  lineItems: ConversationLineItem[];
}

interface Props {
  entities: EntityRecord[];
  departments: DepartmentRecord[];
  masterItems: ItemRecord[];
  masterCategories: CategoryRecord[];
  formatEntityLabel: (ent: EntityRecord) => string;
  onConfirm: (result: PrConversationResult) => void;
  onSwitchToForm: () => void;
  onMasterItemCreated?: (item: ItemRecord) => void;
  onDepartmentCreated?: (department: DepartmentRecord) => void;
  onCategoryCreated?: (category: CategoryRecord) => void;
}

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white';

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

export default function PrConversationFlow({
  entities,
  departments,
  masterItems,
  masterCategories,
  formatEntityLabel,
  onConfirm,
  onSwitchToForm,
  onMasterItemCreated,
  onDepartmentCreated,
  onCategoryCreated,
}: Props) {
  const [step, setStep] = useState<Step>({ type: 'q', index: 0 });
  const [history, setHistory] = useState<Step[]>([]);
  const [answers, setAnswers] = useState<PrConversationAnswers>({});
  const [skipped, setSkipped] = useState<PrHeaderField[]>([]);
  const [lineItems, setLineItems] = useState<ConversationLineItem[]>([]);
  const [draftItem, setDraftItem] = useState<ConversationLineItem>(emptyConversationLineItem());
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'intro',
      role: 'bot',
      text: `Let's create your purchase request. I'll ask a few questions one by one.\n\n${PR_HEADER_QUESTIONS[0].question}`,
    },
  ]);

  const currentHeader = step.type === 'q' ? PR_HEADER_QUESTIONS[step.index] : null;
  const currentLineQ = step.type === 'line' ? LINE_ITEM_QUESTIONS[step.qIndex] : null;

  const entityLabel = useMemo(() => {
    if (!answers.entityId) return '';
    const ent = entities.find((e) => e.id === answers.entityId);
    return ent ? formatEntityLabel(ent) : '';
  }, [answers.entityId, entities, formatEntityLabel]);

  const requestOptions = requestTypeChoices(answers.purchaseType);

  const go = (next: Step) => {
    setHistory((h) => [...h, step]);
    setStep(next);
    setDraft('');
  };

  const pushBot = (text: string) => {
    setMessages((m) => [...m, { id: `${Date.now()}-b`, role: 'bot', text }]);
  };

  const pushUser = (text: string) => {
    setMessages((m) => [...m, { id: `${Date.now()}-u`, role: 'user', text }]);
  };

  const afterHeader = (fromIndex: number) => {
    const nextIndex = fromIndex + 1;
    if (nextIndex < PR_HEADER_QUESTIONS.length) {
      go({ type: 'q', index: nextIndex });
      pushBot(PR_HEADER_QUESTIONS[nextIndex].question);
      return;
    }
    go({ type: 'add-items' });
    pushBot('Do you want to add line items?');
  };

  const startLineItem = (itemIndex: number) => {
    const item = emptyConversationLineItem();
    setDraftItem(item);
    go({ type: 'line', itemIndex, qIndex: 0 });
    pushBot(`Line item ${itemIndex + 1}. ${LINE_ITEM_QUESTIONS[0].question}`);
  };

  const afterLineQuestion = (itemIndex: number, qIndex: number, item: ConversationLineItem) => {
    const nextQ = qIndex + 1;
    if (nextQ < LINE_ITEM_QUESTIONS.length) {
      go({ type: 'line', itemIndex, qIndex: nextQ });
      pushBot(LINE_ITEM_QUESTIONS[nextQ].question);
      return;
    }
    setLineItems((prev) => {
      const copy = [...prev];
      copy[itemIndex] = item;
      return copy;
    });
    go({ type: 'another', itemIndex });
    pushBot('Do you want to add another line item?');
  };

  const showSummary = () => {
    go({ type: 'summary' });
    pushBot('Here is your purchase request summary. Review it, then Confirm & Create, or Edit to change answers.');
  };

  const applyHeaderValue = (field: PrHeaderField, value: string | number | '', skippedField: boolean) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (skippedField) {
        if (field === 'entityId') next.entityId = '';
        else if (field === 'purchaseType') delete next.purchaseType;
        else if (field === 'requestType') delete next.requestType;
        else if (field === 'vendorSelection') delete next.vendorSelection;
        else if (field === 'currency') delete next.currency;
        else (next as Record<string, unknown>)[field] = '';
        return next;
      }
      if (field === 'entityId') next.entityId = value === '' ? '' : Number(value);
      else if (field === 'purchaseType') {
        next.purchaseType = value === 'work_order' ? 'work_order' : 'purchase_order';
        if (next.purchaseType === 'purchase_order' && next.requestType === 'Service') {
          next.requestType = 'Opex';
        }
      } else if (field === 'requestType') next.requestType = value as 'Capex' | 'Opex' | 'Service';
      else if (field === 'vendorSelection') next.vendorSelection = value === 'own' ? 'own' : 'scm';
      else if (field === 'currency') next.currency = value as CurrencyCode;
      else (next as Record<string, unknown>)[field] = String(value);
      return next;
    });
    setSkipped((prev) => (skippedField ? Array.from(new Set([...prev, field])) : prev.filter((f) => f !== field)));
  };

  const displayHeaderValue = (field: PrHeaderField, raw: string) => {
    if (field === 'entityId') {
      const ent = entities.find((e) => String(e.id) === raw);
      return ent ? formatEntityLabel(ent) : raw;
    }
    const q = PR_HEADER_QUESTIONS.find((x) => x.field === field);
    const opt = q?.options?.find((o) => o.value === raw);
    if (opt) return opt.label;
    if (field === 'requestType') return requestOptions.find((o) => o.value === raw)?.label || raw;
    return raw;
  };

  const continueHeader = (raw: string, skippedField: boolean) => {
    if (!currentHeader) return;
    applyHeaderValue(currentHeader.field, raw, skippedField);
    pushUser(skippedField ? 'Skipped' : displayHeaderValue(currentHeader.field, raw));
    afterHeader(step.type === 'q' ? step.index : 0);
  };

  const applyLineValue = (field: LineItemField, raw: string, skippedField: boolean): ConversationLineItem => {
    const next = { ...draftItem };
    if (field === 'itemId') {
      if (skippedField || !raw) {
        next.itemId = null;
        next.itemName = '';
      } else {
        const master = masterItems.find((m) => String(m.id) === raw);
        if (master) {
          next.itemId = master.id;
          next.itemName = master.name;
          next.description = next.description || master.description || master.name;
          next.category = next.category || master.categoryName || '';
          next.unit = master.unit || 'Nos';
          next.hsnCode = master.hsnCode || '';
          next.gstPercentage = Number(master.gstPercentage ?? 18);
        }
      }
    } else if (field === 'description') {
      next.description = skippedField ? '' : raw;
    } else if (field === 'category') {
      next.category = skippedField ? '' : raw;
    } else if (field === 'quantity') {
      next.quantity = skippedField ? 0 : Math.max(0, Number(raw) || 0);
    } else if (field === 'estimatedCost') {
      next.estimatedCost = skippedField ? 0 : Math.max(0, Number(raw) || 0);
    }
    setDraftItem(next);
    return next;
  };

  const continueLine = (raw: string, skippedField: boolean) => {
    if (step.type !== 'line' || !currentLineQ) return;
    const item = applyLineValue(currentLineQ.field, raw, skippedField);
    let shown = raw;
    if (currentLineQ.field === 'itemId' && !skippedField) {
      const master = masterItems.find((m) => String(m.id) === raw);
      shown = master ? `${master.name}${master.itemCode ? ` (${master.itemCode})` : ''}` : raw;
    }
    pushUser(skippedField ? 'Skipped' : shown);
    afterLineQuestion(step.itemIndex, step.qIndex, item);
  };

  const choiceOptions = currentHeader?.field === 'requestType' ? requestOptions : currentHeader?.options || [];

  const prefillForHeader = () => {
    if (!currentHeader) return '';
    const field = currentHeader.field;
    if (field === 'entityId') return answers.entityId === '' || answers.entityId == null ? '' : String(answers.entityId);
    const value = answers[field];
    return value == null ? '' : String(value);
  };

  const prefillForLine = () => {
    if (!currentLineQ) return '';
    const field = currentLineQ.field;
    if (field === 'itemId') return draftItem.itemId ? String(draftItem.itemId) : '';
    if (field === 'quantity') return draftItem.quantity ? String(draftItem.quantity) : '';
    if (field === 'estimatedCost') return draftItem.estimatedCost ? String(draftItem.estimatedCost) : '';
    return String(draftItem[field] || '');
  };

  const headerValue = () => (draft !== '' ? draft : prefillForHeader());
  const lineValue = () => (draft !== '' ? draft : prefillForLine());

  const handleNext = () => {
    if (step.type === 'q' && currentHeader) {
      const value = headerValue();
      if (!String(value).trim()) return;
      continueHeader(String(value), false);
      return;
    }
    if (step.type === 'line' && currentLineQ) {
      const value = lineValue();
      if (!String(value).trim()) return;
      continueLine(String(value), false);
    }
  };

  const handleSkip = () => {
    if (step.type === 'q' && currentHeader) {
      continueHeader('', true);
      return;
    }
    if (step.type === 'line' && currentLineQ) {
      continueLine('', true);
    }
  };

  const handleBack = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setStep(prev);
    setDraft('');
    setMessages((m) => {
      if (m.length <= 1) return m;
      const copy = [...m];
      if (copy[copy.length - 1]?.role === 'bot') copy.pop();
      if (copy[copy.length - 1]?.role === 'user') copy.pop();
      return copy.length ? copy : m.slice(0, 1);
    });
  };

  const handleEdit = () => {
    setHistory([]);
    setStep({ type: 'q', index: 0 });
    setDraft('');
    setMessages([
      {
        id: 'edit',
        role: 'bot',
        text: `Let's review your answers. You can change any field, including ones you skipped.\n\n${PR_HEADER_QUESTIONS[0].question}`,
      },
    ]);
  };

  const activeDraft = step.type === 'q' ? headerValue() : step.type === 'line' ? lineValue() : draft;

  const skippedLabels = skipped.filter((f) => !formatHeaderAnswer(f, answers, entityLabel)).map((f) => FIELD_LABELS[f]);

  const currency = answers.currency || 'INR';

  const renderInput = () => {
    if (step.type === 'add-items') {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              pushUser('Yes, add line item');
              startLineItem(lineItems.length);
            }}
            className="px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700"
          >
            Yes, Add Line Item
          </button>
          <button
            type="button"
            onClick={() => {
              pushUser('No');
              showSummary();
            }}
            className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"
          >
            No
          </button>
        </div>
      );
    }

    if (step.type === 'another') {
      return (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              pushUser('Yes');
              if (step.type === 'another') startLineItem(step.itemIndex + 1);
            }}
            className="px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              pushUser('No');
              showSummary();
            }}
            className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"
          >
            No
          </button>
        </div>
      );
    }

    if (currentHeader?.input === 'choice' || (currentHeader?.field === 'requestType')) {
      return (
        <div className="flex flex-wrap gap-2">
          {choiceOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                setDraft(opt.value);
                continueHeader(opt.value, false);
              }}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold border ${
                prefillForHeader() === opt.value
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      );
    }

    if (currentHeader?.input === 'entity') {
      const selected = entities.find((ent) => String(ent.id) === String(activeDraft));
      return (
        <SearchCreateField
          options={entities.map((ent) => ({
            id: ent.id,
            label: formatEntityLabel(ent),
            subLabel: ent.costCenter || undefined,
          }))}
          displayValue={selected ? formatEntityLabel(selected) : ''}
          selectedId={selected?.id}
          placeholder="Search entity by code, name, cost center…"
          addNoun="entity"
          onSelect={(opt) => setDraft(String(opt.id))}
          onClear={() => setDraft('')}
        />
      );
    }

    if (currentHeader?.input === 'department') {
      return (
        <DepartmentCombobox
          departments={departments}
          selectedName={activeDraft}
          onSelect={(dept) => setDraft(dept.name)}
          onClear={() => setDraft('')}
          onCreated={(created) => {
            onDepartmentCreated?.(created);
            setDraft(created.name);
          }}
        />
      );
    }

    if (currentHeader?.input === 'date') {
      return (
        <input
          type="date"
          min={todayIso()}
          className={inputClass}
          value={activeDraft}
          onChange={(e) => setDraft(e.target.value)}
        />
      );
    }

    if (currentHeader?.input === 'textarea') {
      return (
        <textarea
          rows={4}
          className={`${inputClass} resize-none`}
          value={activeDraft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your answer"
        />
      );
    }

    if (currentLineQ?.input === 'item') {
      const pickItem = (master: ItemRecord) => {
        setDraftItem((prev) => ({
          ...prev,
          itemId: master.id,
          itemName: master.name,
          description: prev.description || master.description || master.name,
          category: prev.category || master.categoryName || '',
          unit: master.unit || 'Nos',
          hsnCode: master.hsnCode || '',
          gstPercentage: Number(master.gstPercentage ?? 18),
        }));
        setDraft(String(master.id));
      };
      return (
        <ItemCombobox
          items={masterItems}
          selectedId={draftItem.itemId}
          selectedName={draftItem.itemName}
          categoryId={masterCategories.find((c) => c.name === draftItem.category)?.id || null}
          onSelect={pickItem}
          onClear={() => {
            applyLineValue('itemId', '', true);
            setDraft('');
          }}
          onCreated={(created) => {
            onMasterItemCreated?.(created);
            pickItem(created);
          }}
        />
      );
    }

    if (currentLineQ?.input === 'category') {
      return (
        <CategoryCombobox
          categories={masterCategories}
          selectedName={activeDraft}
          requestType={answers.requestType}
          onSelect={(cat) => setDraft(cat.name)}
          onClear={() => setDraft('')}
          onCreated={(created) => {
            onCategoryCreated?.(created);
            setDraft(created.name);
          }}
        />
      );
    }

    if (currentLineQ?.input === 'number' || currentHeader?.input === 'number') {
      return (
        <input
          type="number"
          min={currentLineQ?.field === 'quantity' ? 1 : 0}
          step={currentLineQ?.field === 'estimatedCost' ? '0.01' : '1'}
          className={inputClass}
          value={draft || activeDraft}
          onChange={(e) => setDraft(e.target.value)}
        />
      );
    }

    if (currentLineQ?.input === 'textarea') {
      return (
        <textarea
          rows={3}
          className={`${inputClass} resize-none`}
          value={draft || activeDraft}
          onChange={(e) => setDraft(e.target.value)}
        />
      );
    }

    if (currentHeader?.input === 'text') {
      return (
        <input
          type="text"
          className={inputClass}
          value={activeDraft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type your answer"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleNext();
          }}
        />
      );
    }

    return null;
  };

  const showNav = step.type === 'q' || step.type === 'line';
  const questionText =
    currentHeader?.question ||
    currentLineQ?.question ||
    (step.type === 'add-items' ? 'Do you want to add line items?' : '') ||
    (step.type === 'another' ? 'Do you want to add another line item?' : '');

  const progressTotal = PR_HEADER_QUESTIONS.length + 1 + Math.max(lineItems.length, 1) * LINE_ITEM_QUESTIONS.length;
  const progressDone =
    step.type === 'q'
      ? step.index
      : step.type === 'add-items'
        ? PR_HEADER_QUESTIONS.length
        : step.type === 'line'
          ? PR_HEADER_QUESTIONS.length + 1 + step.itemIndex * LINE_ITEM_QUESTIONS.length + step.qIndex
          : progressTotal;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Conversational Mode</h2>
          <p className="text-xs text-gray-500">Answer one question at a time. Nothing is created until you confirm.</p>
        </div>
        <button
          type="button"
          onClick={onSwitchToForm}
          className="text-xs font-semibold text-teal-700 hover:text-teal-900"
        >
          Switch to Normal Form
        </button>
      </div>

      <div className="h-1.5 bg-gray-100">
        <div
          className="h-full bg-teal-600 transition-all"
          style={{ width: `${Math.min(100, Math.round((progressDone / progressTotal) * 100))}%` }}
        />
      </div>

      <div className="p-6 space-y-4 max-h-[520px] overflow-y-auto bg-slate-50/40">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-teal-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {step.type !== 'summary' && (
        <div className="p-6 border-t border-gray-100 space-y-4">
          {questionText && <p className="text-sm font-semibold text-gray-900">{questionText}</p>}
          {renderInput()}
          {(step.type === 'add-items' || step.type === 'another') && (
            <button
              type="button"
              onClick={handleBack}
              disabled={history.length === 0}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40"
            >
              Back
            </button>
          )}
          {showNav && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBack}
                disabled={history.length === 0}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="px-4 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50"
              >
                Skip
              </button>
              {(currentHeader?.input !== 'choice' && currentHeader?.field !== 'requestType') || currentLineQ ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2.5 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700"
                >
                  Next
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {step.type === 'summary' && (
        <div className="p-6 border-t border-gray-100 space-y-5">
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-3">Purchase Request Summary</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {PR_HEADER_QUESTIONS.map((q) => {
                const value = formatHeaderAnswer(q.field, answers, entityLabel);
                return (
                  <div key={q.field} className="flex justify-between gap-3 border-b border-gray-50 py-1.5">
                    <dt className="text-gray-500">{FIELD_LABELS[q.field]}</dt>
                    <dd className="font-medium text-gray-900 text-right">
                      {value || <span className="text-amber-600 font-normal">Skipped</span>}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>

          {skippedLabels.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-800 mb-2">Skipped Fields</p>
              <ul className="text-sm text-amber-800 list-disc pl-5 space-y-0.5">
                {skippedLabels.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
              <p className="text-xs text-amber-700 mt-2">You can fill these later with Edit, or on the form after confirm.</p>
            </div>
          )}

          <div>
            <p className="text-sm font-semibold text-gray-900 mb-2">Line Items</p>
            {lineItems.length === 0 ? (
              <p className="text-sm text-gray-500">No line items added</p>
            ) : (
              <ol className="space-y-3">
                {lineItems.map((item, i) => (
                  <li key={item.id} className="border border-gray-200 rounded-xl p-3 text-sm">
                    <p className="font-semibold text-gray-900">
                      {i + 1}. {item.itemName || item.description || 'Item'}
                    </p>
                    {item.description && item.description !== item.itemName && (
                      <p className="text-gray-600 mt-0.5">{item.description}</p>
                    )}
                    <p className="text-gray-600 mt-1">
                      Quantity: {item.quantity} · Unit Price:{' '}
                      {formatMoney(item.estimatedCost, currency, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {item.category ? ` · Category: ${item.category}` : ''}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEdit}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onConfirm({ answers, skipped, lineItems })}
              className="px-4 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700"
            >
              Confirm & Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
