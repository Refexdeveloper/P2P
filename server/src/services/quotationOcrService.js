import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';

const MAX_BYTES = 6 * 1024 * 1024;

function decodeBase64(fileData) {
  const raw = String(fileData || '').includes(',') ? String(fileData).split(',').pop() : String(fileData || '');
  return Buffer.from(raw || '', 'base64');
}

function extOf(fileName = '') {
  const name = String(fileName).toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.docx')) return 'docx';
  if (name.endsWith('.doc')) return 'doc';
  if (/\.(png|jpg|jpeg|webp|bmp|tif|tiff)$/.test(name)) return 'image';
  return '';
}

function parseIndianAmount(raw) {
  if (raw == null) return 0;
  const text = String(raw).replace(/[₹$]|rs\.?|inr/gi, '').trim();
  const cleaned = text.replace(/,/g, '').replace(/[^\d.]/g, '');
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isYear(n) {
  return n >= 1990 && n <= 2040 && Math.abs(n - Math.round(n)) < 0.001;
}

function isPhoneLike(n) {
  const s = String(Math.round(n));
  return s.length >= 8 && s.length <= 12;
}

function isMoneyAmount(n) {
  return n >= 50 && n <= 50000000 && !isYear(n) && !isPhoneLike(n);
}

function collectAmounts(text) {
  const src = String(text);
  const hits = [
    ...(src.match(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d{1,2})?/gi) || []),
    ...(src.match(/\b\d{1,2},\d{2},\d{3}(?:\.\d{1,2})?\b/g) || []),
    ...(src.match(/\b\d{1,3},\d{3}(?:\.\d{1,2})?\b/g) || []),
    ...(src.match(/\b\d{3,7}(?:\.\d{1,2})?\b/g) || []),
  ];
  const out = [];
  for (const hit of hits) {
    const n = parseIndianAmount(hit);
    if (isMoneyAmount(n)) out.push(n);
  }
  return [...new Set(out)];
}

function isJunkDescription(desc) {
  return /purchase\s*order|po[\s\-_.]*no|phone|tel\.|mobile|whatsapp|fax|e-?mail|ref\.?\s*no|pr[\s:\-]|pr\s*reference|delivery\s*schedule|expected\s*delivery|arbitration|accordance|without\s*prejudice|terms\s*(and|&)\s*conditions|page\s*\d|gstin|cin\s*:|pan\s*:|website|www\.|https?:|date\s*:|dated|buyer\s*name|consignee|vendor\s*code|quotation\s*no|quote\s*no|bill\s*to|ship\s*to|kind\s*attn|subject\s*:|sincerely|regards|authorized\s*sign|bank\s*details|ifsc|account\s*no|msme|udyam/i.test(
    desc
  );
}

function isProductDescription(desc) {
  const text = String(desc || '').replace(/\s+/g, ' ').trim();
  if (!text || text.length < 4 || isJunkDescription(text) || looksLikeHeader(text)) return false;
  const words = text.split(' ').filter((w) => /[a-z]/i.test(w));
  if (words.length >= 2) return true;
  return /(laptop|desktop|monitor|cable|pipe|valve|pump|motor|switch|panel|meter|sensor|filter|steel|copper|wire|bolt|nut|washer|bearing|gasket|hose|fitting|inch|mm|kg|litre|nos|set|unit)/i.test(
    text
  );
}

function isPlausibleItem(item) {
  const qty = Number(item.quantity) || 0;
  const unit = Number(item.quotedUnitPrice) || 0;
  const total = Number(item.quotedTotal) || 0;
  if (!isProductDescription(item.description)) return false;
  if (qty < 1 || qty > 100000) return false;
  if (!isMoneyAmount(unit)) return false;
  if (total > 0 && qty > 0 && unit > 0) {
    const expected = unit * qty;
    if (expected > 50 && Math.abs(total - expected) / expected > 0.25 && Math.abs(total - unit) > 1) {
      item.quotedTotal = Math.round(expected * 100) / 100;
    }
  }
  return true;
}

function findLabeledAmount(text, labels) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (labels.some((re) => re.test(line))) {
      const amounts = collectAmounts(line);
      if (amounts.length) return amounts[amounts.length - 1];
    }
  }
  const blob = String(text);
  for (const re of labels) {
    const hit = blob.match(new RegExp(`${re.source}[^\\n]{0,40}`, 'i'));
    if (hit) {
      const amounts = collectAmounts(hit[0]);
      if (amounts.length) return amounts[amounts.length - 1];
    }
  }
  return 0;
}

function findLeadTime(text) {
  const m =
    String(text).match(/lead\s*time[^0-9]{0,12}(\d{1,3})\s*(day|days|week|weeks)/i) ||
    String(text).match(/(\d{1,3})\s*(day|days|week|weeks)[^.]{0,12}(delivery|lead)/i);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  return /week/i.test(m[2]) ? n * 7 : n;
}

function findPaymentTerms(text) {
  const m = String(text).match(/net\s*(15|30|45|60)|advance\s*50%|on\s*delivery/i);
  if (!m) return '';
  const v = m[0].toLowerCase();
  if (v.includes('15')) return 'Net 30';
  if (v.includes('30')) return 'Net 30';
  if (v.includes('45')) return 'Net 45';
  if (v.includes('60')) return 'Net 60';
  if (v.includes('50')) return 'Advance 50%';
  if (v.includes('delivery')) return 'On Delivery';
  return '';
}

function looksLikeHeader(line) {
  return /^(s\.?\s*no|item|description|particulars|qty|quantity|rate|unit|amount|total|hsn|gst|price)$/i.test(
    line.replace(/[^a-z\s]/gi, ' ').trim()
  );
}

function parseLineItems(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 3 && !looksLikeHeader(l));

  const items = [];
  for (const line of lines) {
    if (/(grand\s*total|sub\s*total|taxable|cgst|sgst|igst|round\s*off|amount\s*in\s*words)/i.test(line)) {
      continue;
    }
    if (isJunkDescription(line)) continue;
    const nums = collectAmounts(line);
    if (!nums.length) continue;
    const desc = line
      .replace(/(?:₹|rs\.?|inr)\s*[\d,]+(?:\.\d+)?/gi, '')
      .replace(/\b\d{1,2},\d{2},\d{3}(?:\.\d+)?\b/g, '')
      .replace(/\b\d{1,3},\d{3}(?:\.\d+)?\b/g, '')
      .replace(/\b\d{3,7}(?:\.\d+)?\b/g, '')
      .replace(/\b\d{1,4}\s*(nos|no|pcs|qty|units?|set)\b/gi, '')
      .replace(/^[\-\d.)\s]+/, '')
      .trim();
    if (!isProductDescription(desc)) continue;

    let quantity = 1;
    let quotedUnitPrice = 0;
    let quotedTotal = 0;
    const qtyHit = line.match(/\b(\d{1,4})\s*(nos|no|pcs|qty|units?|set)\b/i) || line.match(/\bqty[:\s]+(\d{1,4})\b/i);
    if (qtyHit) quantity = Number(qtyHit[1]) || 1;

    if (nums.length === 1) {
      quotedUnitPrice = nums[0];
      quotedTotal = quotedUnitPrice * quantity;
    } else {
      quotedUnitPrice = nums[nums.length - 2] || nums[0];
      quotedTotal = nums[nums.length - 1];
      if (quantity === 1 && nums[0] <= 500 && nums[0] !== quotedUnitPrice) quantity = nums[0];
    }

    if (quotedUnitPrice <= 0 && quotedTotal > 0) quotedUnitPrice = quotedTotal / (quantity || 1);
    if (quotedTotal <= 0 && quotedUnitPrice > 0) quotedTotal = quotedUnitPrice * (quantity || 1);

    const item = {
      description: desc.slice(0, 180),
      quantity: quantity || 1,
      quotedUnitPrice: Math.round(quotedUnitPrice * 100) / 100,
      quotedTotal: Math.round(quotedTotal * 100) / 100,
      extra: true,
    };
    if (isPlausibleItem(item)) items.push(item);
    if (items.length >= 20) break;
  }
  return items;
}

function parseTableItems(tables) {
  const items = [];
  const allTables = Array.isArray(tables) ? tables : [];
  for (const table of allTables) {
    if (!Array.isArray(table) || table.length < 2) continue;
    const header = (table[0] || []).map((c) => String(c || '').toLowerCase());
    const descIdx = header.findIndex((h) => /desc|particular|item|product|goods|material|name/i.test(h));
    const qtyIdx = header.findIndex((h) => /^(qty|quantity|qty\.|nos|no\.?s?)$/i.test(h.trim()) || /qty|quantity|nos/i.test(h));
    const rateIdx = header.findIndex(
      (h) => /rate|unit\s*(price|rate|cost)|u\.?rate|price/i.test(h) && !/total|amount/i.test(h)
    );
    const amtIdx = header.findIndex((h) => /amount|line\s*total|value|net/i.test(h));
    const hasHeader = descIdx >= 0 || rateIdx >= 0 || amtIdx >= 0;
    const rows = hasHeader ? table.slice(1) : table;

    for (const raw of rows) {
      const cells = (raw || []).map((c) => String(c || '').replace(/\s+/g, ' ').trim());
      if (!cells.some(Boolean)) continue;
      const joined = cells.join(' ');
      if (/(grand\s*total|sub\s*total|taxable|cgst|sgst|igst|round\s*off|amount\s*in\s*words|gst\s*\d)/i.test(joined)) {
        continue;
      }
      if (isJunkDescription(joined)) continue;
      const desc = (hasHeader && descIdx >= 0 ? cells[descIdx] : cells.find((c) => /[a-z]/i.test(c) && collectAmounts(c).length === 0)) || '';
      if (!isProductDescription(desc)) continue;
      const qtyCell = hasHeader && qtyIdx >= 0 ? cells[qtyIdx] : '';
      const rateCell = hasHeader && rateIdx >= 0 ? cells[rateIdx] : '';
      const amtCell = hasHeader && amtIdx >= 0 ? cells[amtIdx] : '';
      const nums = collectAmounts(joined);
      let quantity = parseIndianAmount(qtyCell) || Number((qtyCell || '').match(/\d+/)?.[0]) || 0;
      let quotedUnitPrice = parseIndianAmount(rateCell);
      let quotedTotal = parseIndianAmount(amtCell);
      if (!quantity) {
        const q = joined.match(/\b(\d{1,4})\s*(nos|no|pcs|qty|units?|set)\b/i);
        quantity = q ? Number(q[1]) : nums.find((n) => n > 0 && n <= 999) || 1;
      }
      if (!quotedUnitPrice && nums.length) quotedUnitPrice = nums.length >= 2 ? nums[nums.length - 2] : nums[0];
      if (!quotedTotal && nums.length) quotedTotal = nums[nums.length - 1];
      if (quotedUnitPrice <= 0 && quotedTotal > 0) quotedUnitPrice = quotedTotal / (quantity || 1);
      if (quotedTotal <= 0 && quotedUnitPrice > 0) quotedTotal = quotedUnitPrice * (quantity || 1);
      const item = {
        description: desc.slice(0, 180),
        quantity: quantity || 1,
        quotedUnitPrice: Math.round(quotedUnitPrice * 100) / 100,
        quotedTotal: Math.round(quotedTotal * 100) / 100,
        extra: true,
      };
      if (isPlausibleItem(item)) items.push(item);
    }
  }
  return items;
}

export function parseQuoteText(text, tableItems = []) {
  const clean = String(text || '').replace(/\u0000/g, '').trim();
  const labeledTotal = findLabeledAmount(clean, [
    /grand\s*total/i,
    /net\s*payable/i,
    /amount\s*payable/i,
    /total\s*amount/i,
    /quoted\s*amount/i,
    /invoice\s*total/i,
    /net\s*amount/i,
    /total\s*value/i,
  ]);

  const goodTables = (tableItems || []).filter(isPlausibleItem);
  const fromText = parseLineItems(clean);
  let lineItems = goodTables.length ? goodTables : fromText;
  const seen = new Set();
  lineItems = lineItems.filter((l) => {
    if (!isPlausibleItem(l)) return false;
    const key = `${String(l.description).toLowerCase()}|${l.quotedUnitPrice}|${l.quantity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const lineSum = lineItems.reduce((s, l) => s + (Number(l.quotedTotal) || 0), 0);
  const quotedPrice = isMoneyAmount(labeledTotal) ? labeledTotal : lineSum || 0;

  return {
    quotedPrice,
    lineItems,
    leadTime: findLeadTime(clean),
    paymentTerms: findPaymentTerms(clean),
    textPreview: clean.slice(0, 800),
  };
}

async function openPdf(buffer) {
  const mod = await import('pdf-parse');
  const Ctor = mod.PDFParse || mod.default?.PDFParse;
  if (typeof Ctor !== 'function') {
    throw new Error('PDF reader failed to load. Restart the API server and try again.');
  }
  return new Ctor({ data: buffer });
}

async function extractPdfContent(buffer) {
  const parser = await openPdf(buffer);
  let text = '';
  let tableItems = [];
  try {
    const result = await parser.getText();
    text = String(result?.text || '').trim();
    try {
      const tables = await parser.getTable({ first: 3 });
      const list = [
        ...(tables?.mergedTables || []),
        ...((tables?.pages || []).flatMap((p) => p.tables || [])),
      ];
      const rowText = [];
      for (const table of list) {
        for (const row of table || []) rowText.push((row || []).join(' '));
      }
      if (rowText.length) text = `${text}\n${rowText.join('\n')}`.trim();
      tableItems = parseTableItems(list);
    } catch {
      /* tables optional */
    }
  } finally {
    await parser.destroy().catch(() => {});
  }
  return { text, tableItems };
}

async function extractPdfPagesAsImages(buffer, maxPages = 3) {
  const parser = await openPdf(buffer);
  try {
    const shots = await parser.getScreenshot({ first: maxPages, scale: 1.6 });
    const pages = Array.isArray(shots?.pages) ? shots.pages : [];
    return pages
      .slice(0, maxPages)
      .map((page) => {
        if (page?.dataUrl) return decodeBase64(page.dataUrl);
        if (page?.data) return Buffer.isBuffer(page.data) ? page.data : Buffer.from(page.data);
        return null;
      })
      .filter(Boolean);
  } finally {
    await parser.destroy().catch(() => {});
  }
}

async function extractDocxText(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return String(result?.value || '').trim();
}

let ocrWorkerPromise = null;
async function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return ocrWorkerPromise;
}

async function extractImageText(buffer) {
  const worker = await getOcrWorker();
  const result = await worker.recognize(buffer);
  return String(result?.data?.text || '').trim();
}

export async function extractQuotationFromUpload(body = {}) {
  const pages = Array.isArray(body.pages) ? body.pages : [];
  const fileName = String(body.fileName || pages[0]?.fileName || 'quotation');
  const fileData = body.fileData || pages[0]?.fileData;

  if (!fileData && !pages.length) {
    throw new Error('Upload a quotation file first');
  }

  let method = 'text';
  let scanned = false;
  let text = '';

  if (pages.length > 1 || (pages.length === 1 && extOf(pages[0].fileName) === 'image')) {
    method = 'ocr';
    const parts = [];
    for (const page of pages.slice(0, 3)) {
      const buf = decodeBase64(page.fileData);
      if (buf.length > MAX_BYTES) throw new Error('Each page must be under 6MB');
      parts.push(await extractImageText(buf));
    }
    text = parts.join('\n');
  } else {
    const buffer = decodeBase64(fileData);
    if (!buffer.length) throw new Error('Could not read the uploaded file');
    if (buffer.length > MAX_BYTES) throw new Error('Quotation file must be under 5MB');

    const kind = extOf(fileName);
    if (kind === 'pdf') {
      let tableItems = [];
      try {
        const extracted = await extractPdfContent(buffer);
        text = extracted.text || '';
        tableItems = extracted.tableItems || [];
      } catch (err) {
        text = '';
        scanned = true;
        console.warn('PDF text extract failed, will try OCR:', err.message);
      }
      method = 'pdf-text';
      const parsedEarly = parseQuoteText(text, tableItems);
      if (text.replace(/\s+/g, '').length < 40 || !parsedEarly.lineItems.length) {
        scanned = true;
        try {
          const images = await extractPdfPagesAsImages(buffer, 3);
          if (images.length) {
            const parts = [];
            for (const img of images) {
              parts.push(await extractImageText(img));
            }
            const ocrText = parts.join('\n').trim();
            if (ocrText.replace(/\s+/g, '').length > 20) {
              text = `${text}\n${ocrText}`.trim();
              method = 'ocr';
            }
          }
        } catch (err) {
          console.warn('PDF page OCR failed:', err.message);
        }
      }
      const parsedPdf = parseQuoteText(text, tableItems);
      return {
        ...parsedPdf,
        method,
        scanned,
        fileName,
        foundText: Boolean(text && text.replace(/\s+/g, '').length > 10),
      };
    } else if (kind === 'docx') {
      text = await extractDocxText(buffer);
      method = 'docx-text';
    } else if (kind === 'doc') {
      throw new Error('Old .doc files are not readable. Save as PDF or .docx, or upload a photo.');
    } else if (kind === 'image') {
      text = await extractImageText(buffer);
      method = 'ocr';
    } else {
      throw new Error('Use PDF, Word (.docx), or an image (JPG/PNG).');
    }
  }

  const parsed = parseQuoteText(text);
  if (!scanned && !parsed.quotedPrice && !parsed.lineItems.length) {
    scanned = method === 'pdf-text';
  }

  return {
    ...parsed,
    method,
    scanned,
    fileName,
    foundText: Boolean(text && text.replace(/\s+/g, '').length > 10),
  };
}
