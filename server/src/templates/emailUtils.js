export function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Friendly role labels for emails (keep system role codes unchanged) */
export function formatRoleDisplayName(role) {
  const map = {
    'HOD Approver': 'L1 Manager',
    'PR Manager': 'L2 Manager',
  };
  return map[role] || role || 'Approver';
}

/** Display entity name (+ code) for email templates */
export function formatEntity(prOrPo) {
  const name = prOrPo?.entityName || prOrPo?.entity || '';
  const code = prOrPo?.entityCode || '';
  if (!name && !code) return '—';
  if (name && code) return `${name} (${code})`;
  return name || code;
}
