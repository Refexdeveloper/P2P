import path from 'path';
import fs from 'fs';

export function contentTypeForFileName(fileName) {
  const lower = String(fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.xlsx')) {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }
  return 'application/octet-stream';
}

/**
 * Safe Content-Disposition value. Node rejects non-ASCII / control chars in header values.
 * Uses ASCII filename= plus RFC 5987 filename*= for the real name.
 */
export function contentDispositionHeader(disposition, fileName) {
  const kind = disposition === 'attachment' ? 'attachment' : 'inline';
  const raw = String(fileName || 'attachment')
    .replace(/[\r\n\0]/g, ' ')
    .trim() || 'attachment';
  const ascii =
    raw
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '_')
      .trim() || 'attachment';
  const encoded = encodeURIComponent(raw)
    .replace(/['()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Send a stored upload as inline preview (PDF/image) instead of a forced download. */
export function sendStoredFile(res, file) {
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }
  const name = String(file.fileName || path.basename(file.fullPath || 'file'));
  res.setHeader('Content-Type', contentTypeForFileName(name));
  res.setHeader('Content-Disposition', contentDispositionHeader('inline', name));
  if (file.buffer?.length) {
    res.setHeader('Content-Length', file.buffer.length);
    return res.end(file.buffer);
  }
  if (file.fullPath && fs.existsSync(file.fullPath)) {
    return res.sendFile(file.fullPath);
  }
  return res.status(404).json({ message: 'File not found' });
}
