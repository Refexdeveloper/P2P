import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * /logout — clear P2P session and send user to RefexOne.com
 */
export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout();
    // Run once on mount — logout navigates away to RefexOne
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-md w-full text-center">
        <i className="ri-loader-4-line text-3xl text-indigo-600 animate-spin"></i>
        <h1 className="text-lg font-bold text-slate-900 mt-4">Signing out…</h1>
        <p className="text-sm text-slate-500 mt-2">Redirecting to RefexOne</p>
      </div>
    </div>
  );
}
