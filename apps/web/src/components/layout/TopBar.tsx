import { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, User, LogOut, Shield, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useCurrentUser,
  useLogout,
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../../hooks/useAuth';
import { useMarkets, useWallets, useOrders } from '../../hooks/useApi';
import { formatDateTime, formatPrice } from '../../lib/utils';

export function TopBar() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: markets = [] } = useMarkets();
  const { data: balances = [] } = useWallets();
  const { data: orders = [] } = useOrders();
  const { data: notifData } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = notifData?.items ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSearchFocused(false);
        setNotifOpen(false);
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const q = searchQuery.trim().toLowerCase();
  const matchingMarkets = q
    ? markets
        .filter(
          (m) =>
            m.symbol.toLowerCase().includes(q) ||
            m.baseAsset.toLowerCase().includes(q) ||
            m.quoteAsset.toLowerCase().includes(q),
        )
        .slice(0, 4)
    : [];
  const matchingAssets = q
    ? balances.filter((b) => b.asset.toLowerCase().includes(q)).slice(0, 3)
    : [];
  const matchingOrders = q
    ? orders
        .filter(
          (o) =>
            o.symbol.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
        )
        .slice(0, 3)
    : [];
  const hasSearchResults =
    matchingMarkets.length > 0 || matchingAssets.length > 0 || matchingOrders.length > 0;

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : 'GU';

  return (
    <header className="h-16 bg-[#0b0e11] border-b border-[#1c212a] flex items-center justify-between px-6 shrink-0 relative z-20">
      {/* Global Search */}
      <div className="flex-1 max-w-md relative" ref={searchRef}>
        <Search className="w-4 h-4 text-[#5e6673] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onFocus={() => setSearchFocused(true)}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setSearchFocused(true);
          }}
          placeholder="Search markets, assets, or orders..."
          className="w-full bg-[#14171d] border border-[#232933] focus:border-[#f5b642] rounded-lg py-2 pl-10 pr-4 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none transition-colors"
        />

        {searchFocused && q.length > 0 && (
          <div className="absolute left-0 right-0 mt-2 bg-[#14171d] border border-[#232933] rounded-xl shadow-2xl py-2 text-xs z-50 max-h-80 overflow-y-auto">
            {!hasSearchResults ? (
              <div className="px-4 py-3 text-[#5e6673]">Không tìm thấy kết quả cho &quot;{searchQuery}&quot;</div>
            ) : (
              <>
                {matchingMarkets.length > 0 && (
                  <div className="px-2 pb-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#5e6673] uppercase">Markets</div>
                    {matchingMarkets.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          setSearchQuery('');
                          navigate(`/trade/${m.symbol}`);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#1e232d] cursor-pointer text-left"
                      >
                        <span className="font-semibold text-white">{m.baseAsset}/{m.quoteAsset}</span>
                        <span className="font-mono text-[#0ecb81]">
                          {m.lastPrice ? formatPrice(m.lastPrice, m.tickSize) : m.status}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {matchingAssets.length > 0 && (
                  <div className="px-2 pb-1 border-t border-[#1c212a] pt-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#5e6673] uppercase">Wallet Assets</div>
                    {matchingAssets.map((b) => (
                      <button
                        key={b.asset}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          setSearchQuery('');
                          navigate('/wallet');
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#1e232d] cursor-pointer text-left"
                      >
                        <span className="font-semibold text-white">{b.asset}</span>
                        <span className="font-mono text-[#848e9c]">Avail: {b.available}</span>
                      </button>
                    ))}
                  </div>
                )}

                {matchingOrders.length > 0 && (
                  <div className="px-2 border-t border-[#1c212a] pt-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-[#5e6673] uppercase">Orders</div>
                    {matchingOrders.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setSearchFocused(false);
                          setSearchQuery('');
                          navigate('/orders');
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between hover:bg-[#1e232d] cursor-pointer text-left"
                      >
                        <span className="text-white">
                          <span className={o.side === 'BUY' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{o.side}</span>{' '}
                          {o.symbol}
                        </span>
                        <span className="text-[#848e9c] font-mono">{o.status}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            aria-label="Notifications"
            onClick={() => setNotifOpen((prev) => !prev)}
            className="w-8 h-8 rounded-lg bg-[#14171d] border border-[#232933] hover:border-[#363d4a] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] transition-colors relative cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#f5b642] text-black text-[10px] font-bold flex items-center justify-center absolute -top-1.5 -right-1.5">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-[#14171d] border border-[#232933] rounded-xl shadow-2xl z-50 overflow-hidden text-xs">
              <div className="px-3.5 py-2.5 border-b border-[#232933] flex items-center justify-between">
                <span className="font-bold text-white">Thông báo ({unreadCount} chưa đọc)</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllRead.mutate()}
                    className="text-[11px] text-[#f5b642] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Đọc tất cả
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#1c212a]">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-[#5e6673]">Chưa có thông báo nào.</div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        if (!n.isRead) markRead.mutate(n.id);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-[#1a1e26] transition-colors cursor-pointer ${
                        n.isRead ? 'opacity-65' : 'bg-[#1b2028]/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="font-semibold text-white truncate">{n.title}</span>
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#f5b642] shrink-0" />}
                      </div>
                      <div className="text-[11px] text-[#848e9c] leading-snug">{n.message}</div>
                      <div className="text-[10px] text-[#5e6673] mt-1">{formatDateTime(n.createdAt)}</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

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
                {user?.role === 'ADMIN'
                  ? 'Administrator'
                  : user?.twoFactorEnabled
                    ? '2FA Protected'
                    : 'Standard Trader'}
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
