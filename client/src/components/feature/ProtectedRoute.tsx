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
    return null;
  }

  return <>{children}</>;
}
