import { ReactNode, useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { PM_PAGE_BG } from '../../constants/pmTheme';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Lock document scroll — only the main pane scrolls (prevents white gap below long pages)
  useEffect(() => {
    const html = document.documentElement;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyHeight = document.body.style.height;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.height = prevBodyHeight;
    };
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileNavOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] overflow-hidden" style={{ background: PM_PAGE_BG }}>
      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden cursor-pointer"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <TopBar onMenuClick={() => setMobileNavOpen(true)} />
        <main
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{ background: PM_PAGE_BG }}
        >
          <div className="min-h-full w-full min-w-0 max-w-full p-3 pb-10 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
