import { useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import {
  Landmark,
  BarChart2,
  Coins,
  Users,
  RefreshCw,
  Shield,
  ArrowUpRight,
} from 'lucide-react';
import { Badge, Button, Alert } from '../components/ui';
import { AdminTreasuryTab } from '../components/admin/AdminTreasuryTab';
import { AdminWithdrawalsTab } from '../components/admin/AdminWithdrawalsTab';
import { AdminMarketsTab } from '../components/admin/AdminMarketsTab';
import { AdminAssetsTab } from '../components/admin/AdminAssetsTab';
import { AdminUsersTab } from '../components/admin/AdminUsersTab';

type AdminTab = 'treasury' | 'markets' | 'assets' | 'users' | 'withdrawals';

export function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('treasury');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const isFetchingTreasury =
    useIsFetching({ queryKey: ['admin', 'treasury', 'overview'] }) > 0;

  const handleSuccess = (message: string) => {
    setActionError(null);
    setActionSuccess(message);
  };

  const handleError = (message: string) => {
    setActionSuccess(null);
    setActionError(message);
  };

  const tabs: Array<{ key: AdminTab; label: string; icon: typeof Landmark }> = [
    { key: 'treasury', label: 'Treasury & Phí sàn', icon: Landmark },
    { key: 'withdrawals', label: 'Duyệt Rút tiền', icon: ArrowUpRight },
    { key: 'markets', label: 'Thị trường', icon: BarChart2 },
    { key: 'assets', label: 'Tài sản', icon: Coins },
    { key: 'users', label: 'Người dùng', icon: Users },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-[#f5b642]" />
            <span>Admin Control Panel</span>
            <Badge variant="yellow">ADMIN</Badge>
          </h1>
          <p className="text-xs text-[#848e9c] mt-1">
            Giám sát doanh thu phí Treasury, điều hành thị trường, tài sản và quản trị người dùng.
          </p>
        </div>

        {activeTab === 'treasury' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['admin', 'treasury'] });
            }}
            isLoading={isFetchingTreasury}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới dữ liệu
          </Button>
        )}
      </div>

      {actionError && (
        <Alert
          type="error"
          message={actionError}
          onClose={() => setActionError(null)}
        />
      )}
      {actionSuccess && (
        <Alert
          type="success"
          message={actionSuccess}
          onClose={() => setActionSuccess(null)}
        />
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-[#232933]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'text-[#f5b642] border-[#f5b642]'
                  : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'treasury' && <AdminTreasuryTab />}
      {activeTab === 'withdrawals' && (
        <AdminWithdrawalsTab onSuccess={handleSuccess} onError={handleError} />
      )}
      {activeTab === 'markets' && (
        <AdminMarketsTab onSuccess={handleSuccess} onError={handleError} />
      )}
      {activeTab === 'assets' && (
        <AdminAssetsTab onSuccess={handleSuccess} onError={handleError} />
      )}
      {activeTab === 'users' && (
        <AdminUsersTab onSuccess={handleSuccess} onError={handleError} />
      )}
    </div>
  );
}
