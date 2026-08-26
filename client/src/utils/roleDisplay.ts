/** Friendly role labels for UI (keep system role codes unchanged for auth/API). */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'HOD Approver': 'L1 Manager',
  'PR Manager': 'L2 Manager',
};

export function formatRoleDisplayName(role?: string | null): string {
  if (!role) return '';
  return ROLE_DISPLAY_NAMES[role] || role;
}

