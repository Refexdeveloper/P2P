import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import { uploadToGcs, downloadFromGcs, gcsEnabled } from './gcsStorage.js';
import {
  buildPoDocumentHtml,
  buildPoPdfParts,
} from '../templates/poDocumentTemplate.js';
import { PO_STYLES } from '../templates/poDocumentTemplate.styles.js';
import { buildSignatureRenderOptions } from './signatureService.js';
import { parseAnnexureIi, serializeAnnexureIi } from '../utils/annexureIi.js';

function withResolvedSignature(po, options = {}) {
  const signature = options.signature || buildSignatureRenderOptions(po);
  return { ...options, signature };
}

export function buildPoHtml(po, options = {}) {
  return buildPoDocumentHtml(po, withResolvedSignature(po, options));
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

  // Inline images inside Annexure-I / Terms clause HTML so Puppeteer can measure height.
  if (Array.isArray(po.annexureClauses) && po.annexureClauses.length) {
    next.annexureClauses = [];
    for (const clause of po.annexureClauses) {
      next.annexureClauses.push({
        ...clause,
        termsDescription: await inlineHtmlImages(
          clause.termsDescription || clause.terms_description || ''
        ),
        terms_description: undefined,
      });
    }
  }
  if (Array.isArray(po.termsClauses) && po.termsClauses.length) {
    next.termsClauses = [];
    for (const clause of po.termsClauses) {
      next.termsClauses.push({
        ...clause,
        termsDescription: await inlineHtmlImages(
          clause.termsDescription || clause.terms_description || ''
        ),
        terms_description: undefined,
      });
    }
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
  return `<div class="table-frame"><table class="price po-table">${thead}<tbody>${rowsHtml}</tbody></table></div>`;
}

function termsTableHtml(thead, rowsHtml) {
  return `<div class="table-frame"><table class="terms terms-compact">${thead}<tbody>${rowsHtml}</tbody></table></div>`;
}

function annexureTableHtml(thead, rowsHtml) {
  return `<div class="table-frame"><table class="terms terms-compact annexure-table">${thead}<tbody>${rowsHtml}</tbody></table></div>`;
}

function pdfPageHtml(parts, contentHtml, pageNo, totalPages, contentMaxPx) {
  const contentStyle =
    contentMaxPx > 0
      ? ` style="height:${contentMaxPx}px;max-height:${contentMaxPx}px;min-height:0"`
      : '';
  return `
<div class="pdf-page">
  <header class="pdf-header">${parts.headerHtml}</header>
  <main class="pdf-content"${contentStyle}>${contentHtml}</main>
  <footer class="pdf-footer">
    <div class="pdf-footer-brand">${parts.footerHtml}</div>
    <div class="pdf-page-no">Page ${pageNo} of ${totalPages}</div>
  </footer>
</div>`;
}

/** A4 layout regions derived from measured header/footer — hard content boundary. */
function computePageLayout(heights) {
  const mm = (n) => (n * 96) / 25.4;
  const pageH = mm(297);
  const headerH = Math.max(heights.header || 0, mm(18));
  const footerH = Math.max(heights.footer || 0, mm(55));
  const contentPad = mm(4);
  const contentMaxPx = Math.floor(
    Math.max(120, heights.contentArea || pageH - headerH - footerH - contentPad)
  );
  return { pageH, headerH, footerH, contentMaxPx, contentPad };
}

function renderTableBlock(block, parts) {
  const body = block.rows.join('');
  if (block.type === 'price-table') {
    return priceTableHtml(
      block.continued ? parts.priceTheadContinued : parts.priceThead,
      body
    );
  }
  if (block.type === 'terms-table') {
    return termsTableHtml(
      block.continued ? parts.termsTheadContinued : parts.termsThead,
      body
    );
  }
  if (block.type === 'annexure-table') {
    return annexureTableHtml(
      block.continued ? parts.annexureTheadContinued : parts.annexureThead,
      body
    );
  }
  return '';
}

function renderPageBlocks(blocks, parts) {
  return blocks
    .map((block) => {
      if (block.html != null) return block.html;
      return renderTableBlock(block, parts);
    })
    .join('\n');
}

function renderPagesHtml(pages, parts, layout) {
  const total = Math.max(pages.length, 1);
  return pages
    .map((blocks, i) =>
      pdfPageHtml(parts, renderPageBlocks(blocks, parts), i + 1, total, layout.contentMaxPx)
    )
    .join('\n');
}

function pageHasContent(blocks) {
  for (const block of blocks || []) {
    if (block.html != null) {
      const html = String(block.html || '');
      // Drop title-only Annexure-II cards (blank "Continued" heading pages).
      if (isAnnexureIiTitleOnly(html)) continue;
      if (/<img\b/i.test(html) || /<figure\b/i.test(html) || /<table\b/i.test(html)) return true;
      const text = html
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<div class="annexure-ii-title">[\s\S]*?<\/div>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 2) return true;
    } else if (block.rows?.length) {
      return true;
    }
  }
  return false;
}

/** True when an Annexure-II card has only the heading (no real body). */
function isAnnexureIiTitleOnly(html) {
  const h = String(html || '');
  if (!/class\s*=\s*["'][^"']*annexure-ii/i.test(h) && !/<div class="annexure-ii"/i.test(h)) {
    return false;
  }
  const bodyMatch = h.match(/<div class="annexure-ii-body">([\s\S]*?)<\/div>\s*<\/div>\s*$/i);
  const body = bodyMatch ? bodyMatch[1] : h.replace(/<div class="annexure-ii-title">[\s\S]*?<\/div>/gi, '');
  if (/<img\b|<figure\b|<table\b/i.test(body)) return false;
  const text = body
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length < 3;
}

function clonePages(pages) {
  return pages.map((page) =>
    page.map((block) => {
      if (block.html != null) return { ...block };
      return { ...block, rows: [...block.rows] };
    })
  );
}

/**
 * Document section order for PDF packing / overflow repair.
 * Annexure-II must stay before manager sign (notes) and vendor acceptance (ack).
 */
const SECTION_ORDER = {
  details: 0,
  'price-table': 1,
  'terms-table': 2,
  'annexure-table': 3,
  'annexure-ii': 4,
  notes: 5,
  ack: 6,
  html: 4,
};

function sectionOrder(type) {
  return SECTION_ORDER[type] ?? 4;
}

function nextPageHasLaterSection(nextPage, unitType) {
  if (!nextPage?.length) return false;
  const unitOrder = sectionOrder(unitType);
  return nextPage.some((block) => sectionOrder(block.type) > unitOrder);
}

function blockLooksLikeAnnexureIi(block) {
  if (!block) return false;
  if (block.type === 'annexure-ii') return true;
  if (block.html != null && /class\s*=\s*["'][^"']*annexure-ii/i.test(String(block.html))) return true;
  return false;
}

/**
 * Hard guarantee: Annexure-II (all pages) → SCM manager sign → vendor acceptance.
 * Keep packed Annexure-II page groups intact (important for pasted tables).
 */
function enforceDocumentSectionOrder(pages) {
  if (!Array.isArray(pages) || !pages.length) return pages;

  const early = [];
  const annexureIiPages = [];
  const notes = [];
  const ack = [];

  for (const page of pages) {
    const earlyPage = [];
    const iiPage = [];
    for (const block of page || []) {
      const t = block?.type;
      if (blockLooksLikeAnnexureIi(block)) {
        iiPage.push({ ...block, type: 'annexure-ii' });
      } else if (t === 'notes') notes.push(block);
      else if (t === 'ack') ack.push(block);
      else earlyPage.push(block);
    }
    if (earlyPage.length && pageHasContent(earlyPage)) early.push(earlyPage);
    if (iiPage.length && pageHasContent(iiPage)) annexureIiPages.push(iiPage);
  }

  const out = [...early, ...annexureIiPages];
  if (notes.length) out.push(notes);
  if (ack.length) out.push(ack);

  pages.length = 0;
  for (const page of out) {
    if (pageHasContent(page)) pages.push(page);
  }
  return pages;
}

/** Move the last packable unit off an overflowing page onto the next page. */
function shiftLastUnitFromPage(pages, pageIndex) {
  if (pageIndex < 0 || pageIndex >= pages.length) return false;
  const page = pages[pageIndex];
  if (!page.length) return false;

  const lastBlock = page[page.length - 1];
  let unit;
  const splittingTableRow =
    lastBlock.html == null && lastBlock.rows && lastBlock.rows.length > 1;

  if (splittingTableRow) {
    unit = { type: lastBlock.type, continued: true, rows: [lastBlock.rows.pop()] };
    if (!lastBlock.rows.length) page.pop();
  } else {
    unit = page.pop();
    if (unit.html == null) unit = { ...unit, continued: true };
  }

  const wasAloneAfterPop = page.length === 0;
  if (!page.length) pages.splice(pageIndex, 1);

  const nextIdx = pageIndex >= pages.length ? pages.length : pageIndex + 1;
  if (!pages[nextIdx]) pages.splice(nextIdx, 0, []);
  const nextPage = pages[nextIdx];

  // Never push Annexure-II (or any earlier section) past manager sign / vendor acceptance.
  const unitType = blockLooksLikeAnnexureIi(unit) ? 'annexure-ii' : unit.type;
  if (nextPageHasLaterSection(nextPage, unitType)) {
    pages.splice(nextIdx, 0, [unit]);
    // Alone oversized block stays before notes/ack; caller must split/shrink it next.
    return !wasAloneAfterPop;
  }

  if (unit.html != null) {
    nextPage.unshift(unit);
  } else {
    // Alone table row on the last page: open a fresh page for it instead of clipping into the footer.
    if (wasAloneAfterPop && !nextPage.length) {
      nextPage.push(unit);
      return true;
    }
    const nextFirstTable = nextPage.find((b) => b.html == null);
    if (nextFirstTable && nextFirstTable.type !== unit.type) {
      pages.splice(nextIdx, 0, [unit]);
      return true;
    }
    const peer = nextPage.find((b) => b.type === unit.type && b.html == null);
    if (peer) {
      peer.rows.unshift(...unit.rows);
      peer.continued = true;
    } else {
      nextPage.unshift(unit);
    }
  }
  return true;
}

/**
 * Last-resort split: if a single annexure/terms row still overflows (usually text + image),
 * peel the trailing <img>/<figure> onto the next page as a continued row.
 */
function splitTrailingImageFromOverflowRow(pages, pageIndex) {
  if (pageIndex < 0 || pageIndex >= pages.length) return false;
  const page = pages[pageIndex];
  if (!page?.length) return false;

  for (let bi = page.length - 1; bi >= 0; bi -= 1) {
    const block = page[bi];
    if (!block?.rows?.length) continue;
    if (block.type !== 'annexure-table' && block.type !== 'terms-table') continue;

    const rowHtml = block.rows[block.rows.length - 1];
    if (!/<img\b/i.test(rowHtml) && !/<figure\b/i.test(rowHtml)) continue;

    const tdMatch = rowHtml.match(/<td>([\s\S]*)<\/td>\s*<\/tr>/i);
    if (!tdMatch) continue;
    const cellHtml = tdMatch[1];
    const imgRe = /(<figure\b[^>]*>[\s\S]*?<\/figure>|<img\b[^>]*\/?>)\s*$/i;
    const imgMatch = cellHtml.match(imgRe);
    if (!imgMatch) continue;

    const before = cellHtml.slice(0, imgMatch.index).trim();
    const imagePart = imgMatch[1];
    if (!before) continue; // image-only row — cannot peel further

    const annexIdx = rowHtml.match(/data-annexure="(\d+)"/)?.[1];
    const termIdx = rowHtml.match(/data-term="(\d+)"/)?.[1];
    const baseId = rowHtml.match(/data-block="([^"]+)"/)?.[1] || 'row';
    const contId = `${baseId}-img`;
    const attr =
      annexIdx != null
        ? `data-annexure="${annexIdx}"`
        : termIdx != null
          ? `data-term="${termIdx}"`
          : '';

    const snoTd = block.type === 'annexure-table' ? `<td class="sno-col"></td>` : '';
    const headTd =
      block.type === 'annexure-table'
        ? `<td class="head-col"></td>`
        : `<th class="head-col terms-head-continued"></th>`;

    const keptRow = rowHtml.replace(tdMatch[1], before);
    const contRow = `
      <tr class="terms-row terms-row-continued" data-block="${contId}" ${attr}>
        ${snoTd}
        ${headTd}
        <td>${imagePart}</td>
      </tr>`;

    block.rows[block.rows.length - 1] = keptRow;

    const nextIdx = pageIndex + 1;
    if (!pages[nextIdx]) pages.splice(nextIdx, 0, []);
    const nextPage = pages[nextIdx];
    const peer = nextPage.find((b) => b.type === block.type && b.html == null);
    if (peer) {
      peer.rows.unshift(contRow);
      peer.continued = true;
    } else {
      nextPage.unshift({ type: block.type, continued: true, rows: [contRow] });
    }
    return true;
  }
  return false;
}

/**
 * If a tall Annexure-II table overflows, move trailing rows to the next page.
 * Never re-insert an "ANNEXURE-II" heading in the middle of the table.
 */
function splitOverflowingAnnexureIiTable(pages, pageIndex) {
  if (pageIndex < 0 || pageIndex >= pages.length) return false;
  const page = pages[pageIndex];
  if (!page?.length) return false;

  for (let bi = page.length - 1; bi >= 0; bi -= 1) {
    const block = page[bi];
    if (!blockLooksLikeAnnexureIi(block) || block.html == null) continue;
    const html = String(block.html || '');
    if (isAnnexureIiTitleOnly(html)) {
      page.splice(bi, 1);
      if (!page.length) pages.splice(pageIndex, 1);
      return true;
    }

    const tableMatch = html.match(/<table\b[\s\S]*?<\/table>/i);
    if (!tableMatch) continue;

    const tableHtml = tableMatch[0];
    const rowMatches = [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
    if (rowMatches.length < 3) continue;

    // Keep header row(s) + first half on this page; move the rest.
    const keepCount = Math.max(2, Math.ceil(rowMatches.length * 0.55));
    if (keepCount >= rowMatches.length) continue;

    const headRows = rowMatches.slice(0, keepCount).join('');
    const tailRows = rowMatches.slice(keepCount).join('');
    const openTable = tableHtml.match(/^<table\b[^>]*>/i)?.[0] || '<table class="annexure-ii-table">';
    const keptTable = `${openTable}${headRows}</table>`;
    const contTable = `${openTable}${tailRows}</table>`;

    // Only keep the ANNEXURE-II title on the first card — never mid-table.
    const alreadyCont =
      /annexure-ii-cont/i.test(html) || !/<div class="annexure-ii-title">/i.test(html);
    const titleHtml = alreadyCont ? '' : `<div class="annexure-ii-title">ANNEXURE-II</div>`;
    const headerMatch = html.match(/<div class="annexure-ii-header">[\s\S]*?<\/div>/i);
    const headerHtml = alreadyCont ? '' : headerMatch ? headerMatch[0] : '';
    const before = html.slice(0, tableMatch.index);
    const after = html.slice(tableMatch.index + tableMatch[0].length);
    const beforeBody = before
      .replace(/<div class="annexure-ii[^"]*">/i, '')
      .replace(/<div class="annexure-ii-title">[\s\S]*?<\/div>/i, '')
      .replace(/<div class="annexure-ii-header">[\s\S]*?<\/div>/i, '')
      .replace(/<div class="annexure-ii-body">/i, '')
      .trim();
    const afterBody = after.replace(/<\/div>\s*<\/div>\s*$/i, '').trim();

    page[bi] = {
      type: 'annexure-ii',
      html: `
      <div class="annexure-ii${alreadyCont ? ' annexure-ii-cont' : ''}">
        ${titleHtml}
        ${headerHtml}
        <div class="annexure-ii-body">${beforeBody}${keptTable}${afterBody}</div>
      </div>`,
    };

    const contHtml = `
      <div class="annexure-ii annexure-ii-cont">
        <div class="annexure-ii-body">${contTable}</div>
      </div>`;

    const nextIdx = pageIndex + 1;
    if (!pages[nextIdx]) pages.splice(nextIdx, 0, []);
    const nextPage = pages[nextIdx];
    const nextBusy =
      nextPage.some((b) => blockLooksLikeAnnexureIi(b)) ||
      nextPageHasLaterSection(nextPage, 'annexure-ii');

    // Own page for continuation — avoids [table rows][ANNEXURE-II title][more rows] on one page.
    if (nextBusy) {
      pages.splice(nextIdx, 0, [{ type: 'annexure-ii', html: contHtml }]);
    } else {
      nextPage.unshift({ type: 'annexure-ii', html: contHtml });
    }
    return true;
  }
  return false;
}

/**
 * Fix mid-page ANNEXURE-II headings: if a titled card follows annexure content on the
 * same page, strip the duplicate title so the table reads in order.
 */
function fixAnnexureIiHeadingOrder(pages) {
  if (!Array.isArray(pages)) return pages;
  for (const page of pages) {
    let sawAnnexureIi = false;
    for (const block of page || []) {
      if (!blockLooksLikeAnnexureIi(block) || block.html == null) continue;
      const html = String(block.html);
      if (sawAnnexureIi && /<div class="annexure-ii-title">/i.test(html)) {
        block.html = html
          .replace(/<div class="annexure-ii-title">[\s\S]*?<\/div>/gi, '')
          .replace(/<div class="annexure-ii-header">[\s\S]*?<\/div>/gi, '')
          .replace(/class="annexure-ii"/i, 'class="annexure-ii annexure-ii-cont"');
      }
      sawAnnexureIi = true;
    }
  }
  return pages;
}

/** Remove blank Annexure-II heading pages and empty pages. */
function pruneEmptyPages(pages) {
  if (!Array.isArray(pages)) return pages;
  for (let i = pages.length - 1; i >= 0; i -= 1) {
    const page = pages[i];
    if (!page?.length) {
      pages.splice(i, 1);
      continue;
    }
    for (let bi = page.length - 1; bi >= 0; bi -= 1) {
      const block = page[bi];
      if (block?.html != null && isAnnexureIiTitleOnly(block.html)) {
        page.splice(bi, 1);
      }
    }
    if (!page.length || !pageHasContent(page)) pages.splice(i, 1);
  }
  return pages;
}

/** Shrink images on an overflowing page so content fits before notes/ack. */
function shrinkOverflowImagesOnPage(pages, pageIndex, maxHeightPx = 120) {
  if (pageIndex < 0 || pageIndex >= pages.length) return false;
  const page = pages[pageIndex];
  if (!page?.length) return false;

  let changed = false;
  const shrinkHtml = (html) => {
    let out = String(html || '');
    const before = out;
    out = out.replace(/<img\b([^>]*)>/gi, (_full, attrs) => {
      let a = String(attrs || '');
      if (/style\s*=\s*"/i.test(a)) {
        a = a.replace(/style\s*=\s*"[^"]*"/i, (styleAttr) => {
          let s = styleAttr.replace(/max-height\s*:\s*[^;!"']+/gi, `max-height:${maxHeightPx}px`);
          if (!/max-height\s*:/i.test(s)) {
            s = s.replace(/style\s*=\s*"/i, `style="max-height:${maxHeightPx}px !important;`);
          } else {
            s = s.replace(/max-height\s*:\s*[^;"]+/i, `max-height:${maxHeightPx}px !important`);
          }
          return s;
        });
      } else {
        a = `${a} style="max-height:${maxHeightPx}px !important;max-width:100% !important;height:auto !important;object-fit:contain;"`;
      }
      a = a.replace(/\sheight\s*=\s*["'][^"']*["']/gi, '');
      return `<img${a}>`;
    });
    if (out !== before) changed = true;
    return out;
  };

  for (const block of page) {
    if (block.html != null) {
      block.html = shrinkHtml(block.html);
    } else if (block.rows?.length) {
      block.rows = block.rows.map((row) => shrinkHtml(row));
    }
  }
  return changed;
}

function buildMeasureHtml(parts) {
  const termRows = collectMeasureRows(parts.termRows, parts.termOverflowRows).join('');
  const annexRows = collectMeasureRows(parts.annexureSimpleRows, parts.annexureOverflowRows).join('');
  const annexIi = (parts.annexureIiBlocks || [])
    .map((block, i) => {
      const html = typeof block === 'string' ? block : block.html;
      const key = typeof block === 'string' ? `annexure-ii-${i}` : block.key || `annexure-ii-${i}`;
      return `<div data-block="${key}">${html}</div>`;
    })
    .join('');

  return wrapPoHtmlDocument(
    `
    <div class="pdf-page pdf-page-measure" style="height:297mm;max-height:297mm;width:210mm">
      <header class="pdf-header" data-block="header">${parts.headerHtml}</header>
      <main class="pdf-content pdf-content-measure" data-block="content-area">
        <div data-block="details">${parts.detailsHtml}</div>
        <div class="table-frame">
          <table class="price po-table" id="measure-price">
            ${parts.priceThead}
            <tbody>
              ${parts.itemRows.join('')}
              ${parts.totalsRows}
            </tbody>
          </table>
        </div>
        ${
          collectMeasureRows(parts.termRows, parts.termOverflowRows).length
            ? `<div class="table-frame"><table class="terms terms-compact po-table" id="measure-terms">${parts.termsThead}<tbody>${termRows}</tbody></table></div>`
            : ''
        }
        ${
          collectMeasureRows(parts.annexureSimpleRows, parts.annexureOverflowRows).length
            ? `<div class="table-frame"><table class="terms annexure-table po-table" id="measure-annexure">${parts.annexureThead}<tbody>${annexRows}</tbody></table></div>`
            : ''
        }
        ${annexIi}
        <div data-block="notes">${parts.notesHtml}</div>
        <div data-block="ack">${parts.ackHtml}</div>
      </main>
      <footer class="pdf-footer" data-block="footer">
        <div class="pdf-footer-brand">${parts.footerHtml}</div>
        <div class="pdf-page-no">Page 1 of 1</div>
      </footer>
    </div>`,
    'PO measure',
    'po-document po-document-pdf-pages'
  );
}

function heightOf(map, id, fallback = 48) {
  const n = Number(map[id]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Measured row height + small buffer for page packing (collision repair handles overlap). */
function packRowHeight(map, id, fallback = 48, scale = 1) {
  return (heightOf(map, id, fallback) * 1.03 + 4) * scale;
}

function rowBlockId(rowHtml, fallback) {
  return rowHtml.match(/data-block="([^"]+)"/)?.[1] || fallback;
}

/** Unique rows for height measurement (preview rows + expanded pack rows). */
function collectMeasureRows(simpleRows, packRows) {
  const byBlock = new Map();
  for (const row of [...(simpleRows || []), ...(packRows || [])]) {
    const id = rowBlockId(row, '');
    if (id) byBlock.set(id, row);
  }
  return [...byBlock.values()];
}

/** One row per clause; split when a row exceeds one page height, or when it contains images. */
function resolveFlowableRows(simpleRows, overflowRows, heights, contentMaxPx, scale = 1, _attrName = 'data-term') {
  if (!simpleRows?.length) return [];
  const footerSlack = Math.ceil((8 * 96) / 25.4) * scale;
  const maxRowH = (contentMaxPx - footerSlack) * 0.92;
  const out = [];
  for (let i = 0; i < simpleRows.length; i += 1) {
    const simple = simpleRows[i];
    const blockId = rowBlockId(simple, `row-${i}`);
    const rowH = packRowHeight(heights, blockId, 48, scale);
    const idx = simple.match(/data-(?:term|annexure)="(\d+)"/)?.[1] ?? String(i);
    const rowAttr = simple.includes('data-annexure=') ? 'data-annexure' : 'data-term';
    const expanded = (overflowRows || []).filter((r) => r.includes(`${rowAttr}="${idx}"`));
    const hasImage = /<img\b/i.test(simple) || /<figure\b/i.test(simple);
    // Prefer pre-split chunks when images are present or the measured row is tall.
    if (expanded.length > 1 && (hasImage || rowH > maxRowH * 0.55)) {
      out.push(...expanded);
    } else {
      out.push(simple);
    }
  }
  return out;
}

function newTableBlock(type, continued = false) {
  return { type, continued, rows: [] };
}

function packPoPages(parts, heights, scale = 1) {
  const layout = computePageLayout(heights);
  const contentH = layout.contentMaxPx;
  const slack = Math.ceil((8 * 96) / 25.4) * scale;
  const tableGap = Math.ceil((2 * 96) / 25.4);

  const pages = [];
  let current = [];
  let used = 0;

  const flush = () => {
    if (current.length && pageHasContent(current)) pages.push(current);
    current = [];
    used = 0;
  };

  const startNewSection = () => {
    flush();
  };

  const canFit = (extra) => used + extra <= contentH - slack;

  const addHtml = (html, h, forceNew = false, type = 'html') => {
    if (!html || !String(html).trim()) return;
    if (forceNew) startNewSection();
    const need = Math.max(h, 8);
    if (used > 0 && !canFit(need)) flush();
    current.push({ type, html });
    used += need;
  };

  const packTableSection = ({
    rows,
    tableType,
    theadH,
    defaultRowH = 40,
    forceNewSection = true,
  }) => {
    if (!rows.length) return;
    if (forceNewSection) startNewSection();

    let block = null;
    let continued = false;
    used += theadH;

    const ensureBlock = () => {
      if (!block) {
        block = newTableBlock(tableType, continued);
        current.push(block);
      }
    };

    const closeBlock = () => {
      block = null;
      continued = true;
    };

    rows.forEach((rowHtml, i) => {
      const blockId = rowHtml.match(/data-block="([^"]+)"/)?.[1] || `${tableType}-${i}`;
      const rowH = packRowHeight(heights, blockId, defaultRowH, scale);

      if (!canFit(rowH) && block?.rows.length) {
        closeBlock();
        flush();
        used = theadH;
      } else if (!canFit(rowH) && used > theadH) {
        flush();
        used = theadH;
      }

      ensureBlock();
      block.rows.push(rowHtml);
      used += rowH;
    });
  };

  // —— Page 1+: Header + line items ——
  addHtml(parts.detailsHtml, heights.details || 0, false, 'details');

  const theadH = heights.priceThead || 52;
  const totalsH = heights.totals || 72;
  let priceBlock = null;
  let priceContinued = false;

  const ensurePriceBlock = () => {
    if (!priceBlock) {
      priceBlock = newTableBlock('price-table', priceContinued);
      current.push(priceBlock);
      used += theadH + tableGap;
    }
  };

  const flushPriceBlock = () => {
    priceBlock = null;
    priceContinued = true;
  };

  const placePriceRow = (rowHtml, rowH) => {
    if (priceBlock && !canFit(rowH)) {
      flushPriceBlock();
      flush();
    } else if (!priceBlock && used > 0 && !canFit(theadH + rowH)) {
      flush();
    }
    ensurePriceBlock();
    priceBlock.rows.push(rowHtml);
    used += rowH;
  };

  parts.itemRows.forEach((_, i) => {
    placePriceRow(parts.itemRows[i], packRowHeight(heights, `item-${i}`, 64, scale));
  });

  if (priceBlock || !pages.length) {
    if (priceBlock && !canFit(totalsH)) {
      flushPriceBlock();
      flush();
    } else if (!priceBlock && used > 0 && !canFit(theadH + totalsH)) {
      flush();
    }
    ensurePriceBlock();
    priceBlock.rows.push(parts.totalsRows);
    used += totalsH;
  }

  const termPackRows =
    (parts.resolvedTermRows?.length ? parts.resolvedTermRows : null) ||
    parts.termRows ||
    parts.termPackRows ||
    [];
  if (termPackRows.length) {
    packTableSection({
      rows: termPackRows,
      tableType: 'terms-table',
      theadH: heights.termsThead || 48,
      defaultRowH: 36,
      forceNewSection: true,
    });
  }

  const annexurePackRows =
    (parts.resolvedAnnexureRows?.length ? parts.resolvedAnnexureRows : null) ||
    parts.annexureSimpleRows ||
    parts.annexureRows ||
    [];
  if (annexurePackRows.length) {
    packTableSection({
      rows: annexurePackRows,
      tableType: 'annexure-table',
      theadH: heights.annexureThead || 48,
      defaultRowH: 36,
      forceNewSection: true,
    });
  }

  (parts.annexureIiBlocks || []).forEach((block, i) => {
    const html = typeof block === 'string' ? block : block.html;
    const key = typeof block === 'string' ? `annexure-ii-${i}` : block.key || `annexure-ii-${i}`;
    // Each pre-split Annexure-II chunk gets its own page, in order.
    addHtml(html, packRowHeight(heights, key, 220, scale), true, 'annexure-ii');
  });

  const notesHtml = String(parts.notesHtml || '').trim();
  const ackHtml = String(parts.ackHtml || '').trim();

  if (notesHtml) {
    startNewSection();
    addHtml(notesHtml, packRowHeight(heights, 'notes', 120, scale), false, 'notes');
  }
  if (ackHtml) {
    startNewSection();
    addHtml(ackHtml, packRowHeight(heights, 'ack', 100, scale), false, 'ack');
  }

  flush();
  const packed = pages.filter((page) => Array.isArray(page) && pageHasContent(page));
  enforceDocumentSectionOrder(packed);
  fixAnnexureIiHeadingOrder(packed);
  pruneEmptyPages(packed);
  return packed;
}

async function waitForPdfAssets(page) {
  await page.evaluate(async () => {
    const withTimeout = (p, ms) =>
      Promise.race([p, new Promise((resolve) => setTimeout(resolve, ms))]);

    if (document.fonts?.ready) {
      try {
        await withTimeout(document.fonts.ready, 1500);
      } catch {
        /* ignore */
      }
    }
    const imgs = Array.from(document.images || []);
    await withTimeout(
      Promise.all(
        imgs.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = img.onerror = () => resolve();
              })
        )
      ),
      4000
    );
  });
}

async function detectFooterCollisions(browser, html, reusePage = null, opts = {}) {
  const checkPage = reusePage || (await browser.newPage());
  const ownsPage = !reusePage;
  const waitAssets = opts.waitAssets !== false;
  if (ownsPage) {
    await checkPage.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
  }
  try {
    await checkPage.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch {
    await checkPage.setContent(html, { waitUntil: 'load', timeout: 60000 });
  }
  await checkPage.emulateMediaType('print');
  if (waitAssets) {
    await waitForPdfAssets(checkPage);
  }

  const collisions = await checkPage.evaluate(() => {
    const tolerance = 3;
    const hits = [];
    document.querySelectorAll('.pdf-page').forEach((pageEl, pageIndex) => {
      const footer = pageEl.querySelector('.pdf-footer');
      const content = pageEl.querySelector('.pdf-content');
      if (!footer || !content) return;

      const footerTop = footer.getBoundingClientRect().top;

      const checkEl = (el) => {
        const rect = el.getBoundingClientRect();
        if (rect.height < 1 || rect.width < 1) return;
        if (rect.bottom > footerTop + tolerance) {
          hits.push({
            pageIndex,
            reason: 'footer-overlap',
            block: el.getAttribute('data-block') || el.tagName,
            overflowPx: Math.round(rect.bottom - footerTop),
          });
        }
      };

      content.querySelectorAll('tbody tr[data-block]').forEach(checkEl);
      content.querySelectorAll('.table-frame, .annexure-ii, .special-notes, .ack-block').forEach(checkEl);

      if (content.scrollHeight > content.clientHeight + tolerance) {
        hits.push({
          pageIndex,
          reason: 'content-overflow',
          overflowPx: Math.round(content.scrollHeight - content.clientHeight),
        });
      }
    });
    return hits;
  });
  if (ownsPage) await checkPage.close();
  return { collisions, checkPage: ownsPage ? null : checkPage };
}

async function paginatePoHtml(browser, po, options) {
  const parts = buildPoPdfParts(po, options);
  const measurePage = await browser.newPage();
  await measurePage.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
  await measurePage.setContent(buildMeasureHtml(parts), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await measurePage.emulateMediaType('print');
  await waitForPdfAssets(measurePage);

  const heights = await measurePage.evaluate(() => {
    const h = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().height : 0;
    };
    const pageEl = document.querySelector('.pdf-page-measure');
    const headerEl = document.querySelector('[data-block="header"]');
    const footerEl = document.querySelector('[data-block="footer"]');
    const contentEl = document.querySelector('[data-block="content-area"]');
    let contentArea = 0;
    if (pageEl && headerEl && footerEl) {
      contentArea = pageEl.clientHeight - headerEl.offsetHeight - footerEl.offsetHeight;
    } else if (contentEl) {
      contentArea = contentEl.clientHeight;
    }
    const map = {
      header: h('[data-block="header"]'),
      footer: h('[data-block="footer"]'),
      contentArea,
      details: h('[data-block="details"]'),
      priceThead: document.querySelector('#measure-price thead')?.getBoundingClientRect().height || 52,
      totals: 0,
      termsThead: document.querySelector('#measure-terms thead')?.getBoundingClientRect().height || 48,
      annexureThead: document.querySelector('#measure-annexure thead')?.getBoundingClientRect().height || 48,
      notes: h('[data-block="notes"]'),
      ack: h('[data-block="ack"]'),
    };
    document.querySelectorAll('#measure-price tbody tr[data-block]').forEach((el) => {
      map[el.getAttribute('data-block')] = el.getBoundingClientRect().height;
    });
    const totalRows = document.querySelectorAll('#measure-price tbody tr.total, #measure-price tbody tr.amount-words-row');
    map.totals = Array.from(totalRows).reduce((sum, el) => sum + el.getBoundingClientRect().height, 0);
    document.querySelectorAll('#measure-terms tbody tr').forEach((el) => {
      const block = el.getAttribute('data-block');
      if (block) map[block] = el.getBoundingClientRect().height;
    });
    document.querySelectorAll('#measure-annexure tbody tr').forEach((el) => {
      const block = el.getAttribute('data-block');
      if (block) map[block] = el.getBoundingClientRect().height;
    });
    document.querySelectorAll('[data-block^="annexure-ii-"]').forEach((el) => {
      map[el.getAttribute('data-block')] = el.getBoundingClientRect().height;
    });
    return map;
  });
  await measurePage.close();

  const layout = computePageLayout(heights);
  const packParts = {
    ...parts,
    resolvedTermRows: resolveFlowableRows(
      parts.termPackRows || parts.termRows,
      parts.termOverflowRows,
      heights,
      layout.contentMaxPx,
      1,
      'data-term'
    ),
    resolvedAnnexureRows: resolveFlowableRows(
      parts.annexureRows || parts.annexureSimpleRows,
      parts.annexureOverflowRows,
      heights,
      layout.contentMaxPx,
      1,
      'data-annexure'
    ),
  };

  const checkPage = await browser.newPage();
  await checkPage.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

  let packScale = 1.0;
  let pages = [];
  const maxAttempts = 2;
  const maxRepairs = 8;
  let assetsReady = false;

  try {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      pages = clonePages(packPoPages(packParts, heights, packScale));

      for (let repair = 0; repair < maxRepairs; repair += 1) {
        const draftHtml = wrapPoHtmlDocument(
          renderPagesHtml(pages, parts, layout),
          `${parts.docLabel} - ${parts.poNumber}`,
          'po-document po-document-pdf-pages'
        );
        // Wait for images only on the first collision check (major PDF speed win).
        const { collisions } = await detectFooterCollisions(browser, draftHtml, checkPage, {
          waitAssets: !assetsReady,
        });
        assetsReady = true;
        if (!collisions.length) break;

        const worstPage = collisions.reduce(
          (max, c) => (c.pageIndex > max ? c.pageIndex : max),
          collisions[0].pageIndex
        );
        if (!shiftLastUnitFromPage(pages, worstPage)) {
          if (!splitTrailingImageFromOverflowRow(pages, worstPage)) {
            // Do not re-split Annexure-II tables here — row order is fixed in buildAnnexureIiPdfBlocks.
            if (!shrinkOverflowImagesOnPage(pages, worstPage, Math.max(90, 160 - repair * 12))) {
              break;
            }
          }
        }
        enforceDocumentSectionOrder(pages);
        fixAnnexureIiHeadingOrder(pages);
        pruneEmptyPages(pages);
      }

      enforceDocumentSectionOrder(pages);
      fixAnnexureIiHeadingOrder(pages);
      pruneEmptyPages(pages);
      const pagesHtml = renderPagesHtml(pages, parts, layout);
      const draftHtml = wrapPoHtmlDocument(
        pagesHtml,
        `${parts.docLabel} - ${parts.poNumber}`,
        'po-document po-document-pdf-pages'
      );
      const { collisions: remaining } = await detectFooterCollisions(browser, draftHtml, checkPage, {
        waitAssets: false,
      });
      if (!remaining.length) {
        return draftHtml;
      }
      packScale += 0.12;
    }
  } finally {
    await checkPage.close();
  }

  return wrapPoHtmlDocument(
    renderPagesHtml(pages, parts, layout),
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
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
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
  options = withResolvedSignature(po, options);
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
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
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
    // Upload PDF to GCS
    if (gcsEnabled() && fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      uploadToGcs(`purchase-orders/${fileName}`, buf, 'application/pdf')
        .catch((e) => console.warn('[GCS] PO PDF upload failed:', e.message));
    }
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

export async function resolvePoDocumentPath(po) {
  const fileName = po.signedPdfPath || po.pdfPath;
  if (!fileName) throw new Error('Document not generated');
  const baseName = path.basename(fileName);
  const fullPath = path.join(PO_UPLOAD_DIR, baseName);
  if (fs.existsSync(fullPath)) {
    const isHtml = fullPath.toLowerCase().endsWith('.html');
    return { fullPath, fileName: baseName, isHtml };
  }
  const htmlName = baseName.replace(/\.pdf$/i, '.html');
  const htmlPath = path.join(PO_UPLOAD_DIR, htmlName);
  if (fs.existsSync(htmlPath)) {
    return { fullPath: htmlPath, fileName: htmlName, isHtml: true };
  }
  // GCS fallback for new uploads
  if (gcsEnabled()) {
    const buf = await downloadFromGcs(`purchase-orders/${baseName}`);
    if (buf?.length) return { fullPath: null, fileName: baseName, isHtml: false, buffer: buf };
  }
  throw new Error('PO document file not found');
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
  const isDraft = String(po.statusRaw || po.status || '').toLowerCase() === 'draft';
  const preferredName =
    options.fileName ||
    (isSigned ? po.signedPdfPath : null) ||
    po.pdfPath ||
    `${po.poNumber || 'PO'}_draft.pdf`;
  const pdfName = String(preferredName).replace(/\.html$/i, '.pdf');
  const pdfPath = path.join(PO_UPLOAD_DIR, path.basename(pdfName));

  const pdfMtime = fs.existsSync(pdfPath) ? fs.statSync(pdfPath).mtimeMs : 0;
  const poUpdatedMs = Number(po.updatedAtMs || 0);
  const pdfStale = poUpdatedMs > 0 && pdfMtime > 0 && poUpdatedMs > pdfMtime + 500;

  if (
    fs.existsSync(pdfPath) &&
    looksLikePdfFile(pdfPath) &&
    !options.forceRegenerate &&
    !isDraft &&
    !pdfStale
  ) {
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
