/** Friendly role labels for UI (keep system role codes unchanged for auth/API). */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'HOD Approver': 'L1 Manager',
  'PR Manager': 'L2 Manager',
  CFO: 'Group CEO',
};

const MUGESH_EMAIL = 'mugesh.m@refex.co.in';

/** True when this user is Mugesh (Cloud Subscription actor — no designation in UI). */
export function isMugeshUser(userOrEmail?: { email?: string | null; name?: string | null } | string | null): boolean {
  if (!userOrEmail) return false;
  const email =
    typeof userOrEmail === 'string'
      ? userOrEmail
      : String(userOrEmail.email || '').trim().toLowerCase();
  if (email && email === MUGESH_EMAIL) return true;
  if (typeof userOrEmail !== 'string') {
    const name = String(userOrEmail.name || '')
      .trim()
      .toLowerCase();
    if (!email && name && (name === 'mugesh' || name.startsWith('mugesh '))) return true;
  }
  return false;
}

/**
 * Display label for a system role.
 * Mugesh must not show CFO / Group CEO (or any designation) on any page.
 */
export function formatRoleDisplayName(
  role?: string | null,
  userOrEmail?: { email?: string | null; name?: string | null } | string | null
): string {
  if (isMugeshUser(userOrEmail)) return '';
  if (!role) return '';
  // History rows may pass role "CFO" with Mugesh as the person — callers should pass email.
  return ROLE_DISPLAY_NAMES[role] || role;
}

/** Role beside a person in history/timeline — hides Mugesh designations. */
export function formatPersonRoleSuffix(
  role?: string | null,
  personNameOrEmail?: string | null,
  separator = ' · '
): string {
  if (isMugeshUser(personNameOrEmail) || isMugeshUser({ name: personNameOrEmail })) return '';
  const label = formatRoleDisplayName(role, personNameOrEmail ? { name: personNameOrEmail } : null);
  return label ? `${separator}${label}` : '';
}

/** L1 (HOD Approver) or L2 (PR Manager) — used for manager RFQ quote summary layout. */
export function isL1OrL2Manager(role?: string | null): boolean {
  return role === 'HOD Approver' || role === 'PR Manager';
}
