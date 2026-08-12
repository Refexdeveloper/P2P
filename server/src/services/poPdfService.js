import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';
import {
  buildPoDocumentHtml,
  buildPoPdfChromeTemplates,
  PO_PDF_LAYOUT,
} from '../templates/poDocumentTemplate.js';
import { buildSignatureRenderOptions } from './signatureService.js';

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

export function buildPoHtml(po, options = {}) {
  return buildPoDocumentHtml(po, options);
}

/**
 * Convert PO / Work Order HTML → PDF.
 * Header/footer logos: HTML doc-shell thead/tfoot (reliable for letterhead HTML).
 * Page numbers: Puppeteer footer chrome only.
 */
export async function htmlToPdf(html, filePath, chromeTemplates = null) {
  const executablePath = resolveBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      'Chrome/Edge not found for PDF generation. Install Google Chrome or set PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  const browser = await launchPdfBrowser(executablePath);

  try {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0', timeout: 90000 });
    } catch {
      await page.setContent(html, { waitUntil: 'load', timeout: 90000 });
    }
    await page.emulateMediaType('print');
    await page.evaluate(async () => {
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

    const chrome = chromeTemplates || buildPoPdfChromeTemplates();

    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: PO_PDF_LAYOUT.top,
        right: PO_PDF_LAYOUT.side,
        bottom: PO_PDF_LAYOUT.bottom,
        left: PO_PDF_LAYOUT.side,
      },
      displayHeaderFooter: true,
      headerTemplate: chrome.headerTemplate,
      footerTemplate: chrome.footerTemplate,
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

  const html = buildPoHtml(po, { ...options, forPdf: true });
  const chrome = buildPoPdfChromeTemplates(po);
  fs.writeFileSync(htmlPath, html, 'utf8');

  try {
    await htmlToPdf(html, filePath, chrome);
    return { filePath, fileName, htmlFileName, htmlPath };
  } catch (err) {
    console.warn('HTML-to-PDF failed, HTML document saved:', err.message);
    return {
      filePath: htmlPath,
      fileName: htmlFileName,
      htmlFileName,
      htmlPath,
      htmlOnly: true,
      pdfError: err.message,
    };
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
