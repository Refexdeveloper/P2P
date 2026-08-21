import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import {
  buildPoDocumentHtml,
  buildPoPdfParts,
} from '../templates/poDocumentTemplate.js';
import { PO_STYLES } from '../templates/poDocumentTemplate.styles.js';
import { buildSignatureRenderOptions } from './signatureService.js';
import { parseAnnexureIi, serializeAnnexureIi } from '../utils/annexureIi.js';

export function buildPoHtml(po, options = {}) {
  return buildPoDocumentHtml(po, options);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PO_UPLOAD_DIR = path.join(__dirname, '../../uploads/po');

const CHROME_PATHS = {
  win32: [
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe')
      : null,
    process.env.LOCALAPPDATA
      ? path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
      : null,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean),
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/lib/chromium/chromium',
  ],
};

function ensurePoDir() {
  if (!fs.existsSync(PO_UPLOAD_DIR)) {
    fs.mkdirSync(PO_UPLOAD_DIR, { recursive: true });
  }
}

function resolveBrowserExecutable() {
  const fromEnv = process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  const candidates = CHROME_PATHS[os.platform()] || CHROME_PATHS.linux;
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function puppeteerLaunchArgs() {
  // Do NOT use --single-process / --no-zygote on Cloud Run — they crash Chrome
  // with "Protocol error (Target.setDiscoverTargets): Target closed".
  return [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--no-first-run',
    '--font-render-hinting=none',
    '--hide-scrollbars',
    '--mute-audio',
  ];
}

async function launchPdfBrowser(executablePath) {
  if (!process.env.HOME) process.env.HOME = '/tmp';
  const opts = {
    executablePath,
    headless: true,
    protocolTimeout: 120000,
    timeout: 60000,
    args: puppeteerLaunchArgs(),
  };
  try {
    return await puppeteer.launch(opts);
  } catch (err) {
    console.warn('Puppeteer launch failed, retrying with minimal args:', err.message);
    return puppeteer.launch({
      ...opts,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
  }
}

function looksLikeHtml(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || '').trim());
}

function looksLikeImageSrc(value) {
  const v = String(value || '').trim();
  return /^data:image\//i.test(v) || /^https?:\/\//i.test(v) || /^\//.test(v);
}

async function inlineImageSrc(src) {
  const s = String(src || '').trim();
  if (!s || s.startsWith('data:')) return s;
  if (!/^https?:\/\//i.test(s) && !s.startsWith('/')) return s;
  try {
    const url = s.startsWith('/')
      ? `${String(process.env.API_PUBLIC_URL || process.env.APP_URL || '').replace(/\/$/, '')}${s}`
      : s;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return s;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > 1_800_000) return s;
    const mime = (res.headers.get('content-type') || 'image/png').split(';')[0] || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return s;
  }
}

async function inlineHtmlImages(html) {
  const re = /(<img\b[^>]*\bsrc\s*=\s*)(["'])([^"']+)\2/gi;
  const matches = [...String(html || '').matchAll(re)];
  let out = String(html || '');
  for (const m of matches) {
    const inlined = await inlineImageSrc(m[3]);
    if (inlined !== m[3]) {
      out = out.replace(m[0], `${m[1]}${m[2]}${inlined}${m[2]}`);
    }
  }
  return out;
}

async function inlinePoBranding(po = {}) {
  const next = { ...po };
  const header = String(po.headerLogo || po.header_logo || '');
  const footer = String(po.footerLogo || po.footer_logo || '');
  if (header) {
    next.headerLogo = looksLikeHtml(header)
      ? await inlineHtmlImages(header)
      : await inlineImageSrc(header);
  }
  if (footer) {
    next.footerLogo = looksLikeHtml(footer)
      ? await inlineHtmlImages(footer)
      : await inlineImageSrc(footer);
  }
  const annexureRows = parseAnnexureIi(po.annexureIiRows || po.annexureIiHtml || po.annexure_ii_html || '');
  if (annexureRows.length) {
    const inlined = [];
    for (const row of annexureRows) {
      const images = [];
      for (const img of row.images || []) {
        images.push({
          ...img,
          src: await inlineImageSrc(img.src),
        });
      }
      inlined.push({
        ...row,
        header: await inlineHtmlImages(row.header || ''),
        description: await inlineHtmlImages(row.description || ''),
        images,
      });
    }
    next.annexureIiRows = inlined;
    next.annexureIiHtml = serializeAnnexureIi(inlined);
  }
  return next;
}

function wrapPoHtmlDocument(bodyInner, title, bodyClass) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${PO_STYLES}</style>
</head>
<body class="${bodyClass}">
${bodyInner}
</body>
</html>`;
}

function priceTableHtml(thead, rowsHtml) {
  return `<div class="table-frame"><table class="price">${thead}<tbody>${rowsHtml}</tbody></table></div>`;
}

function termsTableHtml(thead, rowsHtml) {
  return `<div class="table-frame"><table class="terms terms-compact">${thead}<tbody>${rowsHtml}</tbody></table></div>`;
}

function annexureTableHtml(thead, rowsHtml) {
  return `<div class="table-frame"><table class="terms terms-compact annexure-table">${thead}<tbody>${rowsHtml}</tbody></table></div>`;
}

function pdfPageHtml(parts, contentHtml, pageNo, totalPages) {
  return `
<div class="pdf-page">
  <header class="pdf-header">${parts.headerHtml}</header>
  <main class="pdf-content">${contentHtml}</main>
  <footer class="pdf-footer">${parts.footerHtml}<div class="pdf-page-no">Page ${pageNo} of ${totalPages}</div></footer>
</div>`;
}

function buildMeasureHtml(parts) {
  const itemTables = parts.itemRows
    .map(
      (row, i) =>
        `<table class="price" style="width:100%"><tbody data-block="item-${i}">${row}</tbody></table>`
    )
    .join('');
  const termTables = parts.termRows
    .map(
      (row, i) =>
        `<table class="terms terms-compact" style="width:100%"><tbody data-block="term-${i}">${row}</tbody></table>`
    )
    .join('');
  const annexTables = parts.annexureRows
    .map(
      (row, i) =>
        `<table class="terms annexure-table" style="width:100%"><tbody data-block="annexure-${i}">${row}</tbody></table>`
    )
    .join('');
  const annexIi = parts.annexureIiBlocks
    .map((html, i) => `<div data-block="annexure-ii-${i}">${html}</div>`)
    .join('');

  return wrapPoHtmlDocument(
    `
    <div class="pdf-header" data-block="header">${parts.headerHtml}</div>
    <div class="pdf-footer" data-block="footer">${parts.footerHtml}<div class="pdf-page-no">Page 1 of 1</div></div>
    <div class="pdf-content">
      <div data-block="details">${parts.detailsHtml}</div>
      <table class="price" style="width:100%">${parts.priceThead}<tbody></tbody></table>
      <div data-block="price-thead"></div>
      ${itemTables}
      <table class="price" style="width:100%"><tbody data-block="totals">${parts.totalsRows}</tbody></table>
      ${parts.termsThead ? `<table class="terms terms-compact" style="width:100%">${parts.termsThead}</table>` : ''}
      <div data-block="terms-thead"></div>
      ${termTables}
      ${parts.annexureThead ? `<table class="terms annexure-table" style="width:100%">${parts.annexureThead}</table>` : ''}
      <div data-block="annexure-thead"></div>
      ${annexTables}
      ${annexIi}
      <div data-block="notes">${parts.notesHtml}</div>
      <div data-block="ack">${parts.ackHtml}</div>
    </div>`,
    'PO measure',
    'po-document po-document-pdf-pages'
  );
}

function heightOf(map, id, fallback = 48) {
  const n = Number(map[id]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function packPoPages(parts, heights) {
  const pageH = (297 * 96) / 25.4;
  const contentH = Math.max(
    200,
    pageH - heights.header - heights.footer - (7 * 96) / 25.4
  );

  const pages = [];
  let current = [];
  let used = 0;

  const flush = () => {
    if (current.length) pages.push(current);
    current = [];
    used = 0;
  };

  const addHtml = (html, h, forceNew = false) => {
    if (forceNew) flush();
    const need = Math.min(Math.max(h, 8), contentH);
    if (used > 0 && used + need > contentH) flush();
    current.push(html);
    used += need;
  };

  addHtml(parts.detailsHtml, heights.details, false);

  const theadH = heights.priceThead || 52;
  const totalsH = heights.totals || 72;
  let priceStarted = false;
  let continued = false;
  let bucket = [];

  const flushPrice = () => {
    if (!bucket.length) return;
    current.push(
      priceTableHtml(continued ? parts.priceTheadContinued : parts.priceThead, bucket.join(''))
    );
    bucket = [];
    continued = true;
    priceStarted = true;
  };

  const startPricePage = () => {
    flushPrice();
    flush();
    continued = priceStarted;
  };

  parts.itemRows.forEach((_, i) => {
    const rowH = heightOf(heights, `item-${i}`, 64);
    const overhead = bucket.length === 0 ? theadH : 0;
    if (used + overhead + rowH > contentH && (used > 0 || bucket.length > 0)) {
      startPricePage();
    } else if (bucket.length === 0) {
      used += theadH;
    }
    bucket.push(parts.itemRows[i]);
    used += rowH;
  });

  if (bucket.length || !priceStarted) {
    if (used + (bucket.length ? 0 : theadH) + totalsH > contentH && (used > 0 || bucket.length > 0)) {
      flushPrice();
      flush();
      continued = true;
      bucket = [];
      used = theadH;
    }
    bucket.push(parts.totalsRows);
    used += totalsH;
    flushPrice();
  }

  if (parts.termRows.length) {
    flush();
    let tBucket = [];
    let tContinued = false;
    const tHeadH = heights.termsThead || 48;
    used = tHeadH;
    const flushTerms = () => {
      if (!tBucket.length) return;
      current.push(
        termsTableHtml(tContinued ? parts.termsTheadContinued : parts.termsThead, tBucket.join(''))
      );
      tBucket = [];
      tContinued = true;
    };
    parts.termRows.forEach((_, i) => {
      const rowH = heightOf(heights, `term-${i}`, 40);
      if (used + rowH > contentH && tBucket.length) {
        flushTerms();
        flush();
        used = tHeadH;
      }
      tBucket.push(parts.termRows[i]);
      used += rowH;
    });
    flushTerms();
  }

  if (parts.annexureRows.length) {
    flush();
    let aBucket = [];
    let aContinued = false;
    const aHeadH = heights.annexureThead || 48;
    used = aHeadH;
    const flushAnn = () => {
      if (!aBucket.length) return;
      current.push(
        annexureTableHtml(
          aContinued ? parts.annexureTheadContinued : parts.annexureThead,
          aBucket.join('')
        )
      );
      aBucket = [];
      aContinued = true;
    };
    parts.annexureRows.forEach((_, i) => {
      const rowH = heightOf(heights, `annexure-${i}`, 40);
      if (used + rowH > contentH && aBucket.length) {
        flushAnn();
        flush();
        used = aHeadH;
      }
      aBucket.push(parts.annexureRows[i]);
      used += rowH;
    });
    flushAnn();
  }

  parts.annexureIiBlocks.forEach((_, i) => {
    addHtml(parts.annexureIiBlocks[i], heightOf(heights, `annexure-ii-${i}`, 180), true);
  });

  addHtml(parts.notesHtml, heights.notes || 220, true);
  addHtml(parts.ackHtml, heights.ack || 180, true);
  flush();
  return pages;
}

async function waitForPdfAssets(page) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }
    const imgs = Array.from(document.images || []);
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.onload = img.onerror = () => resolve();
            })
      )
    );
  });
}

async function paginatePoHtml(browser, po, options) {
  const parts = buildPoPdfParts(po, options);
  const measurePage = await browser.newPage();
  await measurePage.setViewport({ width: 794, height: 1600, deviceScaleFactor: 1 });
  await measurePage.setContent(buildMeasureHtml(parts), { waitUntil: 'load', timeout: 90000 });
  await measurePage.emulateMediaType('print');
  await waitForPdfAssets(measurePage);

  const heights = await measurePage.evaluate(() => {
    const h = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().height : 0;
    };
    const map = {
      header: h('[data-block="header"]'),
      footer: h('[data-block="footer"]'),
      details: h('[data-block="details"]'),
      priceThead: document.querySelector('table.price thead')?.getBoundingClientRect().height || 52,
      totals: h('[data-block="totals"]'),
      termsThead: document.querySelector('table.terms thead')?.getBoundingClientRect().height || 48,
      annexureThead:
        document.querySelector('table.annexure-table thead')?.getBoundingClientRect().height || 48,
      notes: h('[data-block="notes"]'),
      ack: h('[data-block="ack"]'),
    };
    document.querySelectorAll('[data-block]').forEach((el) => {
      map[el.getAttribute('data-block')] = el.getBoundingClientRect().height;
    });
    return map;
  });
  await measurePage.close();

  const packed = packPoPages(parts, heights);
  const total = Math.max(packed.length, 1);
  const pagesHtml = packed
    .map((chunks, i) => pdfPageHtml(parts, chunks.join('\n'), i + 1, total))
    .join('\n');

  return wrapPoHtmlDocument(
    pagesHtml,
    `${parts.docLabel} - ${parts.poNumber}`,
    'po-document po-document-pdf-pages'
  );
}

/**
 * Convert already-paginated PO HTML → A4 PDF.
 * Header/footer live inside each .pdf-page (reserved bands).
 */
export async function htmlToPdf(html, filePath) {
  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      'Chrome/Edge not found for PDF generation. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  const browser = await launchPdfBrowser(executablePath);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 90000 });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 90000 });
    }
    await page.emulateMediaType('print');
    await waitForPdfAssets(page);

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });
  } finally {
    await browser.close();
  }
}

export async function generatePoPdf(po, options = {}) {
  ensurePoDir();
  const baseName = options.fileName || `${po.poNumber}_${options.signed ? 'signed' : 'draft'}`;
  const fileName = baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`;
  const htmlFileName = fileName.replace(/\.pdf$/i, '.html');
  const filePath = path.join(PO_UPLOAD_DIR, fileName);
  const htmlPath = path.join(PO_UPLOAD_DIR, htmlFileName);

  const branded = await inlinePoBranding(po);
  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    const html = buildPoHtml(branded, { ...options, forPdf: false });
    fs.writeFileSync(htmlPath, html, 'utf8');
    return {
      filePath: htmlPath,
      fileName: htmlFileName,
      htmlFileName,
      htmlPath,
      htmlOnly: true,
      pdfError: 'Chrome/Edge not found',
    };
  }

  const browser = await launchPdfBrowser(executablePath);
  try {
    const html = await paginatePoHtml(browser, branded, options);
    fs.writeFileSync(htmlPath, html, 'utf8');
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 90000 });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 90000 });
    }
    await page.emulateMediaType('print');
    await waitForPdfAssets(page);
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      displayHeaderFooter: false,
    });
    return { filePath, fileName, htmlFileName, htmlPath };
  } catch (err) {
    console.warn('HTML-to-PDF failed, HTML document saved:', err.message);
    if (!fs.existsSync(htmlPath)) {
      fs.writeFileSync(htmlPath, buildPoHtml(branded, { ...options, forPdf: false }), 'utf8');
    }
    return {
      filePath: htmlPath,
      fileName: htmlFileName,
      htmlFileName,
      htmlPath,
      htmlOnly: true,
      pdfError: err.message,
    };
  } finally {
    await browser.close();
  }
}

export function resolvePoDocumentPath(po) {
  const fileName = po.signedPdfPath || po.pdfPath;
  if (!fileName) throw new Error('Document not generated');
  const fullPath = path.join(PO_UPLOAD_DIR, path.basename(fileName));
  if (!fs.existsSync(fullPath)) {
    const htmlName = path.basename(fileName).replace(/\.pdf$/i, '.html');
    const htmlPath = path.join(PO_UPLOAD_DIR, htmlName);
    if (fs.existsSync(htmlPath)) {
      return { fullPath: htmlPath, fileName: htmlName, isHtml: true };
    }
    throw new Error('PO document file not found');
  }
  const isHtml = fullPath.toLowerCase().endsWith('.html');
  return { fullPath, fileName: path.basename(fileName), isHtml };
}

function looksLikePdfFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('utf8') === '%PDF-';
  } catch {
    return false;
  }
}

/**
 * Ensure a real PDF file exists for the PO (regenerate from HTML/template if needed).
 * When the PO is digitally signed, re-embeds the SCM Manager signature image.
 */
export async function ensurePoPdf(po, options = {}) {
  const isSigned = Boolean(po.signedPdfPath || po.signatureImagePath || options.signed);
  const preferredName =
    options.fileName ||
    (isSigned ? po.signedPdfPath : null) ||
    po.pdfPath ||
    `${po.poNumber || 'PO'}_draft.pdf`;
  const pdfName = String(preferredName).replace(/\.html$/i, '.pdf');
  const pdfPath = path.join(PO_UPLOAD_DIR, path.basename(pdfName));

  if (fs.existsSync(pdfPath) && looksLikePdfFile(pdfPath) && !options.forceRegenerate) {
    return { fullPath: pdfPath, fileName: path.basename(pdfName), isHtml: false };
  }

  const signature =
    options.signature ||
    (isSigned ? buildSignatureRenderOptions(po) : undefined);

  const generated = await generatePoPdf(po, {
    ...options,
    fileName: path.basename(pdfName),
    signed: isSigned,
    signature,
  });

  if (generated.htmlOnly || !looksLikePdfFile(generated.filePath)) {
    throw new Error(
      generated.htmlOnly
        ? 'PDF engine unavailable (Chrome/Edge). Install Chrome or set PUPPETEER_EXECUTABLE_PATH.'
        : 'Generated file is not a valid PDF'
    );
  }

  return { fullPath: generated.filePath, fileName: generated.fileName, isHtml: false };
}

/** Generate a one-off PDF buffer/file for live preview (does not require saved PO). */
export async function renderPoPdfToFile(po, fileName = 'PO_preview.pdf') {
  const result = await generatePoPdf(po, { fileName });
  if (result.htmlOnly || !looksLikePdfFile(result.filePath)) {
    const detail = result.pdfError ? ` (${result.pdfError})` : '';
    throw new Error(
      result.htmlOnly
        ? `Could not generate PDF. Install Google Chrome / Microsoft Edge, or set PUPPETEER_EXECUTABLE_PATH.${detail}`
        : 'Generated file is not a valid PDF'
    );
  }
  return result;
}
