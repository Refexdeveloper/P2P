import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import PrChatbot from './PrChatbot';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user } = useAuth();
  const location = useLocation();
  const onRfqPage = location.pathname.includes('/rfq-entry');
  const showPrChatbot = user?.role === 'Requester' && !onRfqPage;

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
    <div className="flex h-[100dvh] max-h-[100dvh] bg-gray-50 overflow-hidden">
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
        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-50">
          <div
            className={`p-3 sm:p-4 lg:p-6 min-h-0 w-full min-w-0 max-w-full ${
              showPrChatbot ? 'pb-28' : 'pb-10'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
      {showPrChatbot ? <PrChatbot /> : null}
    </div>
  );
}
