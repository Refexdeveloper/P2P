import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../contexts/AuthContext';
// TEMP: RefexOne redirect disabled — uncomment when ready
// import { authApi } from '../../services/api';
// import { getRefexOneUrl, goToRefexOne } from '../../utils/refexOneUrl';

/*
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
*/

/**
 * /login — local email/password form for now.
 * TEMP: RefexOne.com redirect is commented out; restore when asked.
 */
export default function LoginPage() {
  const { login, isAuthenticated, isLoading: authBootLoading, user } = useAuth();
  // TEMP: RefexOne redirect disabled — uncomment when ready
  // const {
  //   loginWithRefexOneToken,
  //   completeSessionLogin,
  //   isAuthenticated,
  //   isLoading: authBootLoading,
  //   user,
  // } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // TEMP: RefexOne redirect disabled — uncomment when ready
  // const [refexoneUrl, setRefexoneUrl] = useState(getRefexOneUrl());
  // const [status, setStatus] = useState('Checking RefexOne session…');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const redirectPath = (() => {
    const from = location.state?.from as { pathname?: string; search?: string } | undefined;
    const fromQuery = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (fromQuery) return fromQuery;
    if (!from?.pathname) return undefined;
    return `${from.pathname}${from.search || ''}`;
  })();

  // TEMP: RefexOne redirect disabled — uncomment when ready
  // useEffect(() => {
  //   authApi
  //     .refexOneConfig()
  //     .then((cfg) => {
  //       if (cfg.refexoneUrl) setRefexoneUrl(cfg.refexoneUrl.replace(/\/$/, ''));
  //     })
  //     .catch(() => undefined);
  // }, []);

  useEffect(() => {
    if (authBootLoading) return;
    if (isAuthenticated && user) {
      navigate(resolvePostLoginPath(user.role, user.navigation, redirectPath), { replace: true });
    }
  }, [authBootLoading, isAuthenticated, user, redirectPath, navigate]);

  // TEMP: RefexOne redirect disabled — uncomment when ready
  // useEffect(() => {
  //   if (authBootLoading) return;
  //
  //   if (isAuthenticated && user) {
  //     setStatus('Opening P2P…');
  //     navigate(resolvePostLoginPath(user.role, user.navigation, redirectPath), { replace: true });
  //     return;
  //   }
  //
  //   const p2pToken =
  //     searchParams.get('p2p_token') ||
  //     searchParams.get('p2pToken') ||
  //     sessionStorage.getItem('p2p_sso_token') ||
  //     localStorage.getItem('p2p_sso_token');
  //
  //   const refexToken =
  //     extractTokenFromSearch(searchParams) ||
  //     extractTokenFromHash() ||
  //     extractStoredRefexOneToken();
  //
  //   // Already logged into RefexOne (token present) → sign into P2P
  //   if (p2pToken || refexToken) {
  //     let cancelled = false;
  //     (async () => {
  //       try {
  //         setStatus('RefexOne session found — signing into P2P…');
  //         if (p2pToken) {
  //           await completeSessionLogin(p2pToken, redirectPath);
  //           try {
  //             sessionStorage.removeItem('p2p_sso_token');
  //             localStorage.removeItem('p2p_sso_token');
  //           } catch {
  //             /* ignore */
  //           }
  //         } else if (refexToken) {
  //           await loginWithRefexOneToken(refexToken, redirectPath);
  //         }
  //         clearTokenFromUrl(searchParams);
  //       } catch {
  //         if (!cancelled) {
  //           clearTokenFromUrl(searchParams);
  //           setStatus('Redirecting to RefexOne…');
  //           window.location.replace(refexoneUrl || getRefexOneUrl());
  //         }
  //       }
  //     })();
  //     return () => {
  //       cancelled = true;
  //     };
  //   }
  //
  //   // No session → RefexOne login; open P2P from My Apps after sign-in
  //   setStatus('Redirecting to RefexOne…');
  //   const t = window.setTimeout(() => {
  //     window.location.replace(refexoneUrl || getRefexOneUrl());
  //   }, 400);
  //   return () => window.clearTimeout(t);
  // }, [
  //   authBootLoading,
  //   isAuthenticated,
  //   user,
  //   redirectPath,
  //   navigate,
  //   searchParams,
  //   loginWithRefexOneToken,
  //   completeSessionLogin,
  //   refexoneUrl,
  // ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password');
      return;
    }
    setIsLoading(true);
    try {
      await login(email.trim(), password, redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Check your email and password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (authBootLoading || (isAuthenticated && user)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-md w-full text-center">
          <i className="ri-loader-4-line text-3xl text-indigo-600 animate-spin"></i>
          <h1 className="text-lg font-bold text-slate-900 mt-4">Opening P2P…</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-login-circle-line text-2xl text-white"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-900">P2P Login</h1>
            <p className="text-sm text-slate-600 mt-2">Sign in with your account credentials</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                Email
              </label>
              <div className="relative">
                <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="you@refex.co.in"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <i className={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                </button>
              </div>
            </div>

            {error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Signing in…
                </>
              ) : (
                <>
                  <i className="ri-login-circle-line"></i>
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* TEMP: RefexOne redirect disabled — uncomment when ready
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => goToRefexOne()}
              className="text-sm text-indigo-600 hover:underline cursor-pointer"
            >
              Continue to RefexOne
            </button>
          </div>
          */}
        </div>
      </div>
    </div>
  );
}
