import {
  FileSpreadsheet,
  Grid3X3,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  QrCode,
  Settings,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { adminLogin, adminLogout, checkAdminSession } from '../../utils/api';

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

const ADMIN_LINKS = [
  { label: 'Overview', to: '/admin', Icon: LayoutDashboard },
  { label: 'Registrations', to: '/admin/registrations', Icon: Users },
  { label: 'Seat Map', to: '/admin/seats', Icon: Grid3X3 },
  { label: 'Excel Reports', to: '/admin/reports', Icon: FileSpreadsheet },
  { label: 'Settings', to: '/admin/settings', Icon: Settings },
  { label: 'QR Verify', to: '/verify', Icon: QrCode },
];

export function AdminLayout({ title, subtitle, actions, children }: AdminLayoutProps) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    checkAdminSession()
      .then((auth) => setAuthenticated(auth))
      .catch(() => setAuthenticated(false))
      .finally(() => setChecking(false));
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      await adminLogin(password);
      setAuthenticated(true);
      setPassword('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminLogout();
    setAuthenticated(false);
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-6">
        <div className="text-sm text-[#737373]">Verifying administrator session...</div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#FAF8F4] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white border border-[#EAE5DC] p-8">
          <div className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] uppercase text-[#977E52]">
            <Lock className="w-3.5 h-3.5" />
            <span>Protected Portal</span>
          </div>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-[#242424]">
            MARGAZHI Admin
          </h1>
          <p className="mt-1.5 text-sm text-[#737373]">
            Sign in to manage festival registrations, seat maps, check-ins, and Excel reports.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {loginError && (
              <div
                role="alert"
                className="border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs text-red-900"
              >
                {loginError}
              </div>
            )}

            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs font-medium tracking-[0.12em] uppercase text-[#525252]"
              >
                Administrator Password
              </label>
              <input
                id="admin-password-input"
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="mt-2 w-full px-3.5 py-2.5 bg-[#FAF8F4] border border-[#EAE5DC] text-sm focus:outline-none focus:border-[#B49A6C]"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 px-5 text-xs font-medium tracking-[0.16em] uppercase bg-[#242424] text-[#FAF8F4] hover:bg-[#383838] transition-colors disabled:opacity-50"
            >
              {loggingIn ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#EAE5DC] text-center">
            <Link to="/" className="text-xs text-[#737373] hover:text-[#242424] underline">
              Return to Public Website
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F4] text-[#242424] flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col bg-white border-r border-[#EAE5DC] shrink-0">
        <div className="h-16 px-6 flex items-center border-b border-[#EAE5DC]">
          <Link to="/" className="font-serif text-xl font-semibold tracking-[0.14em]">
            MARGAZHI
          </Link>
        </div>
        <nav aria-label="Admin navigation" className="flex-1 p-4 space-y-1">
          {ADMIN_LINKS.map(({ label, to, Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-[#EAE5DC]/60 text-[#242424] border border-[#B49A6C]/50'
                    : 'text-[#525252] hover:bg-[#FAF8F4] hover:text-[#242424] border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 text-[#977E52] shrink-0" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#EAE5DC]">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium tracking-[0.1em] uppercase text-[#525252] hover:text-[#242424] hover:bg-[#FAF8F4] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="bg-white border-b border-[#EAE5DC] px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen((prev) => !prev)}
              aria-label="Toggle admin menu"
              className="lg:hidden p-2 border border-[#EAE5DC] bg-[#FAF8F4]"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-[#242424] truncate">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-[#737373] truncate">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        </header>

        {/* Mobile Admin Drawer */}
        {mobileNavOpen && (
          <nav className="lg:hidden bg-white border-b border-[#EAE5DC] px-4 py-3 space-y-1">
            {ADMIN_LINKS.map(({ label, to, Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileNavOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${
                  location.pathname === to ? 'bg-[#EAE5DC]/60 text-[#242424]' : 'text-[#525252]'
                }`}
              >
                <Icon className="w-4 h-4 text-[#977E52]" />
                <span>{label}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-[#737373]"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </nav>
        )}

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
