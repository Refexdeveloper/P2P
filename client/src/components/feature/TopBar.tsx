import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { notifications } from '../../mocks/procurement-data';
import BrandLogo from './BrandLogo';

type TopBarProps = {
  onMenuClick?: () => void;
};

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { user, logout } = useAuth();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => {
    logout();
  };

  const getInitials = () => {
    if (!user?.name) return 'U';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2);
  };

  return (
    <div className="h-14 sm:h-16 bg-[#f7f7f8] border-b border-gray-200 border-t-[3px] border-t-[#f5c9a8] flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 lg:px-5 shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-white/80 cursor-pointer shrink-0"
          aria-label="Open navigation"
        >
          <i className="ri-menu-line text-xl"></i>
        </button>

        <BrandLogo className="shrink-0" />

        <div className="relative hidden sm:block flex-1 max-w-xl lg:max-w-2xl min-w-0">
          <i className="ri-search-line absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-base"></i>
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="What are you looking for today?"
            className="w-full h-10 pl-10 pr-28 bg-white border border-gray-200 rounded-full text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-300 shadow-sm"
          />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 whitespace-nowrap select-none">
            {isMac ? 'Cmd+E' : 'Ctrl+E'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-3 shrink-0">
        <button
          type="button"
          className="sm:hidden p-2 hover:bg-white/80 rounded-lg transition-colors"
          aria-label="Search"
          onClick={() => searchRef.current?.focus()}
        >
          <i className="ri-search-line text-gray-600 text-xl"></i>
        </button>

        <button
          type="button"
          className="p-2 hover:bg-white/80 rounded-lg transition-colors hidden sm:inline-flex"
          aria-label="Quick add"
        >
          <i className="ri-add-circle-line text-gray-600 text-xl"></i>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 hover:bg-white/80 rounded-lg transition-colors relative"
            aria-label="Notifications"
          >
            <i className="ri-notification-3-line text-gray-600 text-xl"></i>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNotifications(false)}></div>
              <div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-1.5rem))] bg-white rounded-lg shadow-lg border border-gray-200 z-20 max-h-96 overflow-y-auto">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">Notifications</h3>
                </div>
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer ${!notification.read ? 'bg-blue-50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-2 shrink-0 ${
                            notification.priority === 'high'
                              ? 'bg-red-500'
                              : notification.priority === 'medium'
                                ? 'bg-yellow-500'
                                : 'bg-green-500'
                          }`}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          <p className="text-sm text-gray-600 mt-1 break-words">{notification.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(notification.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 hover:bg-white/80 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-sky-600 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white font-semibold text-sm">{getInitials()}</span>
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-gray-900 whitespace-nowrap max-w-[8rem] truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-gray-500 whitespace-nowrap max-w-[8rem] truncate">{user?.role || 'Role'}</p>
            </div>
            <i className="ri-arrow-down-s-line text-gray-600 hidden sm:inline"></i>
          </button>

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1.5rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-20">
                <div className="p-4 border-b border-gray-200">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{user?.email}</p>
                  <p className="text-xs text-sky-600 font-medium mt-1">{user?.role}</p>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <i className="ri-user-line"></i>
                    <span className="whitespace-nowrap">Profile</span>
                  </button>
                  <button
                    type="button"
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <i className="ri-settings-3-line"></i>
                    <span className="whitespace-nowrap">Settings</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <i className="ri-logout-box-line"></i>
                    <span className="whitespace-nowrap">Logout</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
