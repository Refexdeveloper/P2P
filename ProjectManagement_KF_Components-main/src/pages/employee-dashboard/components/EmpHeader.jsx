import { useState } from 'react';

const notifTypeIcon = {
  deadline: 'ri-alarm-warning-line',
  update: 'ri-refresh-line',
  mention: 'ri-at-line',
  complete: 'ri-checkbox-circle-line',
};

const notifTypeColor = {
  deadline: { bg: '#FEF2F2', color: '#E53935' },
  update: { bg: '#FFFBEB', color: '#FB8C00' },
  mention: { bg: '#EFF6FF', color: '#1E88E5' },
  complete: { bg: '#F0FDF4', color: '#43A047' },
};

export default function EmpHeader({ profile, overdueCount = 0, initialNotifications = [] }) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);

  const unread = notifications.filter((n) => !n.read).length;
  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <div className="border-b border-white/50 bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88 px-2 py-2.5 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.12)] backdrop-blur-md sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E88E5] text-xs font-bold text-white shadow-[0_8px_20px_-4px_rgba(30,136,229,0.45)] sm:h-12 sm:w-12 sm:rounded-2xl sm:text-sm">
            {profile.avatar}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xs font-semibold text-slate-900 sm:text-base">{profile.name}</h2>
              <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold text-[#1E88E5] ring-1 ring-[#1E88E5]/20 sm:px-2.5 sm:text-xs">
                {profile.role}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-slate-600 sm:text-xs">
              {profile.department} · {profile.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 text-xs text-slate-800 shadow-sm lg:flex">
            <i className="ri-calendar-line text-[#1E88E5]" />
            <span className="font-medium">{dateStr}</span>
          </div>
          {overdueCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-red-100 bg-red-50/90 px-2 py-1.5 text-[10px] font-semibold text-[#E53935] sm:rounded-xl sm:px-3 sm:py-2 sm:text-[11px]">
              <i className="ri-alarm-warning-line" aria-hidden />
              {overdueCount} Overdue
            </div>
          ) : null}

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-200/90 bg-white/90 shadow-sm transition hover:bg-white sm:h-10 sm:w-10 sm:rounded-xl"
              aria-expanded={notifOpen}
            >
              <i className="ri-notification-3-line text-lg text-slate-600" aria-hidden />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#E53935] text-[10px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </button>
            {notifOpen ? (
              <>
                <button type="button" className="fixed inset-0 z-40 cursor-default bg-transparent" aria-label="Close" onClick={() => setNotifOpen(false)} />
                <div className="absolute right-0 top-12 z-50 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_32px_rgba(15,23,42,0.12)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-sm font-semibold text-slate-900">
                      Notifications
                      {unread > 0 ? (
                        <span className="ml-2 rounded-full bg-[#E53935] px-1.5 py-0.5 text-xs text-white">{unread}</span>
                      ) : null}
                    </span>
                    {unread > 0 ? (
                      <button type="button" onClick={markAllRead} className="cursor-pointer text-xs text-[#1E88E5] hover:underline">
                        Mark all read
                      </button>
                    ) : null}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-slate-500">No notifications</p>
                    ) : (
                      notifications.map((n) => {
                        const cfg = notifTypeColor[n.type] || notifTypeColor.update;
                        return (
                          <div
                            key={n.id}
                            className="flex cursor-pointer items-start gap-3 border-b border-slate-50 px-4 py-3 transition-colors hover:bg-slate-50/80"
                            style={{ background: n.read ? 'transparent' : '#f8fafc' }}
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: cfg.bg }}>
                              <i className={`${notifTypeIcon[n.type] || 'ri-notification-line'} text-sm`} style={{ color: cfg.color }} aria-hidden />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs leading-snug text-slate-800">{n.message}</p>
                              <p className="mt-1 text-[10px] text-slate-500">{n.time}</p>
                            </div>
                            {!n.read ? <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#1E88E5]" /> : null}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
