import Sidebar from './Sidebar';
import Topbar from './Topbar';
export default function AppLayout({ children }) {
    return (<div className="min-h-dvh bg-gradient-to-br from-gray-50 to-gray-100">
      <Sidebar />
      <div className="transition-all duration-300" style={{ marginLeft: '260px' }}>
        <Topbar />
        <main className="min-h-dvh pt-16">
          <div className="p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>);
}
