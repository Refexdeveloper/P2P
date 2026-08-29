/** Draft saves use DRAFT-{id} and do not consume the official FY sequence. */
export function isDraftPlaceholderPrNumber(prNumber?: string | null): boolean {
  return String(prNumber || '').trim().toUpperCase().startsWith('DRAFT-');
}

export function formatPrNumberDisplay(prNumber?: string | null, status?: string | null): string {
  const raw = String(prNumber || '').trim();
  if (!raw || raw === 'Auto on save') return 'Assigned on submit';
  if (isDraftPlaceholderPrNumber(raw) && String(status || '').toUpperCase() === 'DRAFT') {
    return 'Draft — PR# on submit';
  }
  return raw;
}
