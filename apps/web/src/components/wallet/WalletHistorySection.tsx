import { useState } from 'react';
import { Clock, ArrowUpRight, ArrowLeftRight } from 'lucide-react';
import {
  useWithdrawals,
  useCancelWithdrawal,
  useTransfers,
} from '../../hooks/useApi';
import { Button, Badge, Spinner, Alert } from '../ui';
import { formatDecimal, formatDateTime, getDepositStatusMeta, parseApiError } from '../../lib/utils';
import type { DepositIntent } from '../../types';

interface WalletHistorySectionProps {
  deposits: DepositIntent[];
  loadingDeposits: boolean;
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenTransfer: () => void;
}

export function WalletHistorySection({
  deposits,
  loadingDeposits,
  onOpenDeposit,
  onOpenWithdraw,
  onOpenTransfer,
}: WalletHistorySectionProps) {
  const { data: withdrawals = [], isLoading: loadingWithdrawals } = useWithdrawals();
  const cancelWithdrawal = useCancelWithdrawal();
  const { data: transfers = [], isLoading: loadingTransfers } = useTransfers();
  const [cancelWithdrawError, setCancelWithdrawError] = useState<string | null>(null);

  return (
    <>
      {/* ─── Recent On-Chain Deposits ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#232933] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Clock className="w-4 h-4 text-[#f5b642]" />
            Recent On-Chain Deposits
            <span className="text-xs font-normal text-[#5e6673]">({deposits.length})</span>
          </div>
          <Button variant="outline" size="xs" onClick={onOpenDeposit}>
            + New Deposit Intent
          </Button>
        </div>

        {loadingDeposits ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : deposits.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#5e6673]">
            Chưa có giao dịch nạp on-chain nào. Nhấn <strong className="text-[#eaecef]">DEPOSIT</strong> để tạo Deposit Intent.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#5e6673] border-b border-[#232933] bg-[#0e1116]">
                  <th className="py-2.5 px-4 text-left font-medium">CREATED AT</th>
                  <th className="py-2.5 px-4 text-left font-medium">ASSET</th>
                  <th className="py-2.5 px-4 text-right font-medium">AMOUNT</th>
                  <th className="py-2.5 px-4 text-left font-medium">STATUS</th>
                  <th className="py-2.5 px-4 text-left font-medium">ACCOUNT REF</th>
                  <th className="py-2.5 px-4 text-left font-medium">TX HASH</th>
                  <th className="py-2.5 px-4 text-right font-medium">EXPIRES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b2028] font-numeric">
                {deposits.slice(0, 10).map((dep) => {
                  const meta = getDepositStatusMeta(dep.status);
                  return (
                    <tr key={dep.depositId} className="hover:bg-[#1a1e26]">
                      <td className="py-2.5 px-4 text-[#848e9c] font-sans">
                        {formatDateTime(dep.createdAt)}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-white font-sans">{dep.asset}</td>
                      <td className="py-2.5 px-4 text-right text-[#eaecef]">
                        {dep.amount ? formatDecimal(dep.amount, 6) : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${meta.className}`}
                        >
                          {meta.label}
                          {dep.confirmationCount !== undefined && dep.status === 'CONFIRMING'
                            ? ` (${dep.confirmationCount})`
                            : ''}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#848e9c]">
                        {dep.accountReference.slice(0, 10)}...{dep.accountReference.slice(-6)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#848e9c]">
                        {dep.txHash
                          ? `${dep.txHash.slice(0, 10)}...${dep.txHash.slice(-6)}`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-[#848e9c] font-sans">
                        {formatDateTime(dep.expiresAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Recent Withdrawals & Internal Transfers ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Withdrawals */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232933] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ArrowUpRight className="w-4 h-4 text-[#f6465d]" />
              Recent Withdrawals
              <span className="text-xs font-normal text-[#5e6673]">({withdrawals.length})</span>
            </div>
            <Button variant="outline" size="xs" onClick={onOpenWithdraw}>
              + Withdraw
            </Button>
          </div>
          {cancelWithdrawError && (
            <Alert
              type="error"
              message={cancelWithdrawError}
              onClose={() => setCancelWithdrawError(null)}
              className="m-3"
            />
          )}
          {loadingWithdrawals ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5e6673]">
              Chưa có yêu cầu rút tiền nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#5e6673] border-b border-[#232933] bg-[#0e1116]">
                    <th className="py-2 px-3 text-left font-medium">TIME</th>
                    <th className="py-2 px-3 text-left font-medium">ASSET</th>
                    <th className="py-2 px-3 text-right font-medium">AMOUNT</th>
                    <th className="py-2 px-3 text-left font-medium">STATUS</th>
                    <th className="py-2 px-3 text-right font-medium">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2028] font-numeric">
                  {withdrawals.slice(0, 8).map((w) => (
                    <tr key={w.id} className="hover:bg-[#1a1e26]">
                      <td className="py-2 px-3 text-[#848e9c] font-sans">
                        {formatDateTime(w.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-bold text-white font-sans">
                        {w.assetSymbol}
                      </td>
                      <td className="py-2 px-3 text-right text-[#eaecef]">
                        {formatDecimal(w.amount, 6)}
                      </td>
                      <td className="py-2 px-3 font-sans">
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
                          size="sm"
                        >
                          {w.status}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-right font-sans">
                        {w.status === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCancelWithdrawError(null);
                              cancelWithdrawal.mutate(w.id, {
                                onError: (err) => setCancelWithdrawError(parseApiError(err)),
                              });
                            }}
                            disabled={
                              cancelWithdrawal.isPending && cancelWithdrawal.variables === w.id
                            }
                            className="text-xs text-[#f6465d] hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-[#5e6673] font-mono text-[10px]">
                            {w.txHash ? `${w.txHash.slice(0, 8)}...` : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Internal Transfers */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#232933] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ArrowLeftRight className="w-4 h-4 text-[#f5b642]" />
              Recent Internal Transfers
              <span className="text-xs font-normal text-[#5e6673]">({transfers.length})</span>
            </div>
            <Button variant="outline" size="xs" onClick={onOpenTransfer}>
              + Transfer
            </Button>
          </div>
          {loadingTransfers ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : transfers.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5e6673]">
              Chưa có giao dịch chuyển nội bộ nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#5e6673] border-b border-[#232933] bg-[#0e1116]">
                    <th className="py-2 px-3 text-left font-medium">TIME</th>
                    <th className="py-2 px-3 text-left font-medium">DIR</th>
                    <th className="py-2 px-3 text-left font-medium">PEER EMAIL</th>
                    <th className="py-2 px-3 text-right font-medium">AMOUNT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1b2028] font-numeric">
                  {transfers.slice(0, 8).map((t) => (
                    <tr key={t.id} className="hover:bg-[#1a1e26]">
                      <td className="py-2 px-3 text-[#848e9c] font-sans">
                        {formatDateTime(t.createdAt)}
                      </td>
                      <td className="py-2 px-3 font-sans">
                        <Badge variant={t.direction === 'IN' ? 'green' : 'yellow'} size="sm">
                          {t.direction}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-[#eaecef] font-sans truncate max-w-[160px]">
                        {t.direction === 'OUT' ? t.recipientEmail : t.senderEmail}
                      </td>
                      <td
                        className={`py-2 px-3 text-right font-semibold ${
                          t.direction === 'IN' ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                        }`}
                      >
                        {t.direction === 'IN' ? '+' : '-'}
                        {formatDecimal(t.amount, 6)} {t.assetSymbol}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
