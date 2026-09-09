/** Friendly role labels for UI (keep system role codes unchanged for auth/API). */
const ROLE_DISPLAY_NAMES: Record<string, string> = {
  'HOD Approver': 'L1 Manager',
  'PR Manager': 'L2 Manager',
  CFO: 'Group CEO',
};

const MUGESH_EMAIL = 'mugesh.m@refex.co.in';
const SRIVATHS_EMAIL = 'srivaths.varadharajan@refex.co.in';

function personEmail(userOrEmail?: { email?: string | null; name?: string | null } | string | null): string {
  if (!userOrEmail) return '';
  return typeof userOrEmail === 'string'
    ? userOrEmail.trim().toLowerCase()
    : String(userOrEmail.email || '')
        .trim()
        .toLowerCase();
}

function personName(userOrEmail?: { email?: string | null; name?: string | null } | string | null): string {
  if (!userOrEmail || typeof userOrEmail === 'string') return '';
  return String(userOrEmail.name || '')
    .trim()
    .toLowerCase();
}

/** True when this user is Mugesh (Cloud Subscription actor — no designation in UI). */
export function isMugeshUser(userOrEmail?: { email?: string | null; name?: string | null } | string | null): boolean {
  if (!userOrEmail) return false;
  const email = personEmail(userOrEmail);
  if (email && (email === MUGESH_EMAIL || email.includes('mugesh.m@'))) return true;
  if (typeof userOrEmail === 'string') {
    const s = userOrEmail.trim().toLowerCase();
    return s === 'mugesh' || s.startsWith('mugesh ') || s.startsWith('mugesh.');
  }
  const name = personName(userOrEmail);
  if (!email && name && (name === 'mugesh' || name.startsWith('mugesh '))) return true;
  return false;
}

/** True when this user is Srivaths (L2) — show CTO, never CFO. */
export function isSrivathsUser(
  userOrEmail?: { email?: string | null; name?: string | null } | string | null
): boolean {
  if (!userOrEmail) return false;
  const email = personEmail(userOrEmail);
  if (email && (email === SRIVATHS_EMAIL || email.includes('srivaths.varadharajan@'))) return true;
  const raw =
    typeof userOrEmail === 'string'
      ? userOrEmail.trim().toLowerCase()
      : personName(userOrEmail);
  if (raw && (raw === 'srivaths' || raw.startsWith('srivaths ') || raw.startsWith('srivaths.'))) return true;
  return false;
}

/**
 * Display label for a system role.
 * Mugesh: no designation. Srivaths: CTO (system role may still be CFO).
 */
export function formatRoleDisplayName(
  role?: string | null,
  userOrEmail?: { email?: string | null; name?: string | null } | string | null
): string {
  if (isMugeshUser(userOrEmail)) return '';
  if (isSrivathsUser(userOrEmail)) return 'CTO';
  if (!role) return '';
  return ROLE_DISPLAY_NAMES[role] || role;
}

/** Role beside a person in history/timeline — hides Mugesh designations. */
export function formatPersonRoleSuffix(
  role?: string | null,
  personNameOrEmail?: string | null,
  separator = ' · '
): string {
  if (isMugeshUser(personNameOrEmail) || isMugeshUser({ name: personNameOrEmail })) return '';
  const label = formatRoleDisplayName(role, personNameOrEmail ? { name: personNameOrEmail, email: personNameOrEmail } : null);
  return label ? `${separator}${label}` : '';
}

/** L1 (HOD Approver) or L2 (PR Manager) — used for manager RFQ quote summary layout. */
export function isL1OrL2Manager(role?: string | null): boolean {
  return role === 'HOD Approver' || role === 'PR Manager';
}
