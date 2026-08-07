import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth } from '../../../contexts/AuthContext';
import { authApi } from '../../../services/api';

/**
 * RefexOne app-launcher entry.
 * Set as HOME URL in RefexOne: /auth/refexone/launch
 */
function extractToken(params: URLSearchParams): { kind: 'refex' | 'p2p'; value: string } | null {
  const p2p = params.get('p2p_token') || params.get('p2pToken') || params.get('session_token');
  if (p2p?.trim()) return { kind: 'p2p', value: p2p.trim() };

  for (const key of [
    'access_token',
    'accessToken',
    'token',
    'refexone_token',
    'refexoneToken',
    'id_token',
    'kf_token',
  ]) {
    const value = params.get(key);
    if (value?.trim()) return { kind: 'refex', value: value.trim() };
  }
  return null;
}

function readStoredSsoToken(): string | null {
  try {
    const fromSession = sessionStorage.getItem('p2p_sso_token');
    if (fromSession?.trim()) return fromSession.trim();
    const fromLocal = localStorage.getItem('p2p_sso_token');
    if (fromLocal?.trim()) return fromLocal.trim();
  } catch {
    // ignore
  }
  return null;
}

function clearStoredSsoToken() {
  try {
    sessionStorage.removeItem('p2p_sso_token');
    localStorage.removeItem('p2p_sso_token');
  } catch {
    // ignore
  }
}

export default function RefexOneLaunchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    loginWithRefexOneToken,
    completeSessionLogin,
    isAuthenticated,
    isLoading,
    user,
  } = useAuth();

  const [status, setStatus] = useState('Connecting from RefexOne…');
  const [error, setError] = useState('');
  const [samlHint, setSamlHint] = useState<{ entityId: string; acsUrl: string; homeUrl: string } | null>(
    null
  );

  useEffect(() => {
    authApi
      .refexOneConfig()
      .then((cfg) => {
        if (cfg.saml) setSamlHint(cfg.saml);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const errParam = searchParams.get('error');
    if (errParam) {
      setStatus('');
      setError(errParam);
      return;
    }

    if (isAuthenticated && user) {
      navigate(resolvePostLoginPath(user.role, user.navigation), { replace: true });
      return;
    }

    const hash = window.location.hash.replace(/^#/, '');
    const hashParams = new URLSearchParams(
      hash.includes('=') ? (hash.includes('?') ? hash.split('?')[1] || '' : hash) : ''
    );
    const found =
      extractToken(searchParams) ||
      extractToken(hashParams) ||
      (() => {
        const stored = readStoredSsoToken();
        return stored ? ({ kind: 'p2p' as const, value: stored }) : null;
      })();

    if (!found) {
      setStatus('');
      setError(
        'No session was passed from RefexOne. The app opened HOME URL without a SAML login. Use the ACS URL below in RefexOne, then launch the app again from My Apps (not by pasting the HOME link).'
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setStatus('Signing you into P2P automatically…');
        if (found.kind === 'p2p') {
          await completeSessionLogin(found.value);
        } else {
          await loginWithRefexOneToken(found.value);
        }
        clearStoredSsoToken();
      } catch (err) {
        if (!cancelled) {
          clearStoredSsoToken();
          setError(err instanceof Error ? err.message : 'Automatic sign-in failed');
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
    navigate,
    loginWithRefexOneToken,
    completeSessionLogin,
  ]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-10 max-w-lg w-full text-center">
        {!error ? (
          <>
            <i className="ri-loader-4-line text-3xl text-teal-600 animate-spin"></i>
            <h1 className="text-lg font-bold text-slate-900 mt-4">P2P SSO</h1>
            <p className="text-sm text-slate-600 mt-2">{status}</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
              <i className="ri-shield-keyhole-line text-2xl text-amber-600"></i>
            </div>
            <h1 className="text-lg font-bold text-slate-900 mt-4">Almost there</h1>
            <p className="text-sm text-slate-600 mt-2">{error}</p>
            {samlHint && (
              <div className="mt-4 text-left bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">Set these in RefexOne → SAML App:</p>
                <p>
                  <span className="font-medium">Entity ID:</span>{' '}
                  <span className="font-mono break-all">{samlHint.entityId}</span>
                </p>
                <p>
                  <span className="font-medium">ACS URL:</span>{' '}
                  <span className="font-mono break-all">{samlHint.acsUrl}</span>
                </p>
                <p>
                  <span className="font-medium">HOME URL:</span>{' '}
                  <span className="font-mono break-all">{samlHint.homeUrl}</span>
                </p>
                <p className="pt-1 text-amber-700">
                  Click the app from Refex One My Apps so it POSTs to ACS. Opening HOME alone will not SSO.
                </p>
              </div>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <Link
                to="/auth/refexone"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold"
              >
                Continue with RefexOne email &amp; password
              </Link>
              <Link to="/login" className="text-sm text-slate-600 hover:underline text-center">
                Back to login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
