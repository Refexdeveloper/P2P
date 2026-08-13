import pool from '../config/db.js';

export const SUPER_ADMIN_ROLE = 'Super Admin';

export const NAV_ITEMS = [
  { code: 'nav.requester_dashboard', label: 'Dashboard', path: '/requester/dashboard', icon: 'ri-dashboard-line', group: 'Requester', sort: 10 },
  { code: 'nav.create_pr', label: 'Create PR', path: '/requester/create-pr', icon: 'ri-add-circle-line', group: 'Requester', sort: 11 },
  { code: 'nav.rfq_entry', label: 'RFQ Entry', path: '/requester/rfq-entry', icon: 'ri-file-edit-line', group: 'Requester', sort: 12 },
  { code: 'nav.track_pr', label: 'Track PR', path: '/requester/track-pr', icon: 'ri-search-line', group: 'Requester', sort: 13 },
  { code: 'nav.pr_manager_dashboard', label: 'My Tasks', path: '/tasks', icon: 'ri-task-line', group: 'L2 Manager', sort: 20 },
  { code: 'nav.rfq_approval', label: 'RFQ Approval', path: '/rfq-approval', icon: 'ri-bar-chart-box-line', group: 'Approvals', sort: 30 },
  { code: 'nav.tasks', label: 'My Tasks', path: '/tasks', icon: 'ri-task-line', group: 'General', sort: 40 },
  { code: 'nav.cfo_dashboard', label: 'Dashboard', path: '/cfo/dashboard', icon: 'ri-dashboard-line', group: 'CFO', sort: 50 },
  { code: 'nav.home_dashboard', label: 'Dashboard', path: '/', icon: 'ri-dashboard-line', group: 'General', sort: 5 },
  { code: 'nav.purchase_requests', label: 'Dashboard', path: '/scm/purchase-requests', icon: 'ri-dashboard-line', group: 'SCM', sort: 60 },
  { code: 'nav.scm_rfq_entry', label: 'RFQ Entry', path: '/scm/rfq-entry', icon: 'ri-file-list-line', group: 'SCM', sort: 61 },
  { code: 'nav.scm_manager_dashboard', label: 'Dashboard', path: '/scm/manager-dashboard', icon: 'ri-dashboard-line', group: 'SCM Manager', sort: 65 },
  { code: 'nav.create_po', label: 'Create PO', path: '/scm/create-po', icon: 'ri-shopping-cart-2-line', group: 'SCM', sort: 62 },
  { code: 'nav.track_po', label: 'Track PO', path: '/scm/track-po', icon: 'ri-search-eye-line', group: 'SCM', sort: 63 },
  { code: 'nav.po_excel_import', label: 'PO Excel Import', path: '/scm/po-excel-import', icon: 'ri-file-excel-2-line', group: 'SCM', sort: 64 },
  { code: 'nav.item_master', label: 'Item Master', path: '/scm/item-master', icon: 'ri-box-3-line', group: 'Masters', sort: 200 },
  { code: 'nav.vendor_master', label: 'Vendor Master', path: '/scm/vendor-master', icon: 'ri-store-2-line', group: 'Masters', sort: 201 },
  { code: 'nav.category_master', label: 'Category Master', path: '/scm/category-master', icon: 'ri-price-tag-3-line', group: 'Masters', sort: 202 },
  { code: 'nav.entity_master', label: 'Entity Master', path: '/scm/entity-master', icon: 'ri-building-2-line', group: 'Masters', sort: 205 },
  { code: 'nav.department_master', label: 'Department Master', path: '/scm/department-master', icon: 'ri-organization-chart', group: 'Masters', sort: 206 },
  { code: 'nav.po_letterhead_master', label: 'PO Type Master', path: '/scm/po-type-master', icon: 'ri-file-list-3-line', group: 'Masters', sort: 203 },
  { code: 'nav.letterhead_master', label: 'Letterhead Master', path: '/scm/letterhead-master', icon: 'ri-layout-top-2-line', group: 'Masters', sort: 204 },
  { code: 'nav.vendor_quotation', label: 'Vendor Quotation Portal', path: '/scm/vendor-quotation-portal', icon: 'ri-price-tag-3-line', group: 'SCM', sort: 66 },
  { code: 'nav.vendor_comparison', label: 'Vendor Comparison', path: '/scm/vendor-comparison', icon: 'ri-bar-chart-box-line', group: 'SCM', sort: 67 },
  { code: 'nav.technical_clearance', label: 'Technical Clearance', path: '/scm/technical-clearance', icon: 'ri-shield-check-line', group: 'SCM', sort: 68 },
  { code: 'nav.po_approval', label: 'PO Approval', path: '/scm/po-approval', icon: 'ri-checkbox-circle-line', group: 'SCM', sort: 69 },
  { code: 'nav.buyer_final_verify', label: 'Buyer Final Verify', path: '/scm/buyer-final-verify', icon: 'ri-shield-check-line', group: 'SCM', sort: 70 },
  { code: 'nav.vendor_po_acceptance', label: 'Vendor PO Acceptance', path: '/scm/vendor-po-acceptance', icon: 'ri-shake-hands-line', group: 'SCM', sort: 71 },
  { code: 'nav.vendor_invoice', label: 'Vendor Invoice', path: '/scm/vendor-invoice', icon: 'ri-file-invoice-line', group: 'SCM', sort: 72 },
  { code: 'nav.grn', label: 'GRN', path: '/grn', icon: 'ri-truck-line', group: 'SCM', sort: 73 },
  { code: 'nav.accounts_dashboard', label: 'Accounts Dashboard', path: '/accounts/dashboard', icon: 'ri-dashboard-line', group: 'Accounts', sort: 79 },
  { code: 'nav.invoice_verification', label: 'Invoice Verification', path: '/accounts/invoice-verification', icon: 'ri-file-check-2-line', group: 'Accounts', sort: 80 },
  { code: 'nav.payment', label: 'Payment', path: '/accounts/payment', icon: 'ri-money-rupee-circle-line', group: 'Accounts', sort: 81 },
  { code: 'nav.payment_authorization', label: 'Payment Authorization', path: '/accounts/scm-payment-approval', icon: 'ri-shield-check-line', group: 'SCM Manager', sort: 82 },
  { code: 'nav.functional_evaluate', label: 'Evaluate PR', path: '/functional/evaluate-pr', icon: 'ri-dashboard-line', group: 'Functional', sort: 90 },
  { code: 'nav.tech_evaluation', label: 'Technical Evaluation', path: '/tech-evaluator/rfq-evaluation', icon: 'ri-star-line', group: 'Tech', sort: 100 },
  { code: 'nav.vendor_dashboard', label: 'Dashboard', path: '/vendor/dashboard', icon: 'ri-dashboard-line', group: 'Vendor', sort: 110 },
  { code: 'nav.admin_users', label: 'User Permissions', path: '/admin/user-permissions', icon: 'ri-shield-user-line', group: 'Admin', sort: 1 },
  { code: 'nav.admin_email_logs', label: 'Notification Logs', path: '/admin/email-logs', icon: 'ri-notification-3-line', group: 'Admin', sort: 2 },
];

export const ROLE_DEFAULT_PERMISSIONS = {
  Requester: [
    'nav.requester_dashboard',
    'nav.create_pr',
    'nav.rfq_entry',
    'nav.track_pr',
    'nav.item_master',
    'nav.vendor_master',
    'nav.category_master',
    'nav.entity_master',
    'nav.department_master',
  ],
  'PR Manager': ['nav.pr_manager_dashboard', 'nav.rfq_approval'],
  CFO: ['nav.cfo_dashboard', 'nav.rfq_approval', 'nav.tasks'],
  'HOD Approver': ['nav.tasks', 'nav.rfq_approval'],
  'SCM Buyer': [
    'nav.purchase_requests',
    'nav.rfq_approval',
    'nav.tasks',
    'nav.create_po',
    'nav.scm_rfq_entry',
    'nav.track_po',
    'nav.po_excel_import',
    'nav.item_master',
    'nav.vendor_master',
    'nav.category_master',
    'nav.entity_master',
    'nav.department_master',
    'nav.po_letterhead_master',
    'nav.letterhead_master',
    'nav.vendor_quotation',
    'nav.vendor_comparison',
    'nav.technical_clearance',
    'nav.po_approval',
    'nav.buyer_final_verify',
    'nav.vendor_po_acceptance',
    'nav.vendor_invoice',
    'nav.grn',
  ],
  'SCM Manager': [
    'nav.scm_manager_dashboard',
    'nav.po_approval',
    'nav.rfq_approval',
    'nav.payment_authorization',
    'nav.tasks',
    'nav.item_master',
    'nav.vendor_master',
    'nav.category_master',
    'nav.entity_master',
    'nav.department_master',
    'nav.po_letterhead_master',
    'nav.letterhead_master',
  ],
  'Accounts Payable': ['nav.accounts_dashboard', 'nav.invoice_verification', 'nav.payment'],
  'Accounts Manager': [
    'nav.accounts_dashboard',
    'nav.invoice_verification',
    'nav.payment',
    'nav.payment_authorization',
  ],
  'Functional Team': ['nav.functional_evaluate', 'nav.tasks'],
  'Tech Evaluator': ['nav.tech_evaluation'],
  Vendor: ['nav.vendor_dashboard', 'nav.vendor_quotation', 'nav.vendor_po_acceptance', 'nav.vendor_invoice'],
  [SUPER_ADMIN_ROLE]: NAV_ITEMS.map((n) => n.code),
};

export const ASSIGNABLE_ROLES = Object.keys(ROLE_DEFAULT_PERMISSIONS).filter(
  (role) => role !== SUPER_ADMIN_ROLE
);

export function isSuperAdmin(role) {
  return role === SUPER_ADMIN_ROLE;
}

export async function seedNavigationPermissions() {
  for (const item of NAV_ITEMS) {
    await pool.query(
      `INSERT INTO navigation_permissions (code, label, path, icon, nav_group, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE label = VALUES(label), path = VALUES(path), icon = VALUES(icon),
       nav_group = VALUES(nav_group), sort_order = VALUES(sort_order)`,
      [item.code, item.label, item.path, item.icon, item.group, item.sort]
    );
  }
}

export async function getUserPermissionCodes(userId, role) {
  if (isSuperAdmin(role)) {
    return NAV_ITEMS.map((n) => n.code);
  }

  const defaults = ROLE_DEFAULT_PERMISSIONS[role] || ['nav.home_dashboard', 'nav.tasks'];
  const validCodes = new Set(NAV_ITEMS.map((n) => n.code));

  const [rows] = await pool.query(
    `SELECT permission_code FROM user_permissions WHERE user_id = ? ORDER BY permission_code`,
    [userId]
  );

  if (rows.length) {
    const stored = rows.map((r) => r.permission_code).filter((c) => validCodes.has(c));
    // Stored rows exist but none map to real nav items → use role defaults
    // (fixes SSO users left with empty/stale permission rows → sidebar logout-only)
    if (stored.length) {
      // Heal: L2 Manager should not have both My Tasks nav codes
      if (role === 'PR Manager') {
        if (!stored.includes('nav.pr_manager_dashboard') && validCodes.has('nav.pr_manager_dashboard')) {
          stored.push('nav.pr_manager_dashboard');
          await pool.query(
            `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
            [userId, 'nav.pr_manager_dashboard']
          );
        }
        if (stored.includes('nav.tasks')) {
          const idx = stored.indexOf('nav.tasks');
          if (idx >= 0) stored.splice(idx, 1);
          await pool.query(
            `DELETE FROM user_permissions WHERE user_id = ? AND permission_code = 'nav.tasks'`,
            [userId]
          );
        }
        if (!stored.includes('nav.rfq_approval') && validCodes.has('nav.rfq_approval')) {
          stored.push('nav.rfq_approval');
          await pool.query(
            `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
            [userId, 'nav.rfq_approval']
          );
        }
      }
      // Heal: Requester + SCM roles always get Masters menu permissions
      if (role === 'Requester' || role === 'SCM Buyer' || role === 'SCM Manager') {
        const healCodes = [
          'nav.item_master', 'nav.vendor_master', 'nav.category_master',
          'nav.entity_master', 'nav.department_master',
        ];
        if (role === 'Requester') {
          healCodes.push(
            'nav.requester_dashboard',
            'nav.create_pr',
            'nav.rfq_entry',
            'nav.track_pr'
          );
        }
        if (role === 'SCM Buyer' || role === 'SCM Manager') {
          healCodes.push('nav.po_letterhead_master', 'nav.letterhead_master');
        }
        if (role === 'SCM Buyer') {
          healCodes.push(
            'nav.purchase_requests',
            'nav.rfq_approval',
            'nav.tasks',
            'nav.create_po',
            'nav.scm_rfq_entry',
            'nav.buyer_final_verify',
            'nav.track_po',
            'nav.po_excel_import'
          );
        }
        if (role === 'SCM Manager') {
          healCodes.push('nav.scm_manager_dashboard', 'nav.po_approval', 'nav.rfq_approval');
        }
        for (const code of healCodes) {
          if (!stored.includes(code) && validCodes.has(code)) {
            stored.push(code);
            await pool.query(
              `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
              [userId, code]
            );
          }
        }
      }
      return stored;
    }
  }

  return defaults;
}

export async function getUserNavigation(userId, role) {
  let codes = await getUserPermissionCodes(userId, role);
  let codeSet = new Set(codes);
  let nav = NAV_ITEMS.filter((n) => codeSet.has(n.code)).sort((a, b) => a.sort - b.sort);

  // Safety net: never return an empty sidebar for a known role
  if (!nav.length && !isSuperAdmin(role)) {
    const defaults = ROLE_DEFAULT_PERMISSIONS[role] || [];
    codeSet = new Set(defaults);
    nav = NAV_ITEMS.filter((n) => codeSet.has(n.code)).sort((a, b) => a.sort - b.sort);

    // Heal DB so next login is correct
    if (defaults.length) {
      for (const code of defaults) {
        await pool.query(
          `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
          [userId, code]
        );
      }
    }
  }

  // SCM Manager: Dashboard → PO Approval → RFQ Approval → …
  // SCM Buyer: Dashboard → RFQ Entry → …
  if (role === 'SCM Manager' || role === 'SCM Buyer') {
    const order = ROLE_DEFAULT_PERMISSIONS[role] || [];
    const rank = new Map(order.map((code, i) => [code, i]));
    nav.sort((a, b) => {
      const ai = rank.has(a.code) ? rank.get(a.code) : 1000 + a.sort;
      const bi = rank.has(b.code) ? rank.get(b.code) : 1000 + b.sort;
      return ai - bi;
    });
  }

  // One menu entry per path (avoids duplicate My Tasks for L2 Manager, Super Admin, etc.)
  const byPath = new Map();
  for (const item of nav) {
    const prev = byPath.get(item.path);
    if (!prev) {
      byPath.set(item.path, item);
      continue;
    }
    const prevGeneric = prev.code === 'nav.tasks' || prev.code === 'nav.home_dashboard';
    const nextGeneric = item.code === 'nav.tasks' || item.code === 'nav.home_dashboard';
    if (prevGeneric && !nextGeneric) byPath.set(item.path, item);
  }
  const keep = new Set([...byPath.values()].map((n) => n.code));
  return nav.filter((n) => keep.has(n.code) && byPath.get(n.path)?.code === n.code);
}

export async function setUserPermissions(userId, permissionCodes) {
  const [userRows] = await pool.query(`SELECT id, role FROM users WHERE id = ?`, [userId]);
  if (!userRows.length) throw new Error('User not found');
  if (isSuperAdmin(userRows[0].role)) throw new Error('Cannot modify Super Admin permissions');

  const validCodes = new Set(NAV_ITEMS.map((n) => n.code));
  const filtered = [...new Set(permissionCodes.filter((c) => validCodes.has(c)))];

  await pool.query(`DELETE FROM user_permissions WHERE user_id = ?`, [userId]);
  for (const code of filtered) {
    await pool.query(`INSERT INTO user_permissions (user_id, permission_code) VALUES (?, ?)`, [userId, code]);
  }

  return getUserPermissionCodes(userId, userRows[0].role);
}

export async function seedUserPermissionsForRole(userId, role) {
  const defaults = ROLE_DEFAULT_PERMISSIONS[role];
  if (!defaults?.length || isSuperAdmin(role)) return;

  const [existing] = await pool.query(`SELECT 1 FROM user_permissions WHERE user_id = ? LIMIT 1`, [userId]);
  if (existing.length) return;

  for (const code of defaults) {
    await pool.query(
      `INSERT IGNORE INTO user_permissions (user_id, permission_code) VALUES (?, ?)`,
      [userId, code]
    );
  }
}

export async function enrichAuthUser(userRow) {
  const permissions = await getUserPermissionCodes(userRow.id, userRow.role);
  const navigation = await getUserNavigation(userRow.id, userRow.role);
  return {
    id: userRow.id,
    email: userRow.email,
    name: userRow.name,
    role: userRow.role,
    departmentId: userRow.department_id ?? userRow.departmentId ?? null,
    departmentName: userRow.department_name ?? userRow.departmentName ?? null,
    isSuperAdmin: isSuperAdmin(userRow.role),
    permissions,
    navigation: navigation.map((n) => ({
      code: n.code,
      label: n.label,
      path: n.path,
      icon: n.icon,
      group: n.group,
    })),
  };
}
