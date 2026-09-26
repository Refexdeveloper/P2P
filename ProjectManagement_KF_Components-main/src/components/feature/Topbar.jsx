import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Avatar from '../base/Avatar';
import { mockNotifications } from '../../mocks/dashboard';
const breadcrumbMap = {
    '/dashboard': ['Home', 'CTO Dashboard'],
    '/pm-dashboard': ['Home', 'PM Dashboard'],
    '/employee-dashboard': ['Home', 'Employee Dashboard'],
    '/projects': ['Home', 'Projects'],
    '/tasks': ['Home', 'Tasks'],
    '/reports': ['Home', 'Reports'],
    '/help': ['Home', 'Help'],
};
export default function Topbar() {
    const location = useLocation();
    const [notifOpen, setNotifOpen] = useState(false);
    const [searchVal, setSearchVal] = useState('');
    const crumbs = breadcrumbMap[location.pathname] ?? ['Home'];
    const unread = mockNotifications.filter((n) => !n.read).length;
    const notifIconMap = {
        warning: 'ri-alarm-warning-line text-amber-500',
        info: 'ri-information-line text-blue-500',
        success: 'ri-checkbox-circle-line text-emerald-500',
    };
    return (<header className="fixed top-0 z-40 right-0 h-16 bg-white border-b border-gray-100 flex items-center px-6 gap-4" style={{ left: 'var(--sidebar-width, 260px)', transition: 'left 0.3s' }}>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm flex-1 min-w-0">
        {crumbs.map((c, i) => (<span key={i} className="flex items-center gap-1.5">
            {i > 0 && <i className="ri-arrow-right-s-line text-gray-300"/>}
            <span className={i === crumbs.length - 1 ? 'font-semibold text-gray-800 truncate' : 'text-gray-400'}>
              {c}
            </span>
          </span>))}
      </div>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <i className="ri-search-line absolute left-3 text-gray-400 text-sm"/>
        <input type="text" placeholder="Search projects, tasks..." value={searchVal} onChange={(e) => setSearchVal(e.target.value)} className="pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl w-64 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"/>
      </div>

      {/* Notifications */}
      <div className="relative">
        <button onClick={() => setNotifOpen(!notifOpen)} className="relative w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 transition-all cursor-pointer">
          <i className="ri-notification-3-line text-lg"/>
          {unread > 0 && (<span className="absolute top-1 right-1 w-4 h-4 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
              {unread}
            </span>)}
        </button>

        {notifOpen && (<div className="absolute right-0 top-12 w-80 bg-white rounded-2xl border border-gray-100 shadow-xl z-50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">Notifications</span>
              <span className="text-xs text-blue-500 cursor-pointer">{unread} unread</span>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {mockNotifications.map((n) => (<div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-all ${!n.read ? 'bg-blue-50/30' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <i className={`${notifIconMap[n.type] ?? 'ri-information-line text-gray-400'} text-base`}/>
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 leading-snug">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{n.time}</p>
                    </div>
                  </div>
                </div>))}
            </div>
            <button className="w-full px-4 py-2.5 text-xs text-center text-blue-500 hover:bg-gray-50 transition-all cursor-pointer" onClick={() => setNotifOpen(false)}>
              View all notifications
            </button>
          </div>)}
      </div>

      {/* Profile */}
      <div className="flex items-center gap-2.5 pl-2 border-l border-gray-100">
        <Avatar initials="CTO" size="sm"/>
        <div className="hidden md:block">
          <p className="text-xs font-semibold text-gray-800 leading-tight">Admin User</p>
          <p className="text-[10px] text-gray-400">CTO</p>
        </div>
        <button className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
          <i className="ri-arrow-down-s-line"/>
        </button>
      </div>
    </header>);
}
