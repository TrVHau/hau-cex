import { Bell, Settings } from 'lucide-react';
import type { UserPreferences } from '../../types';

interface PreferenceTabProps {
  preferences?: UserPreferences;
  savedMsg: string | null;
  onSavePref: (patch: Partial<UserPreferences>) => void;
}

export function NotificationsTab({ preferences, savedMsg, onSavePref }: PreferenceTabProps) {
  const notifOrders = preferences?.notifOrders ?? true;
  const notifSecurity = preferences?.notifSecurity ?? true;
  const notifNewsletter = preferences?.notifNewsletter ?? false;

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#232933] pb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Bell className="w-4 h-4 text-[#f5b642]" />
          Notification Preferences
        </div>
        {savedMsg && <span className="text-xs text-[#0ecb81] font-semibold">{savedMsg}</span>}
      </div>
      <p className="text-xs text-[#848e9c]">
        Cài đặt được lưu trực tiếp lên tài khoản của bạn.
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
            onChange={(e) => onSavePref({ notifOrders: e.target.checked })}
            className="accent-[#f5b642] w-4 h-4 cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
          <div>
            <div className="text-xs font-semibold text-white">Security &amp; Password Changes</div>
            <div className="text-[11px] text-[#848e9c]">
              Critical security alerts whenever passwords, 2FA, or API keys are modified
            </div>
          </div>
          <input
            type="checkbox"
            checked={notifSecurity}
            onChange={(e) => onSavePref({ notifSecurity: e.target.checked })}
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
            onChange={(e) => onSavePref({ notifNewsletter: e.target.checked })}
            className="accent-[#f5b642] w-4 h-4 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

export function SystemPreferencesTab({
  preferences,
  savedMsg,
  onSavePref,
}: PreferenceTabProps) {
  const prefCurrency = preferences?.baseCurrency ?? 'USDT';
  const prefLang = preferences?.language ?? 'en';
  const prefConfirmOrder = preferences?.confirmOrder ?? true;

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-[#232933] pb-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <Settings className="w-4 h-4 text-[#f5b642]" />
          System &amp; Trading Preferences
        </div>
        {savedMsg && <span className="text-xs text-[#0ecb81] font-semibold">{savedMsg}</span>}
      </div>

      <div className="space-y-4 text-xs">
        <div>
          <label className="block text-[#848e9c] mb-1.5 font-medium">Base Display Currency</label>
          <select
            value={prefCurrency}
            onChange={(e) =>
              onSavePref({ baseCurrency: e.target.value as 'USDT' | 'USD' | 'VND' })
            }
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
            onChange={(e) => onSavePref({ language: e.target.value as 'en' | 'vi' })}
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
              Save preference for explicit confirmation before order submission
            </div>
          </div>
          <input
            type="checkbox"
            checked={prefConfirmOrder}
            onChange={(e) => onSavePref({ confirmOrder: e.target.checked })}
            className="accent-[#f5b642] w-4 h-4 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}
