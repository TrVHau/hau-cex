import { useState } from 'react';
import { Search, Bell, ChevronDown, User, LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser, useLogout } from '../../hooks/useAuth';

export function TopBar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'GU';

  return (
    <header className="h-16 bg-[#0b0e11] border-b border-[#1c212a] flex items-center justify-between px-6 shrink-0 relative z-20">
      {/* Search Input */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-[#5e6673] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search markets, assets, or orders..."
          className="w-full bg-[#14171d] border border-[#232933] focus:border-[#f5b642] rounded-lg py-2 pl-10 pr-4 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none transition-colors"
        />
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <button
          aria-label="Notifications"
          className="w-8 h-8 rounded-lg bg-[#14171d] border border-[#232933] hover:border-[#363d4a] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition-colors relative cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="w-2 h-2 rounded-full bg-[#f5b642] absolute top-1.5 right-1.5" />
        </button>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#14171d] transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#f5b642] to-[#ffda85] text-black font-bold text-xs flex items-center justify-center shadow">
              {initials}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-semibold text-[#eaecef]">
                {user ? user.email.split('@')[0] : 'Guest'}
              </span>
              <span className="text-[10px] text-[#0ecb81] flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0ecb81]" />
                Pro Trader
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#848e9c]" />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div
              className="absolute right-0 mt-2 w-48 bg-[#14171d] border border-[#232933] rounded-xl shadow-xl py-1 text-xs text-[#eaecef] z-50 animate-in fade-in"
              onMouseLeave={() => setDropdownOpen(false)}
            >
              <div className="px-3 py-2 border-b border-[#232933]">
                <div className="font-semibold truncate">{user?.email ?? 'Not logged in'}</div>
                <div className="text-[10px] text-[#848e9c]">Role: {user?.role ?? 'GUEST'}</div>
              </div>
              <button
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/profile');
                }}
                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#1e232d] transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5 text-[#848e9c]" />
                Profile & Settings
              </button>
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/admin');
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#1e232d] transition-colors cursor-pointer text-[#f5b642]"
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin Dashboard
                </button>
              )}
              {user && (
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    logout.mutate();
                  }}
                  className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-[#1e232d] text-[#f6465d] transition-colors cursor-pointer border-t border-[#232933]"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
