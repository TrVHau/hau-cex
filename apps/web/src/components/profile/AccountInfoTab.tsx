import { User as UserIcon, Edit3, CheckCircle2 } from 'lucide-react';
import { Button, Badge } from '../ui';

interface AccountInfoTabProps {
  displayName: string;
  email: string;
  role: string;
  userId: string;
  copiedUserId: boolean;
  onCopyUserId: () => void;
  createdAt?: string | null;
  lastLoginAt?: string | null;
  onOpenEditProfile: () => void;
}

export function AccountInfoTab({
  displayName,
  email,
  role,
  userId,
  copiedUserId,
  onCopyUserId,
  createdAt,
  lastLoginAt,
  onOpenEditProfile,
}: AccountInfoTabProps) {
  return (
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
            onClick={onOpenEditProfile}
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
                onClick={onCopyUserId}
                className="text-[#f5b642] hover:underline flex items-center gap-1 cursor-pointer font-sans"
              >
                {copiedUserId ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
            <span className="text-[#848e9c]">Registration Date</span>
            <div className="text-white font-semibold text-xs">
              {createdAt ? new Date(createdAt).toLocaleString() : 'N/A'}
            </div>
          </div>

          <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] space-y-1">
            <span className="text-[#848e9c]">Last Successful Login</span>
            <div className="text-white font-semibold text-xs">
              {lastLoginAt ? new Date(lastLoginAt).toLocaleString() : 'Just now'}
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
  );
}
