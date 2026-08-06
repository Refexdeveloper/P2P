import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ensureNavigation, isMastersNavItem } from '../../constants/roleNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { invoiceData } from '../../mocks/invoice-data';

function badgeForPath(path: string): number | null {
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

  // Desktop: collapse when not hovered. Mobile drawer: always expanded when open.
  const collapsed = !mobileOpen && !hovered;

  const menuItems = useMemo<MenuNode[]>(() => {
    const nav = ensureNavigation(user?.role, user?.navigation);
    const masters: MenuLeaf[] = [];
    const others: MenuLeaf[] = [];

    for (const item of nav) {
      const leaf: MenuLeaf = {
        kind: 'link',
        icon: item.icon,
        label: item.label,
        path: item.path,
        badge: badgeForPath(item.path),
      };
      if (isMastersNavItem(item)) {
        masters.push(leaf);
      } else {
        others.push(leaf);
      }
    }

    const nodes: MenuNode[] = [...others];
    if (masters.length) {
      const group: MenuGroup = {
        kind: 'group',
        key: 'masters',
        label: 'Masters',
        icon: 'ri-database-2-line',
        children: masters,
      };
      const createPoIdx = nodes.findIndex((n) => n.kind === 'link' && n.path === '/scm/create-po');
      const scmIdx = nodes.findIndex((n) => n.kind === 'link' && n.path.startsWith('/scm/'));
      if (createPoIdx >= 0) {
        nodes.splice(createPoIdx + 1, 0, group);
      } else if (scmIdx >= 0) {
        nodes.splice(scmIdx + 1, 0, group);
      } else {
        nodes.push(group);
      }
    }
    return nodes;
  }, [user?.role, user?.navigation]);

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
    const nav = ensureNavigation(user.role, user.navigation);
    const hasMasters = nav.some(isMastersNavItem);
    const needsHeal =
      !user.navigation?.length ||
      ((user.role === 'SCM Buyer' || user.role === 'SCM Manager') && !hasMasters);
    if (needsHeal) {
      refreshUser().catch(() => undefined);
    }
  }, [user, refreshUser]);

  const handleNavigate = () => {
    onMobileClose?.();
  };

  const renderLink = (item: MenuLeaf, nested = false) => {
    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
    return (
      <Link
        key={item.path}
        to={item.path}
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
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 bg-teal-600 text-white text-[9px] font-semibold rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </div>
          {!collapsed && (
            <span className={`font-medium whitespace-nowrap ${nested ? 'text-xs' : 'text-sm'}`}>{item.label}</span>
          )}
        </div>
        {!collapsed && item.badge != null && (
          <span className="px-2 py-0.5 bg-teal-600 text-white text-xs font-semibold rounded-full">
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
        fixed inset-y-0 left-0 w-64
        ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
        lg:static lg:translate-x-0 lg:shadow-none lg:shrink-0
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
          {!collapsed && <span className="font-semibold text-gray-900 whitespace-nowrap">P2P System</span>}
          {collapsed && <span className="font-semibold text-gray-900 whitespace-nowrap lg:hidden">P2P System</span>}
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
              <p className="text-xs text-gray-500 truncate">{user?.role || 'Role'}</p>
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
