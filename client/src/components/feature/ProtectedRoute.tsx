import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true, state: { from: location } });
    }
  }, [isAuthenticated, isLoading, navigate, location]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
