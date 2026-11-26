import { useState } from 'react';
import { Edit3, CheckCircle2, X } from 'lucide-react';
import { useUpdateProfile } from '../../hooks/useAuth';
import { Button } from '../ui';

interface EditProfileModalProps {
  currentFullName: string;
  email: string;
  onClose: () => void;
}

export function EditProfileModal({ currentFullName, email, onClose }: EditProfileModalProps) {
  const updateProfileMutation = useUpdateProfile();
  const [fullNameInput, setFullNameInput] = useState(currentFullName);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfileMutation.mutateAsync({ fullName: fullNameInput });
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
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
            onClick={onClose}
            className="text-[#848e9c] hover:text-white p-1 rounded-lg hover:bg-[#1e232d] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={(e) => { void handleSave(e); }} className="mt-4 space-y-4">
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
              onClick={onClose}
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
  );
}
