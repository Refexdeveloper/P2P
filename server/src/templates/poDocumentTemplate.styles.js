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
  /** Space for full letterhead footer HTML + page number */
  bottom: '48mm',
  side: '10mm',
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
  @page { size: A4; }
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
    display: block;
    width: 100%;
    background: #fff;
    margin: 8px 0 0;
    padding: 4px 0 0;
    border: none;
  }
  .pdf-run-footer-inner {
    text-align: center;
    font-size: 13px;
    line-height: 1.45;
    color: #222;
    border: none;
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
    body.po-document-preview .page-sheet .pdf-run-footer { margin-top: auto; }
  }

  @media print {
    body.po-document {
      max-width: none;
      width: 100%;
      margin: 0;
      padding: 0 !important;
    }

    table.doc-shell > thead { display: table-header-group !important; }
    table.doc-shell > tfoot { display: table-footer-group !important; }

    .pdf-run-header { margin: 0 0 8px; }
    .pdf-run-footer {
      display: block !important;
      margin: 6px 0 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .page-sheet { margin: 0; padding: 0; width: 100%; }

    .page-body,
    .info-box,
    .table-frame,
    .annexure-card,
    .special-notes,
    .ack-box,
    .amount-words,
    table.price,
    table.terms {
      width: 100% !important;
      max-width: 100% !important;
    }
  }

  .logo { font-size: 30px; font-weight: 800; font-style: italic; letter-spacing: -1px; }
  .logo .r1 { color: #2e3192; } .logo .e1 { color: #27aae1; } .logo .f { color: #39b54a; }
  .logo .e2 { color: #8dc63f; } .logo .x { color: #f7941d; }

  .title { text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 1px; margin: 8px 0 12px 0; }
  .po-meta { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; font-size: 13px; width: 100%; }

  .info-box {
    border: 1px solid #000;
    padding: 10px 14px;
    margin-bottom: 14px;
    page-break-inside: avoid;
    break-inside: avoid;
    width: 100%;
  }
  .info-box p { margin: 3px 0; }
  .info-box a { color: #1155cc; text-decoration: underline; }

  .table-frame {
    width: 100%;
    border: none;
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
  table.terms th.head-col, table.terms td.head-col { width: 18%; text-align: left; font-weight: bold; }
  table.terms td { text-align: left; }
  table.terms td.sno-col, table.terms th.sno-col { width: 6%; text-align: center; }
  table.price td.center, table.price th { text-align: center; }
  table.price td.right { text-align: right; }
  table.price tr.total td { font-weight: bold; }
  table.price .spec-block p { margin: 6px 0; }

  table.terms thead, table.price thead { display: table-header-group; }
  table.terms tbody, table.price tbody { display: table-row-group; }
  table.terms tr { page-break-inside: avoid; break-inside: avoid; }
  table.price tr { page-break-inside: auto; break-inside: auto; }

  .amount-words {
    width: 100%;
    border: 1px solid #000;
    border-top: none;
    padding: 8px 10px;
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .amount-words .label { font-weight: bold; white-space: nowrap; margin-right: 10px; }
  .amount-words .value {
    font-weight: bold;
    text-align: right;
    flex: 1;
    min-width: 0;
    white-space: normal;
    overflow-wrap: anywhere;
  }

  h2.annexure-title { text-align: center; margin: 0 0 2px 0; font-size: 14px; font-weight: 700; letter-spacing: 0.5px; }
  h3.annexure-sub { text-align: center; margin: 0; font-size: 12px; font-weight: 600; color: #333; }
  .special-notes, .ack-box {
    width: 100%;
    border: 1px solid #000;
    padding: 12px 16px;
    page-break-inside: auto;
    break-inside: auto;
  }
  .special-notes p, .ack-box p { margin: 6px 0; }
  .special-notes .lbl { font-weight: bold; }
  .sig-space { min-height: 72px; margin: 8px 0 12px; }
  .sig-space .sig-img {
    max-height: 90px;
    max-width: 260px;
    object-fit: contain;
    display: block;
    border-bottom: 1px solid #ccc;
    padding-bottom: 4px;
  }
  .ack-box .sig-gap { height: 70px; }
  .letterhead-block { margin-bottom: 10px; width: 100%; }
`;
