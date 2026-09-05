import type { NavItem } from '../services/api';

/** Mirrors server ROLE_DEFAULT_PERMISSIONS → NAV_ITEMS for sidebar fallback */
const NAV_BY_CODE: Record<string, NavItem> = {
  'nav.requester_dashboard': {
    code: 'nav.requester_dashboard',
    label: 'Dashboard',
    path: '/requester/dashboard',
    icon: 'ri-dashboard-line',
    group: 'Requester',
  },
  'nav.create_pr': {
    code: 'nav.create_pr',
    label: 'Create PR',
    path: '/requester/create-pr',
    icon: 'ri-add-circle-line',
    group: 'Requester',
  },
  'nav.rfq_entry': {
    code: 'nav.rfq_entry',
    label: 'RFQ Entry',
    path: '/requester/rfq-entry',
    icon: 'ri-file-edit-line',
    group: 'Requester',
  },
  'nav.track_pr': {
    code: 'nav.track_pr',
    label: 'Track PR',
    path: '/requester/track-pr',
    icon: 'ri-search-line',
    group: 'Requester',
  },
  'nav.requester_vendor_po_acceptance': {
    code: 'nav.requester_vendor_po_acceptance',
    label: 'Vendor PO Acceptance',
    path: '/requester/vendor-po-acceptance',
    icon: 'ri-shake-hands-line',
    group: 'Requester',
  },
  'nav.requester_vendor_invoice': {
    code: 'nav.requester_vendor_invoice',
    label: 'Vendor Invoice',
    path: '/requester/vendor-invoice',
    icon: 'ri-file-invoice-line',
    group: 'Requester',
  },
  'nav.pr_manager_dashboard': {
    code: 'nav.pr_manager_dashboard',
    label: 'My Tasks',
    path: '/tasks',
    icon: 'ri-task-line',
    group: 'L2 Manager',
  },
  'nav.rfq_approval': {
    code: 'nav.rfq_approval',
    label: 'RFQ Approval',
    path: '/rfq-approval',
    icon: 'ri-bar-chart-box-line',
    group: 'Approvals',
  },
  'nav.tasks': {
    code: 'nav.tasks',
    label: 'My Tasks',
    path: '/tasks',
    icon: 'ri-task-line',
    group: 'General',
  },
  'nav.cfo_insights': {
    code: 'nav.cfo_insights',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'ri-dashboard-line',
    group: 'CFO',
  },
  'nav.cfo_dashboard': {
    code: 'nav.cfo_dashboard',
    label: 'PR Approvals',
    path: '/cfo/dashboard',
    icon: 'ri-checkbox-circle-line',
    group: 'CFO',
  },
  'nav.purchase_requests': {
    code: 'nav.purchase_requests',
    label: 'Dashboard',
    path: '/scm/purchase-requests',
    icon: 'ri-dashboard-line',
    group: 'SCM',
  },
  'nav.create_po': {
    code: 'nav.create_po',
    label: 'Create PO',
    path: '/scm/create-po',
    icon: 'ri-shopping-cart-2-line',
    group: 'SCM',
  },
  'nav.track_po': {
    code: 'nav.track_po',
    label: 'Track PO',
    path: '/scm/track-po',
    icon: 'ri-search-eye-line',
    group: 'SCM',
  },
  'nav.po_excel_import': {
    code: 'nav.po_excel_import',
    label: 'PO Excel Import',
    path: '/scm/po-excel-import',
    icon: 'ri-file-excel-2-line',
    group: 'SCM',
  },
  'nav.item_master': {
    code: 'nav.item_master',
    label: 'Item Master',
    path: '/scm/item-master',
    icon: 'ri-box-3-line',
    group: 'Masters',
  },
  'nav.vendor_master': {
    code: 'nav.vendor_master',
    label: 'Vendor Master',
    path: '/scm/vendor-master',
    icon: 'ri-store-2-line',
    group: 'Masters',
  },
  'nav.category_master': {
    code: 'nav.category_master',
    label: 'Category Master',
    path: '/scm/category-master',
    icon: 'ri-price-tag-3-line',
    group: 'Masters',
  },
  'nav.entity_master': {
    code: 'nav.entity_master',
    label: 'Entity Master',
    path: '/scm/entity-master',
    icon: 'ri-building-2-line',
    group: 'Masters',
  },
  'nav.department_master': {
    code: 'nav.department_master',
    label: 'Department Master',
    path: '/scm/department-master',
    icon: 'ri-organization-chart',
    group: 'Masters',
  },
  'nav.po_letterhead_master': {
    code: 'nav.po_letterhead_master',
    label: 'PO Type Master',
    path: '/scm/po-type-master',
    icon: 'ri-file-list-3-line',
    group: 'Masters',
  },
  'nav.letterhead_master': {
    code: 'nav.letterhead_master',
    label: 'Letterhead Master',
    path: '/scm/letterhead-master',
    icon: 'ri-layout-top-2-line',
    group: 'Masters',
  },
  'nav.scm_rfq_entry': {
    code: 'nav.scm_rfq_entry',
    label: 'RFQ Entry',
    path: '/scm/rfq-entry',
    icon: 'ri-file-list-line',
    group: 'SCM',
  },
  'nav.vendor_quotation': {
    code: 'nav.vendor_quotation',
    label: 'Vendor Quotation Portal',
    path: '/scm/vendor-quotation-portal',
    icon: 'ri-price-tag-3-line',
    group: 'SCM',
  },
  'nav.vendor_comparison': {
    code: 'nav.vendor_comparison',
    label: 'Vendor Comparison',
    path: '/scm/vendor-comparison',
    icon: 'ri-bar-chart-box-line',
    group: 'SCM',
  },
  'nav.technical_clearance': {
    code: 'nav.technical_clearance',
    label: 'Technical Clearance',
    path: '/scm/technical-clearance',
    icon: 'ri-shield-check-line',
    group: 'SCM',
  },
  'nav.po_approval': {
    code: 'nav.po_approval',
    label: 'PO Approval',
    path: '/scm/po-approval',
    icon: 'ri-checkbox-circle-line',
    group: 'SCM',
  },
  'nav.scm_manager_dashboard': {
    code: 'nav.scm_manager_dashboard',
    label: 'Dashboard',
    path: '/scm/manager-dashboard',
    icon: 'ri-dashboard-line',
    group: 'SCM Manager',
  },
  'nav.buyer_final_verify': {
    code: 'nav.buyer_final_verify',
    label: 'Buyer Final Verify',
    path: '/scm/buyer-final-verify',
    icon: 'ri-shield-check-line',
    group: 'SCM',
  },
  'nav.vendor_po_acceptance': {
    code: 'nav.vendor_po_acceptance',
    label: 'Vendor PO Acceptance',
    path: '/scm/vendor-po-acceptance',
    icon: 'ri-shake-hands-line',
    group: 'SCM',
  },
  'nav.vendor_invoice': {
    code: 'nav.vendor_invoice',
    label: 'Vendor Invoice',
    path: '/scm/vendor-invoice',
    icon: 'ri-file-invoice-line',
    group: 'SCM',
  },
  'nav.grn': {
    code: 'nav.grn',
    label: 'GRN',
    path: '/grn',
    icon: 'ri-truck-line',
    group: 'SCM',
  },
  'nav.accounts_dashboard': {
    code: 'nav.accounts_dashboard',
    label: 'Accounts Dashboard',
    path: '/accounts/dashboard',
    icon: 'ri-dashboard-line',
    group: 'Accounts',
  },
  'nav.invoice_verification': {
    code: 'nav.invoice_verification',
    label: 'Invoice Verification',
    path: '/accounts/invoice-verification',
    icon: 'ri-file-check-2-line',
    group: 'Accounts',
  },
  'nav.payment': {
    code: 'nav.payment',
    label: 'Payment',
    path: '/accounts/payment',
    icon: 'ri-money-rupee-circle-line',
    group: 'Accounts',
  },
  'nav.payment_authorization': {
    code: 'nav.payment_authorization',
    label: 'Payment Authorization',
    path: '/accounts/scm-payment-approval',
    icon: 'ri-shield-check-line',
    group: 'SCM Manager',
  },
  'nav.functional_evaluate': {
    code: 'nav.functional_evaluate',
    label: 'Evaluate PR',
    path: '/functional/evaluate-pr',
    icon: 'ri-dashboard-line',
    group: 'Functional',
  },
  'nav.tech_evaluation': {
    code: 'nav.tech_evaluation',
    label: 'Technical Evaluation',
    path: '/tech-evaluator/rfq-evaluation',
    icon: 'ri-star-line',
    group: 'Tech',
  },
  'nav.vendor_dashboard': {
    code: 'nav.vendor_dashboard',
    label: 'Dashboard',
    path: '/vendor/dashboard',
    icon: 'ri-dashboard-line',
    group: 'Vendor',
  },
  'nav.admin_users': {
    code: 'nav.admin_users',
    label: 'User Permissions',
    path: '/admin/user-permissions',
    icon: 'ri-shield-user-line',
    group: 'Admin',
  },
  'nav.admin_email_logs': {
    code: 'nav.admin_email_logs',
    label: 'Notification Logs',
    path: '/admin/email-logs',
    icon: 'ri-notification-3-line',
    group: 'Admin',
  },
  'nav.admin_scm_signature': {
    code: 'nav.admin_scm_signature',
    label: 'SCM Signature',
    path: '/admin/scm-signature',
    icon: 'ri-quill-pen-line',
    group: 'Admin',
  },
};

const MASTER_NAV_CODES = [
  'nav.item_master',
  'nav.vendor_master',
  'nav.category_master',
  'nav.entity_master',
  'nav.department_master',
  'nav.po_letterhead_master',
  'nav.letterhead_master',
] as const;

const REQUESTER_MASTER_NAV_CODES = [
  'nav.item_master',
  'nav.vendor_master',
  'nav.category_master',
  'nav.entity_master',
  'nav.department_master',
] as const;

const ROLE_NAV_WHITELIST: Record<string, string[]> = {
  CFO: ['nav.cfo_insights', 'nav.cfo_dashboard', 'nav.tasks'],
  'HOD Approver': ['nav.tasks', 'nav.rfq_approval', 'nav.cfo_insights', 'nav.create_pr', 'nav.track_pr'],
  'PR Manager': ['nav.pr_manager_dashboard', 'nav.rfq_approval', 'nav.cfo_insights', 'nav.create_pr', 'nav.track_pr'],
};

const ROLE_DEFAULT_CODES: Record<string, string[]> = {
  Requester: [
    'nav.requester_dashboard',
    'nav.create_pr',
    'nav.rfq_entry',
    'nav.track_pr',
    'nav.requester_vendor_po_acceptance',
    'nav.grn',
    'nav.requester_vendor_invoice',
    ...REQUESTER_MASTER_NAV_CODES,
  ],
  'PR Manager': ['nav.pr_manager_dashboard', 'nav.rfq_approval', 'nav.create_pr', 'nav.track_pr'],
  CFO: ['nav.cfo_insights', 'nav.cfo_dashboard', 'nav.tasks'],
  'HOD Approver': ['nav.tasks', 'nav.rfq_approval', 'nav.create_pr', 'nav.track_pr'],
  'SCM Buyer': [
    'nav.purchase_requests',
    'nav.scm_rfq_entry',
    'nav.create_po',
    'nav.buyer_final_verify',
    'nav.track_po',
    'nav.item_master',
    'nav.vendor_master',
    'nav.category_master',
    'nav.entity_master',
    'nav.department_master',
    'nav.po_letterhead_master',
    'nav.letterhead_master',
    'nav.po_excel_import',
    'nav.vendor_quotation',
    'nav.vendor_comparison',
    'nav.technical_clearance',
    'nav.po_approval',
    'nav.vendor_invoice',
    'nav.grn',
  ],
  'SCM Manager': [
    'nav.scm_manager_dashboard',
    'nav.po_approval',
    'nav.rfq_approval',
    'nav.tasks',
    'nav.track_po',
    'nav.payment_authorization',
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
  'Super Admin': [
    'nav.admin_users',
    'nav.admin_email_logs',
    'nav.admin_scm_signature',
    'nav.track_pr',
    'nav.scm_rfq_entry',
    'nav.rfq_approval',
  ],
};

export function getDefaultNavigationForRole(role?: string | null): NavItem[] {
  if (!role) return [];
  const codes = ROLE_DEFAULT_CODES[role] || [];
  return codes.map((code) => NAV_BY_CODE[code]).filter(Boolean);
}

function isMastersNavCode(code?: string) {
  return Boolean(code && (MASTER_NAV_CODES as readonly string[]).includes(code));
}

const EMAIL_NAV_CODES: Record<string, string[]> = {
  'srivaths.varadharajan@refex.co.in': ['nav.cfo_insights', 'nav.tasks'],
};

export function ensureNavigation(
  role: string | undefined | null,
  navigation?: NavItem[] | null,
  email?: string | null
): NavItem[] {
  const base = navigation?.length
    ? navigation.map((item) => {
        const catalog = NAV_BY_CODE[item.code];
        if (!catalog) return item;
        // Catalog group wins for Masters so cached "SCM" group does not hide the submenu
        return {
          ...item,
          ...catalog,
          label: catalog.label || item.label,
          path: catalog.path || item.path,
          icon: catalog.icon || item.icon,
          group: catalog.group || item.group,
        };
      })
    : getDefaultNavigationForRole(role);

  let merged = base;

  // Requester always gets core menus + fulfillment (GRN, invoice, vendor acceptance) + Masters
  if (role === 'Requester') {
    merged = merged.filter((n) => n.code !== 'nav.tasks');
    const codes = new Set(merged.map((n) => n.code));
    merged = [...merged];
    for (const code of [
      'nav.requester_dashboard',
      'nav.create_pr',
      'nav.rfq_entry',
      'nav.track_pr',
      'nav.requester_vendor_po_acceptance',
      'nav.grn',
      'nav.requester_vendor_invoice',
      ...REQUESTER_MASTER_NAV_CODES,
    ]) {
      if (!codes.has(code) && NAV_BY_CODE[code]) {
        merged.push(NAV_BY_CODE[code]);
      }
    }
    const order = ROLE_DEFAULT_CODES.Requester || [];
    const rank = new Map(order.map((code, i) => [code, i]));
    merged = [...merged].sort((a, b) => {
      const ai = rank.has(a.code) ? (rank.get(a.code) as number) : 1000;
      const bi = rank.has(b.code) ? (rank.get(b.code) as number) : 1000;
      return ai - bi;
    });
  }

  // SCM roles always get Item / Vendor / Category Master entries
  if (role === 'SCM Buyer' || role === 'SCM Manager') {
    const codes = new Set(merged.map((n) => n.code));
    merged = [...merged];
    for (const code of MASTER_NAV_CODES) {
      if (!codes.has(code) && NAV_BY_CODE[code]) {
        merged.push(NAV_BY_CODE[code]);
      }
    }
  }

  // SCM Manager sidebar: Dashboard → PO Approval → RFQ Entry (approval queue) → My Tasks → …
  if (role === 'SCM Manager') {
    const order = ROLE_DEFAULT_CODES['SCM Manager'] || [];
    const rank = new Map(order.map((code, i) => [code, i]));
    // Never show buyer RFQ Entry for SCM Manager
    merged = merged.filter((n) => n.code !== 'nav.scm_rfq_entry');
    const codes = new Set(merged.map((n) => n.code));
    for (const code of [
      'nav.scm_manager_dashboard',
      'nav.po_approval',
      'nav.rfq_approval',
      'nav.tasks',
      'nav.track_po',
    ]) {
      if (!codes.has(code) && NAV_BY_CODE[code]) {
        merged.push(NAV_BY_CODE[code]);
        codes.add(code);
      }
    }
    merged = [...merged]
      .map((n) =>
        n.code === 'nav.rfq_approval'
          ? { ...n, label: 'RFQ Entry' }
          : n
      )
      .sort((a, b) => {
        const ai = rank.has(a.code) ? (rank.get(a.code) as number) : 1000;
        const bi = rank.has(b.code) ? (rank.get(b.code) as number) : 1000;
        return ai - bi;
      });
  }

  // SCM Buyer: Dashboard → RFQ Entry → Create PO → Buyer Final Verify → Track PO → Masters
  if (role === 'SCM Buyer') {
    merged = merged.filter(
      (n) => n.code !== 'nav.tasks' && n.code !== 'nav.rfq_approval' && n.code !== 'nav.vendor_po_acceptance'
    );
    const codes = new Set(merged.map((n) => n.code));
    for (const code of [
      'nav.purchase_requests',
      'nav.scm_rfq_entry',
      'nav.create_po',
      'nav.buyer_final_verify',
      'nav.track_po',
    ]) {
      if (!codes.has(code) && NAV_BY_CODE[code]) {
        merged = [...merged, NAV_BY_CODE[code]];
        codes.add(code);
      }
    }
    const order = ROLE_DEFAULT_CODES['SCM Buyer'] || [];
    const rank = new Map(order.map((code, i) => [code, i]));
    merged = [...merged].sort((a, b) => {
      const ai = rank.has(a.code) ? (rank.get(a.code) as number) : 1000;
      const bi = rank.has(b.code) ? (rank.get(b.code) as number) : 1000;
      return ai - bi;
    });
  }

  // CFO: use server nav when present; otherwise role defaults
  if (role === 'CFO' && !navigation?.length) {
    merged = getDefaultNavigationForRole('CFO');
  }

  const emailOverride = EMAIL_NAV_CODES[String(email || '').trim().toLowerCase()];
  if (emailOverride?.length) {
    const allowed = new Set(emailOverride);
    merged = merged.filter((n) => allowed.has(n.code));
    for (const code of emailOverride) {
      if (!merged.some((n) => n.code === code) && NAV_BY_CODE[code]) {
        merged.push(NAV_BY_CODE[code]);
      }
    }
  }

  // L1 Manager (HOD): My Tasks + RFQ Approval; optional Financial Insights from admin
  if (role === 'HOD Approver') {
    const allowed = new Set(ROLE_NAV_WHITELIST['HOD Approver'] || ['nav.tasks', 'nav.rfq_approval']);
    merged = merged.filter((n) => allowed.has(n.code));
    for (const code of ['nav.create_pr', 'nav.track_pr']) {
      if (!merged.some((n) => n.code === code) && NAV_BY_CODE[code]) {
        merged.push(NAV_BY_CODE[code]);
      }
    }
    const order = ['nav.cfo_insights', 'nav.create_pr', 'nav.track_pr', 'nav.tasks', 'nav.rfq_approval'];
    const rank = new Map(order.map((code, i) => [code, i]));
    merged = [...merged].sort((a, b) => {
      const ai = rank.has(a.code) ? (rank.get(a.code) as number) : 1000;
      const bi = rank.has(b.code) ? (rank.get(b.code) as number) : 1000;
      return ai - bi;
    });
  }

  // L2 Manager: one My Tasks entry (nav.pr_manager_dashboard), never also nav.tasks
  if (role === 'PR Manager') {
    const allowed = new Set(ROLE_NAV_WHITELIST['PR Manager'] || ['nav.pr_manager_dashboard', 'nav.rfq_approval']);
    merged = merged.filter((n) => allowed.has(n.code));
    merged = merged.filter((n) => n.code !== 'nav.tasks');
    const codes = new Set(merged.map((n) => n.code));
    if (!codes.has('nav.pr_manager_dashboard') && NAV_BY_CODE['nav.pr_manager_dashboard']) {
      merged = [NAV_BY_CODE['nav.pr_manager_dashboard'], ...merged];
    }
    for (const code of ['nav.create_pr', 'nav.track_pr']) {
      if (!codes.has(code) && NAV_BY_CODE[code]) {
        merged.push(NAV_BY_CODE[code]);
        codes.add(code);
      }
    }
    const order = ['nav.cfo_insights', 'nav.create_pr', 'nav.track_pr', 'nav.pr_manager_dashboard', 'nav.rfq_approval'];
    const rank = new Map(order.map((code, i) => [code, i]));
    merged = [...merged].sort((a, b) => {
      const ai = rank.has(a.code) ? (rank.get(a.code) as number) : 1000;
      const bi = rank.has(b.code) ? (rank.get(b.code) as number) : 1000;
      return ai - bi;
    });
  }

  // Drop duplicate menu entries that share the same path (e.g. My Tasks twice)
  return dedupeNavigationByPath(merged);
}

/** Keep one nav item per path; prefer role-specific codes over generic nav.tasks. */
function dedupeNavigationByPath(items: NavItem[]): NavItem[] {
  const byPath = new Map<string, NavItem>();
  for (const item of items) {
    const prev = byPath.get(item.path);
    if (!prev) {
      byPath.set(item.path, item);
      continue;
    }
    const prevGeneric = prev.code === 'nav.tasks' || prev.code === 'nav.home_dashboard';
    const nextGeneric = item.code === 'nav.tasks' || item.code === 'nav.home_dashboard';
    if (prevGeneric && !nextGeneric) {
      byPath.set(item.path, item);
    }
  }
  const keep = new Set([...byPath.values()].map((n) => n.code));
  return items.filter((n) => keep.has(n.code) && byPath.get(n.path)?.code === n.code);
}

export function isMastersNavItem(item: Pick<NavItem, 'code' | 'group' | 'path'>) {
  return (
    item.group === 'Masters' ||
    isMastersNavCode(item.code) ||
    item.path === '/scm/item-master' ||
    item.path === '/scm/vendor-master' ||
    item.path === '/scm/category-master' ||
    item.path === '/scm/entity-master' ||
    item.path === '/scm/department-master' ||
    item.path === '/scm/po-type-master' ||
    item.path === '/scm/letterhead-master' ||
    item.path === '/scm/po-letterhead-master'
  );
}
