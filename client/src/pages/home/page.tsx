import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoleHomePath, useAuth } from '../../contexts/AuthContext';
import { getUnauthenticatedSsoUrl, goToRefexOneSamlSso } from '../../utils/refexOneUrl';

export default function Home() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      goToRefexOneSamlSso(getUnauthenticatedSsoUrl('/'));
      return;
    }
    navigate(getRoleHomePath(user.role, user.navigation), { replace: true });
  }, [user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
      Redirecting…
    </div>
  );
}
