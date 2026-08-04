import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../../contexts/AuthContext';

/**
 * Callback after RefexOne token handoff or SAML ACS redirect.
 * /auth/refexone/callback?access_token=... | ?p2p_token=...
 */
export default function RefexOneCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithRefexOneToken, completeSessionLogin, isAuthenticated, user, isLoading } =
    useAuth();
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Completing RefexOne SSO…');

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated && user) {
      navigate(resolvePostLoginPath(user.role, user.navigation), { replace: true });
      return;
    }

    const errParam = searchParams.get('error');
    if (errParam) {
      setError(errParam);
      setStatus('');
      return;
    }

    const p2pToken = searchParams.get('p2p_token') || searchParams.get('p2pToken');
    const token =
      searchParams.get('access_token') ||
      searchParams.get('accessToken') ||
      searchParams.get('token') ||
      searchParams.get('refexone_token');

    const redirectPath =
      searchParams.get('redirect') || searchParams.get('returnUrl') || undefined;

    if (!p2pToken && !token) {
      setError(
        'No RefexOne token was returned. Sign in with your RefexOne email and password instead.'
      );
      setStatus('');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setStatus('Validating session…');
        if (p2pToken) {
          await completeSessionLogin(p2pToken, redirectPath);
        } else if (token) {
          await loginWithRefexOneToken(token, redirectPath);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'RefexOne SSO failed. Please sign in again.'
          );
          setStatus('');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isLoading,
    isAuthenticated,
    user,
    searchParams,
    loginWithRefexOneToken,
    completeSessionLogin,
    navigate,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-md w-full text-center">
        {!error ? (
          <>
            <i className="ri-loader-4-line text-3xl text-indigo-600 animate-spin"></i>
            <h1 className="text-lg font-bold text-slate-900 mt-4">RefexOne SSO</h1>
            <p className="text-sm text-slate-600 mt-2">{status || 'Signing you into P2P…'}</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <i className="ri-error-warning-line text-2xl text-red-600"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-4">SSO incomplete</h1>
            <p className="text-sm text-red-600 mt-2">{error}</p>
            <Link
              to="/auth/refexone"
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
            >
              Continue with RefexOne email &amp; password
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
