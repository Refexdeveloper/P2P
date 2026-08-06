import { useState, useEffect, FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resolvePostLoginPath, useAuth, UserRole } from '../../contexts/AuthContext';
import { authApi } from '../../services/api';

const roles: UserRole[] = [
  'Requester',
  'HOD Approver',
  'CFO',
  'Functional Team',
  'SCM Buyer',
  'QA Inspector',
  'Legal',
  'Accounts Payable',
  'Vendor',
  'Governance Admin',
  'PR Manager',
  'SCM Manager',
  'Super Admin',
];

const demoAccounts = [
  {
    role: 'Requester' as UserRole,
    email: 'requester@procure.com',
    password: 'demo1234',
    icon: 'ri-file-list-3-line',
    color: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400',
    iconColor: 'text-emerald-600 bg-emerald-100',
    description: 'Submit & track purchase requests',
  },
  {
    role: 'PR Manager' as UserRole,
    email: 'prmanager@procure.com',
    password: 'demo1234',
    icon: 'ri-shield-user-line',
    color: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400',
    iconColor: 'text-indigo-600 bg-indigo-100',
    description: 'Review & approve purchase requests',
  },
  {
    role: 'CFO' as UserRole,
    email: 'cfo@procure.com',
    password: 'demo1234',
    icon: 'ri-building-line',
    color: 'bg-violet-50 border-violet-200 hover:border-violet-400',
    iconColor: 'text-violet-600 bg-violet-100',
    description: 'Entity-wise business approvals',
  },
  {
    role: 'HOD Approver' as UserRole,
    email: 'manager@procure.com',
    password: 'demo1234',
    icon: 'ri-user-star-line',
    color: 'bg-amber-50 border-amber-200 hover:border-amber-400',
    iconColor: 'text-amber-600 bg-amber-100',
    description: 'Review & approve department requests',
  },
  {
    role: 'SCM Buyer' as UserRole,
    email: 'scm@procure.com',
    password: 'demo1234',
    icon: 'ri-shopping-bag-3-line',
    color: 'bg-teal-50 border-teal-200 hover:border-teal-400',
    iconColor: 'text-teal-600 bg-teal-100',
    description: 'Manage vendors, RFQ & purchase orders',
  },
  {
    role: 'SCM Manager' as UserRole,
    email: 'scmmanager@procure.com',
    password: 'demo1234',
    icon: 'ri-user-settings-line',
    color: 'bg-sky-50 border-sky-200 hover:border-sky-400',
    iconColor: 'text-sky-600 bg-sky-100',
    description: 'L2 manager — RFQ vendor comparison & approval',
  },
  {
    role: 'Super Admin' as UserRole,
    email: 'admin@procure.com',
    password: 'demo1234',
    icon: 'ri-shield-user-line',
    color: 'bg-rose-50 border-rose-200 hover:border-rose-400',
    iconColor: 'text-rose-600 bg-rose-100',
    description: 'Manage users & navigation permissions',
  },
];

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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('Requester');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [refexoneUrl, setRefexoneUrl] = useState('https://refexone.com');
  const [refexoneEnabled, setRefexoneEnabled] = useState(true);

  const { login, loginWithRefexOneToken, isAuthenticated, isLoading: authBootLoading, user } = useAuth();
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
    authApi
      .refexOneConfig()
      .then((cfg) => {
        setRefexoneEnabled(cfg.enabled !== false);
        if (cfg.refexoneUrl) setRefexoneUrl(cfg.refexoneUrl);
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  useEffect(() => {
    if (authBootLoading || isAuthenticated) return;

    const token =
      extractTokenFromSearch(searchParams) ||
      extractTokenFromHash() ||
      extractStoredRefexOneToken();

    if (!token) return;

    let cancelled = false;
    const runSso = async () => {
      setSsoLoading(true);
      setError('');
      try {
        await loginWithRefexOneToken(token, redirectPath);
        clearTokenFromUrl(searchParams);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'RefexOne automatic sign-in failed. Please sign in manually.'
          );
          clearTokenFromUrl(searchParams);
        }
      } finally {
        if (!cancelled) setSsoLoading(false);
      }
    };

    runSso();
    return () => {
      cancelled = true;
    };
  }, [authBootLoading, isAuthenticated, searchParams, loginWithRefexOneToken, redirectPath]);

  const handleDemoLogin = (account: (typeof demoAccounts)[0]) => {
    setEmail(account.email);
    setPassword(account.password);
    setRole(account.role);
    setActiveDemo(account.role);
    setError('');
  };

  const handleContinueWithRefexOne = () => {
    const params = new URLSearchParams();
    if (redirectPath) params.set('redirect', redirectPath);
    const qs = params.toString();
    navigate(`/auth/refexone${qs ? `?${qs}` : ''}`);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password, redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (ssoLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-10 max-w-md w-full text-center">
          <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <i className="ri-loader-4-line text-2xl text-indigo-600 animate-spin"></i>
          </div>
          <h1 className="text-lg font-bold text-slate-900 mb-2">Signing in with RefexOne</h1>
          <p className="text-sm text-slate-600">
            Detected your RefexOne session — completing automatic login…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <i className="ri-shopping-cart-2-line text-3xl text-white"></i>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Procurement P2P</h1>
            <p className="text-sm text-slate-600">Sign in with RefexOne or a demo account</p>
          </div>

          {refexoneEnabled && (
            <div className="mb-5 space-y-3">
              <button
                type="button"
                onClick={handleContinueWithRefexOne}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <i className="ri-shield-keyhole-line text-lg"></i>
                Continue with RefexOne
              </button>
              <p className="text-xs text-center text-slate-500">
                Use your <strong>refexone.com</strong> email &amp; password to SSO into the P2P portal.
              </p>
            </div>
          )}

          <div className="mb-5 rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3">
            <p className="text-xs font-semibold text-indigo-800 mb-1">RefexOne SSO</p>
            <p className="text-xs text-indigo-700">
              Click <strong>Continue with RefexOne</strong> and sign in with the same credentials as{' '}
              <a href={refexoneUrl} target="_blank" rel="noopener noreferrer" className="underline">
                refexone.com
              </a>
              . P2P verifies with RefexOne and opens your portal.
            </p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <i className="ri-flashlight-line text-amber-500 text-base w-5 h-5 flex items-center justify-center"></i>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Quick Demo Access
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {demoAccounts.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => handleDemoLogin(account)}
                  className={`relative p-3 rounded-lg border text-left transition-all cursor-pointer ${account.color} ${
                    activeDemo === account.role ? 'ring-2 ring-teal-500 ring-offset-1' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center mb-2 ${account.iconColor}`}>
                    <i className={`${account.icon} text-base`}></i>
                  </div>
                  <p className="text-xs font-semibold text-slate-800 leading-tight">{account.role}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{account.description}</p>
                  {activeDemo === account.role && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-teal-500 rounded-full flex items-center justify-center">
                      <i className="ri-check-line text-white text-[10px]"></i>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {activeDemo && (
              <div className="mt-2.5 bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2 border border-slate-100">
                <i className="ri-information-line text-blue-500 text-sm w-4 h-4 flex items-center justify-center"></i>
                <p className="text-[11px] text-slate-600">
                  Credentials filled — <strong>{email}</strong> / <strong>{password}</strong>
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-200"></div>
            <span className="text-xs text-slate-400 font-medium">or enter manually</span>
            <div className="flex-1 h-px bg-slate-200"></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-mail-line text-slate-400 text-lg"></i>
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setActiveDemo(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="you@refex.co.in"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-lock-line text-slate-400 text-lg"></i>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setActiveDemo(null);
                  }}
                  className="w-full pl-10 pr-12 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                >
                  <i
                    className={`${
                      showPassword ? 'ri-eye-off-line' : 'ri-eye-line'
                    } text-slate-400 text-lg hover:text-slate-600 transition-colors`}
                  ></i>
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-slate-700 mb-2">
                Demo Role <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <i className="ri-user-settings-line text-slate-400 text-lg"></i>
                </div>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as UserRole);
                    setActiveDemo(null);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none bg-white cursor-pointer"
                >
                  <option value="">Use account role from system</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <i className="ri-arrow-down-s-line text-slate-400 text-lg"></i>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <i className="ri-error-warning-line text-red-600 text-lg mt-0.5"></i>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              {isLoading ? (
                <>
                  <i className="ri-loader-4-line text-lg animate-spin"></i>
                  Signing in...
                </>
              ) : (
                <>
                  <i className="ri-login-box-line text-lg"></i>
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs text-center text-slate-500">
              Secure enterprise procurement management system
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          © 2024 Procurement P2P. All rights reserved.
        </p>
      </div>
    </div>
  );
}
