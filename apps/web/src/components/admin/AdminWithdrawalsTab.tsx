import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, CheckCircle2, XCircle } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { Card, Badge, Button, Spinner } from '../ui';
import { parseApiError, formatDateTime, formatDecimal } from '../../lib/utils';
import type { WithdrawalStatus } from '../../types';

interface AdminWithdrawalsTabProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function AdminWithdrawalsTab({ onSuccess, onError }: AdminWithdrawalsTabProps) {
  const queryClient = useQueryClient();
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<WithdrawalStatus | ''>('');

  const {
    data: withdrawalsPages,
    isLoading: loadingWithdrawals,
    hasNextPage: hasNextWithdrawals,
    isFetchingNextPage: fetchingNextWithdrawals,
    fetchNextPage: fetchNextWithdrawals,
  } = useInfiniteQuery({
    queryKey: ['admin', 'withdrawals', withdrawalStatusFilter],
    queryFn: ({ pageParam }) =>
      adminApi.getWithdrawals({
        status: withdrawalStatusFilter || undefined,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const completeWithdrawal = useMutation({
    mutationFn: ({ id, txHash }: { id: string; txHash?: string }) =>
      adminApi.completeWithdrawal(id, txHash),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      void queryClient.invalidateQueries({ queryKey: ['wallets'] });
      onSuccess('Đã duyệt và hoàn tất lệnh rút tiền');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const rejectWithdrawal = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.rejectWithdrawal(id, reason),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] });
      void queryClient.invalidateQueries({ queryKey: ['wallets'] });
      onSuccess('Đã từ chối lệnh rút và hoàn trả số dư cho người dùng');
    },
    onError: (err) => onError(parseApiError(err)),
  });

  const withdrawalItems = withdrawalsPages?.pages.flatMap((page) => page.items) ?? [];

  return (
    <Card className="p-0 overflow-hidden">
      <div className="p-4 border-b border-[#232933] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-[#f6465d]" />
            Quản lý Yêu cầu Rút tiền ({withdrawalItems.length})
          </h2>
          <p className="text-xs text-[#848e9c] mt-0.5">
            Duyệt lệnh rút tiền hoặc từ chối để hoàn số dư khả dụng cho người dùng.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          {(['', 'PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'] as const).map((st) => (
            <button
              key={st || 'ALL'}
              type="button"
              onClick={() => setWithdrawalStatusFilter(st)}
              className={`px-2.5 py-1 rounded border font-semibold cursor-pointer ${
                withdrawalStatusFilter === st
                  ? 'bg-[#f5b642]/15 border-[#f5b642] text-[#f5b642]'
                  : 'bg-[#1b2028] border-[#282f3c] text-[#848e9c] hover:text-white'
              }`}
            >
              {st || 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {loadingWithdrawals ? (
        <div className="py-12 flex justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                  <th className="py-3 px-4 font-medium">THỜI GIAN</th>
                  <th className="py-3 px-4 font-medium">NGƯỜI DÙNG</th>
                  <th className="py-3 px-4 font-medium">TÀI SẢN</th>
                  <th className="py-3 px-4 font-medium text-right">SỐ LƯỢNG</th>
                  <th className="py-3 px-4 font-medium">ĐỊA CHỈ NHẬN</th>
                  <th className="py-3 px-4 font-medium">TRẠNG THÁI</th>
                  <th className="py-3 px-4 font-medium text-right">THAO TÁC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {withdrawalItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#5e6673]">
                      Không có yêu cầu rút tiền nào.
                    </td>
                  </tr>
                ) : (
                  withdrawalItems.map((w) => (
                    <tr key={w.id} className="hover:bg-[#1a1e26]">
                      <td className="py-3 px-4 text-[#848e9c]">{formatDateTime(w.createdAt)}</td>
                      <td className="py-3 px-4 text-white font-medium">{w.userEmail}</td>
                      <td className="py-3 px-4 font-bold text-white">{w.assetSymbol}</td>
                      <td className="py-3 px-4 text-right font-mono text-white">
                        {formatDecimal(w.amount, 6)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#848e9c]">{w.toAddress}</td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            w.status === 'COMPLETED'
                              ? 'green'
                              : w.status === 'PENDING'
                                ? 'yellow'
                                : w.status === 'FAILED'
                                  ? 'red'
                                  : 'gray'
                          }
                        >
                          {w.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {w.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="primary"
                              size="xs"
                              onClick={() => {
                                const txHash = window.prompt('Nhập Tx Hash (nếu có, không bắt buộc):');
                                if (txHash !== null) {
                                  completeWithdrawal.mutate({
                                    id: w.id,
                                    txHash: txHash.trim() || undefined,
                                  });
                                }
                              }}
                              isLoading={
                                completeWithdrawal.isPending && completeWithdrawal.variables?.id === w.id
                              }
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Duyệt
                            </Button>
                            <Button
                              variant="danger"
                              size="xs"
                              onClick={() => {
                                const reason = window.prompt('Nhập lý do từ chối (không bắt buộc):');
                                if (reason !== null) {
                                  rejectWithdrawal.mutate({
                                    id: w.id,
                                    reason: reason.trim() || undefined,
                                  });
                                }
                              }}
                              isLoading={
                                rejectWithdrawal.isPending && rejectWithdrawal.variables?.id === w.id
                              }
                            >
                              <XCircle className="w-3 h-3" />
                              Từ chối
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[#5e6673] font-mono">
                            {w.txHash ? `${w.txHash.slice(0, 10)}...` : (w.failureReason ?? '—')}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasNextWithdrawals && (
            <div className="p-3 border-t border-[#232933] flex justify-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void fetchNextWithdrawals()}
                isLoading={fetchingNextWithdrawals}
              >
                Tải thêm yêu cầu rút tiền
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
