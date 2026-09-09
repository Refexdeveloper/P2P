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

/** Send a stored upload as inline preview (PDF/image) instead of a forced download. */
export function sendStoredFile(res, file) {
  if (!file) {
    return res.status(404).json({ message: 'File not found' });
  }
  const name = String(file.fileName || path.basename(file.fullPath || 'file')).replace(/"/g, '');
  res.setHeader('Content-Type', contentTypeForFileName(name));
  res.setHeader('Content-Disposition', `inline; filename="${name}"`);
  if (file.buffer?.length) {
    res.setHeader('Content-Length', file.buffer.length);
    return res.end(file.buffer);
  }
  if (file.fullPath && fs.existsSync(file.fullPath)) {
    return res.sendFile(file.fullPath);
  }
  return res.status(404).json({ message: 'File not found' });
}
