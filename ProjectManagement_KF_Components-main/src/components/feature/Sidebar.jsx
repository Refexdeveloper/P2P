import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import Avatar from '../base/Avatar';
const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'ri-dashboard-3-line' },
    { path: '/projects', label: 'Projects', icon: 'ri-folder-3-line' },
    { path: '/tasks', label: 'Tasks', icon: 'ri-task-line' },
    { path: '/reports', label: 'Reports', icon: 'ri-bar-chart-2-line' },
    { path: '/help', label: 'Help', icon: 'ri-question-line' },
    { path: '/employee-dashboard', label: 'Employee Dashboard', icon: 'ri-user-3-line' },
];
export default function Sidebar() {
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    return (<aside className={`
        fixed left-0 top-0 h-full z-50 bg-white border-r border-gray-100
        flex flex-col transition-all duration-300
        ${collapsed ? 'w-[72px]' : 'w-[260px]'}
      `}>
      {/* Logo */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-gray-100 flex-shrink-0">
        {!collapsed && (<div className="flex items-center gap-2.5 overflow-hidden">
            <img src="https://static.readdy.ai/image/d0ead66ce635a168f1e83b108be94826/fe7621c39936f84e8e4570e1810c310f.png" alt="ProjectFlow Logo" className="h-8 w-8 object-contain flex-shrink-0"/>
            <span className="text-base font-bold bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 bg-clip-text text-transparent whitespace-nowrap">
              ProjectFlow
            </span>
          </div>)}
        {collapsed && (<img src="https://static.readdy.ai/image/d0ead66ce635a168f1e83b108be94826/fe7621c39936f84e8e4570e1810c310f.png" alt="Logo" className="h-8 w-8 object-contain mx-auto"/>)}
        <button onClick={() => setCollapsed(!collapsed)} className={`w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all cursor-pointer flex-shrink-0 ${collapsed ? 'mx-auto mt-0' : ''}`}>
          <i className={`${collapsed ? 'ri-menu-unfold-line' : 'ri-menu-fold-line'} text-base`}/>
        </button>
      </div>

      {/* Gradient underline */}
      <div className="h-0.5 bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-500 flex-shrink-0"/>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (<NavLink key={item.path} to={item.path} title={collapsed ? item.label : undefined} className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group
                ${isActive
                    ? 'bg-gradient-to-r from-blue-500 via-emerald-500 to-amber-400 text-white'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'}
                ${collapsed ? 'justify-center' : ''}
              `}>
              <span className={`w-5 h-5 flex items-center justify-center flex-shrink-0`}>
                <i className={`${item.icon} text-lg`}/>
              </span>
              {!collapsed && (<span className="text-sm font-medium truncate">{item.label}</span>)}
              {!collapsed && isActive && (<span className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70 flex-shrink-0"/>)}
            </NavLink>);
        })}
      </nav>

      {/* User Profile */}
      <div className={`border-t border-gray-100 p-4 flex-shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
        {collapsed ? (<Avatar initials="CTO" size="sm"/>) : (<div className="flex items-center gap-3">
            <Avatar initials="CTO" size="sm"/>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-800 truncate">Admin User</p>
              <p className="text-xs text-gray-400 truncate">CTO View</p>
            </div>
            <button className="ml-auto w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 cursor-pointer">
              <i className="ri-settings-3-line text-base"/>
            </button>
          </div>)}
      </div>
    </aside>);
}
