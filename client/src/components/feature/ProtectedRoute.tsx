import { ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getUnauthenticatedSsoUrl, goToRefexOneSamlSso } from '../../utils/refexOneUrl';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    const returnPath = `${location.pathname}${location.search || ''}`;
    goToRefexOneSamlSso(getUnauthenticatedSsoUrl(returnPath));
  }, [isAuthenticated, isLoading, location.pathname, location.search]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin" />
          <p className="text-sm text-slate-600 mt-3">Signing you in…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
