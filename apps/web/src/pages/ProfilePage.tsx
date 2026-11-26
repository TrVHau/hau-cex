import { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  LogOut,
  Edit3,
  CheckCircle2,
  Copy,
  Shield,
  User as UserIcon,
  Bell,
  Settings,
  Check,
} from 'lucide-react';
import {
  useCurrentUser,
  useLogout,
  useSessions,
  usePreferences,
  useUpdatePreferences,
} from '../hooks/useAuth';
import { TwoFactorModal } from '../components/profile/TwoFactorModal';
import { ApiKeysPanel } from '../components/profile/ApiKeysPanel';
import { SecurityTab } from '../components/profile/SecurityTab';
import { AccountInfoTab } from '../components/profile/AccountInfoTab';
import { NotificationsTab, SystemPreferencesTab } from '../components/profile/PreferencesTabs';
import { ChangePasswordModal } from '../components/profile/ChangePasswordModal';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import type { UserPreferences } from '../types';
import { Button, Badge } from '../components/ui';

export function ProfilePage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const { data: sessions = [] } = useSessions();
  const { data: preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const [activeTab, setActiveTab] = useState<'SECURITY' | 'INFO' | 'NOTIF' | 'PREF'>('SECURITY');
  const [copiedUserId, setCopiedUserId] = useState(false);

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isTwoFactorOpen, setIsTwoFactorOpen] = useState(false);
  const [prefsSavedMsg, setPrefsSavedMsg] = useState<string | null>(null);

  const savePrefPatch = (patch: Partial<UserPreferences>) => {
    updatePreferences.mutate(patch, {
      onSuccess: () => {
        setPrefsSavedMsg('Đã lưu cài đặt!');
        window.setTimeout(() => setPrefsSavedMsg(null), 1800);
      },
    });
  };

  const displayName = user?.fullName || (user?.email ? user.email.split('@')[0] : 'Trader');
  const email = user?.email ?? 'trader@haucex.io';
  const role = user?.role ?? 'USER';
  const userId = user?.userId || (user as { id?: string })?.id || 'Unknown';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'July 2026';

  const copyUserId = () => {
    void navigator.clipboard.writeText(userId);
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Profile Header Banner ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-l from-[#f5b642]/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#f5b642] to-[#ffda85] text-black font-black text-2xl flex items-center justify-center shadow-lg shrink-0">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white tracking-tight">{displayName}</h1>
                <Badge variant="yellow" size="sm">
                  <ShieldCheck className="w-3 h-3 text-[#f5b642]" />
                  Verified
                </Badge>
              </div>
              <div className="text-xs text-[#848e9c] mt-1 flex items-center gap-2">
                <span>{email}</span>
                <span>•</span>
                <button
                  onClick={copyUserId}
                  className="hover:text-white flex items-center gap-1 font-mono text-[11px] cursor-pointer"
                  title="Click to copy UID"
                >
                  UID: {userId.slice(0, 8)}...
                  {copiedUserId ? (
                    <Check className="w-3 h-3 text-[#0ecb81]" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#5e6673]" />
                  )}
                </button>
              </div>
              <div className="text-[11px] text-[#5e6673] mt-1 tracking-wider uppercase font-semibold">
                MEMBER SINCE {memberSince} • PRO TRADER ({role})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logout.mutate()}
              className="text-xs cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsEditProfileOpen(true)}
              className="text-xs font-bold cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </Button>
          </div>
        </div>
      </div>

      {/* ─── Main 2-Column Section ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (col-span-8) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Sub-tabs Navigation */}
          <div className="flex items-center gap-2 bg-[#14171d] p-1.5 rounded-xl border border-[#232933] w-fit text-xs font-semibold">
            {(
              [
                { key: 'SECURITY', label: 'Security', icon: Lock },
                { key: 'INFO', label: 'Account Info', icon: UserIcon },
                { key: 'NOTIF', label: 'Notifications', icon: Bell },
                { key: 'PREF', label: 'Preferences', icon: Settings },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === tab.key
                      ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'SECURITY' && (
            <SecurityTab
              email={email}
              twoFactorEnabled={Boolean(user?.twoFactorEnabled)}
              notifLogin={preferences?.notifLogin ?? true}
              onSavePref={savePrefPatch}
              onOpenChangePassword={() => setIsChangePasswordOpen(true)}
              onOpenTwoFactor={() => setIsTwoFactorOpen(true)}
            />
          )}

          {activeTab === 'INFO' && (
            <AccountInfoTab
              displayName={displayName}
              email={email}
              role={role}
              userId={userId}
              copiedUserId={copiedUserId}
              onCopyUserId={copyUserId}
              createdAt={user?.createdAt}
              lastLoginAt={user?.lastLoginAt}
              onOpenEditProfile={() => setIsEditProfileOpen(true)}
            />
          )}

          {activeTab === 'NOTIF' && (
            <NotificationsTab
              preferences={preferences}
              savedMsg={prefsSavedMsg}
              onSavePref={savePrefPatch}
            />
          )}

          {activeTab === 'PREF' && (
            <SystemPreferencesTab
              preferences={preferences}
              savedMsg={prefsSavedMsg}
              onSavePref={savePrefPatch}
            />
          )}
        </div>

        {/* Right Column (col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-white">Account Status</div>
              <Badge variant={user?.status === 'LOCKED' ? 'red' : 'green'} size="sm">
                {user?.status ?? 'ACTIVE'}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#848e9c]">2FA Protection</span>
                <span
                  className={`font-semibold flex items-center gap-1 ${
                    user?.twoFactorEnabled ? 'text-[#0ecb81]' : 'text-[#848e9c]'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {user?.twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[#848e9c]">Active Sessions</span>
                <span className="text-white font-numeric font-bold">{sessions.length}</span>
              </div>

              <div className="pt-2 border-t border-[#1c212a] space-y-2 text-xs">
                <button
                  onClick={() => setActiveTab('SECURITY')}
                  className="w-full flex items-center justify-between text-[#848e9c] hover:text-[#eaecef] py-1 cursor-pointer"
                >
                  <span>Security Center</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => setActiveTab('INFO')}
                  className="w-full flex items-center justify-between text-[#848e9c] hover:text-[#eaecef] py-1 cursor-pointer"
                >
                  <span>Account Details</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>

          <ApiKeysPanel />

          <div className="bg-gradient-to-br from-[#1b2028] to-[#14171d] border border-[#f5b642]/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm font-bold text-[#f5b642]">Referral Program</div>
              <Badge variant="gray" size="sm">COMING SOON</Badge>
            </div>
            <p className="text-xs text-[#848e9c]">
              Chương trình giới thiệu hoa hồng đang trong lộ trình phát triển tiếp theo.
            </p>
          </div>

          <div className="text-center text-[10px] text-[#5e6673] flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            PROTECTED BY JWT + TOTP 2FA SECURITY
          </div>
        </div>
      </div>

      {isTwoFactorOpen && (
        <TwoFactorModal
          enabled={Boolean(user?.twoFactorEnabled)}
          onClose={() => setIsTwoFactorOpen(false)}
        />
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal onClose={() => setIsChangePasswordOpen(false)} />
      )}

      {isEditProfileOpen && (
        <EditProfileModal
          currentFullName={user?.fullName || ''}
          email={email}
          onClose={() => setIsEditProfileOpen(false)}
        />
      )}
    </div>
  );
}
