import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { goToRefexOne } from '../../utils/refexOneUrl';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      goToRefexOne();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
