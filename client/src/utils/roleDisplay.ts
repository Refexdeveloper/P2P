/** Friendly role labels for UI (keep system role codes unchanged for auth/API). */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'HOD Approver': 'L1 Manager',
  'PR Manager': 'L2 Manager',
};

export function formatRoleDisplayName(role?: string | null): string {
  if (!role) return '';
  return ROLE_DISPLAY_NAMES[role] || role;
}

/** L1 (HOD Approver) or L2 (PR Manager) — used for manager RFQ quote summary layout. */
export function isL1OrL2Manager(role?: string | null): boolean {
  return role === 'HOD Approver' || role === 'PR Manager';
}

