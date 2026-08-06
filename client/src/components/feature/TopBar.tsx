import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notifications } from '../../mocks/procurement-data';

type TopBarProps = {
  onMenuClick?: () => void;
};

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
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
    <div className="h-14 sm:h-16 bg-white border-b border-gray-200 flex items-center justify-between gap-2 px-3 sm:px-4 lg:px-6 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer shrink-0"
          aria-label="Open navigation"
        >
          <i className="ri-menu-line text-xl"></i>
        </button>
        <div className="min-w-0">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Procurement P2P</h2>
          <p className="text-xs text-gray-500 hidden sm:block">Enterprise Management System</p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 lg:gap-4 shrink-0">
        <div className="relative hidden md:block">
          <input
            type="text"
            placeholder="Search..."
            className="w-40 lg:w-72 xl:w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
        </div>

        <button
          type="button"
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:inline-flex"
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
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
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
            className="flex items-center space-x-2 sm:space-x-3 p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
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
                  <p className="text-xs text-blue-600 font-medium mt-1">{user?.role}</p>
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
