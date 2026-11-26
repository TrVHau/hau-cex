import { useState } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { Landmark, Receipt, TrendingUp } from 'lucide-react';
import Decimal from 'decimal.js';
import { adminApi } from '../../api/admin';
import { useMarkets } from '../../hooks/useApi';
import { Card, Badge, Button, Spinner, CoinIcon } from '../ui';
import { formatDateTime, formatDecimal } from '../../lib/utils';

function estimateUsdValue(
  amountStr: string,
  symbol: string,
  priceMap: Map<string, Decimal>,
): Decimal {
  try {
    const amount = new Decimal(amountStr);
    if (amount.isZero()) return new Decimal(0);
    if (symbol === 'USDT' || symbol === 'USDC') return amount;
    const price = priceMap.get(symbol);
    return price ? amount.mul(price) : new Decimal(0);
  } catch {
    return new Decimal(0);
  }
}

export function AdminTreasuryTab() {
  const [assetFilter, setAssetFilter] = useState<string>('');
  const { data: publicMarkets = [] } = useMarkets();

  const usdtPriceMap = new Map<string, Decimal>();
  publicMarkets.forEach((m) => {
    if (m.quoteAsset === 'USDT' && m.ticker?.lastPrice) {
      try {
        usdtPriceMap.set(m.baseAsset, new Decimal(m.ticker.lastPrice));
      } catch {
        // ignore invalid price
      }
    }
  });

  const { data: treasuryOverview, isLoading: loadingTreasury } = useQuery({
    queryKey: ['admin', 'treasury', 'overview'],
    queryFn: () => adminApi.getTreasuryOverview(),
    refetchInterval: 15_000,
  });

  const {
    data: treasuryLedgerPages,
    isLoading: loadingTreasuryLedger,
    isFetchingNextPage: fetchingNextLedger,
    hasNextPage: hasNextLedger,
    fetchNextPage: fetchNextLedger,
  } = useInfiniteQuery({
    queryKey: ['admin', 'treasury', 'ledger', assetFilter],
    queryFn: ({ pageParam }) =>
      adminApi.getTreasuryLedger({
        assetSymbol: assetFilter || undefined,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
  });

  const treasuryWallets = treasuryOverview?.wallets ?? [];
  const treasuryLedgerItems =
    treasuryLedgerPages?.pages.flatMap((page) => page.items) ?? [];

  let totalBalanceUsd = new Decimal(0);
  let totalFeesUsd = new Decimal(0);
  treasuryWallets.forEach((w) => {
    totalBalanceUsd = totalBalanceUsd.add(
      estimateUsdValue(w.totalBalance, w.assetSymbol, usdtPriceMap),
    );
    totalFeesUsd = totalFeesUsd.add(
      estimateUsdValue(w.totalFeesCollected, w.assetSymbol, usdtPriceMap),
    );
  });

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-[#14171d] to-[#1a1f28]">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-[#848e9c] uppercase tracking-wider">
                Tổng doanh thu phí (Ước tính)
              </div>
              <div className="text-2xl font-bold text-[#f5b642] font-numeric mt-2">
                ${formatDecimal(totalFeesUsd.toFixed(), 2)}
              </div>
              <div className="text-xs text-[#848e9c] mt-1">
                Số dư khả dụng hiện tại:{' '}
                <span className="text-[#eaecef] font-numeric font-medium">
                  ${formatDecimal(totalBalanceUsd.toFixed(), 2)}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#f5b642]/15 border border-[#f5b642]/30 flex items-center justify-center text-[#f5b642]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium text-[#848e9c] uppercase tracking-wider">
                Tổng lượt thu phí
              </div>
              <div className="text-2xl font-bold text-white font-numeric mt-2">
                {treasuryOverview?.totalFeeEntries ?? 0}
              </div>
              <div className="text-xs text-[#848e9c] mt-1">
                Thu lần cuối:{' '}
                <span className="text-[#eaecef]">
                  {treasuryOverview?.lastCollectedAt
                    ? formatDateTime(treasuryOverview.lastCollectedAt)
                    : 'Chưa có giao dịch'}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#0ecb81]/15 border border-[#0ecb81]/30 flex items-center justify-center text-[#0ecb81]">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium text-[#848e9c] uppercase tracking-wider">
                Tài khoản Treasury
              </div>
              <div className="text-sm font-semibold text-white mt-2 truncate">
                {treasuryOverview?.account.email ?? '—'}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="purple" size="sm">
                  {treasuryOverview?.account.role ?? 'SYSTEM'}
                </Badge>
                <span className="text-[11px] text-[#5e6673] font-mono truncate">
                  {treasuryOverview?.account.id ?? ''}
                </span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/30 flex items-center justify-center text-[#60a5fa] shrink-0">
              <Landmark className="w-5 h-5" />
            </div>
          </div>
        </Card>
      </div>

      {/* Treasury Wallets by Asset */}
      <Card title="Ví Treasury & Doanh thu phí theo Tài sản" noPadding>
        {loadingTreasury ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                  <th className="py-3 px-4 font-medium">TÀI SẢN</th>
                  <th className="py-3 px-4 font-medium text-right">SỐ DƯ HIỆN TẠI</th>
                  <th className="py-3 px-4 font-medium text-right">TỔNG PHÍ ĐÃ THU</th>
                  <th className="py-3 px-4 font-medium text-right">ƯỚC TÍNH USD</th>
                  <th className="py-3 px-4 font-medium text-right">SỐ LƯỢT THU PHÍ</th>
                  <th className="py-3 px-4 font-medium text-right">CẬP NHẬT LẦN CUỐI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {treasuryWallets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#5e6673]">
                      Chưa có tài sản nào trong hệ thống.
                    </td>
                  </tr>
                ) : (
                  treasuryWallets.map((w) => {
                    const feeUsd = estimateUsdValue(
                      w.totalFeesCollected,
                      w.assetSymbol,
                      usdtPriceMap,
                    );
                    const precision = Math.min(Math.max(w.decimals, 2), 8);
                    return (
                      <tr key={w.assetId} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <CoinIcon symbol={w.assetSymbol} size="md" />
                            <div>
                              <div className="font-semibold text-white">{w.assetSymbol}</div>
                              <div className="text-[11px] text-[#848e9c]">{w.assetName}</div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="py-3 px-4 text-right font-numeric text-white font-medium"
                          title={w.availableBalance}
                        >
                          {formatDecimal(w.availableBalance, precision)}
                        </td>
                        <td
                          className="py-3 px-4 text-right font-numeric text-[#0ecb81] font-semibold"
                          title={w.totalFeesCollected}
                        >
                          {formatDecimal(w.totalFeesCollected, precision)}
                        </td>
                        <td className="py-3 px-4 text-right font-numeric text-[#eaecef]">
                          {feeUsd.greaterThan(0)
                            ? `$${formatDecimal(feeUsd.toFixed(), 2)}`
                            : '$0.00'}
                        </td>
                        <td className="py-3 px-4 text-right font-numeric text-[#eaecef]">
                          {w.feeEntryCount}
                        </td>
                        <td className="py-3 px-4 text-right text-[#848e9c]">
                          {w.updatedAt ? formatDateTime(w.updatedAt) : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Treasury Ledger History */}
      <Card
        title="Lịch sử dòng tiền phí Treasury"
        action={
          <div className="flex items-center gap-2">
            <select
              aria-label="Lọc theo tài sản"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="bg-[#0b0e11] border border-[#2b3240] rounded-md px-2.5 py-1 text-xs text-[#eaecef] outline-none focus:border-[#f5b642]"
            >
              <option value="">Tất cả tài sản</option>
              {treasuryWallets.map((w) => (
                <option key={w.assetId} value={w.assetSymbol}>
                  {w.assetSymbol}
                </option>
              ))}
            </select>
          </div>
        }
        noPadding
      >
        {loadingTreasuryLedger ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                    <th className="py-3 px-4 font-medium">THỜI GIAN</th>
                    <th className="py-3 px-4 font-medium">TÀI SẢN</th>
                    <th className="py-3 px-4 font-medium">THỊ TRƯỜNG</th>
                    <th className="py-3 px-4 font-medium">LOẠI</th>
                    <th className="py-3 px-4 font-medium text-right">SỐ TIỀN</th>
                    <th className="py-3 px-4 font-medium text-right">TRƯỚC → SAU</th>
                    <th className="py-3 px-4 font-medium text-right">THAM CHIẾU</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c212a]">
                  {treasuryLedgerItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#5e6673]">
                        Chưa có biến động phí nào trong sổ cái Treasury.
                      </td>
                    </tr>
                  ) : (
                    treasuryLedgerItems.map((entry) => {
                      const isPositive = !entry.amount.startsWith('-');
                      return (
                        <tr key={entry.id} className="hover:bg-[#1a1e26] transition-colors">
                          <td className="py-3 px-4 text-[#848e9c] whitespace-nowrap">
                            {formatDateTime(entry.createdAt)}
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">
                            {entry.assetSymbol}
                          </td>
                          <td className="py-3 px-4">
                            {entry.marketSymbol ? (
                              <div>
                                <span className="font-medium text-[#eaecef]">
                                  {entry.marketSymbol}
                                </span>
                                {entry.executionPrice && entry.executedQuantity && (
                                  <div className="text-[10px] text-[#848e9c] font-numeric">
                                    {formatDecimal(entry.executedQuantity, 6)} @{' '}
                                    {formatDecimal(entry.executionPrice, 2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#5e6673]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="yellow" size="sm">
                              {entry.entryType}
                            </Badge>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-numeric font-semibold ${
                              isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'
                            }`}
                            title={entry.amount}
                          >
                            {isPositive
                              ? `+${formatDecimal(entry.amount, 8)}`
                              : formatDecimal(entry.amount, 8)}
                          </td>
                          <td className="py-3 px-4 text-right font-numeric text-[#848e9c]">
                            {formatDecimal(entry.beforeBalance, 6)} →{' '}
                            <span className="text-[#eaecef]">
                              {formatDecimal(entry.afterBalance, 6)}
                            </span>
                          </td>
                          <td
                            className="py-3 px-4 text-right font-mono text-[11px] text-[#848e9c]"
                            title={`${entry.referenceType}: ${entry.referenceId}`}
                          >
                            {entry.referenceType} #{entry.referenceId.slice(0, 8)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {hasNextLedger && (
              <div className="p-3 border-t border-[#232933] flex justify-center">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void fetchNextLedger()}
                  isLoading={fetchingNextLedger}
                >
                  Tải thêm bản ghi
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
