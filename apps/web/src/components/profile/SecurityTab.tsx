import {
  Smartphone,
  Mail,
  Key,
  Lock,
  Laptop,
  Check,
  Clock,
  Trash2,
} from 'lucide-react';
import {
  useSessions,
  useRevokeSession,
  useRevokeAllOtherSessions,
} from '../../hooks/useAuth';
import type { UserPreferences } from '../../types';
import { Button, Badge } from '../ui';

interface SecurityTabProps {
  email: string;
  twoFactorEnabled: boolean;
  notifLogin: boolean;
  onSavePref: (patch: Partial<UserPreferences>) => void;
  onOpenChangePassword: () => void;
  onOpenTwoFactor: () => void;
}

export function SecurityTab({
  email,
  twoFactorEnabled,
  notifLogin,
  onSavePref,
  onOpenChangePassword,
  onOpenTwoFactor,
}: SecurityTabProps) {
  const { data: sessions = [], isLoading: isLoadingSessions } = useSessions();
  const revokeSessionMutation = useRevokeSession();
  const revokeAllOtherSessionsMutation = useRevokeAllOtherSessions();

  return (
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
            onClick={onOpenChangePassword}
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
            onChange={(e) => onSavePref({ notifLogin: e.target.checked })}
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
          Add multi-factor protection to safeguard your wallet assets and account logins.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Google Auth */}
          <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-[#f5b642]" />
                <span className="text-xs font-bold text-white">Google Authenticator</span>
              </div>
              <Badge variant={twoFactorEnabled ? 'green' : 'gray'} size="sm">
                {twoFactorEnabled ? 'ENABLED' : 'DISABLED'}
              </Badge>
            </div>
            <div className="text-[11px] text-[#848e9c] my-2">
              TOTP 6-digit codes required during sign-in when enabled.
            </div>
            <Button
              variant={twoFactorEnabled ? 'secondary' : 'primary'}
              size="xs"
              onClick={onOpenTwoFactor}
              className="w-fit self-end text-xs"
            >
              {twoFactorEnabled ? 'Manage' : 'Setup'}
            </Button>
          </div>

          {/* Email Account */}
          <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#0ecb81]" />
                <span className="text-xs font-bold text-white">Registered Email</span>
              </div>
              <Badge variant="green" size="sm">ACTIVE</Badge>
            </div>
            <div className="text-[11px] text-[#848e9c] my-2 break-all">
              Primary login identifier: {email}
            </div>
            <span className="text-[10px] text-[#5e6673] self-end">Locked for security</span>
          </div>

          {/* SMS Auth */}
          <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between opacity-75">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-4 h-4 text-[#848e9c]" />
                <span className="text-xs font-bold text-white">SMS Authentication</span>
              </div>
              <Badge variant="gray" size="sm">NOT SUPPORTED</Badge>
            </div>
            <div className="text-[11px] text-[#848e9c] my-2">
              SMS gateway is not configured in this environment. Use Google Authenticator instead.
            </div>
          </div>

          {/* Security Key */}
          <div className="p-3.5 bg-[#1b2028] rounded-xl border border-[#282f3c] flex flex-col justify-between opacity-75">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <Key className="w-4 h-4 text-[#848e9c]" />
                <span className="text-xs font-bold text-white">FIDO2 / YubiKey</span>
              </div>
              <Badge variant="gray" size="sm">NOT SUPPORTED</Badge>
            </div>
            <div className="text-[11px] text-[#848e9c] my-2">
              Hardware WebAuthn keys are not enabled in this release.
            </div>
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
                      <span>Started: {new Date(sess.createdAt).toLocaleString()}</span>
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
  );
}
