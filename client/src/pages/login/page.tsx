import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';
import { getRefexOneUrl, goToRefexOne } from '../../utils/refexOneUrl';

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
 * /login → RefexOne portal.
 * If RefexOne already passed a token (or user is signed into P2P), enter the P2P system.
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
  const [refexoneUrl, setRefexoneUrl] = useState(getRefexOneUrl());
  const [status, setStatus] = useState('Checking RefexOne session…');

  const redirectPath = (() => {
    const from = location.state?.from as { pathname?: string; search?: string } | undefined;
    const fromQuery = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (fromQuery) return fromQuery;
    if (!from?.pathname) return undefined;
    return `${from.pathname}${from.search || ''}`;
  })();

  useEffect(() => {
    authApi
      .refexOneConfig()
      .then((cfg) => {
        if (cfg.refexoneUrl) setRefexoneUrl(cfg.refexoneUrl.replace(/\/$/, ''));
      })
      .catch(() => undefined);
  }, []);

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
            window.location.replace(refexoneUrl || getRefexOneUrl());
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    // No session → RefexOne login; open P2P from My Apps after sign-in
    setStatus('Redirecting to RefexOne…');
    const t = window.setTimeout(() => {
      window.location.replace(refexoneUrl || getRefexOneUrl());
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
    refexoneUrl,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
        <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-loader-4-line text-2xl text-indigo-600 animate-spin"></i>
        </div>
        <h1 className="text-lg font-bold text-slate-900 mb-2">{status}</h1>
        <p className="text-sm text-slate-600">
          Sign in at RefexOne, then open <strong>P2P</strong> from My Apps to enter this system.
        </p>
        <button
          type="button"
          onClick={() => goToRefexOne()}
          className="mt-6 text-sm text-indigo-600 hover:underline cursor-pointer"
        >
          Continue to RefexOne
        </button>
      </div>
    </div>
  );
}
