export const DEFAULT_ANNEXURE_II_TITLE = 'ANNEXURE-II';

export function emptyAnnexureIiRow() {
  return { title: DEFAULT_ANNEXURE_II_TITLE, header: '', description: '', images: [], comments: '' };
}

function normalizeImage(img) {
  if (!img) return null;
  if (typeof img === 'string') {
    const src = img.trim();
    return src ? { src, caption: '' } : null;
  }
  const src = String(img.src || img.url || img.dataUrl || '').trim();
  if (!src) return null;
  return {
    src,
    caption: String(img.caption || img.label || '').trim(),
  };
}

function plainTitle(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveAnnexureIiTitle(row = {}) {
  return plainTitle(row.title) || DEFAULT_ANNEXURE_II_TITLE;
}

function normalizeRow(row = {}) {
  const images = Array.isArray(row.images)
    ? row.images.map(normalizeImage).filter(Boolean)
    : [];
  let title =
    plainTitle(row.title) ||
    plainTitle(row.annexureTitle) ||
    plainTitle(row.annexureHeading) ||
    '';
  let header = String(row.header || row.termsHeader || '');
  const headerPlain = plainTitle(header);
  // Legacy: user put ANNEXURE-IV in header while title stayed ANNEXURE-II — promote to single title
  if (/^ANNEXURE[\s\-–—_.]*([IVXLC]+|\d+)$/i.test(headerPlain)) {
    const m = headerPlain.match(/^ANNEXURE[\s\-–—_.]*([IVXLC]+|\d+)$/i);
    title = m ? `ANNEXURE-${String(m[1]).toUpperCase()}` : headerPlain.toUpperCase();
    header = '';
  }
  if (!title) title = DEFAULT_ANNEXURE_II_TITLE;
  return {
    title,
    header,
    description: String(row.description || row.termsDescription || row.html || ''),
    images,
    comments: String(row.comments || row.comment || row.remarks || ''),
  };
}

function htmlLooksEmpty(html) {
  return !String(html || '')
    .replace(/<img\b[^>]*>/gi, 'IMG')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function annexureIiRowIsEmpty(row) {
  const r = normalizeRow(row);
  return (
    htmlLooksEmpty(r.header) &&
    htmlLooksEmpty(r.description) &&
    !r.images.length &&
    !String(r.comments || '').trim()
  );
}

export function parseAnnexureIi(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(normalizeRow);
  if (typeof raw === 'object') {
    if (Array.isArray(raw.rows)) return raw.rows.map(normalizeRow);
    if (raw.header || raw.description || raw.images || raw.title) return [normalizeRow(raw)];
    return [];
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return parseAnnexureIi(JSON.parse(text));
    } catch {
      /* fall through as HTML */
    }
  }
  return [normalizeRow({ description: text })];
}

export function serializeAnnexureIi(rows) {
  const list = (Array.isArray(rows) ? rows : parseAnnexureIi(rows))
    .map(normalizeRow)
    .filter((row) => !annexureIiRowIsEmpty(row));
  if (!list.length) return '';
  return JSON.stringify({ v: 2, rows: list });
}

export function annexureIiHasContent(raw) {
  return parseAnnexureIi(raw).some((row) => !annexureIiRowIsEmpty(row));
}
