import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  masterApi,
  prApi,
  fileToAttachmentPayload,
  CategoryRecord,
  DepartmentRecord,
  EntityRecord,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatMoney } from '../../constants/currency';

type ChatStep =
  | 'need'
  | 'qty_cost'
  | 'category'
  | 'more_items'
  | 'entity'
  | 'entity_missing'
  | 'entity_cost_center'
  | 'department'
  | 'department_missing'
  | 'request_type'
  | 'purchase_type'
  | 'required_date'
  | 'justification'
  | 'priority'
  | 'files_ask'
  | 'files_upload'
  | 'review'
  | 'done';

type Role = 'bot' | 'user';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

interface DraftItem {
  description: string;
  quantity: number;
  unitCost: number;
  category: string;
}

interface DraftFile {
  id: string;
  name: string;
  size: number;
  file: File;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function parseQtyCost(text: string): { quantity?: number; unitCost?: number } {
  const cleaned = text.replace(/,/g, '').trim();
  const qtyCost = cleaned.match(/(\d+(?:\.\d+)?)\s*(?:x|qty|quantity|nos|units?)?\s*(?:@|at|for|rs\.?|₹|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (qtyCost) {
    return { quantity: Number(qtyCost[1]), unitCost: Number(qtyCost[2]) };
  }
  const numbers = cleaned.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length >= 2) return { quantity: numbers[0], unitCost: numbers[1] };
  if (numbers.length === 1) {
    if (/qty|quantity|nos|units?/i.test(cleaned) || numbers[0] <= 500) {
      return { quantity: numbers[0] };
    }
    return { unitCost: numbers[0] };
  }
  return {};
}

function isYes(text: string) {
  return /^(y|yes|yeah|yep|ok|okay|sure|upload|add)$/i.test(text.trim());
}

function isNo(text: string) {
  return /^(n|no|nope|skip|later|not now)$/i.test(text.trim());
}

function entityLabel(entity: EntityRecord) {
  const base = entity.code ? `${entity.code} — ${entity.name}` : entity.name;
  return entity.costCenter ? `${base} (${entity.costCenter})` : base;
}

function matchEntities(list: EntityRecord[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, 8);
  return list
    .filter((entity) =>
      `${entity.code || ''} ${entity.name} ${entity.costCenter || ''}`.toLowerCase().includes(q)
    )
    .slice(0, 12);
}

function matchDepartments(list: DepartmentRecord[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, 8);
  return list
    .filter((dept) => `${dept.code || ''} ${dept.name}`.toLowerCase().includes(q))
    .slice(0, 12);
}

function findExactEntity(list: EntityRecord[], query: string) {
  const q = query.trim().toLowerCase();
  return (
    list.find((entity) => entityLabel(entity).toLowerCase() === q) ||
    list.find((entity) => entity.name.toLowerCase() === q) ||
    list.find((entity) => (entity.code || '').toLowerCase() === q) ||
    null
  );
}

function findExactDepartment(list: DepartmentRecord[], query: string) {
  const q = query.trim().toLowerCase();
  return (
    list.find((dept) => dept.name.toLowerCase() === q) ||
    list.find((dept) => (dept.code || '').toLowerCase() === q) ||
    null
  );
}

export default function PrChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ChatStep>('need');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'bot',
      text: 'Hi, I can create a Purchase Request for you. What do you need to buy?',
    },
  ]);
  const [title, setTitle] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [pendingItem, setPendingItem] = useState<Partial<DraftItem>>({});
  const [entityId, setEntityId] = useState<number | ''>('');
  const [department, setDepartment] = useState('');
  const [requestType, setRequestType] = useState<'Capex' | 'Opex' | 'Service'>('Opex');
  const [purchaseType, setPurchaseType] = useState<'purchase_order' | 'work_order'>('purchase_order');
  const [requiredDate, setRequiredDate] = useState('');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [entities, setEntities] = useState<EntityRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [pendingMasterName, setPendingMasterName] = useState('');
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ id: number; prNumber: string; submitted: boolean } | null>(null);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canUse = user?.role === 'Requester';

  useEffect(() => {
    const openBot = () => setOpen(true);
    window.addEventListener('p2p-open-pr-chat', openBot);
    return () => window.removeEventListener('p2p-open-pr-chat', openBot);
  }, []);

  useEffect(() => {
    if (!open || !canUse) return;
    (async () => {
      try {
        const [entRes, deptRes, catRes] = await Promise.all([
          masterApi.listEntities({ status: 'active' }),
          masterApi.listDepartments({ status: 'active' }),
          masterApi.listCategories({ status: 'active' }),
        ]);
        setEntities(entRes.data || []);
        setDepartments(deptRes.data || []);
        setCategories(catRes.data || []);
      } catch {
        /* masters optional until user picks */
      }
    })();
  }, [open, canUse]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, files, step, error, created]);

  const push = useCallback((role: Role, text: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, text }]);
  }, []);

  const ask = useCallback((next: ChatStep, text: string) => {
    setStep(next);
    push('bot', text);
  }, [push]);

  const selectedEntity = useMemo(
    () => (entityId === '' ? null : entities.find((e) => e.id === entityId) || null),
    [entities, entityId]
  );

  const entityMatches = useMemo(() => matchEntities(entities, input), [entities, input]);
  const departmentMatches = useMemo(() => matchDepartments(departments, input), [departments, input]);

  const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);

  const finishItem = useCallback((item: DraftItem) => {
    setItems((prev) => [...prev, item]);
    setPendingItem({});
    ask('more_items', `Added ${item.quantity} × ${item.description}. Add another item?`);
  }, [ask]);

  const goAfterItems = useCallback(() => {
    setPendingMasterName('');
    setInput('');
    ask('entity', 'Type your entity name. Matching companies will appear — tap one to select.');
  }, [ask]);

  const goToDepartment = useCallback(() => {
    setPendingMasterName('');
    setInput('');
    const hint = user?.departmentName ? ` Your profile department is ${user.departmentName}.` : '';
    ask('department', `Type your department name. Matching departments will appear — tap one to select.${hint}`);
  }, [ask, user?.departmentName]);

  const applyEntity = (entity: EntityRecord, announce = false) => {
    if (busy) return;
    setEntityId(entity.id);
    setPendingMasterName('');
    setInput('');
    if (announce) push('user', entityLabel(entity));
    goToDepartment();
  };

  const applyDepartment = (dept: DepartmentRecord, announce = false) => {
    if (busy) return;
    setDepartment(dept.name);
    setPendingMasterName('');
    setInput('');
    if (announce) push('user', dept.name);
    applyChoice('request_type', dept.name, () => setDepartment(dept.name));
  };

  const createPendingEntity = async (costCenter?: string) => {
    const name = pendingMasterName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      const res = await masterApi.chatCreateEntity({ name, costCenter: costCenter?.trim() || undefined });
      const createdEntity = res.data;
      setEntities((prev) => {
        if (prev.some((item) => item.id === createdEntity.id)) return prev;
        return [...prev, createdEntity].sort((a, b) => a.name.localeCompare(b.name));
      });
      setEntityId(createdEntity.id);
      setPendingMasterName('');
      setInput('');
      push('bot', `Created entity ${entityLabel(createdEntity)} and selected it.`);
      goToDepartment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create entity');
    } finally {
      setBusy(false);
    }
  };

  const createPendingDepartment = async () => {
    const name = pendingMasterName.trim();
    if (!name) return;
    setBusy(true);
    setError('');
    try {
      const res = await masterApi.chatCreateDepartment({ name });
      const createdDept = res.data;
      setDepartments((prev) => {
        if (prev.some((item) => item.id === createdDept.id)) return prev;
        return [...prev, createdDept].sort((a, b) => a.name.localeCompare(b.name));
      });
      setDepartment(createdDept.name);
      setPendingMasterName('');
      setInput('');
      push('bot', `Created department ${createdDept.name} and selected it.`);
      applyChoice('request_type', createdDept.name, () => setDepartment(createdDept.name));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create department');
    } finally {
      setBusy(false);
    }
  };

  const applyChoice = (next: ChatStep, _label: string, apply: () => void) => {
    if (busy) return;
    apply();
    const prompts: Partial<Record<ChatStep, string>> = {
      request_type: 'Is this Capex, Opex, or Service?',
      purchase_type: 'Do you need a Purchase Order or a Work Order?',
      required_date: 'By when do you need this? Use the date box or type YYYY-MM-DD.',
      justification: 'Why is this purchase needed? (business justification)',
      priority: 'What priority should I set?',
      files_ask: 'Do you want to upload FSD / supporting files now?',
    };
    const text = prompts[next];
    if (text) ask(next, text);
  };

  const handleFiles = (list: File[]) => {
    const allowed = /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png)$/i;
    const accepted = list.filter((f) => allowed.test(f.name) && f.size <= 10 * 1024 * 1024);
    if (!accepted.length) {
      setError('Use PDF, DOC, DOCX, XLS, XLSX, JPG or PNG under 10MB.');
      return;
    }
    setError('');
    setFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: uid(), name: file.name, size: file.size, file })),
    ]);
  };

  const createPr = async (submit: boolean) => {
    if (!entityId || !department || !items.length) {
      setError('Entity, department, and at least one item are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const safeRequestType =
        purchaseType === 'purchase_order' && requestType === 'Service' ? 'Opex' : requestType;
      const res = await prApi.create({
        title: title.trim() || items[0].description,
        requestType: safeRequestType,
        purchaseType,
        department,
        entityId: Number(entityId),
        priority,
        currency: 'INR',
        vendorSelection: 'scm',
        justification: justification.trim(),
        requiredDate,
        submit,
        lineItems: items.map((item) => ({
          description: item.description,
          category: item.category,
          quantity: item.quantity,
          unitCost: item.unitCost,
          unit: 'Nos',
        })),
      });
      const data = res.data as { id: number; prNumber: string };
      for (const item of files) {
        const payload = await fileToAttachmentPayload(item.file);
        await prApi.uploadAttachment(data.id, payload);
      }
      setCreated({ id: data.id, prNumber: data.prNumber, submitted: submit });
      setStep('done');
      push(
        'bot',
        submit
          ? `PR ${data.prNumber} submitted for L1 Manager approval${files.length ? ` with ${files.length} file(s)` : ''}.`
          : `Draft PR ${data.prNumber} saved${files.length ? ` with ${files.length} file(s)` : ''}. You can submit it later.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PR');
    } finally {
      setBusy(false);
    }
  };

  const resetChat = () => {
    setStep('need');
    setInput('');
    setTitle('');
    setItems([]);
    setPendingItem({});
    setEntityId('');
    setDepartment('');
    setPendingMasterName('');
    setRequestType('Opex');
    setPurchaseType('purchase_order');
    setRequiredDate('');
    setJustification('');
    setPriority('Medium');
    setFiles([]);
    setCreated(null);
    setError('');
    setMessages([
      {
        id: uid(),
        role: 'bot',
        text: 'Let’s create another PR. What do you need to buy?',
      },
    ]);
  };

  const handleSend = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || step === 'done' || step === 'review' || step === 'files_upload') return;
    setInput('');
    push('user', text);

    if (step === 'need') {
      setTitle(text);
      setPendingItem({ description: text });
      const parsed = parseQtyCost(text);
      if (parsed.quantity && parsed.unitCost) {
        setPendingItem({ description: text, quantity: parsed.quantity, unitCost: parsed.unitCost });
        ask('category', 'Which category is this item? Pick one or type the name.');
        return;
      }
      ask('qty_cost', 'How many, and what is the estimated unit cost? Example: 5 @ 12000');
      return;
    }

    if (step === 'qty_cost') {
      const parsed = parseQtyCost(text);
      const quantity = parsed.quantity ?? pendingItem.quantity;
      const unitCost = parsed.unitCost ?? pendingItem.unitCost;
      if (!quantity || !unitCost) {
        push('bot', 'Please send both quantity and unit cost, like 5 @ 12000.');
        return;
      }
      setPendingItem((prev) => ({ ...prev, quantity, unitCost }));
      ask('category', 'Which category is this item? Pick one or type the name.');
      return;
    }

    if (step === 'category') {
      const match =
        categories.find((c) => c.name.toLowerCase() === text.toLowerCase()) ||
        categories.find((c) => c.name.toLowerCase().includes(text.toLowerCase()));
      const category = match?.name || text;
      const item: DraftItem = {
        description: String(pendingItem.description || title || text),
        quantity: Number(pendingItem.quantity || 1),
        unitCost: Number(pendingItem.unitCost || 0),
        category,
      };
      finishItem(item);
      return;
    }

    if (step === 'more_items') {
      if (isYes(text)) {
        setPendingItem({});
        ask('need', 'What is the next item?');
        return;
      }
      goAfterItems();
      return;
    }

    if (step === 'entity') {
      const exact = findExactEntity(entities, text);
      if (exact) {
        applyEntity(exact);
        return;
      }
      const matches = matchEntities(entities, text);
      if (matches.length === 1) {
        applyEntity(matches[0]);
        return;
      }
      if (matches.length > 1) {
        setInput(text);
        push('bot', `I found ${matches.length} matching entities. Tap one below to select.`);
        return;
      }
      setPendingMasterName(text);
      ask(
        'entity_missing',
        `Entity "${text}" is not in master. Do you want me to create it?`
      );
      return;
    }

    if (step === 'entity_missing') {
      if (isYes(text)) {
        ask('entity_cost_center', `What cost center should I use for "${pendingMasterName}"? Type it, or say skip to auto-generate.`);
        return;
      }
      setPendingMasterName('');
      ask('entity', 'Okay. Type another entity name, or tap a match from the list.');
      return;
    }

    if (step === 'entity_cost_center') {
      if (isNo(text) || /skip|auto|generate/i.test(text)) {
        void createPendingEntity();
        return;
      }
      void createPendingEntity(text);
      return;
    }

    if (step === 'department') {
      const exact = findExactDepartment(departments, text);
      if (exact) {
        applyDepartment(exact);
        return;
      }
      const matches = matchDepartments(departments, text);
      if (matches.length === 1) {
        applyDepartment(matches[0]);
        return;
      }
      if (matches.length > 1) {
        setInput(text);
        push('bot', `I found ${matches.length} matching departments. Tap one below to select.`);
        return;
      }
      setPendingMasterName(text);
      ask(
        'department_missing',
        `Department "${text}" is not in master. Do you want me to create it?`
      );
      return;
    }

    if (step === 'department_missing') {
      if (isYes(text)) {
        void createPendingDepartment();
        return;
      }
      setPendingMasterName('');
      ask('department', 'Okay. Type another department name, or tap a match from the list.');
      return;
    }

    if (step === 'request_type') {
      const value = /capex/i.test(text) ? 'Capex' : /service/i.test(text) ? 'Service' : /opex/i.test(text) ? 'Opex' : null;
      if (!value) {
        push('bot', 'Please choose Capex, Opex, or Service.');
        return;
      }
      applyChoice('purchase_type', value, () => {
        setRequestType(value);
        if (value === 'Service') setPurchaseType('work_order');
      });
      return;
    }

    if (step === 'purchase_type') {
      const value = /work/i.test(text) ? 'work_order' : /purchase|po/i.test(text) ? 'purchase_order' : null;
      if (!value) {
        push('bot', 'Please choose Purchase Order or Work Order.');
        return;
      }
      applyChoice('required_date', value === 'work_order' ? 'Work Order' : 'Purchase Order', () => setPurchaseType(value));
      return;
    }

    if (step === 'required_date') {
      const date = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      if (!date) {
        push('bot', 'Please use a date like 2026-09-15, or pick from the date box.');
        return;
      }
      applyChoice('justification', date, () => setRequiredDate(date));
      return;
    }

    if (step === 'justification') {
      if (text.length < 8) {
        push('bot', 'Please add a bit more detail for the business justification.');
        return;
      }
      applyChoice('priority', text, () => setJustification(text));
      return;
    }

    if (step === 'priority') {
      const value = /critical/i.test(text)
        ? 'Critical'
        : /high/i.test(text)
          ? 'High'
          : /low/i.test(text)
            ? 'Low'
            : /medium/i.test(text)
              ? 'Medium'
              : null;
      if (!value) {
        push('bot', 'Please choose Low, Medium, High, or Critical.');
        return;
      }
      applyChoice('files_ask', value, () => setPriority(value));
      return;
    }

    if (step === 'files_ask') {
      if (isYes(text)) {
        ask('files_upload', 'Upload FSD or supporting files below. When finished, tap Done uploading.');
        return;
      }
      setStep('review');
      push('bot', 'No files added. Review the PR below, then save as draft or submit.');
    }
  };

  if (!canUse) return null;

  const chips = (() => {
    if (step === 'category') return categories.slice(0, 8).map((c) => c.name);
    if (step === 'more_items') return ['Yes, add another', 'No, continue'];
    if (step === 'entity_missing' || step === 'department_missing') return ['Yes, create it', 'No, search again'];
    if (step === 'entity_cost_center') return ['Skip / auto-generate'];
    if (step === 'request_type') return ['Opex', 'Capex', 'Service'];
    if (step === 'purchase_type') return ['Purchase Order', 'Work Order'];
    if (step === 'priority') return ['Low', 'Medium', 'High', 'Critical'];
    if (step === 'files_ask') return ['Yes, upload files', 'Skip files'];
    return [];
  })();

  const onChip = (label: string) => {
    if (step === 'more_items') {
      handleSend(label.startsWith('Yes') ? 'yes' : 'no');
      return;
    }
    if (step === 'files_ask') {
      handleSend(label.startsWith('Yes') ? 'yes' : 'no');
      return;
    }
    if (step === 'entity_missing' || step === 'department_missing') {
      handleSend(label.startsWith('Yes') ? 'yes' : 'no');
      return;
    }
    if (step === 'entity_cost_center') {
      handleSend('skip');
      return;
    }
    if (step === 'purchase_type') {
      handleSend(label);
      return;
    }
    handleSend(label);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-3 py-3 sm:px-4 text-sm font-medium text-white shadow-lg hover:bg-slate-800 cursor-pointer"
          title="Create PR with AI"
        >
          <i className="ri-robot-2-line text-lg" />
          <span className="hidden sm:inline">Create PR with AI</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(680px,calc(100dvh-2rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">PR Assistant</p>
              <p className="text-[11px] text-slate-300">Ask questions → upload files → create PR</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close chatbot"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 border border-gray-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {step === 'entity' && (
              <div className="rounded-xl border border-gray-200 bg-white p-2">
                <p className="px-1 pb-1.5 text-[11px] font-medium text-slate-500">
                  {input.trim() ? `Matching entities (${entityMatches.length})` : 'Suggested entities — type to search'}
                </p>
                {entityMatches.length > 0 ? (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {entityMatches.map((entity) => (
                      <button
                        key={entity.id}
                        type="button"
                        disabled={busy}
                        onClick={() => applyEntity(entity, true)}
                        className="w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <p className="font-medium text-slate-800">{entity.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {[entity.code, entity.costCenter].filter(Boolean).join(' · ') || 'No code'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-2 text-xs text-amber-700">
                    No entity matches “{input.trim()}”. Press send and I will ask if you want to create it.
                  </p>
                )}
              </div>
            )}

            {step === 'department' && (
              <div className="rounded-xl border border-gray-200 bg-white p-2">
                <p className="px-1 pb-1.5 text-[11px] font-medium text-slate-500">
                  {input.trim() ? `Matching departments (${departmentMatches.length})` : 'Suggested departments — type to search'}
                </p>
                {departmentMatches.length > 0 ? (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {departmentMatches.map((dept) => (
                      <button
                        key={dept.id}
                        type="button"
                        disabled={busy}
                        onClick={() => applyDepartment(dept, true)}
                        className="w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-50 cursor-pointer"
                      >
                        <p className="font-medium text-slate-800">{dept.name}</p>
                        {dept.code ? <p className="text-[11px] text-gray-400">{dept.code}</p> : null}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-2 text-xs text-amber-700">
                    No department matches “{input.trim()}”. Press send and I will ask if you want to create it.
                  </p>
                )}
              </div>
            )}

            {step === 'required_date' && (
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  push('user', value);
                  applyChoice('justification', value, () => setRequiredDate(value));
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            )}

            {step === 'files_upload' && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(Array.from(e.dataTransfer.files || []));
                  }}
                  className="w-full rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <i className="ri-upload-cloud-2-line mr-1 text-lg" />
                  Drop or click to upload FSD / files
                  <span className="mt-1 block text-[11px] text-gray-400">PDF, DOC, XLS, JPG, PNG · 10MB each</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
                {files.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {files.map((file) => (
                      <div key={file.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
                        <i className="ri-file-text-line text-slate-500" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                          <p className="text-[11px] text-gray-400">{formatSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFiles((prev) => prev.filter((f) => f.id !== file.id))}
                          className="text-red-400 hover:text-red-600 cursor-pointer"
                        >
                          <i className="ri-close-line" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setStep('review');
                    push(
                      'user',
                      files.length ? `Uploaded ${files.length} file(s)` : 'No files added'
                    );
                    push('bot', 'Review the PR below, then save as draft or submit.');
                  }}
                  className="mt-3 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white cursor-pointer"
                >
                  Done uploading
                </button>
              </div>
            )}

            {step === 'review' && (
              <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <p className="mb-2 font-semibold text-slate-900">PR preview</p>
                <dl className="space-y-1 text-xs text-slate-600">
                  <div><span className="text-gray-400">Title: </span>{title || items[0]?.description}</div>
                  <div><span className="text-gray-400">Entity: </span>{selectedEntity ? `${selectedEntity.code || ''} ${selectedEntity.name}`.trim() : '—'}</div>
                  <div><span className="text-gray-400">Department: </span>{department || '—'}</div>
                  <div><span className="text-gray-400">Type: </span>{requestType} · {purchaseType === 'work_order' ? 'Work Order' : 'Purchase Order'}</div>
                  <div><span className="text-gray-400">Needed by: </span>{requiredDate || '—'}</div>
                  <div><span className="text-gray-400">Priority: </span>{priority}</div>
                  <div><span className="text-gray-400">Files: </span>{files.length ? files.map((f) => f.name).join(', ') : 'None'}</div>
                </dl>
                <ul className="mt-2 space-y-1 text-xs">
                  {items.map((item, i) => (
                    <li key={`${item.description}-${i}`} className="rounded-lg bg-slate-50 px-2 py-1.5">
                      {item.quantity} × {item.description} · {item.category} · {formatMoney(item.quantity * item.unitCost)}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm font-semibold text-slate-900">Total {formatMoney(totalAmount)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => createPr(false)}
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => createPr(true)}
                    className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? 'Creating…' : 'Submit PR'}
                  </button>
                </div>
              </div>
            )}

            {created && (
              <div className="flex gap-2">
                <Link
                  to={`/requester/edit-pr/${created.id}`}
                  className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-xs font-medium text-slate-700 border border-gray-200"
                >
                  Open PR form
                </Link>
                <Link
                  to="/requester/track-pr"
                  className="flex-1 rounded-lg bg-teal-600 px-3 py-2 text-center text-xs font-medium text-white"
                >
                  Track PR
                </Link>
              </div>
            )}

            {step === 'done' && (
              <button
                type="button"
                onClick={resetChat}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Create another PR
              </button>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>

          {chips.length > 0 && step !== 'review' && step !== 'done' && (
            <div className="flex flex-wrap gap-1.5 border-t border-gray-100 bg-white px-3 py-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => onChip(chip)}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || step === 'review' || step === 'done' || step === 'files_upload'}
              placeholder={
                step === 'entity'
                  ? 'Type entity name to search…'
                  : step === 'department'
                    ? 'Type department name to search…'
                    : step === 'entity_cost_center'
                      ? 'Cost center or skip'
                    : step === 'files_upload'
                      ? 'Upload files above'
                      : step === 'review'
                        ? 'Review and submit above'
                        : 'Type your answer…'
              }
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-300 disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim() || step === 'review' || step === 'done' || step === 'files_upload'}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white disabled:opacity-40 cursor-pointer"
            >
              <i className="ri-send-plane-2-fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
