/**
 * Single margin system for PO PDF — used by Puppeteer + preview CSS.
 * Every page: same left/right/top/bottom content inset.
 */
export const PO_PDF_LAYOUT = {
  /** Left & right margin on every page (mm) */
  marginMm: 15,
  /** Top margin — header is in-document (same as preview); keep a light band (mm) */
  topMm: 12,
  /** Bottom margin — room for Puppeteer page number only (mm) */
  bottomMm: 14,
};

export const PO_STYLES = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }

  body.po-document {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 12.5px;
    color: #1a1a1a;
    max-width: calc(210mm - ${PO_PDF_LAYOUT.marginMm * 2}mm);
    margin: 0 auto;
    padding: ${PO_PDF_LAYOUT.topMm}mm ${PO_PDF_LAYOUT.marginMm}mm ${PO_PDF_LAYOUT.bottomMm}mm;
    line-height: 1.35;
    background: #fff;
  }

  /* Running chrome unused — PDF uses the same in-sheet header/footer as preview */
  .running-header, .running-footer { display: none !important; }

  .page-sheet {
    width: 100%;
    margin: 0 0 20px;
    padding: 0;
    page-break-after: always;
    break-after: page;
  }
  .page-sheet:last-child { page-break-after: auto; break-after: auto; margin-bottom: 0; }
  .page-terms { page-break-before: always; break-before: page; }
  .page-annexure { page-break-before: always; break-before: page; }

  @media print {
    body.po-document {
      max-width: none;
      width: 100%;
      margin: 0;
      padding: 0;
    }

    /* Keep the same header/footer as HTML preview (do not hide for PDF) */
    .page-sheet > .doc-header,
    .page-sheet > .doc-footer {
      display: block !important;
      visibility: visible !important;
    }

    .page-sheet {
      margin: 0;
      padding: 0;
      width: 100%;
    }

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

  .header { display: flex; justify-content: flex-end; align-items: flex-start; margin-bottom: 6px; width: 100%; }
  .header-custom { width: 100%; }
  .header-logo-img { max-height: 52px; max-width: 200px; object-fit: contain; display: block; margin-left: auto; }
  .footer-custom { text-align: center; margin-top: 8px; padding-top: 4px; width: 100%; }
  .footer-custom .footer-master-content {
    width: 100%;
    margin: 0 auto;
    text-align: center;
  }
  .footer-custom .footer-master-content img {
    max-width: 100%;
    height: auto;
    max-height: 88px;
    display: block;
    margin: 0 auto;
  }
  .footer-master-content table {
    width: 100% !important;
    max-width: 100%;
    margin: 0 auto;
    border-collapse: collapse;
    table-layout: fixed;
  }
  .footer-master-content td,
  .footer-master-content th {
    vertical-align: top;
    text-align: left;
    font-size: 8.5px;
    line-height: 1.35;
    padding: 0 6px;
    word-break: break-word;
  }
  .footer-master-content td:first-child { padding-left: 0; }
  .footer-master-content td:last-child { padding-right: 0; }
  .footer-master-content div[style*="display: flex"],
  .footer-master-content div[style*="display:flex"] {
    display: flex !important;
    justify-content: space-between !important;
    align-items: flex-start !important;
    gap: 12px;
    width: 100%;
    text-align: left;
  }
  .footer-master-content div[style*="display: flex"] > div,
  .footer-master-content div[style*="display:flex"] > div {
    flex: 1 1 0;
    min-width: 0;
    text-align: left;
  }
  .footer .offices {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    text-align: left;
    margin-top: 4px;
  }
  .footer .office-col { flex: 1 1 0; font-size: 9px; line-height: 1.35; }
  .footer-logo-img {
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: 90px;
    object-fit: contain;
    object-position: center;
    display: block;
    margin: 0 auto;
  }
  .footer-custom .pagenum,
  .footer .pagenum { display: none; }
  .logo { font-size: 30px; font-weight: 800; font-style: italic; letter-spacing: -1px; }
  .logo .r1 { color: #2e3192; } .logo .e1 { color: #27aae1; } .logo .f { color: #39b54a; }
  .logo .e2 { color: #8dc63f; } .logo .x { color: #f7941d; }
  .title { text-align: center; font-weight: bold; font-size: 16px; letter-spacing: 1px; margin: 10px 0 14px 0; }
  .po-meta { display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 10px; font-size: 13px; width: 100%; }
  .info-box { border: 1px solid #000; padding: 10px 14px; margin-bottom: 16px; page-break-inside: avoid; width: 100%; }
  .info-box p { margin: 3px 0; }
  .info-box a { color: #1155cc; text-decoration: underline; }

  .table-frame {
    width: 100%;
    border: 1px solid #000;
    margin: 6px 0 0;
    page-break-inside: auto;
    break-inside: auto;
  }
  .annexure-card {
    width: 100%;
    border: 1px solid #000;
    background: #fff;
    page-break-inside: auto;
    break-inside: auto;
  }
  .annexure-card-title {
    border-bottom: 1px solid #000;
    padding: 8px 10px;
    text-align: center;
    background: #f2f2f2;
    page-break-after: avoid;
    break-after: avoid;
  }
  .annexure-card .annexure-table { border: none; width: 100%; }
  .annexure-card .annexure-table thead th { border-top: none; }
  table.terms-compact th,
  table.terms-compact td { padding: 5px 7px; font-size: 11px; }

  table.price, table.terms {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 0;
  }
  table.price caption, table.terms caption {
    caption-side: top;
    font-weight: bold;
    padding: 6px 8px;
    text-align: center;
    background: #f2f2f2;
    border-bottom: 1px solid #000;
  }
  table.price th, table.price td,
  table.terms th, table.terms td {
    border-right: 1px solid #000;
    border-bottom: 1px solid #000;
    border-top: none;
    border-left: none;
    padding: 7px 9px;
    vertical-align: top;
    font-size: 12px;
    word-wrap: break-word;
    overflow-wrap: anywhere;
  }
  table.price th:last-child, table.price td:last-child,
  table.terms th:last-child, table.terms td:last-child { border-right: none; }
  table.price tr:last-child th, table.price tr:last-child td,
  table.terms tr:last-child th, table.terms tr:last-child td { border-bottom: none; }
  .annexure-card .annexure-table tr:last-child th,
  .annexure-card .annexure-table tr:last-child td { border-bottom: none; }
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
  table.terms tr, table.price tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .amount-words {
    width: 100%;
    border: 1px solid #000;
    padding: 8px 10px;
    display: flex;
    justify-content: space-between;
    font-size: 12.5px;
    page-break-inside: avoid;
  }
  .table-frame + .amount-words { border-top: none; }
  .amount-words .label { font-weight: bold; white-space: nowrap; margin-right: 10px; }
  .amount-words .value { font-weight: bold; text-align: right; }
  .footer { text-align: center; margin-top: 10px; padding-top: 4px; width: 100%; }
  .footer .brand { font-weight: bold; color: #2e3192; font-size: 12px; }
  .footer .sub { font-size: 9px; color: #333; margin-bottom: 4px; }
  .footer .cin-bar {
    display: inline-block;
    background: linear-gradient(90deg,#2e3192,#27aae1,#39b54a,#f7941d);
    color: #fff;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: bold;
    margin: 4px 0;
  }
  .footer .reg { font-size: 8.5px; color: #333; margin-top: 2px; }
  .footer hr { border: none; border-top: 2px solid #27aae1; margin: 4px 0; }
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
  .sig-space { min-height: 60px; margin: 8px 0 12px; }
  .sig-space .sig-img {
    max-height: 70px;
    max-width: 220px;
    object-fit: contain;
    display: block;
  }
  .ack-box .sig-gap { height: 70px; }
  .letterhead-block { margin-bottom: 10px; width: 100%; }
`;
