import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { rfqApi, VendorRecord, RfqFieldDefinition } from '../../services/api';
import { formatMoney } from '../../constants/currency';

type ChatStep = 'vendor' | 'vendor_missing' | 'vendor_email' | 'file' | 'price' | 'review' | 'done';
type Role = 'bot' | 'user';

interface ChatMessage {
  id: string;
  role: Role;
  text: string;
}

export interface RfqChatVendorRow {
  invitationId: number;
  vendorName: string;
  hasActiveQuote?: boolean;
}

export interface RfqChatLineItem {
  id: number | string;
  description: string;
  quantity: number;
  unitCost?: number;
}

interface RfqChatbotProps {
  prId: number;
  prNumber?: string;
  isFinalized?: boolean;
  vendors: VendorRecord[];
  tableRows: RfqChatVendorRow[];
  lineItems: RfqChatLineItem[];
  fieldDefinitions?: RfqFieldDefinition[];
  onRefresh: () => Promise<void> | void;
  onToast?: (message: string) => void;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isYes(text: string) {
  return /^(y|yes|yeah|yep|ok|okay|sure)$/i.test(text.trim());
}

function isNo(text: string) {
  return /^(n|no|nope|skip|later)$/i.test(text.trim());
}

function matchVendors(list: VendorRecord[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return list.slice(0, 8);
  return list
    .filter((v) => `${v.name} ${v.vendorCode || ''} ${v.email || ''}`.toLowerCase().includes(q))
    .slice(0, 12);
}

function parseAmount(text: string) {
  const cleaned = text.replace(/[,₹$]/g, '').trim();
  const n = Number(cleaned.match(/[\d.]+/)?.[0]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',').pop() || '' : result);
    };
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export default function RfqChatbot({
  prId,
  prNumber,
  isFinalized,
  vendors,
  tableRows,
  lineItems,
  fieldDefinitions = [],
  onRefresh,
  onToast,
}: RfqChatbotProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ChatStep>('vendor');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: uid(),
      role: 'bot',
      text: `I can upload an RFQ quotation for ${prNumber || 'this PR'}. Which vendor is this quote from? Type the name to search.`,
    },
  ]);
  const [vendor, setVendor] = useState<VendorRecord | { name: string; email: string } | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [quotedPrice, setQuotedPrice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openBot = () => {
      if (!isFinalized) setOpen(true);
    };
    window.addEventListener('p2p-open-rfq-chat', openBot);
    return () => window.removeEventListener('p2p-open-rfq-chat', openBot);
  }, [isFinalized]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, file, step, error]);

  const push = useCallback((role: Role, text: string) => {
    setMessages((prev) => [...prev, { id: uid(), role, text }]);
  }, []);

  const ask = useCallback(
    (next: ChatStep, text: string) => {
      setStep(next);
      push('bot', text);
    },
    [push]
  );

  const vendorMatches = useMemo(() => matchVendors(vendors, input), [vendors, input]);

  const invited = useMemo(() => {
    const name = (vendor?.name || '').toLowerCase();
    return tableRows.find((row) => row.vendorName.toLowerCase() === name) || null;
  }, [tableRows, vendor]);

  const resetChat = () => {
    setStep('vendor');
    setInput('');
    setVendor(null);
    setPendingName('');
    setFile(null);
    setQuotedPrice(0);
    setError('');
    setMessages([
      {
        id: uid(),
        role: 'bot',
        text: 'Let’s upload another quotation. Which vendor is this from?',
      },
    ]);
  };

  const applyVendor = (next: VendorRecord | { name: string; email: string }, announce = false) => {
    setVendor(next);
    setPendingName('');
    setInput('');
    if (announce) push('user', next.name);
    ask('file', `Selected ${next.name}. Upload the quotation PDF or image (max 5MB).`);
  };

  const handleFiles = (list: File[]) => {
    const picked = list.find((f) => /\.(pdf|png|jpe?g)$/i.test(f.name) && f.size <= 5 * 1024 * 1024);
    if (!picked) {
      setError('Use a PDF, JPG, or PNG under 5MB.');
      return;
    }
    setError('');
    setFile(picked);
  };

  const saveQuote = async () => {
    if (!vendor || !file || !quotedPrice) {
      setError('Vendor, file, and quoted amount are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      let invitationId = invited?.invitationId;
      if (!invitationId) {
        const inviteRes = await rfqApi.invite(
          prId,
          [{ name: vendor.name, email: vendor.email || '' }],
          fieldDefinitions,
          false
        );
        const rows = ((inviteRes.data as { tableRows?: RfqChatVendorRow[] })?.tableRows || []) as RfqChatVendorRow[];
        const row =
          rows.find((r) => r.vendorName.toLowerCase() === vendor.name.toLowerCase()) || rows[rows.length - 1];
        invitationId = row?.invitationId;
      }
      if (!invitationId) throw new Error('Could not add vendor to this RFQ');

      const quotationFileData = await fileToBase64(file);
      const quoteLineItems = lineItems.map((li, index) => {
        const qty = Number(li.quantity) || 1;
        const prTotal = lineItems.reduce(
          (sum, item) => sum + (Number(item.quantity) || 1) * (Number(item.unitCost) || 0),
          0
        );
        const share =
          prTotal > 0
            ? (quotedPrice * ((Number(li.quantity) || 1) * (Number(li.unitCost) || 0))) / prTotal
            : quotedPrice / Math.max(lineItems.length, 1);
        const unit = index === lineItems.length - 1 && lineItems.length > 1
          ? 0
          : share / qty;
        return {
          lineItemId: String(li.id),
          description: li.description,
          quantity: qty,
          quotedUnitPrice: unit,
          quotedTotal: unit * qty,
        };
      });
      if (quoteLineItems.length > 1) {
        const used = quoteLineItems.slice(0, -1).reduce((sum, l) => sum + l.quotedTotal, 0);
        const last = quoteLineItems[quoteLineItems.length - 1];
        last.quotedTotal = Math.max(0.01, quotedPrice - used);
        last.quotedUnitPrice = last.quotedTotal / last.quantity;
      }

      await rfqApi.manualSubmit(invitationId, {
        quotedPrice,
        quoteLineItems,
        quotationFileName: file.name,
        quotationFileData,
        vendorNotes: 'Uploaded via RFQ AI chatbot',
        paymentTerms: 'Net 30',
        compliance: true,
      });

      await onRefresh();
      onToast?.(`Quotation uploaded for ${vendor.name}`);
      setStep('done');
      push('bot', `Saved ${vendor.name} quotation ${formatMoney(quotedPrice)} with file ${file.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload quotation');
    } finally {
      setBusy(false);
    }
  };

  const handleSend = (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy || step === 'file' || step === 'review' || step === 'done') return;
    setInput('');
    push('user', text);

    if (step === 'vendor') {
      const exact =
        vendors.find((v) => v.name.toLowerCase() === text.toLowerCase()) ||
        vendors.find((v) => (v.vendorCode || '').toLowerCase() === text.toLowerCase());
      if (exact) {
        applyVendor(exact);
        return;
      }
      const matches = matchVendors(vendors, text);
      if (matches.length === 1) {
        applyVendor(matches[0]);
        return;
      }
      if (matches.length > 1) {
        setInput(text);
        push('bot', `I found ${matches.length} vendors. Tap one below to select.`);
        return;
      }
      setPendingName(text);
      ask('vendor_missing', `Vendor "${text}" is not in vendor master. Create a manual RFQ vendor with this name?`);
      return;
    }

    if (step === 'vendor_missing') {
      if (isYes(text)) {
        ask('vendor_email', `What email should I use for "${pendingName}"?`);
        return;
      }
      setPendingName('');
      ask('vendor', 'Okay. Type another vendor name, or tap a match from the list.');
      return;
    }

    if (step === 'vendor_email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        push('bot', 'Please enter a valid email address.');
        return;
      }
      applyVendor({ name: pendingName, email: text });
      return;
    }

    if (step === 'price') {
      const amount = parseAmount(text);
      if (!amount) {
        push('bot', 'Please enter a quoted amount, for example 137000.');
        return;
      }
      setQuotedPrice(amount);
      setStep('review');
      push('bot', 'Review the quotation below, then save.');
    }
  };

  if (isFinalized) return null;

  const chips =
    step === 'vendor_missing' ? ['Yes, create it', 'No, search again'] : step === 'price' ? [] : [];

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-teal-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-teal-700 cursor-pointer"
        >
          <i className="ri-upload-cloud-2-line text-lg" />
          RFQ upload with AI
        </button>
      )}

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[min(680px,calc(100dvh-2rem))] w-[min(420px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-teal-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between bg-teal-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">RFQ Assistant</p>
              <p className="text-[11px] text-teal-100">Search vendor → upload file → save quote</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer"
              aria-label="Close RFQ chatbot"
            >
              <i className="ri-close-line text-lg" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-teal-700 text-white' : 'bg-white text-slate-800 border border-gray-200'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {step === 'vendor' && (
              <div className="rounded-xl border border-gray-200 bg-white p-2">
                <p className="px-1 pb-1.5 text-[11px] font-medium text-slate-500">
                  {input.trim() ? `Matching vendors (${vendorMatches.length})` : 'Suggested vendors — type to search'}
                </p>
                {vendorMatches.length > 0 ? (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {vendorMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        disabled={busy}
                        onClick={() => applyVendor(item, true)}
                        className="w-full rounded-lg px-2.5 py-2 text-left text-xs hover:bg-teal-50 cursor-pointer"
                      >
                        <p className="font-medium text-slate-800">{item.name}</p>
                        <p className="text-[11px] text-gray-400">
                          {[item.vendorCode, item.email].filter(Boolean).join(' · ') || 'No email'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-2 text-xs text-amber-700">
                    No vendor matches “{input.trim()}”. Press send and I will ask if you want to add them.
                  </p>
                )}
              </div>
            )}

            {step === 'file' && (
              <div className="rounded-xl border border-dashed border-teal-300 bg-white p-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFiles(Array.from(e.dataTransfer.files || []));
                  }}
                  className="w-full rounded-lg bg-teal-50 px-3 py-4 text-center text-sm text-teal-800 hover:bg-teal-100 cursor-pointer"
                >
                  <i className="ri-upload-cloud-2-line mr-1 text-lg" />
                  Drop or click to upload quotation
                  <span className="mt-1 block text-[11px] text-teal-600/80">PDF, JPG, PNG · 5MB</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) handleFiles(Array.from(e.target.files));
                    e.target.value = '';
                  }}
                />
                {file && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
                    <i className="ri-file-pdf-line text-teal-600" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-slate-800">{file.name}</p>
                      <p className="text-[11px] text-gray-400">{formatSize(file.size)}</p>
                    </div>
                    <button type="button" onClick={() => setFile(null)} className="text-red-400 hover:text-red-600 cursor-pointer">
                      <i className="ri-close-line" />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={!file}
                  onClick={() => {
                    if (!file) return;
                    push('user', `Uploaded ${file.name}`);
                    ask('price', 'What is the total quoted amount? Example: 137000');
                  }}
                  className="mt-3 w-full rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 cursor-pointer"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 'review' && vendor && (
              <div className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
                <p className="mb-2 font-semibold text-slate-900">Quotation preview</p>
                <dl className="space-y-1 text-xs text-slate-600">
                  <div><span className="text-gray-400">Vendor: </span>{vendor.name}</div>
                  <div><span className="text-gray-400">Email: </span>{vendor.email || '—'}</div>
                  <div><span className="text-gray-400">File: </span>{file?.name || '—'}</div>
                  <div><span className="text-gray-400">Quoted: </span>{formatMoney(quotedPrice)}</div>
                  <div>
                    <span className="text-gray-400">Mode: </span>
                    {invited ? 'Existing RFQ vendor' : 'Add as manual entry'}
                  </div>
                </dl>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void saveQuote()}
                  className="mt-3 w-full rounded-lg bg-teal-700 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Saving…' : 'Save quote + file'}
                </button>
              </div>
            )}

            {step === 'done' && (
              <button
                type="button"
                onClick={resetChat}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Upload another quote
              </button>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-gray-100 bg-white px-3 py-2">
              {chips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSend(chip.startsWith('Yes') ? 'yes' : 'no')}
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || step === 'file' || step === 'review' || step === 'done'}
              placeholder={
                step === 'vendor'
                  ? 'Type vendor name to search…'
                  : step === 'vendor_email'
                    ? 'Vendor email'
                    : step === 'price'
                      ? 'Quoted amount'
                      : step === 'file'
                        ? 'Upload file above'
                        : 'Type your answer…'
              }
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-300 disabled:bg-gray-50"
            />
            <button
              type="submit"
              disabled={busy || !input.trim() || step === 'file' || step === 'review' || step === 'done'}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white disabled:opacity-40 cursor-pointer"
            >
              <i className="ri-send-plane-2-fill" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

export function openRfqChat() {
  window.dispatchEvent(new Event('p2p-open-rfq-chat'));
}
