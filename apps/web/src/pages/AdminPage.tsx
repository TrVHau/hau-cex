import { useState } from 'react';
import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Landmark,
  BarChart2,
  Coins,
  Users,
  RefreshCw,
  Receipt,
  Shield,
  Lock,
  Unlock,
  Play,
  Pause,
  TrendingUp,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { adminApi } from '../api/admin';
import { useMarkets } from '../hooks/useApi';
import { Card, Badge, Button, Alert, Spinner } from '../components/ui';
import { parseApiError, formatDateTime, formatDecimal } from '../lib/utils';

type AdminTab = 'treasury' | 'markets' | 'assets' | 'users';

function formatFeePercent(rate: string): string {
  try {
    return `${new Decimal(rate).mul(100).toFixed(2)}%`;
  } catch {
    return rate;
  }
}

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

export function AdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<AdminTab>('treasury');
  const [assetFilter, setAssetFilter] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const { data: publicMarkets = [] } = useMarkets();

  // Map baseAsset -> lastPrice (USDT) để ước lượng tổng doanh thu USD
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

  // ─── Treasury Queries ─────────────────────────────────────────────────────
  const {
    data: treasuryOverview,
    isLoading: loadingTreasury,
    isFetching: fetchingTreasury,
    refetch: refetchTreasury,
  } = useQuery({
    queryKey: ['admin', 'treasury', 'overview'],
    queryFn: () => adminApi.getTreasuryOverview(),
    enabled: activeTab === 'treasury',
    refetchInterval: 15_000,
  });

  const {
    data: treasuryLedgerPages,
    isLoading: loadingTreasuryLedger,
    isFetchingNextPage: fetchingNextLedger,
    hasNextPage: hasNextLedger,
    fetchNextPage: fetchNextLedger,
    refetch: refetchTreasuryLedger,
  } = useInfiniteQuery({
    queryKey: ['admin', 'treasury', 'ledger', assetFilter],
    queryFn: ({ pageParam }) =>
      adminApi.getTreasuryLedger({
        assetSymbol: assetFilter || undefined,
        cursor: pageParam,
        limit: 20,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined),
    enabled: activeTab === 'treasury',
  });

  // ─── Markets Query ────────────────────────────────────────────────────────
  const { data: markets, isLoading: loadingMarkets } = useQuery({
    queryKey: ['admin', 'markets'],
    queryFn: () => adminApi.getMarkets(),
    enabled: activeTab === 'markets',
  });

  // ─── Assets Query ─────────────────────────────────────────────────────────
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
    getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined),
    enabled: activeTab === 'assets',
  });

  // ─── Users Query ──────────────────────────────────────────────────────────
  const {
    data: usersPages,
    isLoading: loadingUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: fetchingNextUsers,
    fetchNextPage: fetchNextUsers,
  } = useInfiniteQuery({
    queryKey: ['admin', 'users'],
    queryFn: ({ pageParam }) => adminApi.getUsers({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined),
    enabled: activeTab === 'users',
  });

  // ─── Mutations ────────────────────────────────────────────────────────────
  const lockUser = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.lockUser(id, reason),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionSuccess('Đã khóa tài khoản người dùng');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const unlockUser = useMutation({
    mutationFn: (id: string) => adminApi.unlockUser(id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      setActionSuccess('Đã mở khóa tài khoản người dùng');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const activateAsset = useMutation({
    mutationFn: (id: string) => adminApi.activateAsset(id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] });
      setActionSuccess('Đã kích hoạt tài sản');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const deactivateAsset = useMutation({
    mutationFn: (id: string) => adminApi.deactivateAsset(id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'assets'] });
      setActionSuccess('Đã vô hiệu hóa tài sản');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const openMarket = useMutation({
    mutationFn: (id: string) => adminApi.openMarket(id),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'markets'] });
      void queryClient.invalidateQueries({ queryKey: ['markets'] });
      setActionSuccess('Đã gửi lệnh mở thị trường tới Matching Engine');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  const suspendMarket = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      adminApi.suspendMarket(id, reason),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'markets'] });
      void queryClient.invalidateQueries({ queryKey: ['markets'] });
      setActionSuccess('Đã tạm dừng thị trường');
    },
    onError: (err) => setActionError(parseApiError(err)),
  });

  // ─── Derived Data ─────────────────────────────────────────────────────────
  const treasuryWallets = treasuryOverview?.wallets ?? [];
  const treasuryLedgerItems =
    treasuryLedgerPages?.pages.flatMap((page) => page.items) ?? [];
  const assetItems = assetsPages?.pages.flatMap((page) => page.items) ?? [];
  const userItems = usersPages?.pages.flatMap((page) => page.items) ?? [];

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

  const tabs: Array<{ key: AdminTab; label: string; icon: typeof Landmark }> = [
    { key: 'treasury', label: 'Treasury & Phí sàn', icon: Landmark },
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
              void refetchTreasury();
              void refetchTreasuryLedger();
            }}
            isLoading={fetchingTreasury}
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

      {/* ─── TREASURY TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'treasury' && (
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
          <Card
            title="Ví Treasury & Doanh thu phí theo Tài sản"
            noPadding
          >
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
                                <div className="w-7 h-7 rounded-full bg-[#1e232d] border border-[#2b3240] flex items-center justify-center font-bold text-[10px] text-[#f5b642]">
                                  {w.assetSymbol.slice(0, 4)}
                                </div>
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
                                {isPositive ? `+${formatDecimal(entry.amount, 8)}` : formatDecimal(entry.amount, 8)}
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
      )}

      {/* ─── MARKETS TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'markets' && (
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
                        <td className="py-3 px-4 font-semibold text-white">{market.symbol}</td>
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
                                  suspendMarket.isPending &&
                                  suspendMarket.variables?.id === market.id
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
      )}

      {/* ─── ASSETS TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'assets' && (
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
                          <td className="py-3 px-4 font-semibold text-white">{asset.symbol}</td>
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
      )}

      {/* ─── USERS TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <Card title="Quản lý Người dùng (Users)" noPadding>
          {loadingUsers ? (
            <div className="p-8 flex justify-center">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[#848e9c] border-b border-[#232933] text-left bg-[#111419]">
                      <th className="py-3 px-4 font-medium">EMAIL / TÊN</th>
                      <th className="py-3 px-4 font-medium">ROLE</th>
                      <th className="py-3 px-4 font-medium">TRẠNG THÁI</th>
                      <th className="py-3 px-4 font-medium">ĐĂNG NHẬP CUỐI</th>
                      <th className="py-3 px-4 font-medium">NGÀY TẠO</th>
                      <th className="py-3 px-4 font-medium text-right">THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1c212a]">
                    {userItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-[#5e6673]">
                          Không có người dùng nào.
                        </td>
                      </tr>
                    ) : (
                      userItems.map((user) => (
                        <tr key={user.id} className="hover:bg-[#1a1e26] transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-white">{user.email}</div>
                            {user.fullName && (
                              <div className="text-[11px] text-[#848e9c]">{user.fullName}</div>
                            )}
                            {user.lockedReason && (
                              <div className="text-[11px] text-[#f6465d]">
                                Lý do khóa: {user.lockedReason}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={user.role === 'ADMIN' ? 'yellow' : 'gray'}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {user.status === 'LOCKED' ? (
                              <Badge variant="red">LOCKED</Badge>
                            ) : (
                              <Badge variant="green">ACTIVE</Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[#848e9c]">
                            {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '—'}
                          </td>
                          <td className="py-3 px-4 text-[#848e9c]">
                            {formatDateTime(user.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {user.role === 'USER' &&
                              (user.status === 'LOCKED' ? (
                                <Button
                                  variant="primary"
                                  size="xs"
                                  onClick={() => unlockUser.mutate(user.id)}
                                  isLoading={
                                    unlockUser.isPending && unlockUser.variables === user.id
                                  }
                                >
                                  <Unlock className="w-3 h-3" />
                                  Mở khóa
                                </Button>
                              ) : (
                                <Button
                                  variant="danger"
                                  size="xs"
                                  onClick={() => {
                                    const reason = window.prompt(
                                      `Nhập lý do khóa ${user.email} (không bắt buộc):`,
                                    );
                                    if (reason !== null) {
                                      lockUser.mutate({
                                        id: user.id,
                                        reason: reason.trim() || undefined,
                                      });
                                    }
                                  }}
                                  isLoading={
                                    lockUser.isPending && lockUser.variables?.id === user.id
                                  }
                                >
                                  <Lock className="w-3 h-3" />
                                  Khóa
                                </Button>
                              ))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {hasNextUsers && (
                <div className="p-3 border-t border-[#232933] flex justify-center">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void fetchNextUsers()}
                    isLoading={fetchingNextUsers}
                  >
                    Tải thêm người dùng
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
