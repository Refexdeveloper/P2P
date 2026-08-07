import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../contexts/AuthContext';
import { goToRefexOne } from '../../utils/refexOneUrl';

const REFEXONE_TOKEN_KEYS = [
  'access_token',
  'accessToken',
  'token',
  'refexone_token',
  'refexoneToken',
];

function extractTokenFromSearch(params: URLSearchParams): string | null {
  for (const key of REFEXONE_TOKEN_KEYS) {
    const value = params.get(key);
    if (value?.trim()) return value.trim();
  }
  return null;
}

function extractTokenFromHash(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash.startsWith('/') ? hash.split('?')[1] || '' : hash);
  return extractTokenFromSearch(params);
}

function extractStoredRefexOneToken(): string | null {
  for (const key of [
    'refexone_token',
    'refexone_access_token',
    'access_token',
    'token',
  ]) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value?.trim() && value.split('.').length === 3) return value.trim();
  }
  return null;
}

function clearTokenFromUrl(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  REFEXONE_TOKEN_KEYS.forEach((key) => next.delete(key));
  const query = next.toString();
  const path = `${window.location.pathname}${query ? `?${query}` : ''}`;
  window.history.replaceState({}, '', path);
}

/**
 * /login always sends users to RefexOne unless a SSO token is present
 * (or they are already authenticated in P2P).
 */
export default function LoginPage() {
  const { loginWithRefexOneToken, isAuthenticated, isLoading: authBootLoading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const redirectPath = (() => {
    const from = location.state?.from as { pathname?: string; search?: string } | undefined;
    const fromQuery = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (fromQuery) return fromQuery;
    if (!from?.pathname) return undefined;
    return `${from.pathname}${from.search || ''}`;
  })();

  useEffect(() => {
    if (authBootLoading || !isAuthenticated || !user) return;
    navigate(resolvePostLoginPath(user.role, user.navigation, redirectPath), { replace: true });
  }, [authBootLoading, isAuthenticated, user, redirectPath, navigate]);

  useEffect(() => {
    if (authBootLoading || isAuthenticated) return;

    const token =
      extractTokenFromSearch(searchParams) ||
      extractTokenFromHash() ||
      extractStoredRefexOneToken();

    if (!token) {
      goToRefexOne();
      return;
    }

    let cancelled = false;
    const runSso = async () => {
      try {
        await loginWithRefexOneToken(token, redirectPath);
        clearTokenFromUrl(searchParams);
      } catch {
        if (!cancelled) {
          clearTokenFromUrl(searchParams);
          goToRefexOne();
        }
      }
    };

    runSso();
    return () => {
      cancelled = true;
    };
  }, [authBootLoading, isAuthenticated, searchParams, loginWithRefexOneToken, redirectPath]);

  const statusTitle = isAuthenticated
    ? 'Opening your dashboard'
    : extractTokenFromSearch(searchParams) || extractTokenFromHash() || extractStoredRefexOneToken()
      ? 'Signing in with RefexOne'
      : 'Redirecting to RefexOne';

  const statusBody = isAuthenticated
    ? 'You are signed in — taking you to P2P…'
    : statusTitle === 'Signing in with RefexOne'
      ? 'Detected your RefexOne session — completing automatic login…'
      : 'Please sign in at refexone.com to open the P2P portal.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-loader-4-line text-2xl text-indigo-600 animate-spin"></i>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">{statusTitle}</h1>
        <p className="text-sm text-slate-600">{statusBody}</p>
      </div>
    </div>
  );
}
