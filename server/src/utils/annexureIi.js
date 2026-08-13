export function emptyAnnexureIiRow() {
  return { header: '', description: '', images: [], comments: '' };
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

function normalizeRow(row = {}) {
  const images = Array.isArray(row.images)
    ? row.images.map(normalizeImage).filter(Boolean)
    : [];
  return {
    header: String(row.header || row.termsHeader || row.title || ''),
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
    if (raw.header || raw.description || raw.images) return [normalizeRow(raw)];
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
