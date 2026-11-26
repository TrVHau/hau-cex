import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart2,
  ArrowLeftRight,
  Wallet,
  ListOrdered,
  History,
  FileText,
  User,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { useCurrentUser, useLogout } from '../../hooks/useAuth';

export function Sidebar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    { to: '/markets', label: 'Markets', icon: BarChart2 },
    { to: '/trade/BTC_USDT', label: 'Trade', icon: ArrowLeftRight },
    { to: '/wallet', label: 'Wallet', icon: Wallet },
    { to: '/orders', label: 'Orders', icon: ListOrdered },
    { to: '/trades', label: 'Trades', icon: History },
    { to: '/ledger', label: 'Ledger', icon: FileText },
    { to: '/profile', label: 'Profile', icon: User },
  ];

  return (
    <aside className="w-56 bg-[#0b0e11] border-r border-[#1c212a] flex flex-col justify-between shrink-0 select-none min-h-screen sticky top-0 h-screen overflow-hidden">
      <div className="flex flex-col flex-1 overflow-y-auto">
        {/* Brand Logo */}
        <Link
          to="/"
          className="h-16 flex items-center px-4 border-b border-[#1c212a] shrink-0 hover:opacity-90 transition-opacity"
        >
          <img src="/logo.png" alt="HAU-CEX Logo" className="h-10 max-h-10 max-w-full w-auto object-contain" />
        </Link>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#1e232d] text-[#f5b642] font-semibold border-l-2 border-[#f5b642]'
                      : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#14171d]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {user?.role === 'ADMIN' && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#1e232d] text-[#f5b642] font-semibold border-l-2 border-[#f5b642]'
                    : 'text-[#848e9c] hover:text-[#eaecef] hover:bg-[#14171d]'
                }`
              }
            >
              <Shield className="w-4 h-4 shrink-0 text-[#f5b642]" />
              <span>Admin Panel</span>
            </NavLink>
          )}
        </nav>
      </div>

      {/* Auth & System Status */}
      <div className="p-3 border-t border-[#1c212a] shrink-0 space-y-3">
        {user ? (
          <button
            onClick={() => logout.mutate()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#848e9c] hover:text-[#eaecef] hover:bg-[#14171d] border border-[#232933] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium text-[#eaecef] bg-[#14171d] hover:bg-[#1e232d] border border-[#232933] cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold text-black bg-[#f5b642] hover:bg-[#e5a835] cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </button>
          </div>
        )}

        <div className="p-2.5 rounded-lg bg-[#14171d]/60 border border-[#1c212a]">
          <div className="text-[10px] font-semibold tracking-wider text-[#5e6673] uppercase mb-1">
            SYSTEM STATUS
          </div>
          <div className="flex items-center gap-2 text-xs text-[#eaecef]">
            <span className="w-2 h-2 rounded-full bg-[#0ecb81] animate-pulse" />
            <span className="text-[11px] text-[#0ecb81] font-medium">Exchange Operational</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
