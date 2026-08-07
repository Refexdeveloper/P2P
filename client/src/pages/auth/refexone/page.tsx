import { FormEvent, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../../contexts/AuthContext';
import { authApi } from '../../../services/api';

/**
 * RefexOne SSO entry for P2P.
 * User signs in with the same email/password used at https://refexone.com
 * Backend validates against RefexOne and issues a P2P session.
 */
export default function RefexOneSsoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    loginWithRefexOne,
    loginWithRefexOneToken,
    isAuthenticated,
    isLoading: authBootLoading,
    user,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState('');
  const [refexoneUrl, setRefexoneUrl] = useState('https://refexone.com');

  const redirectPath =
    searchParams.get('redirect') ||
    searchParams.get('returnUrl') ||
    undefined;

  useEffect(() => {
    authApi
      .refexOneConfig()
      .then((cfg) => {
        if (cfg.refexoneUrl) setRefexoneUrl(cfg.refexoneUrl);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (authBootLoading) return;
    if (isAuthenticated && user) {
      navigate(resolvePostLoginPath(user.role, user.navigation, redirectPath || undefined), { replace: true });
      return;
    }

    const token =
      searchParams.get('access_token') ||
      searchParams.get('accessToken') ||
      searchParams.get('token') ||
      searchParams.get('refexone_token');

    if (!token) return;

    let cancelled = false;
    (async () => {
      setSsoLoading(true);
      setError('');
      try {
        await loginWithRefexOneToken(token, redirectPath);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'RefexOne session could not be used. Sign in with your RefexOne email and password.'
          );
        }
      } finally {
        if (!cancelled) setSsoLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    authBootLoading,
    isAuthenticated,
    user,
    searchParams,
    loginWithRefexOneToken,
    redirectPath,
    navigate,
  ]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Enter your RefexOne email and password');
      return;
    }

    setIsLoading(true);
    try {
      // Always validates against RefexOne API (same credentials as refexone.com)
      await loginWithRefexOne(email.trim(), password, redirectPath);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'RefexOne sign-in failed. Check your email and password.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (ssoLoading || authBootLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-md w-full text-center">
          <i className="ri-loader-4-line text-3xl text-indigo-600 animate-spin"></i>
          <h1 className="text-lg font-bold text-slate-900 mt-4">Connecting to RefexOne</h1>
          <p className="text-sm text-slate-600 mt-2">Signing you into the P2P portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-7">
            <div className="w-14 h-14 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-shield-keyhole-line text-2xl text-white"></i>
            </div>
            <h1 className="text-xl font-bold text-slate-900">Continue with RefexOne</h1>
            <p className="text-sm text-slate-600 mt-2">
              Sign in to P2P with the same email and password you use at{' '}
              <a
                href={refexoneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 font-medium hover:underline"
              >
                refexone.com
              </a>
            </p>
          </div>

          <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-800">
            <p className="font-semibold mb-1">SSO to P2P portal</p>
            <p>
              Already have a RefexOne account? Enter those credentials once here — P2P will
              verify with RefexOne and open your portal automatically.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="refex-email" className="block text-sm font-medium text-slate-700 mb-1.5">
                RefexOne Email
              </label>
              <div className="relative">
                <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  id="refex-email"
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
              <label htmlFor="refex-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                RefexOne Password
              </label>
              <div className="relative">
                <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"></i>
                <input
                  id="refex-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="Same password as RefexOne"
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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-600 mt-0.5"></i>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line animate-spin"></i>
                  Signing in to P2P…
                </>
              ) : (
                <>
                  <i className="ri-login-circle-line"></i>
                  Sign in to P2P Portal
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-2">
            <a
              href={refexoneUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-600 hover:underline inline-flex items-center gap-1"
            >
              <i className="ri-external-link-line"></i>
              Open RefexOne website
            </a>
            <p className="text-xs text-slate-500">
              <a href={refexoneUrl} className="text-slate-700 hover:underline">
                Back to RefexOne
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
