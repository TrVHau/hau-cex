import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../api/admin';
import { Card, Badge, Button, Spinner, CoinIcon } from '../ui';
import { parseApiError } from '../../lib/utils';

interface AdminAssetsTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AdminAssetsTab({ onSuccess, onError }: AdminAssetsTabProps) {
  const queryClient = useQueryClient();

  const {
    data: assetsPages,
    isLoading: loadingAssets,
    hasNextPage: hasNextAssets,
    isFetchingNextPage: fetchingNextAssets,
    fetchNextPage: fetchNextAssets,
  } = useInfiniteQuery({
    queryKey: ['admin', 'assets'],
    queryFn: ({ pageParam }) => adminApi.getAssets({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const activateAsset = useMutation({
    mutationFn: (id: string) => adminApi.activateAsset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] });
      onSuccess('Đã kích hoạt tài sản');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const deactivateAsset = useMutation({
    mutationFn: (id: string) => adminApi.deactivateAsset(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] });
      onSuccess('Đã vô hiệu hóa tài sản');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const assetItems = assetsPages?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card title="Quản lý Tài sản (Assets)" noPadding>
      {loadingAssets ? (
        <div className="p-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                  <th className="py-3 px-4 font-medium">SYMBOL</th>
                  <th className="py-3 px-4 font-medium">TÊN TÀI SẢN</th>
                  <th className="py-3 px-4 font-medium text-right">DECIMALS</th>
                  <th className="py-3 px-4 font-medium">QUYỀN HẠN</th>
                  <th className="py-3 px-4 font-medium">TRẠNG THÁI</th>
                  <th className="py-3 px-4 font-medium text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {assetItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#5e6673]">
                      Chưa có tài sản nào.
                    </td>
                  </tr>
                ) : (
                  assetItems.map((asset) => (
                    <tr key={asset.id} className="hover:bg-[#1a1e26] transition-colors">
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2">
                          <CoinIcon symbol={asset.symbol} size="sm" />
                          <span>{asset.symbol}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-[#eaecef]">{asset.name}</td>
                      <td className="py-3 px-4 text-right font-numeric text-[#848e9c]">
                        {asset.decimals}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={asset.depositEnabled ? 'blue' : 'gray'} size="sm">
                            Deposit: {asset.depositEnabled ? 'ON' : 'OFF'}
                          </Badge>
                          <Badge variant={asset.tradingEnabled ? 'blue' : 'gray'} size="sm">
                            Trade: {asset.tradingEnabled ? 'ON' : 'OFF'}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {asset.status === 'ACTIVE' ? (
                          <Badge variant="green">ACTIVE</Badge>
                        ) : (
                          <Badge variant="gray">INACTIVE</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {asset.status === 'ACTIVE' ? (
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => deactivateAsset.mutate(asset.id)}
                            isLoading={
                              deactivateAsset.isPending && deactivateAsset.variables === asset.id
                            }
                          >
                            Vô hiệu hóa
                          </Button>
                        ) : (
                          <Button
                            variant="buy"
                            size="xs"
                            onClick={() => activateAsset.mutate(asset.id)}
                            isLoading={
                              activateAsset.isPending && activateAsset.variables === asset.id
                            }
                          >
                            Kích hoạt
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasNextAssets && (
            <div className="p-3 border-t border-[#232933] flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void fetchNextAssets()}
                isLoading={fetchingNextAssets}
              >
                Tải thêm tài sản
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
