import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../contexts/AuthContext';
import { getUnauthenticatedSsoUrl, goToRefexOneSamlSso } from '../../utils/refexOneUrl';

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
    'p2p_sso_token',
  ]) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value?.trim() && value.split('.').length === 3) return value.trim();
  }
  return null;
}

function clearTokenFromUrl(searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams);
  REFEXONE_TOKEN_KEYS.forEach((key) => next.delete(key));
  next.delete('p2p_token');
  next.delete('p2pToken');
  const query = next.toString();
  window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

/**
 * /login — redirect to RefexOne.com (SSO).
 * Local admin credentials: use /admin/login
 */
export default function LoginPage() {
  const {
    loginWithRefexOneToken,
    completeSessionLogin,
    isAuthenticated,
    isLoading: authBootLoading,
    user,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ssoUrl, setSsoUrl] = useState<string | null>(null);
  const [status, setStatus] = useState('Checking RefexOne session…');

  const redirectPath = (() => {
    const from = location.state?.from as { pathname?: string; search?: string } | undefined;
    const fromQuery = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (fromQuery) return fromQuery;
    if (!from?.pathname) return undefined;
    return `${from.pathname}${from.search || ''}`;
  })();

  useEffect(() => {
    setSsoUrl(getUnauthenticatedSsoUrl(redirectPath));
  }, [redirectPath]);

  useEffect(() => {
    if (authBootLoading) return;

    if (isAuthenticated && user) {
      setStatus('Opening P2P…');
      navigate(resolvePostLoginPath(user.role, user.navigation, redirectPath), { replace: true });
      return;
    }

    const p2pToken =
      searchParams.get('p2p_token') ||
      searchParams.get('p2pToken') ||
      sessionStorage.getItem('p2p_sso_token') ||
      localStorage.getItem('p2p_sso_token');

    const refexToken =
      extractTokenFromSearch(searchParams) ||
      extractTokenFromHash() ||
      extractStoredRefexOneToken();

    // Already logged into RefexOne (token present) → sign into P2P
    if (p2pToken || refexToken) {
      let cancelled = false;
      (async () => {
        try {
          setStatus('RefexOne session found — signing into P2P…');
          if (p2pToken) {
            await completeSessionLogin(p2pToken, redirectPath);
            try {
              sessionStorage.removeItem('p2p_sso_token');
              localStorage.removeItem('p2p_sso_token');
            } catch {
              /* ignore */
            }
          } else if (refexToken) {
            await loginWithRefexOneToken(refexToken, redirectPath);
          }
          clearTokenFromUrl(searchParams);
        } catch {
          if (!cancelled) {
            clearTokenFromUrl(searchParams);
            setStatus('Redirecting to RefexOne…');
            goToRefexOneSamlSso(ssoUrl || getUnauthenticatedSsoUrl(redirectPath));
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // No session → RefexOne SAML SSO
    if (!ssoUrl) return;
    setStatus('Redirecting to RefexOne…');
    const t = window.setTimeout(() => {
      goToRefexOneSamlSso(ssoUrl);
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    authBootLoading,
    isAuthenticated,
    user,
    redirectPath,
    navigate,
    searchParams,
    loginWithRefexOneToken,
    completeSessionLogin,
    ssoUrl,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-md w-full text-center">
        <i className="ri-loader-4-line text-3xl text-indigo-600 animate-spin"></i>
        <h1 className="text-lg font-bold text-slate-900 mt-4">{status}</h1>
        <p className="text-sm text-slate-500 mt-2">You will continue on RefexOne</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() =>
              goToRefexOneSamlSso(ssoUrl || getUnauthenticatedSsoUrl(redirectPath))
            }
            className="text-sm text-indigo-600 hover:underline cursor-pointer"
          >
            Continue to RefexOne now
          </button>
          <Link to="/admin/login" className="text-xs text-slate-400 hover:text-slate-600 hover:underline">
            Admin local login
          </Link>
        </div>
      </div>
    </div>
  );
}
