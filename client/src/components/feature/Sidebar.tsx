import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ensureNavigation, isMastersNavItem } from '../../constants/roleNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { invoiceData } from '../../mocks/invoice-data';
import { formatRoleDisplayName } from '../../utils/roleDisplay';
import { rfqApi, taskApi } from '../../services/api';

type NavBadgeCounts = {
  tasks: number;
  rfqEntry: number;
  rfqApproval: number;
};

function badgeForPath(path: string, counts: NavBadgeCounts): number | null {
  if (path === '/tasks') {
    return counts.tasks > 0 ? counts.tasks : null;
  }
  if (path === '/scm/rfq-entry') {
    return counts.rfqEntry > 0 ? counts.rfqEntry : null;
  }
  if (path === '/rfq-approval') {
    return counts.rfqApproval > 0 ? counts.rfqApproval : null;
  }
  if (path === '/accounts/invoice-verification') {
    const n = invoiceData.filter((i) => i.status === 'Pending Verification' || i.status === 'Discrepancy').length;
    return n > 0 ? n : null;
  }
  if (path === '/accounts/payment') {
    const n = invoiceData.filter(
      (i) => i.status === 'Approved for Payment' && (i.paymentStatus === 'Pending Payment' || i.paymentStatus === 'Overdue')
    ).length;
    return n > 0 ? n : null;
  }
  if (path === '/accounts/scm-payment-approval') {
    const n = invoiceData.filter((i) => i.status === 'Approved for Payment').length;
    return n > 0 ? n : null;
  }
  return null;
}

type MenuLeaf = {
  kind: 'link';
  icon: string;
  label: string;
  path: string;
  code?: string;
  badge: number | null;
};

type MenuGroup = {
  kind: 'group';
  key: string;
  label: string;
  icon: string;
  children: MenuLeaf[];
};

type MenuNode = MenuLeaf | MenuGroup;

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const [hovered, setHovered] = useState(false);
  const location = useLocation();
  const { user, logout, refreshUser } = useAuth();
  const [mastersOpen, setMastersOpen] = useState(true);
  const [badgeCounts, setBadgeCounts] = useState<NavBadgeCounts>({
    tasks: 0,
    rfqEntry: 0,
    rfqApproval: 0,
  });

  // Desktop: collapse when not hovered. Mobile drawer: always expanded when open.
  const collapsed = !mobileOpen && !hovered;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const role = user.role || '';
    const wantsTasks =
      role === 'SCM Manager' ||
      role === 'HOD Approver' ||
      role === 'PR Manager' ||
      role === 'CFO' ||
      role === 'Super Admin' ||
      role === 'Functional Team';
    const wantsRfqEntry = role === 'SCM Manager' || role === 'SCM Buyer' || role === 'Super Admin';
    const wantsRfqApproval =
      role === 'SCM Manager' ||
      role === 'HOD Approver' ||
      role === 'PR Manager' ||
      role === 'CFO' ||
      role === 'Super Admin';

    (async () => {
      try {
        const [taskRes, entryRes, approvalRes] = await Promise.all([
          wantsTasks ? taskApi.list().catch(() => ({ data: [] as unknown[] })) : Promise.resolve({ data: [] }),
          wantsRfqEntry
            ? rfqApi.listScmEntryPending().catch(() => ({ data: [] as unknown[] }))
            : Promise.resolve({ data: [] }),
          wantsRfqApproval
            ? rfqApi.listPostApprovalPending().catch(() => ({ data: [] as unknown[] }))
            : Promise.resolve({ data: [] }),
        ]);
        if (cancelled) return;
        const tasks = (taskRes.data as Array<{ status?: string }>) || [];
        const pendingTasks = tasks.filter((t) => {
          const s = String(t.status || '').toLowerCase();
          return !s || s === 'pending_approval' || s === 'pending';
        });
        setBadgeCounts({
          tasks: pendingTasks.length || 0,
          rfqEntry: Array.isArray(entryRes.data) ? entryRes.data.length : 0,
          rfqApproval: Array.isArray(approvalRes.data) ? approvalRes.data.length : 0,
        });
      } catch {
        if (!cancelled) setBadgeCounts({ tasks: 0, rfqEntry: 0, rfqApproval: 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, location.pathname]);

  const menuItems = useMemo<MenuNode[]>(() => {
    const nav = ensureNavigation(user?.role, user?.navigation, user?.email);
    const masters: MenuLeaf[] = nav.filter(isMastersNavItem).map((item) => ({
      kind: 'link',
      icon: item.icon,
      label: item.label,
      path: item.path,
      code: item.code,
      badge: badgeForPath(item.path, badgeCounts),
    }));

    const group: MenuGroup | null = masters.length
      ? {
          kind: 'group',
          key: 'masters',
          label: 'Masters',
          icon: 'ri-database-2-line',
          children: masters,
        }
      : null;

    const nodes: MenuNode[] = [];
    let mastersInserted = false;
    for (const item of nav) {
      if (isMastersNavItem(item)) {
        if (group && !mastersInserted) {
          nodes.push(group);
          mastersInserted = true;
        }
        continue;
      }
      nodes.push({
        kind: 'link',
        icon: item.icon,
        label: item.label,
        path: item.path,
        code: item.code,
        badge: badgeForPath(item.path, badgeCounts),
      });
    }
    if (group && !mastersInserted) nodes.push(group);
    return nodes;
  }, [user?.role, user?.navigation, user?.email, badgeCounts]);

  useEffect(() => {
    const onMastersPath =
      location.pathname.includes('/item-master') ||
      location.pathname.includes('/vendor-master') ||
      location.pathname.includes('/category-master') ||
      location.pathname.includes('/entity-master') ||
      location.pathname.includes('/department-master') ||
      location.pathname.includes('/po-type-master') ||
      location.pathname.includes('/letterhead-master') ||
      location.pathname.includes('/po-letterhead-master');
    if (onMastersPath) setMastersOpen(true);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const nav = ensureNavigation(user.role, user.navigation, user.email);
    const hasMasters = nav.some(isMastersNavItem);
    const needsHeal =
      !user.navigation?.length ||
      ((user.role === 'SCM Buyer' || user.role === 'SCM Manager') &&
        (!hasMasters ||
          (user.role === 'SCM Manager' &&
            (!nav.some((n) => n.code === 'nav.tasks') ||
              !nav.some((n) => n.code === 'nav.scm_rfq_entry')))));
    if (needsHeal) {
      refreshUser().catch(() => undefined);
    }
  }, [user, refreshUser]);

  const handleNavigate = () => {
    onMobileClose?.();
  };

  const renderLink = (item: MenuLeaf, nested = false) => {
    const href =
      item.path === '/requester/create-pr' || item.code === 'nav.create_pr'
        ? '/requester/create-pr?new=1'
        : item.path;
    const isActive =
      location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    const isAlertBadge =
      item.path === '/tasks' || item.path === '/scm/rfq-entry' || item.path === '/rfq-approval';
    return (
      <Link
        key={item.path}
        to={href}
        title={collapsed ? item.label : undefined}
        onClick={handleNavigate}
        className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} ${
          nested ? 'px-3 py-2 ml-2' : 'px-3 py-2.5'
        } rounded-lg transition-colors ${
          isActive ? 'bg-teal-50 text-teal-600' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <div className={`flex items-center ${collapsed ? '' : 'space-x-3'}`}>
          <div className="w-5 h-5 flex items-center justify-center relative">
            <i className={`${item.icon} text-lg`}></i>
            {collapsed && item.badge != null && (
              <span
                className={`absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 text-white text-[9px] font-semibold rounded-full flex items-center justify-center ${
                  isAlertBadge ? 'bg-red-600' : 'bg-teal-600'
                }`}
              >
                {item.badge}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className={`font-medium whitespace-nowrap ${nested ? 'text-xs' : 'text-sm'}`}>
              {item.label}
            </span>
          )}
        </div>
        {!collapsed && item.badge != null && (
          <span
            className={`px-2 py-0.5 text-white text-xs font-semibold rounded-full ${
              isAlertBadge ? 'bg-red-600' : 'bg-teal-600'
            }`}
          >
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      onMouseEnter={() => {
        if (window.innerWidth >= 1024) setHovered(true);
      }}
      onMouseLeave={() => {
        if (window.innerWidth >= 1024) setHovered(false);
      }}
      className={`
        bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-out z-50
        fixed inset-y-0 left-0 w-64 h-[100dvh] max-h-[100dvh]
        ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
        lg:static lg:translate-x-0 lg:shadow-none lg:shrink-0 lg:h-full lg:max-h-full lg:min-h-0
        ${collapsed ? 'lg:w-20' : 'lg:w-64'}
      `}
    >
      <div
        className={`h-16 flex items-center border-b border-gray-200 ${
          collapsed ? 'lg:justify-center lg:px-2 justify-between px-4' : 'justify-between px-4'
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shrink-0">
            <i className="ri-shopping-cart-2-line text-white text-lg"></i>
          </div>
          {(!collapsed || mobileOpen) && (
            <span className="font-semibold text-gray-900 whitespace-nowrap">P2P System</span>
          )}
          {collapsed && !mobileOpen && (
            <span className="font-semibold text-gray-900 whitespace-nowrap lg:hidden">P2P</span>
          )}
        </div>
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
          aria-label="Close navigation"
        >
          <i className="ri-close-line text-xl"></i>
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {menuItems.length === 0 ? (
          !collapsed && (
            <p className="text-xs text-gray-400 px-3 py-2">No navigation assigned. Contact Super Admin.</p>
          )
        ) : (
          menuItems.map((item) => {
            if (item.kind === 'link') return renderLink(item);

            const childActive = item.children.some(
              (c) => location.pathname === c.path || location.pathname.startsWith(`${c.path}/`)
            );
            const open = mastersOpen || childActive;

            if (collapsed) {
              return (
                <div key={item.key} className="space-y-1">
                  <div
                    className={`flex items-center justify-center px-3 py-2.5 rounded-lg ${
                      childActive ? 'bg-teal-50 text-teal-600' : 'text-gray-700'
                    }`}
                    title={item.label}
                  >
                    <i className={`${item.icon} text-lg`}></i>
                  </div>
                  {item.children.map((child) => renderLink(child))}
                </div>
              );
            }

            return (
              <div key={item.key}>
                <button
                  type="button"
                  onClick={() => setMastersOpen((v) => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
                    childActive ? 'bg-teal-50 text-teal-700' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 flex items-center justify-center">
                      <i className={`${item.icon} text-lg`}></i>
                    </div>
                    <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>
                  </div>
                  <i className={`ri-arrow-${open ? 'up' : 'down'}-s-line text-gray-400`}></i>
                </button>
                {open && (
                  <div className="mt-0.5 space-y-0.5 border-l border-gray-100 ml-5 pl-1">
                    {item.children.map((child) => renderLink(child, true))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      <div className={`border-t border-gray-200 ${collapsed ? 'p-3' : 'p-4'}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center"
              title={user?.name || 'User'}
            >
              <span className="text-teal-600 font-semibold text-sm">
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2) || 'U'}
              </span>
            </div>
            <button
              onClick={logout}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Logout"
            >
              <i className="ri-logout-box-r-line text-gray-400 text-base"></i>
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-teal-600 font-semibold text-sm">
                {user?.name
                  ?.split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2) || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-gray-500 truncate">
                {formatRoleDisplayName(user?.role) || 'Role'}
              </p>
            </div>
            <button
              onClick={logout}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              title="Logout"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <i className="ri-logout-box-r-line text-gray-400 text-base"></i>
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
