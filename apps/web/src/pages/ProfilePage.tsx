import { useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Mail,
  Key,
  Lock,
  LogOut,
  Edit3,
  Laptop,
  CheckCircle2,
  Copy,
  Plus,
  Shield,
  Eye,
  EyeOff,
  AlertCircle,
  X,
  User as UserIcon,
  Bell,
  Settings,
  Check,
  Clock,
  Trash2,
} from 'lucide-react';
import {
  useCurrentUser,
  useLogout,
  useChangePassword,
  useUpdateProfile,
  useSessions,
  useRevokeSession,
  useRevokeAllOtherSessions,
} from '../hooks/useAuth';
import { Button, Badge } from '../components/ui';

export function ProfilePage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const changePasswordMutation = useChangePassword();
  const updateProfileMutation = useUpdateProfile();
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessions();
  const revokeSessionMutation = useRevokeSession();
  const revokeAllOtherSessionsMutation = useRevokeAllOtherSessions();

  const [activeTab, setActiveTab] = useState<'SECURITY' | 'INFO' | 'NOTIF' | 'PREF'>('SECURITY');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUserId, setCopiedUserId] = useState(false);

  // Modals state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  // Change Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Edit Profile form state
  const [fullNameInput, setFullNameInput] = useState('');
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  // Notification toggles
  const [notifLogin, setNotifLogin] = useState(true);
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [notifNewsletter, setNotifNewsletter] = useState(false);

  // Preference state
  const [prefCurrency, setPrefCurrency] = useState('USDT');
  const [prefLang, setPrefLang] = useState('en');
  const [prefConfirmOrder, setPrefConfirmOrder] = useState(true);

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

  const copyApiKey = () => {
    navigator.clipboard.writeText('hau_live_a89f9213bc8912e7');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  const handleOpenEditProfile = () => {
    setFullNameInput(user?.fullName || '');
    setProfileSuccess(null);
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfileMutation.mutateAsync({ fullName: fullNameInput });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => {
        setIsEditProfileOpen(false);
        setProfileSuccess(null);
      }, 1200);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const handleOpenChangePassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsChangePasswordOpen(true);
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from current password.');
      return;
    }

    try {
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsChangePasswordOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setPasswordError(
        axiosErr.response?.data?.message || 'Failed to change password. Please check your current password.'
      );
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Profile Header Banner ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-l from-[#f5b642]/10 to-transparent pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            {/* Avatar */}
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
              onClick={handleOpenEditProfile}
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
            <button
              onClick={() => setActiveTab('SECURITY')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'SECURITY'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Security
            </button>
            <button
              onClick={() => setActiveTab('INFO')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'INFO'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Account Info
            </button>
            <button
              onClick={() => setActiveTab('NOTIF')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'NOTIF'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('PREF')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'PREF'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Preferences
            </button>
          </div>

          {/* TAB 1: SECURITY */}
          {activeTab === 'SECURITY' && (
            <div className="space-y-5">
              {/* 1. Secure Password Management Card */}
              <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 text-sm font-bold text-white mb-1">
                      <Key className="w-4 h-4 text-[#f5b642]" />
                      Login Password
                    </div>
                    <p className="text-xs text-[#848e9c]">
                      Used to log into your account and verify high-risk security operations.
                    </p>
                  </div>
                  <Badge variant="green" size="sm">
                    <Check className="w-3 h-3 text-[#0ecb81]" />
                    CONFIGURED
                  </Badge>
                </div>

                {/* Secure display: Masked dots, no password exposure */}
                <div className="p-4 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#232933] flex items-center justify-center text-[#f5b642]">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-white">Password Status</div>
                      <div className="text-xs font-mono tracking-widest text-[#848e9c] mt-0.5">
                        ••••••••••••••••
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleOpenChangePassword}
                    className="text-xs font-semibold shrink-0 cursor-pointer"
                  >
                    Change Password
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                  <div>
                    <div className="text-xs font-semibold text-white">Login Security Alerts</div>
                    <div className="text-[10px] text-[#848e9c]">
                      Receive automated security notifications upon new device logins
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifLogin}
                    onChange={(e) => setNotifLogin(e.target.checked)}
                    className="accent-[#f5b642] w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>

              {/* 2. Two-Factor Authentication Card */}
              <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
                <div className="flex items-center gap-2.5 text-sm font-bold text-white mb-1">
                  <Lock className="w-4 h-4 text-[#f5b642]" />
                  Two-Factor Authentication (2FA)
                </div>
                <p className="text-xs text-[#848e9c] mb-4">
                  Add multi-factor protection to safeguard your wallet assets and sensitive trading operations.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Google Auth */}
                  <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-[#f5b642]" />
                        <span className="text-xs font-bold text-white">Google Authenticator</span>
                      </div>
                      <Badge variant="green" size="sm">ENABLED</Badge>
                    </div>
                    <div className="text-[11px] text-[#848e9c] my-2">
                      Use TOTP codes for logins, ledger transfers, and withdrawals.
                    </div>
                    <Button variant="secondary" size="xs" className="w-fit self-end text-xs">
                      Manage
                    </Button>
                  </div>

                  {/* SMS Auth */}
                  <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <Smartphone className="w-4 h-4 text-[#848e9c]" />
                        <span className="text-xs font-bold text-white">SMS Authentication</span>
                      </div>
                      <Badge variant="gray" size="sm">DISABLED</Badge>
                    </div>
                    <div className="text-[11px] text-[#848e9c] my-2">
                      Receive an SMS verification code to verify emergency actions.
                    </div>
                    <Button variant="secondary" size="xs" className="w-fit self-end text-xs">
                      Setup
                    </Button>
                  </div>

                  {/* Email Verification */}
                  <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <Mail className="w-4 h-4 text-[#0ecb81]" />
                        <span className="text-xs font-bold text-white">Email Verification</span>
                      </div>
                      <Badge variant="green" size="sm">ENABLED</Badge>
                    </div>
                    <div className="text-[11px] text-[#848e9c] my-2">
                      System confirmations sent to {email}.
                    </div>
                    <Button variant="secondary" size="xs" className="w-fit self-end text-xs">
                      Manage
                    </Button>
                  </div>

                  {/* Security Key */}
                  <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-[#848e9c]" />
                        <span className="text-xs font-bold text-white">FIDO2 / YubiKey</span>
                      </div>
                      <Badge variant="gray" size="sm">UNSET</Badge>
                    </div>
                    <div className="text-[11px] text-[#848e9c] my-2">
                      Hardware cryptographic key for highest grade cold storage defense.
                    </div>
                    <Button variant="secondary" size="xs" className="w-fit self-end text-xs">
                      Setup
                    </Button>
                  </div>
                </div>
              </div>

              {/* 3. Real Active Sessions Card */}
              <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5 text-sm font-bold text-white">
                    <Laptop className="w-4 h-4 text-[#f5b642]" />
                    Active Sessions ({sessions.length})
                  </div>
                  {sessions.filter((s) => !s.isCurrent).length > 0 && (
                    <button
                      onClick={() => revokeAllOtherSessionsMutation.mutate()}
                      disabled={revokeAllOtherSessionsMutation.isPending}
                      className="text-xs font-bold text-[#f6465d] hover:underline cursor-pointer disabled:opacity-50"
                    >
                      {revokeAllOtherSessionsMutation.isPending
                        ? 'Revoking...'
                        : 'REVOKE ALL OTHER SESSIONS'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#848e9c] mb-4">
                  Review and manage your current active logins across different devices and locations.
                </p>

                {isLoadingSessions ? (
                  <div className="p-4 text-center text-xs text-[#848e9c]">
                    Loading active sessions...
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="p-4 text-center text-xs text-[#848e9c]">
                    No active sessions found.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className="p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <Laptop
                            className={`w-5 h-5 ${
                              sess.isCurrent ? 'text-[#0ecb81]' : 'text-[#848e9c]'
                            }`}
                          />
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              {sess.isCurrent ? 'Current Session' : 'Active Session'}
                              {sess.isCurrent && (
                                <Badge variant="green" size="sm">
                                  CURRENT DEVICE
                                </Badge>
                              )}
                            </div>
                            <div className="text-[10px] text-[#848e9c] flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3 h-3" />
                              <span>
                                Started: {new Date(sess.createdAt).toLocaleString()}
                              </span>
                              <span>•</span>
                              <span className="font-mono text-[#5e6673]">
                                ID: {sess.id.slice(0, 8)}...
                              </span>
                            </div>
                          </div>
                        </div>

                        {!sess.isCurrent && (
                          <button
                            onClick={() => revokeSessionMutation.mutate(sess.id)}
                            disabled={revokeSessionMutation.isPending}
                            className="text-xs font-semibold text-[#f6465d] hover:underline cursor-pointer flex items-center gap-1 p-1.5 rounded hover:bg-[#f6465d]/10 transition-colors"
                            title="Revoke session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            REVOKE
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNT INFO */}
          {activeTab === 'INFO' && (
            <div className="space-y-5">
              <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#232933] pb-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <UserIcon className="w-4 h-4 text-[#f5b642]" />
                    Account Information
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleOpenEditProfile}
                    className="text-xs font-semibold cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    Edit Name
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
                    <span className="text-[#848e9c]">Full Name / Display Name</span>
                    <div className="text-white font-semibold text-sm">{displayName}</div>
                  </div>

                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
                    <span className="text-[#848e9c]">Email Address</span>
                    <div className="text-white font-semibold text-sm flex items-center gap-2">
                      {email}
                      <Badge variant="green" size="sm">Verified</Badge>
                    </div>
                  </div>

                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
                    <span className="text-[#848e9c]">Account Role</span>
                    <div className="text-white font-semibold text-sm flex items-center gap-2">
                      {role}
                      <Badge variant="yellow" size="sm">STANDARD TRADER</Badge>
                    </div>
                  </div>

                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
                    <span className="text-[#848e9c]">Account Status</span>
                    <div className="text-[#0ecb81] font-semibold text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      ACTIVE
                    </div>
                  </div>

                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1 md:col-span-2">
                    <span className="text-[#848e9c]">User Unique Identifier (UUID)</span>
                    <div className="text-white font-mono text-xs flex items-center justify-between">
                      <span>{userId}</span>
                      <button
                        onClick={copyUserId}
                        className="text-[#f5b642] hover:underline flex items-center gap-1 cursor-pointer font-sans"
                      >
                        {copiedUserId ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
                    <span className="text-[#848e9c]">Registration Date</span>
                    <div className="text-white font-semibold text-xs">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
                    <span className="text-[#848e9c]">Last Successful Login</span>
                    <div className="text-white font-semibold text-xs">
                      {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Just now'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Tier Card */}
              <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-3">
                <div className="text-sm font-bold text-white">Trading Fee Tier</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                    <div className="text-xs text-[#848e9c]">Maker Fee Rate</div>
                    <div className="text-lg font-bold text-[#0ecb81] mt-1 font-numeric">0.100%</div>
                  </div>
                  <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                    <div className="text-xs text-[#848e9c]">Taker Fee Rate</div>
                    <div className="text-lg font-bold text-[#f5b642] mt-1 font-numeric">0.100%</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'NOTIF' && (
            <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#232933] pb-3">
                <Bell className="w-4 h-4 text-[#f5b642]" />
                Notification Preferences
              </div>
              <p className="text-xs text-[#848e9c]">
                Configure when and how HAU Exchange notifies you regarding account activity and trading updates.
              </p>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                  <div>
                    <div className="text-xs font-semibold text-white">Order Executions</div>
                    <div className="text-[11px] text-[#848e9c]">
                      Notify immediately when your limit orders fill or execute
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifOrders}
                    onChange={(e) => setNotifOrders(e.target.checked)}
                    className="accent-[#f5b642] w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                  <div>
                    <div className="text-xs font-semibold text-white">Security & Password Changes</div>
                    <div className="text-[11px] text-[#848e9c]">
                      Critical security emails whenever passwords or keys are modified
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifSecurity}
                    onChange={(e) => setNotifSecurity(e.target.checked)}
                    className="accent-[#f5b642] w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                  <div>
                    <div className="text-xs font-semibold text-white">System Announcements</div>
                    <div className="text-[11px] text-[#848e9c]">
                      Product releases, market listings, and platform maintenance updates
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifNewsletter}
                    onChange={(e) => setNotifNewsletter(e.target.checked)}
                    className="accent-[#f5b642] w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PREFERENCES */}
          {activeTab === 'PREF' && (
            <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-[#232933] pb-3">
                <Settings className="w-4 h-4 text-[#f5b642]" />
                System & Trading Preferences
              </div>

              <div className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#848e9c] mb-1.5 font-medium">Base Display Currency</label>
                  <select
                    value={prefCurrency}
                    onChange={(e) => setPrefCurrency(e.target.value)}
                    className="bg-[#1b2028] border border-[#282f3c] text-white rounded-lg p-2.5 w-full outline-none"
                  >
                    <option value="USDT">USDT (Tether USD)</option>
                    <option value="USD">USD (United States Dollar)</option>
                    <option value="VND">VND (Vietnamese Dong)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#848e9c] mb-1.5 font-medium">Interface Language</label>
                  <select
                    value={prefLang}
                    onChange={(e) => setPrefLang(e.target.value)}
                    className="bg-[#1b2028] border border-[#282f3c] text-white rounded-lg p-2.5 w-full outline-none"
                  >
                    <option value="en">English (US)</option>
                    <option value="vi">Tiếng Việt (Vietnamese)</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                  <div>
                    <div className="text-xs font-semibold text-white">Order Placement Confirmation</div>
                    <div className="text-[11px] text-[#848e9c]">
                      Show a confirmation modal before placing market and limit orders
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefConfirmOrder}
                    onChange={(e) => setPrefConfirmOrder(e.target.checked)}
                    className="accent-[#f5b642] w-4 h-4 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (col-span-4) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Account Status Card */}
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-bold text-white">Account Status</div>
              <Badge variant="yellow" size="sm">Tier 2</Badge>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#848e9c]">KYC Verification</span>
                <span className="text-[#0ecb81] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  VERIFIED
                </span>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#848e9c] mb-1">
                  <span>WITHDRAWAL LIMIT</span>
                  <span className="text-white font-numeric font-bold">$100,000 / DAY</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1b2028] overflow-hidden">
                  <div className="h-full bg-[#f5b642] w-[35%]" />
                </div>
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

          {/* API Management Card */}
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
            <div className="text-sm font-bold text-white mb-1">API Management</div>
            <p className="text-xs text-[#848e9c] mb-3">
              Create and manage API keys for algorithmic trading bots.
            </p>

            <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between mb-3">
              <div>
                <div className="text-xs font-bold text-white">TRADING_BOT_01</div>
                <div className="text-[10px] text-[#5e6673]">Last used: 2m ago</div>
              </div>
              <button
                onClick={copyApiKey}
                className="p-1.5 rounded bg-[#232933] text-[#848e9c] hover:text-white cursor-pointer"
                title="Copy API Key"
              >
                {copiedKey ? <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Button variant="secondary" size="sm" className="w-full text-xs font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              CREATE NEW API KEY
            </Button>
          </div>

          {/* Referral Banner */}
          <div className="bg-gradient-to-br from-[#1b2028] to-[#14171d] border border-[#f5b642]/30 rounded-xl p-5">
            <div className="text-sm font-bold text-[#f5b642] mb-1">Earn 20% Commission</div>
            <p className="text-xs text-[#848e9c] mb-3">
              Invite your friends and earn a percentage of their trading fees forever.
            </p>
            <div className="text-xs text-[#f5b642] font-semibold cursor-pointer hover:underline">
              Referral Program Active →
            </div>
          </div>

          {/* Security Badge */}
          <div className="text-center text-[10px] text-[#5e6673] flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            PROTECTED BY AES-256 MULTI-LAYER ENCRYPTION
          </div>
        </div>
      </div>

      {/* ─── SECURE CHANGE PASSWORD MODAL ─── */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#14171d] border border-[#2b3240] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#232933]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f5b642]/10 text-[#f5b642] flex items-center justify-center">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Change Password</h3>
                  <p className="text-[11px] text-[#848e9c]">Enter your current and new credentials</p>
                </div>
              </div>
              <button
                onClick={() => setIsChangePasswordOpen(false)}
                className="text-[#848e9c] hover:text-white p-1 rounded-lg hover:bg-[#1e232d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="mt-4 space-y-4">
              {passwordError && (
                <div className="p-3 bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg flex items-center gap-2.5 text-xs text-[#f6465d]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{passwordError}</span>
                </div>
              )}

              {passwordSuccess && (
                <div className="p-3 bg-[#0ecb81]/10 border border-[#0ecb81]/30 rounded-lg flex items-center gap-2.5 text-xs text-[#0ecb81]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordSuccess}</span>
                </div>
              )}

              {/* Current Password */}
              <div>
                <label className="block text-xs font-medium text-[#848e9c] mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-2.5 pl-3 pr-10 text-xs text-white outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-medium text-[#848e9c] mb-1.5">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Enter new strong password"
                    className="w-full bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-2.5 pl-3 pr-10 text-xs text-white outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-medium text-[#848e9c] mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    placeholder="Re-type new password"
                    className="w-full bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-2.5 pl-3 pr-10 text-xs text-white outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={changePasswordMutation.isPending}
                  className="cursor-pointer text-xs font-bold"
                >
                  {changePasswordMutation.isPending ? 'Updating...' : 'Save Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PROFILE MODAL ─── */}
      {isEditProfileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#14171d] border border-[#2b3240] rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-[#232933]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#f5b642]/10 text-[#f5b642] flex items-center justify-center">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Profile</h3>
                  <p className="text-[11px] text-[#848e9c]">Update your display name</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditProfileOpen(false)}
                className="text-[#848e9c] hover:text-white p-1 rounded-lg hover:bg-[#1e232d] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
              {profileSuccess && (
                <div className="p-3 bg-[#0ecb81]/10 border border-[#0ecb81]/30 rounded-lg flex items-center gap-2.5 text-xs text-[#0ecb81]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#848e9c] mb-1.5">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder="e.g. Alice Nguyen"
                  maxLength={100}
                  className="w-full bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-2.5 px-3 text-xs text-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#848e9c] mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full bg-[#171a21] border border-[#232933] rounded-lg py-2.5 px-3 text-xs text-[#5e6673] cursor-not-allowed outline-none"
                />
                <span className="text-[10px] text-[#5e6673] mt-1 block">
                  Email address cannot be changed directly for security compliance.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditProfileOpen(false)}
                  className="cursor-pointer text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={updateProfileMutation.isPending}
                  className="cursor-pointer text-xs font-bold"
                >
                  {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
