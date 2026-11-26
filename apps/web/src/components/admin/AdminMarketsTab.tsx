import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Pause } from 'lucide-react';
import Decimal from 'decimal.js';
import { adminApi } from '../../api/admin';
import { Card, Badge, Button, Spinner, PairIcon } from '../ui';
import { parseApiError } from '../../lib/utils';

interface AdminMarketsTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

function formatFeePercent(rate: string): string {
  try {
    return `${new Decimal(rate).mul(100).toFixed(2)}%`;
  } catch {
    return rate;
  }
}

export function AdminMarketsTab({ onSuccess, onError }: AdminMarketsTabProps) {
  const queryClient = useQueryClient();

  const { data: markets, isLoading: loadingMarkets } = useQuery({
    queryKey: ['admin', 'markets'],
    queryFn: () => adminApi.getMarkets(),
  });

  const openMarket = useMutation({
    mutationFn: (id: string) => adminApi.openMarket(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'markets'] });
      void queryClient.invalidateQueries({ queryKey: ['markets'] });
      onSuccess('Đã gửi lệnh mở thị trường tới Matching Engine');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const suspendMarket = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.suspendMarket(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'markets'] });
      void queryClient.invalidateQueries({ queryKey: ['markets'] });
      onSuccess('Đã tạm dừng thị trường');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  return (
    <Card title="Quản lý Thị trường (Trading Pairs)" noPadding>
      {loadingMarkets ? (
        <div className="p-8 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                <th className="py-3 px-4 font-medium">CẶP GIAO DỊCH</th>
                <th className="py-3 px-4 font-medium">BASE / QUOTE</th>
                <th className="py-3 px-4 font-medium text-right">MAKER / TAKER FEE</th>
                <th className="py-3 px-4 font-medium text-right">TICK / STEP</th>
                <th className="py-3 px-4 font-medium">TRẠNG THÁI</th>
                <th className="py-3 px-4 font-medium text-right">THAO TÁC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c212a]">
              {(markets ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#5e6673]">
                    Chưa có cặp giao dịch nào.
                  </td>
                </tr>
              ) : (
                (markets ?? []).map((market) => (
                  <tr key={market.id} className="hover:bg-[#1a1e26] transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <PairIcon baseAsset={market.baseAsset} quoteAsset={market.quoteAsset} size="sm" />
                        <span>{market.symbol}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[#eaecef]">
                      {market.baseAsset} / {market.quoteAsset}
                    </td>
                    <td className="py-3 px-4 text-right font-numeric text-[#eaecef]">
                      {formatFeePercent(market.makerFeeRate)} /{' '}
                      {formatFeePercent(market.takerFeeRate)}
                    </td>
                    <td className="py-3 px-4 text-right font-numeric text-[#848e9c]">
                      {market.tickSize} / {market.stepSize}
                    </td>
                    <td className="py-3 px-4">
                      {market.status === 'READY' ? (
                        <Badge variant="green">READY</Badge>
                      ) : market.status === 'SUSPENDED' ? (
                        <Badge variant="red">SUSPENDED</Badge>
                      ) : (
                        <Badge variant="yellow">{market.status}</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex gap-2 justify-end">
                        {market.status === 'SUSPENDED' && (
                          <Button
                            variant="buy"
                            size="xs"
                            onClick={() => openMarket.mutate(market.id)}
                            isLoading={openMarket.isPending && openMarket.variables === market.id}
                          >
                            <Play className="w-3 h-3" />
                            Mở lại
                          </Button>
                        )}
                        {market.status === 'READY' && (
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => {
                              const reason = window.prompt(
                                `Nhập lý do tạm dừng ${market.symbol} (không bắt buộc):`,
                              );
                              if (reason !== null) {
                                suspendMarket.mutate({
                                  id: market.id,
                                  reason: reason.trim() || undefined,
                                });
                              }
                            }}
                            isLoading={
                              suspendMarket.isPending && suspendMarket.variables?.id === market.id
                            }
                          >
                            <Pause className="w-3 h-3" />
                            Tạm dừng
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
