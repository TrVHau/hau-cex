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
} from 'lucide-react';
import { useCurrentUser, useLogout } from '../hooks/useAuth';
import { Button, Badge } from '../components/ui';

export function ProfilePage() {
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [activeTab, setActiveTab] = useState<'INFO' | 'SECURITY' | 'NOTIF' | 'PREF'>('SECURITY');
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const displayName = user?.email ? user.email.split('@')[0] : 'Trader';
  const email = user?.email ?? 'trader@haucex.io';

  const copyApiKey = () => {
    navigator.clipboard.writeText('hau_live_a89f9213bc8912e7');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Profile Header Banner ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-2xl p-6 relative overflow-hidden">
        {/* Subtle background glow */}
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
              <div className="text-xs text-[#848e9c] mt-1">{email}</div>
              <div className="text-[11px] text-[#5e6673] mt-0.5 tracking-wider uppercase font-semibold">
                MEMBER SINCE JANUARY 2024 • PRO TRADER ({user?.role ?? 'USER'})
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => logout.mutate()}
              className="text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </Button>
            <Button variant="primary" size="sm" className="text-xs font-bold">
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
          {/* Sub-tabs */}
          <div className="flex items-center gap-2 bg-[#14171d] p-1.5 rounded-xl border border-[#232933] w-fit text-xs font-semibold">
            <button
              onClick={() => setActiveTab('INFO')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'INFO'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              Account Info
            </button>
            <button
              onClick={() => setActiveTab('SECURITY')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'SECURITY'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              Security
            </button>
            <button
              onClick={() => setActiveTab('NOTIF')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'NOTIF'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('PREF')}
              className={`px-4 py-2 rounded-lg transition-all cursor-pointer ${
                activeTab === 'PREF'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              Preferences
            </button>
          </div>

          {/* 1. Two-Factor Authentication Card */}
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-white mb-1">
              <Lock className="w-4 h-4 text-[#f5b642]" />
              Two-Factor Authentication
            </div>
            <p className="text-xs text-[#848e9c] mb-4">
              Add an extra layer of security to your account by requiring more than just a password to log in.
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
                  Use an app-generated code for login, withdrawals, and security changes.
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
                  Receive a code via text message to verify your identity.
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
                  Verification codes will be sent to your registered email address.
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
                    <span className="text-xs font-bold text-white">Security Key (YubiKey)</span>
                  </div>
                  <Badge variant="gray" size="sm">UNSET</Badge>
                </div>
                <div className="text-[11px] text-[#848e9c] my-2">
                  Use a physical hardware key for the highest level of security.
                </div>
                <Button variant="secondary" size="xs" className="w-fit self-end text-xs">
                  Setup
                </Button>
              </div>
            </div>
          </div>

          {/* 2. Password Management Card */}
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2.5 text-sm font-bold text-white mb-1">
                <Key className="w-4 h-4 text-[#f5b642]" />
                Password Management
              </div>
              <p className="text-xs text-[#848e9c]">
                Keep your password strong and update it regularly to protect your assets.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  defaultValue="SuperSecretPassword123"
                  className="w-full bg-[#1b2028] border border-[#282f3c] rounded-lg py-2 pl-3 pr-10 text-xs text-[#eaecef] outline-none"
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <Button variant="secondary" size="sm" className="text-xs">
                Change Password
              </Button>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#1b2028] rounded-lg border border-[#282f3c]">
              <div>
                <div className="text-xs font-semibold text-white">Login Alerts</div>
                <div className="text-[10px] text-[#848e9c]">Get notified of any new login attempts</div>
              </div>
              <input type="checkbox" defaultChecked className="accent-[#f5b642] w-4 h-4 cursor-pointer" />
            </div>
          </div>

          {/* 3. Active Sessions Card */}
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5">
            <div className="flex items-center gap-2.5 text-sm font-bold text-white mb-1">
              <Laptop className="w-4 h-4 text-[#f5b642]" />
              Active Sessions
            </div>
            <p className="text-xs text-[#848e9c] mb-4">
              Review and manage your current active logins across different devices and locations.
            </p>

            <div className="space-y-2.5">
              <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Laptop className="w-5 h-5 text-[#0ecb81]" />
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      MacBook Pro • Chrome
                      <Badge variant="green" size="sm">CURRENT DEVICE</Badge>
                    </div>
                    <div className="text-[10px] text-[#848e9c]">Singapore, SG • 119.56.104.21 • Active Now</div>
                  </div>
                </div>
                <button className="text-xs font-semibold text-[#f6465d] hover:underline cursor-pointer">
                  REVOKE
                </button>
              </div>

              <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="w-5 h-5 text-[#848e9c]" />
                  <div>
                    <div className="text-xs font-bold text-white">iPhone 15 Pro • App</div>
                    <div className="text-[10px] text-[#848e9c]">Singapore, SG • 119.56.104.21 • 2 hours ago</div>
                  </div>
                </div>
                <button className="text-xs font-semibold text-[#f6465d] hover:underline cursor-pointer">
                  REVOKE
                </button>
              </div>
            </div>

            <Button variant="secondary" size="sm" className="w-full mt-4 text-xs font-bold text-[#f6465d]">
              REVOKE ALL OTHER SESSIONS
            </Button>
          </div>
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
                <a href="#activity" className="flex items-center justify-between text-[#848e9c] hover:text-[#eaecef] py-1">
                  <span>Activity Log</span>
                  <span>→</span>
                </a>
                <a href="#privacy" className="flex items-center justify-between text-[#848e9c] hover:text-[#eaecef] py-1">
                  <span>Privacy Settings</span>
                  <span>→</span>
                </a>
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

            <Button variant="secondary" size="sm" className="w-full text-xs font-semibold">
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
            <a href="#referral" className="text-xs text-[#f5b642] font-semibold hover:underline">
              View Referral Dashboard →
            </a>
          </div>

          {/* Security Badge */}
          <div className="text-center text-[10px] text-[#5e6673] flex items-center justify-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            PROTECTED BY AES-256 MULTI-LAYER ENCRYPTION
          </div>
        </div>
      </div>
    </div>
  );
}
