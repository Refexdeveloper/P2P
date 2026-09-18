export interface AnnexureIiRow {
  /** Gray bar on PDF — e.g. ANNEXURE-II, ANNEXURE-III, ANNEXURE-IV */
  title?: string;
  header: string;
  description: string;
  images?: Array<{ src: string; caption?: string }>;
  comments?: string;
}

export const DEFAULT_ANNEXURE_II_TITLE = 'ANNEXURE-II';

export function emptyAnnexureIiRow(): AnnexureIiRow {
  return { title: DEFAULT_ANNEXURE_II_TITLE, header: '', description: '', images: [], comments: '' };
}

function htmlLooksEmpty(html: string) {
  return !String(html || '')
    .replace(/<img\b[^>]*>/gi, 'IMG')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function plainTitle(value: unknown) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveAnnexureIiTitle(row: Partial<AnnexureIiRow> | null | undefined) {
  return plainTitle(row?.title) || DEFAULT_ANNEXURE_II_TITLE;
}

export function annexureIiRowIsEmpty(row: AnnexureIiRow) {
  return (
    htmlLooksEmpty(row.header) &&
    htmlLooksEmpty(row.description) &&
    !(row.images || []).length &&
    !String(row.comments || '').trim()
  );
}

function normalizeRow(row: Record<string, unknown> | AnnexureIiRow = {}): AnnexureIiRow {
  const raw = row as Record<string, unknown>;
  const images = Array.isArray(raw.images)
    ? raw.images
        .map((img) => {
          if (!img) return null;
          if (typeof img === 'string') return img.trim() ? { src: img.trim(), caption: '' } : null;
          const rec = img as Record<string, unknown>;
          const src = String(rec.src || rec.url || rec.dataUrl || '').trim();
          if (!src) return null;
          return { src, caption: String(rec.caption || rec.label || '').trim() };
        })
        .filter(Boolean) as Array<{ src: string; caption?: string }>
    : [];
  let title =
    plainTitle(raw.title) ||
    plainTitle(raw.annexureTitle) ||
    plainTitle(raw.annexureHeading) ||
    '';
  let header = String(raw.header || raw.termsHeader || '');
  const headerPlain = plainTitle(header);
  // Legacy: ANNEXURE-IV typed in section header → single top-bar title
  if (/^ANNEXURE[\s\-–—_.]*([IVXLC]+|\d+)$/i.test(headerPlain)) {
    const m = headerPlain.match(/^ANNEXURE[\s\-–—_.]*([IVXLC]+|\d+)$/i);
    title = m ? `ANNEXURE-${String(m[1]).toUpperCase()}` : headerPlain.toUpperCase();
    header = '';
  }
  if (!title) title = DEFAULT_ANNEXURE_II_TITLE;
  return {
    title,
    header,
    description: String(raw.description || raw.termsDescription || raw.html || ''),
    images,
    comments: String(raw.comments || raw.comment || raw.remarks || ''),
  };
}

export function parseAnnexureIi(raw: unknown): AnnexureIiRow[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((row) => normalizeRow(row as Record<string, unknown>));
  if (typeof raw === 'object' && raw) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.rows)) return obj.rows.map((row) => normalizeRow(row as Record<string, unknown>));
    if (obj.header || obj.description || obj.images || obj.title) return [normalizeRow(obj)];
    return [];
  }
  const text = String(raw).trim();
  if (!text) return [];
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return parseAnnexureIi(JSON.parse(text));
    } catch {
      /* treat as HTML */
    }
  }
  return [normalizeRow({ description: text })];
}

export function serializeAnnexureIi(rows: AnnexureIiRow[] | string) {
  const list = (Array.isArray(rows) ? rows : parseAnnexureIi(rows))
    .map((row) => normalizeRow(row))
    .filter((row) => !annexureIiRowIsEmpty(row));
  if (!list.length) return '';
  return JSON.stringify({ v: 2, rows: list });
}
