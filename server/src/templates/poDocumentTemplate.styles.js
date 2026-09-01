/**
 * PO / Work Order PDF layout
 *
 * EVERY printed page (Puppeteer chrome templates — reliable across page breaks):
 *   TOP    = headerTemplate  (letterhead header logo)
 *   BODY   = document content (line items / terms / annexure)
 *   BOTTOM = footerTemplate  (letterhead footer + Page X of Y)
 *
 * HTML preview may still use a doc-shell thead/tfoot for on-screen branding.
 */
export const PO_PDF_LAYOUT = {
  /** Space for repeating header logo on every PDF page */
  top: '24mm',
  /** Space for full letterhead footer — must exceed chrome footer height */
  bottom: '72mm',
  side: '12mm',
  marginTopPx: 15,
  marginBottomPx: 38,
  marginSidePx: 38,
  get marginMm() {
    return 10;
  },
  get topMm() {
    return 24;
  },
  get bottomMm() {
    return 48;
  },
};

export const PO_STYLES = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }

  body.po-document {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    color: #1a1a1a;
    max-width: calc(210mm - ${PO_PDF_LAYOUT.marginSidePx * 2}px);
    margin: 0 auto;
    padding: 12px ${PO_PDF_LAYOUT.marginSidePx}px 20px;
    line-height: 1.35;
    background: #fff;
  }

  /* PDF path: chrome templates own header/footer — body is content only */
  body.po-document-pdf {
    max-width: none;
    width: 100%;
    margin: 0;
    padding: 0 !important;
  }

  body.po-document-pdf-pages {
    max-width: none;
    width: 100%;
    margin: 0;
    padding: 0 !important;
    background: #fff;
  }
  .pdf-page {
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    position: relative;
    box-sizing: border-box;
    background: #fff;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    page-break-after: always;
    break-after: page;
  }
  .pdf-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  .pdf-header {
    grid-row: 1;
    padding: 6mm 8mm 2mm;
  }
  .pdf-content {
    grid-row: 2;
    min-height: 0;
    padding: 3mm 8mm 4mm;
    overflow: visible;
  }
  .pdf-footer {
    grid-row: 3;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
    padding: 2mm 8mm 6mm;
    background: #fff;
    text-align: center;
  }
  .pdf-footer-brand {
    width: 100%;
    text-align: center;
  }
  .pdf-footer-brand,
  .pdf-footer-brand * {
    text-align: center !important;
  }
  .pdf-footer-brand table {
    margin-left: auto;
    margin-right: auto;
  }
  .pdf-page-no,
  .pagenum {
    display: block;
    width: 100%;
    text-align: center !important;
    font-size: 10px;
    font-weight: 700;
    color: #333;
    margin: 8px 0 0;
    padding: 0;
    float: none !important;
    position: static !important;
    left: auto !important;
  }

  @media print {
    body.po-document-pdf-pages .pdf-page {
      margin: 0;
      box-shadow: none;
      page-break-after: always;
      break-after: page;
    }
    body.po-document-pdf-pages .pdf-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
  }
  .line-item,
  .po-line-item,
  .po-line-item td,
  .terms-row {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  body.po-document-pdf-pages table.price,
  body.po-document-pdf-pages table.terms,
  table.po-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border-spacing: 0;
    border: 1px solid #000;
  }
  body.po-document-pdf-pages table.price th,
  body.po-document-pdf-pages table.price td,
  body.po-document-pdf-pages table.terms th,
  body.po-document-pdf-pages table.terms td,
  table.po-table th,
  table.po-table td {
    border: 1px solid #000;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-break: normal;
    white-space: normal;
  }
  body.po-document-pdf-pages table.price th.col-uom,
  body.po-document-pdf-pages table.price td.col-uom,
  body.po-document-pdf-pages table.price th.col-tax,
  body.po-document-pdf-pages table.price td.col-tax,
  body.po-document-pdf-pages table.price th.col-total,
  body.po-document-pdf-pages table.price th.col-qty,
  body.po-document-pdf-pages table.price th.col-sl {
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
  }
  body.po-document-pdf-pages .table-frame {
    border: none;
  }
  body.po-document-pdf-pages .table-frame table.price tr > *:first-child,
  body.po-document-pdf-pages .table-frame table.terms tr > *:first-child,
  body.po-document-pdf-pages .table-frame table.price tr > *:last-child,
  body.po-document-pdf-pages .table-frame table.terms tr > *:last-child,
  body.po-document-pdf-pages .table-frame table.price thead tr:first-child > *,
  body.po-document-pdf-pages .table-frame table.terms thead tr:first-child > *,
  body.po-document-pdf-pages .table-frame table.price tbody tr:last-child > *,
  body.po-document-pdf-pages .table-frame table.terms tbody tr:last-child > * {
    border: 1px solid #000 !important;
  }
  td.description,
  td.col-description {
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: normal;
    vertical-align: top;
  }
  body.po-document-pdf-pages table.price td.amount-cell,
  body.po-document-pdf-pages table.price td.unit-rate-cell,
  body.po-document-pdf-pages table.price td.total-amount-cell,
  body.po-document-pdf-pages table.price td.col-rate,
  body.po-document-pdf-pages table.price td.col-unit-rate,
  body.po-document-pdf-pages table.price td.col-total {
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    word-wrap: normal !important;
    text-align: right;
    padding-left: 4px;
    padding-right: 4px;
  }

  /* ===== Document shell — logo bands repeat on every printed page ===== */
  table.doc-shell {
    width: 100%;
    border-collapse: collapse;
    border: none !important;
    margin: 0;
  }
  table.doc-shell > thead { display: table-header-group; }
  table.doc-shell > tfoot { display: table-footer-group; }
  table.doc-shell > tbody { display: table-row-group; }
  table.doc-shell > thead > tr > td,
  table.doc-shell > tfoot > tr > td,
  table.doc-shell > tbody > tr > td.doc-shell-body {
    border: none !important;
    padding: 0 !important;
    background: transparent;
    vertical-align: top;
  }

  /* PDF: reserve header/footer space on every printed page */
  body.po-document-pdf table.doc-shell {
    width: 100%;
    border-collapse: collapse;
  }
  body.po-document-pdf table.doc-shell > thead > tr > td {
    padding: 8mm 10mm 5mm 10mm !important;
    vertical-align: bottom;
  }
  body.po-document-pdf table.doc-shell > tfoot > tr > td {
    padding: 4mm 10mm 8mm 10mm !important;
    vertical-align: top;
  }
  body.po-document-pdf table.doc-shell > tbody > tr > td.doc-shell-body {
    padding: 0 10mm !important;
  }
  body.po-document-pdf table.doc-shell > tbody > tr.doc-shell-row {
    page-break-inside: auto;
    break-inside: auto;
  }
  body.po-document-pdf .pdf-run-header,
  body.po-document-pdf .pdf-run-footer {
    margin: 0;
    padding: 0;
  }

  .pdf-run-header {
    display: block;
    width: 100%;
    background: #fff;
    margin: 0 0 10px;
    padding: 2px 0 4px;
  }
  .pdf-run-header-inner {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    min-height: 44px;
    padding: 2px 0 4px;
  }
  .pdf-run-header-inner .run-header-img,
  .pdf-run-header-inner img {
    max-height: 44px !important;
    max-width: 200px !important;
    height: auto !important;
    width: auto !important;
    object-fit: contain;
    display: block;
    margin-left: auto;
  }
  .pdf-run-header-inner .logo { font-size: 26px; margin-left: auto; }
  .pdf-run-header-inner .run-header-text {
    font-size: 14px;
    font-weight: 700;
    color: #111;
    margin-left: auto;
  }
  .pdf-run-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
    background: #fff;
    margin: 8px 0 0;
    padding: 4px 0 2px;
    border: none;
    text-align: center;
  }
  .pdf-run-footer-inner {
    width: 100%;
    text-align: center;
    font-size: 13px;
    line-height: 1.45;
    color: #222;
    border: none;
  }
  .pdf-run-footer-inner,
  .pdf-run-footer-inner * {
    text-align: center !important;
  }
  .pdf-run-footer-inner table {
    margin-left: auto;
    margin-right: auto;
  }
  .pdf-run-footer-inner .run-footer-img,
  .pdf-run-footer-inner img {
    max-height: 90px !important;
    max-width: 100% !important;
    height: auto !important;
    width: auto !important;
    object-fit: contain;
    display: block;
    margin: 0 auto;
  }
  .pdf-run-footer-inner .run-footer-text {
    font-size: 13px;
    font-weight: 700;
    color: #111;
  }
  .pdf-run-footer-inner .run-footer-html {
    font-size: 13px;
    line-height: 1.45;
    text-align: center;
  }
  .pdf-run-footer-inner .run-footer-html p {
    margin: 2px 0;
    text-align: center;
  }
  .pdf-run-footer-inner .run-footer-html hr,
  .pdf-run-footer-inner hr {
    display: none !important;
  }

  .page-sheet {
    width: 100%;
    margin: 0;
    padding: 0;
    page-break-after: auto;
    break-after: auto;
  }

  .page-terms,
  .page-annexure,
  .page-annexure-ii,
  .page-notes,
  .page-ack {
    page-break-before: always !important;
    break-before: page !important;
  }

  /* Keep section title with at least one row when a table continues */
  table.terms thead,
  table.price thead {
    display: table-header-group !important;
  }
  table.terms tr,
  table.price tr.total {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .page-body { width: 100%; }

  @media screen {
    body.po-document-preview {
      background: #d1d5db;
      max-width: none;
      width: 100%;
      margin: 0;
      padding: 18px 12px 32px;
    }
    body.po-document-preview .page-sheet {
      background: #fff;
      width: 210mm;
      max-width: 100%;
      min-height: 297mm;
      margin: 0 auto 18px;
      padding: 10mm 12mm 12mm;
      box-shadow: 0 2px 12px rgba(0,0,0,.16);
      display: flex;
      flex-direction: column;
    }
    body.po-document-preview .page-sheet .page-body { flex: 1 1 auto; }
    body.po-document-preview .page-sheet .pdf-run-footer { margin-top: auto; width: 100%; }
  }

  @media print {
    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    body.po-document {
      max-width: none;
      width: 100%;
      margin: 0;
      padding: 0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body.po-document-pdf {
      padding: 3mm 2mm 4mm 2mm !important;
    }

    table.doc-shell > thead { display: table-header-group !important; }
    table.doc-shell > tfoot { display: table-footer-group !important; }

    .pdf-run-header { margin: 0 0 8px; }
    .pdf-run-footer {
      display: flex !important;
      flex-direction: column;
      align-items: center;
      margin: 6px 0 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* PDF: chrome templates own header/footer. Tables must not stretch to fill the page. */
    body.po-document-pdf .page-sheet {
      margin: 0;
      padding: 0;
      width: 100%;
      min-height: 0 !important;
      height: auto !important;
    }
    body.po-document-pdf .table-frame,
    body.po-document-pdf table.price,
    body.po-document-pdf table.terms {
      height: auto !important;
      min-height: 0 !important;
    }
    body.po-document-pdf table.price th,
    body.po-document-pdf table.price td,
    body.po-document-pdf table.terms th,
    body.po-document-pdf table.terms td {
      height: auto !important;
      vertical-align: top;
    }
    body.po-document-pdf .pdf-run-header,
    body.po-document-pdf .pdf-run-footer {
      display: none !important;
    }

    /* Full cell borders so a split table still has left/right/top/bottom */
    body.po-document-pdf .table-frame {
      border: none;
    }
    body.po-document-pdf .table-frame table.price tr > *:first-child,
    body.po-document-pdf .table-frame table.terms tr > *:first-child {
      border-left: 1px solid #000 !important;
    }
    body.po-document-pdf .table-frame table.price tr > *:last-child,
    body.po-document-pdf .table-frame table.terms tr > *:last-child {
      border-right: 1px solid #000 !important;
    }
    body.po-document-pdf .table-frame table.price thead tr:first-child > *,
    body.po-document-pdf .table-frame table.terms thead tr:first-child > * {
      border-top: 1px solid #000 !important;
    }
    body.po-document-pdf .table-frame table.price tbody tr:last-child > *,
    body.po-document-pdf .table-frame table.terms tbody tr:last-child > *,
    body.po-document-pdf .table-frame table.price tfoot td,
    body.po-document-pdf .table-frame table.terms tfoot td {
      border-bottom: 1px solid #000 !important;
      border-left: 1px solid #000 !important;
      border-right: 1px solid #000 !important;
    }
    body.po-document-pdf table.price tfoot,
    body.po-document-pdf table.terms tfoot {
      display: table-footer-group !important;
    }
    body.po-document-pdf table.price tfoot td,
    body.po-document-pdf table.terms tfoot td {
      height: 0;
      padding: 0 !important;
      font-size: 0;
      line-height: 0;
      border-top: 1px solid #000 !important;
    }

    /* Match on-screen PO Document Preview: each sheet is a full A4 page */
    body.po-document-preview .page-sheet {
      background: #fff;
      width: 210mm;
      max-width: 100%;
      min-height: 297mm;
      margin: 0;
      padding: 10mm 12mm 12mm !important;
      box-shadow: none;
      display: flex;
      flex-direction: column;
      page-break-after: always;
      break-after: page;
    }
    body.po-document-preview .page-sheet:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    body.po-document-preview .page-sheet .page-body { flex: 1 1 auto; }
    body.po-document-preview .page-sheet .pdf-run-footer { margin-top: auto; width: 100%; }
    body.po-document-preview .page-terms,
    body.po-document-preview .page-annexure,
    body.po-document-preview .page-annexure-ii,
    body.po-document-preview .page-notes,
    body.po-document-preview .page-ack {
      page-break-before: auto !important;
      break-before: auto !important;
    }

    .page-body,
    .info-box,
    .table-frame,
    .annexure-card,
    .annexure-ii,
    .special-notes,
    .ack-box,
    .amount-words-inner,
    table.price,
    table.terms {
      width: 100% !important;
      max-width: 100% !important;
    }

    .info-box,
    .table-frame,
    .annexure-ii,
    .special-notes,
    .ack-box {
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
  }

  .logo { font-size: 30px; font-weight: 800; font-style: italic; letter-spacing: -1px; }
  .logo .r1 { color: #2e3192; } .logo .e1 { color: #27aae1; } .logo .f { color: #39b54a; }
  .logo .e2 { color: #8dc63f; } .logo .x { color: #f7941d; }

  .title { text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 1px; margin: 8px 0 12px 0; }
  .po-meta { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; font-size: 13px; width: 100%; }
  .nowrap { white-space: nowrap !important; word-break: keep-all !important; overflow-wrap: normal !important; }

  .info-box {
    border: 1px solid #000;
    padding: 8px 12px;
    margin-bottom: 12px;
    page-break-inside: avoid;
    break-inside: avoid;
    width: 100%;
  }
  .info-box p { margin: 1px 0; line-height: 1.3; }
  .info-box a { color: #1155cc; text-decoration: underline; }
  .letterhead-block { margin-bottom: 6px; width: 100%; }
  .letterhead-block p { margin: 1px 0; line-height: 1.3; }
  .letterhead-block p:empty,
  .letterhead-block p:has(> br:only-child) { display: none; }

  .table-frame {
    width: 100%;
    border: 1px solid #000;
    margin: 6px 0 0;
    page-break-inside: auto;
    break-inside: auto;
  }
  .annexure-card {
    width: 100%;
    border: none;
    background: #fff;
    page-break-inside: auto;
    break-inside: auto;
  }
  .annexure-card-title {
    border: 1px solid #000;
    border-bottom: none;
    padding: 8px 10px;
    text-align: center;
    background: #f2f2f2;
    page-break-after: avoid;
    break-after: avoid;
  }
  .annexure-card .annexure-table { border: none; width: 100%; }

  .annexure-ii {
    width: 100%;
    border: 1px solid #000;
    background: #fff;
    page-break-inside: auto;
    break-inside: auto;
  }
  .annexure-ii-title {
    border-bottom: 1px solid #000;
    padding: 8px 10px;
    text-align: center;
    background: #f2f2f2;
    font-weight: bold;
    font-size: 13px;
    letter-spacing: 0.3px;
    page-break-after: avoid;
    break-after: avoid;
  }
  .annexure-ii-meta {
    padding: 6px 14px 0;
    font-size: 11px;
    font-weight: 700;
    color: #333;
  }
  .annexure-ii-header {
    padding: 8px 14px 0;
    font-size: 13px;
    font-weight: 700;
  }
  .annexure-ii-comments { margin-top: 10px; }
  .annexure-ii-body {
    padding: 12px 14px;
    font-size: 12px;
    line-height: 1.5;
    color: #111;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  .annexure-ii-body p { margin: 6px 0; }
  .annexure-ii-body ul,
  .annexure-ii-body ol { margin: 6px 0 6px 22px; padding: 0; }
  .annexure-ii-body li { margin: 3px 0; }
  .annexure-ii-body h1,
  .annexure-ii-body h2,
  .annexure-ii-body h3 { margin: 10px 0 6px; font-weight: 700; }
  .annexure-ii-body img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 10px auto;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .annexure-ii-body figure {
    margin: 12px 0;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .annexure-ii-body figcaption {
    font-size: 11px;
    color: #333;
    margin-top: 4px;
  }
  .annexure-ii-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 8px 0;
  }
  .annexure-ii-body table td,
  .annexure-ii-body table th {
    border: 1px solid #000;
    padding: 5px 7px;
    font-size: 11px;
  }
  table.terms-compact th,
  table.terms-compact td { padding: 5px 7px; font-size: 11px; }

  /*
   * separate + spacing 0 keeps full black borders on page-break continuations.
   * collapse often drops the right/top edge on the next page in Chromium.
   */
  table.price, table.terms {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 0;
    border: none;
  }
  table.price th, table.price td,
  table.terms th, table.terms td {
    border-top: 1px solid #000;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    padding: 7px 9px;
    vertical-align: top;
    font-size: 12px;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  /* Avoid double lines between cells */
  table.price tr > * + *,
  table.terms tr > * + * {
    border-left: none;
  }
  table.price tr + tr > *,
  table.terms tr + tr > * {
    border-top: none;
  }

  /* Section title row inside thead — repeats on every continued page */
  table.terms th.section-title,
  table.price th.section-title {
    text-align: center;
    font-weight: bold;
    background: #f2f2f2;
    padding: 6px 8px;
    border: 1px solid #000;
  }
  table.terms thead tr.col-heads th,
  table.price thead tr.col-heads th {
    border-top: none;
  }

  table.price th, table.terms th { background: #f2f2f2; text-align: center; font-weight: bold; }
  table.price td, table.terms td { vertical-align: top; height: auto; }
  table.terms {
    table-layout: fixed;
  }
  table.terms th.head-col,
  table.terms td.head-col {
    width: 22%;
    text-align: left;
    font-weight: bold;
    vertical-align: top;
  }
  table.terms td { text-align: left; }
  table.terms td b,
  table.terms td strong,
  table.terms td .head-col b,
  table.terms td .head-col strong { font-weight: 700; }
  table.terms td i,
  table.terms td em { font-style: italic; }
  table.terms td u { text-decoration: underline; }
  table.terms col.col-sno,
  table.terms td.sno-col,
  table.terms th.sno-col {
    width: 8mm;
    max-width: 10mm;
    text-align: center;
    vertical-align: top;
    white-space: nowrap;
    padding-left: 2px;
    padding-right: 2px;
    font-weight: 700;
  }
  table.terms col.col-terms,
  table.terms th.col-terms,
  table.terms td.col-terms {
    width: auto;
  }
  table.price {
    table-layout: fixed;
  }
  table.price col.col-sl,
  table.price th.col-sl,
  table.price td.col-sl {
    width: 5%;
    text-align: center;
    vertical-align: top;
    white-space: nowrap;
    padding-left: 2px;
    padding-right: 2px;
  }
  table.price col.col-description { width: 40%; }
  table.price col.col-uom { width: 8%; }
  table.price col.col-qty { width: 6%; }
  table.price col.col-unit-rate,
  table.price col.col-rate { width: 15%; }
  table.price col.col-tax { width: 8%; }
  table.price col.col-total { width: 18%; }
  table.price th.col-uom,
  table.price td.col-uom,
  table.price th.col-qty,
  table.price td.col-qty,
  table.price th.col-tax,
  table.price td.col-tax,
  table.price th.col-sl,
  table.price th.col-total,
  table.price th.col-rate,
  table.price th.col-unit-rate {
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    word-wrap: normal !important;
  }
  table.price td.center, table.price th { text-align: center; }
  table.price td.right { text-align: right; }
  table.price td.amount-cell,
  table.price td.unit-rate-cell,
  table.price td.total-amount-cell,
  table.price td.col-rate,
  table.price td.col-unit-rate,
  table.price td.col-total {
    white-space: nowrap !important;
    word-break: keep-all !important;
    overflow-wrap: normal !important;
    word-wrap: normal !important;
    text-align: right;
    vertical-align: top;
    padding-left: 4px;
    padding-right: 4px;
  }
  table.price tr.total td { font-weight: bold; }
  table.price .spec-block p { margin: 6px 0; }

  table.terms thead, table.price thead { display: table-header-group; }
  table.terms tbody, table.price tbody { display: table-row-group; }
  table.terms tr { page-break-inside: avoid; break-inside: avoid; }
  table.price tbody.price-items tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table.price tbody.price-totals,
  table.price tbody.price-totals tr,
  table.price tr.amount-words-row {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  table.price tr.total {
    page-break-after: avoid;
    break-after: avoid;
  }

  /* One 1px frame on left, right, and bottom — same as top. Cell outer edges sit on the frame. */
  .table-frame table.price,
  .table-frame table.terms {
    border: none;
  }
  .table-frame table.price tr > *:first-child,
  .table-frame table.terms tr > *:first-child {
    border-left: none;
  }
  .table-frame table.price tr > *:last-child,
  .table-frame table.terms tr > *:last-child {
    border-right: none;
  }
  .table-frame table.price thead tr:first-child > *,
  .table-frame table.terms thead tr:first-child > * {
    border-top: none;
  }
  .table-frame table.price tbody tr:last-child > *,
  .table-frame table.terms tbody tr:last-child > * {
    border-bottom: none;
  }

  /* Closing row only at the end of the table — do not repeat as a page footer
     (repeating tfoot stretches empty column lines down the page). */
  table.price tfoot,
  table.terms tfoot {
    display: table-row-group !important;
  }
  table.price tfoot td,
  table.terms tfoot td {
    padding: 0 !important;
    height: 0;
    font-size: 0;
    line-height: 0;
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    border-left: 1px solid #000;
    border-right: 1px solid #000;
  }
  .table-frame table.price tfoot td,
  .table-frame table.terms tfoot td {
    border-left: none;
    border-right: none;
    border-bottom: none;
  }

  .amount-words-inner {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    font-size: 12.5px;
  }
  .amount-words-inner .label { font-weight: bold; white-space: nowrap; }
  .amount-words-inner .value {
    font-weight: bold;
    text-align: right;
    flex: 1;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }
  table.price tr.amount-words-row td {
    font-weight: bold;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  h2.annexure-title { text-align: center; margin: 0 0 2px 0; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  h3.annexure-sub { text-align: center; margin: 0; font-size: 12px; font-weight: 600; color: #333; }
  .special-notes, .ack-box {
    width: 100%;
    border: 1px solid #000;
    padding: 12px 16px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .special-notes p, .ack-box p { margin: 6px 0; }
  .special-notes .lbl { font-weight: bold; }
  .special-notes .inv-addr-plain { font-weight: normal; font-style: normal; font-family: inherit; }
  .sig-space { min-height: 72px; margin: 8px 0 12px; }
  .sig-space .sig-img {
    max-height: 90px;
    max-width: 260px;
    object-fit: contain;
    display: block;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
  }
  .sig-space .dsc-box {
    margin-top: 8px;
    max-width: 320px;
    border: 1.5px solid #1d4ed8;
    background: #eff6ff;
    padding: 8px 10px;
    font-size: 10px;
    line-height: 1.45;
    color: #1e3a8a;
  }
  .sig-space .dsc-box .dsc-title {
    font-weight: 800;
    font-size: 11px;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #1d4ed8;
    margin-bottom: 4px;
  }
  .sig-space .sig-img.sig-dsc {
    max-height: 120px;
    max-width: 360px;
    border-bottom: none;
    padding-bottom: 0;
  }
  .ack-box .sig-gap { height: 70px; }
`;
