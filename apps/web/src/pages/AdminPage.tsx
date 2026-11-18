import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../api/admin';
import { Card, Badge, Button, Alert } from '../components/ui';
import { parseApiError, formatDateTime } from '../lib/utils';

export function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'markets' | 'assets'>('users');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
    enabled: activeTab === 'users',
  });

  const { data: markets, isLoading: loadingMarkets } = useQuery({
    queryKey: ['admin', 'markets'],
    queryFn: () => adminApi.getMarkets(),
    enabled: activeTab === 'markets',
  });

  const { data: assets, isLoading: loadingAssets } = useQuery({
    queryKey: ['admin', 'assets'],
    queryFn: () => adminApi.getAssets(),
    enabled: activeTab === 'assets',
  });

  const lockUser = useMutation({
    mutationFn: (id: string) => adminApi.lockUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionSuccess('Đã lock user thành công');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const unlockUser = useMutation({
    mutationFn: (id: string) => adminApi.unlockUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionSuccess('Đã unlock user thành công');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const openMarket = useMutation({
    mutationFn: (id: string) => adminApi.openMarket(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'markets'] });
      void queryClient.invalidateQueries({ queryKey: ['markets'] });
      setActionSuccess('Đã mở market');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const suspendMarket = useMutation({
    mutationFn: (id: string) => adminApi.suspendMarket(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'markets'] });
      void queryClient.invalidateQueries({ queryKey: ['markets'] });
      setActionSuccess('Đã tạm dừng market');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const tabs = [
    { key: 'users' as const, label: 'Users' },
    { key: 'markets' as const, label: 'Markets' },
    { key: 'assets' as const, label: 'Assets' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <span>Admin Panel</span>
        <Badge variant="yellow">ADMIN</Badge>
      </h1>

      {actionError && (
        <Alert
          type="error"
          message={actionError}
          onClose={() => setActionError(null)}
          className="mb-4"
        />
      )}
      {actionSuccess && (
        <Alert
          type="success"
          message={actionSuccess}
          onClose={() => setActionSuccess(null)}
          className="mb-4"
        />
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-700 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card title="Users">
          {loadingUsers && <div className="text-gray-400 py-4">Đang tải...</div>}
          {users && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left pb-2 font-medium">Email</th>
                  <th className="text-left pb-2 font-medium">Role</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-left pb-2 font-medium">Created</th>
                  <th className="text-right pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                    <td className="py-2 text-gray-200">{user.email}</td>
                    <td className="py-2">
                      <Badge variant={user.role === 'ADMIN' ? 'yellow' : 'gray'}>{user.role}</Badge>
                    </td>
                    <td className="py-2">
                      {user.isLocked ? (
                        <Badge variant="red">LOCKED</Badge>
                      ) : (
                        <Badge variant="green">ACTIVE</Badge>
                      )}
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{formatDateTime(user.createdAt)}</td>
                    <td className="py-2 text-right">
                      {user.isLocked ? (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => unlockUser.mutate(user.id)}
                          isLoading={unlockUser.isPending && unlockUser.variables === user.id}
                        >
                          Unlock
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => lockUser.mutate(user.id)}
                          isLoading={lockUser.isPending && lockUser.variables === user.id}
                        >
                          Lock
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Markets Tab */}
      {activeTab === 'markets' && (
        <Card title="Markets">
          {loadingMarkets && <div className="text-gray-400 py-4">Đang tải...</div>}
          {markets && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left pb-2 font-medium">Symbol</th>
                  <th className="text-left pb-2 font-medium">Base</th>
                  <th className="text-left pb-2 font-medium">Quote</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                  <th className="text-right pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr key={market.id} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                    <td className="py-2 font-semibold text-white">{market.symbol}</td>
                    <td className="py-2 text-gray-300">{market.baseAsset}</td>
                    <td className="py-2 text-gray-300">{market.quoteAsset}</td>
                    <td className="py-2">
                      {market.status === 'OPEN' ? (
                        <Badge variant="green">OPEN</Badge>
                      ) : market.status === 'SUSPENDED' ? (
                        <Badge variant="yellow">SUSPENDED</Badge>
                      ) : (
                        <Badge variant="gray">{market.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right flex gap-2 justify-end">
                      {market.status !== 'OPEN' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => openMarket.mutate(market.id)}
                          isLoading={openMarket.isPending && openMarket.variables === market.id}
                        >
                          Open
                        </Button>
                      )}
                      {market.status === 'OPEN' && (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => suspendMarket.mutate(market.id)}
                          isLoading={
                            suspendMarket.isPending && suspendMarket.variables === market.id
                          }
                        >
                          Suspend
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* Assets Tab */}
      {activeTab === 'assets' && (
        <Card title="Assets">
          {loadingAssets && <div className="text-gray-400 py-4">Đang tải...</div>}
          {assets && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left pb-2 font-medium">Symbol</th>
                  <th className="text-left pb-2 font-medium">Name</th>
                  <th className="text-right pb-2 font-medium">Decimals</th>
                  <th className="text-left pb-2 font-medium">Contract</th>
                  <th className="text-left pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((asset) => (
                  <tr key={asset.id} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                    <td className="py-2 font-semibold text-white">{asset.symbol}</td>
                    <td className="py-2 text-gray-300">{asset.name}</td>
                    <td className="py-2 text-right text-gray-300">{asset.decimals}</td>
                    <td className="py-2 text-gray-400 text-xs font-mono">
                      {asset.contractAddress
                        ? `${asset.contractAddress.slice(0, 6)}...${asset.contractAddress.slice(-4)}`
                        : '—'}
                    </td>
                    <td className="py-2">
                      {asset.isActive ? (
                        <Badge variant="green">ACTIVE</Badge>
                      ) : (
                        <Badge variant="gray">INACTIVE</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}
    </div>
  );
}
