import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { ensureNavigation } from '../constants/roleNavigation';
import { authApi, AuthUser, NavItem } from '../services/api';
import { goToRefexOne } from '../utils/refexOneUrl';

export type UserRole =
  | 'Requester'
  | 'HOD Approver'
  | 'CFO'
  | 'Functional Team'
  | 'SCM Buyer'
  | 'QA Inspector'
  | 'Legal'
  | 'Accounts Payable'
  | 'Accounts Manager'
  | 'Vendor'
  | 'Governance Admin'
  | 'PR Manager'
  | 'Tech Evaluator'
  | 'SCM Manager'
  | 'Super Admin';

interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  departmentId?: number | null;
  departmentName?: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
  navigation: NavItem[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string, redirectPath?: string) => Promise<void>;
  loginWithRefexOne: (email: string, password: string, redirectPath?: string) => Promise<void>;
  loginWithRefexOneToken: (accessToken: string, redirectPath?: string) => Promise<void>;
  /** Apply an already-issued P2P JWT (e.g. after RefexOne SAML ACS) */
  completeSessionLogin: (p2pToken: string, redirectPath?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Starting page for each role after login */
export const ROLE_HOME: Partial<Record<UserRole, string>> = {
  Requester: '/requester/dashboard',
  'PR Manager': '/tasks',
  CFO: '/cfo/dashboard',
  Vendor: '/vendor/dashboard',
  'Tech Evaluator': '/tech-evaluator/rfq-evaluation',
  'HOD Approver': '/tasks',
  'SCM Buyer': '/scm/purchase-requests',
  'SCM Manager': '/scm/manager-dashboard',
  'Accounts Payable': '/accounts/dashboard',
  'Accounts Manager': '/accounts/dashboard',
  'Functional Team': '/functional/evaluate-pr',
  'QA Inspector': '/grn',
  Legal: '/tasks',
  'Governance Admin': '/admin/user-permissions',
  'Super Admin': '/admin/user-permissions',
};

export function getRoleHomePath(role: UserRole, navigation?: NavItem[]): string {
  const roleHome = ROLE_HOME[role];
  if (roleHome) return roleHome;
  if (navigation?.length) return navigation[0].path;
  return '/';
}

/** Prefer role home; only keep deep-links that aren't another role's dashboard or auth pages */
export function resolvePostLoginPath(
  role: UserRole,
  navigation: NavItem[] | undefined,
  redirectPath?: string
): string {
  const roleHome = getRoleHomePath(role, navigation);
  if (!redirectPath) return roleHome;

  const pathname = redirectPath.split('?')[0] || '';
  if (
    !pathname ||
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/admin/login' ||
    pathname === '/home' ||
    pathname.startsWith('/auth/')
  ) {
    return roleHome;
  }

  const otherHomes = new Set(
    Object.entries(ROLE_HOME)
      .filter(([r]) => r !== role)
      .map(([, path]) => path)
  );
  if (otherHomes.has(pathname)) return roleHome;

  return redirectPath;
}

function mapAuthUser(u: AuthUser): User {
  const role = u.role as UserRole;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    departmentId: u.departmentId,
    departmentName: u.departmentName,
    isSuperAdmin: Boolean(u.isSuperAdmin),
    permissions: u.permissions || [],
    navigation: ensureNavigation(role, u.navigation),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persistUser = (mapped: User, newToken?: string) => {
    setUser(mapped);
    if (newToken) {
      setToken(newToken);
      localStorage.setItem('p2p_token', newToken);
    }
    localStorage.setItem('p2p_user', JSON.stringify(mapped));
  };

  const redirectByRole = useCallback((role: UserRole, navigation?: NavItem[], redirectPath?: string) => {
    const path = resolvePostLoginPath(role, navigation, redirectPath);
    if (typeof window.REACT_APP_NAVIGATE === 'function') {
      window.REACT_APP_NAVIGATE(path, { replace: true });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await authApi.me();
    const mapped = mapAuthUser(res.user);
    persistUser(mapped);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const storedToken = localStorage.getItem('p2p_token');
      const storedUser = localStorage.getItem('p2p_user');
      if (storedToken && storedUser) {
        setToken(storedToken);
        try {
          const parsed = JSON.parse(storedUser) as AuthUser;
          // Re-map so Masters nav is injected even from stale localStorage
          setUser(mapAuthUser(parsed));
        } catch {
          setUser(JSON.parse(storedUser));
        }
        try {
          const res = await authApi.me();
          persistUser(mapAuthUser(res.user));
        } catch {
          localStorage.removeItem('p2p_token');
          localStorage.removeItem('p2p_user');
          setToken(null);
          setUser(null);
        }
        setIsLoading(false);
        return;
      }

      // Auto SSO: RefexOne / SAML opens P2P with token on any route
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#/, '');
      const hashParams = new URLSearchParams(
        hash.includes('?') ? hash.split('?')[1] : hash.includes('=') ? hash : ''
      );
      let storedSso: string | null = null;
      try {
        storedSso =
          sessionStorage.getItem('p2p_sso_token') || localStorage.getItem('p2p_sso_token');
      } catch {
        storedSso = null;
      }
      const p2pToken =
        params.get('p2p_token') ||
        params.get('p2pToken') ||
        hashParams.get('p2p_token') ||
        storedSso;
      const refexToken =
        params.get('access_token') ||
        params.get('accessToken') ||
        params.get('token') ||
        params.get('refexone_token') ||
        hashParams.get('access_token') ||
        hashParams.get('token');

      if (p2pToken) {
        try {
          localStorage.setItem('p2p_token', p2pToken);
          setToken(p2pToken);
          const res = await authApi.me();
          const mapped = mapAuthUser(res.user);
          persistUser(mapped, p2pToken);
          try {
            sessionStorage.removeItem('p2p_sso_token');
            localStorage.removeItem('p2p_sso_token');
          } catch {
            // ignore
          }
          params.delete('p2p_token');
          params.delete('p2pToken');
          const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
          window.history.replaceState({}, '', clean);
          redirectByRole(mapped.role, mapped.navigation);
        } catch {
          localStorage.removeItem('p2p_token');
        }
      } else if (refexToken) {
        try {
          const res = await authApi.loginWithRefexOneToken(refexToken);
          const mapped = mapAuthUser(res.user);
          persistUser(mapped, res.token);
          ['access_token', 'accessToken', 'token', 'refexone_token', 'refexoneToken'].forEach((key) => {
            params.delete(key);
          });
          const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
          window.history.replaceState({}, '', clean);
          redirectByRole(mapped.role, mapped.navigation);
        } catch {
          // Login / launch page will show a clearer error
        }
      }

      setIsLoading(false);
    };

    bootstrap();
  }, [redirectByRole]);

  const completeLogin = (authUser: AuthUser, newToken: string, redirectPath?: string) => {
    const mapped = mapAuthUser(authUser);
    persistUser(mapped, newToken);
    redirectByRole(mapped.role, mapped.navigation, redirectPath);
  };

  const login = async (email: string, password: string, redirectPath?: string) => {
    const { token: newToken, user: authUser } = await authApi.login(email, password);
    completeLogin(authUser, newToken, redirectPath);
  };

  const loginWithRefexOne = async (email: string, password: string, redirectPath?: string) => {
    const { token: newToken, user: authUser } = await authApi.loginWithRefexOneCredentials(
      email,
      password
    );
    completeLogin(authUser, newToken, redirectPath);
  };

  const loginWithRefexOneToken = async (accessToken: string, redirectPath?: string) => {
    const { token: newToken, user: authUser } = await authApi.loginWithRefexOneToken(accessToken);
    completeLogin(authUser, newToken, redirectPath);
  };

  const completeSessionLogin = async (p2pToken: string, redirectPath?: string) => {
    localStorage.setItem('p2p_token', p2pToken);
    setToken(p2pToken);
    const res = await authApi.me();
    completeLogin(res.user, p2pToken, redirectPath);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('p2p_token');
    localStorage.removeItem('p2p_user');
    try {
      sessionStorage.removeItem('p2p_sso_token');
      localStorage.removeItem('p2p_sso_token');
    } catch {
      /* ignore */
    }
    // Regular users return to RefexOne; admin local login stays at /admin/login
    goToRefexOne();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithRefexOne,
        loginWithRefexOneToken,
        completeSessionLogin,
        logout,
        refreshUser,
        isAuthenticated: !!user && !!token,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
