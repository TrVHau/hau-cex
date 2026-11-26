import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Download,
  RotateCw,
  TrendingUp,
  Clock,
  Search,
  Filter,
  FileText,
} from 'lucide-react';
import { useOrders, useMyTrades } from '../hooks/useApi';
import { Button, Badge, Spinner, CoinIcon } from '../components/ui';
import { formatPrice, formatQty, formatDecimal, formatDateTime, downloadCsv } from '../lib/utils';
import type { OrderTrade } from '../types';
import Decimal from 'decimal.js';

type DateRangeFilter = 'ALL' | '24H' | '7D' | '30D';
const DATE_RANGE_LABELS: Record<DateRangeFilter, string> = {
  ALL: 'All Time',
  '24H': 'Last 24H',
  '7D': 'Last 7D',
  '30D': 'Last 30D',
};

export function TradesPage() {
  const navigate = useNavigate();
  const [sideTab, setSideTab] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'MAKER' | 'TAKER'>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data: allOrders = [], isLoading: loadingOrders, refetch: refetchOrders } = useOrders();
  const safeOrders = Array.isArray(allOrders) ? allOrders : [];
  const {
    data: executedTrades = [],
    isLoading: loadingTrades,
    refetch: refetchTrades,
  } = useMyTrades(safeOrders);

  const cycleDateRange = () => {
    const order: DateRangeFilter[] = ['ALL', '24H', '7D', '30D'];
    setDateRange((prev) => order[(order.indexOf(prev) + 1) % order.length]);
  };

  const nowMs = new Date().getTime();
  const rangeMsMap: Record<DateRangeFilter, number | null> = {
    ALL: null,
    '24H': 24 * 60 * 60 * 1000,
    '7D': 7 * 24 * 60 * 60 * 1000,
    '30D': 30 * 24 * 60 * 60 * 1000,
  };
  const maxAgeMs = rangeMsMap[dateRange];

  const dateFilteredTrades = executedTrades.filter((t) => {
    if (maxAgeMs === null) return true;
    const ts = new Date(t.matchedAt).getTime();
    return Number.isFinite(ts) && nowMs - ts <= maxAgeMs;
  });

  const filteredTrades = dateFilteredTrades.filter((t) => {
    const side = t.side ?? t.takerSide;
    if (sideTab !== 'ALL' && side !== sideTab) return false;
    if (roleFilter !== 'ALL' && t.role !== roleFilter) return false;
    const sym = t.symbol ?? '';
    const oid = t.orderId ?? '';
    const q = search.toLowerCase();
    return sym.toLowerCase().includes(q) || t.id.toLowerCase().includes(q) || oid.toLowerCase().includes(q);
  });

  // Real statistics computed via Decimal.js
  let makerCount = 0;
  let totalQuoteVolume = new Decimal(0);
  let buyQuoteVolume = new Decimal(0);
  let sellQuoteVolume = new Decimal(0);
  const pairVolume: Record<string, { count: number; quoteVol: Decimal }> = {};

  dateFilteredTrades.forEach((t) => {
    if (t.role === 'MAKER') makerCount += 1;
    try {
      const qa = new Decimal(t.quoteAmount);
      totalQuoteVolume = totalQuoteVolume.add(qa);
      const side = t.side ?? t.takerSide;
      if (side === 'BUY') buyQuoteVolume = buyQuoteVolume.add(qa);
      else sellQuoteVolume = sellQuoteVolume.add(qa);

      const sym = t.symbol ?? 'UNKNOWN';
      if (!pairVolume[sym]) pairVolume[sym] = { count: 0, quoteVol: new Decimal(0) };
      pairVolume[sym].count += 1;
      pairVolume[sym].quoteVol = pairVolume[sym].quoteVol.add(qa);
    } catch {
      // ignore
    }
  });

  const makerPct =
    dateFilteredTrades.length > 0
      ? ((makerCount / dateFilteredTrades.length) * 100).toFixed(1)
      : '0.0';
  const topPairs = Object.entries(pairVolume)
    .sort((a, b) => b[1].quoteVol.comparedTo(a[1].quoteVol))
    .slice(0, 2);

  const handleRefresh = async () => {
    await refetchOrders();
    await refetchTrades();
  };

  const handleExportCsv = () => {
    downloadCsv(
      `hau-cex-trades-${new Date().toISOString().slice(0, 10)}.csv`,
      ['TradeID', 'OrderID', 'MatchedAt', 'Symbol', 'Side', 'Role', 'Price', 'Quantity', 'QuoteAmount', 'Fee'],
      filteredTrades.map((t) => [
        t.id,
        t.orderId ?? '',
        t.matchedAt,
        t.symbol ?? '',
        t.side ?? t.takerSide,
        t.role,
        t.price,
        t.quantity,
        t.quoteAmount,
        t.fee,
      ]),
    );
  };

  const isLoading = loadingOrders || (safeOrders.some((o) => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED') && loadingTrades);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold text-white tracking-tight">
            <History className="w-6 h-6 text-[#f5b642]" />
            Trade History
          </div>
          <p className="text-xs text-[#848e9c] mt-1">
            Detailed execution fills fetched directly from matched order records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={cycleDateRange} className="text-xs">
            <Clock className="w-3.5 h-3.5 text-[#f5b642]" />
            {DATE_RANGE_LABELS[dateRange]}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredTrades.length === 0}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#848e9c]" />
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { void handleRefresh(); }}
            className="text-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Top 4 Stat Cards (Real execution stats) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>EXECUTED FILLS</span>
            <span className="text-[11px] text-[#848e9c] font-numeric">{DATE_RANGE_LABELS[dateRange]}</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">
            {dateFilteredTrades.length}
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>MAKER RATIO</span>
            <span className="text-[11px] text-[#848e9c] font-numeric">
              {makerCount}M / {dateFilteredTrades.length - makerCount}T
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">{makerPct}%</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>TOTAL QUOTE VOLUME</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">
            ${totalQuoteVolume.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>BUY / SELL NOTIONAL</span>
          </div>
          <div className="text-lg font-bold font-numeric mt-2">
            <span className="text-[#0ecb81]">+${buyQuoteVolume.toFixed(2)}</span>
            <span className="text-[#5e6673] mx-1.5">/</span>
            <span className="text-[#f6465d]">${sellQuoteVolume.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* ─── Trades Table Card ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-[#232933] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0b0e11] p-1 rounded-lg border border-[#1c212a]">
              {(['ALL', 'BUY', 'SELL'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSideTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    sideTab === tab
                      ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 bg-[#0b0e11] p-1 rounded-lg border border-[#1c212a]">
              {(['ALL', 'MAKER', 'TAKER'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    roleFilter === r
                      ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pair, trade or order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none w-56"
              />
            </div>
            <button
              type="button"
              onClick={() => setRoleFilter((r) => (r === 'ALL' ? 'MAKER' : r === 'MAKER' ? 'TAKER' : 'ALL'))}
              title={`Lọc Role (hiện tại: ${roleFilter})`}
              className="p-2 rounded-lg bg-[#1b2028] border border-[#282f3c] text-[#848e9c] hover:text-[#eaecef] cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-numeric">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#1c212a] text-left font-sans">
                  <th className="py-3 px-4 font-medium">TIME</th>
                  <th className="py-3 px-4 font-medium">TRADING PAIR</th>
                  <th className="py-3 px-4 font-medium">SIDE</th>
                  <th className="py-3 px-4 font-medium">ROLE</th>
                  <th className="py-3 px-4 font-medium text-right">PRICE</th>
                  <th className="py-3 px-4 font-medium text-right">AMOUNT</th>
                  <th className="py-3 px-4 font-medium text-right">FEE</th>
                  <th className="py-3 px-4 font-medium text-right">TOTAL (QUOTE)</th>
                  <th className="py-3 px-4 font-medium text-right font-sans">ORDER REF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {filteredTrades.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-[#5e6673] font-sans">
                      No executed trades found.
                    </td>
                  </tr>
                ) : (
                  filteredTrades.map((t: OrderTrade) => {
                    const side = t.side ?? t.takerSide;
                    const isBuy = side === 'BUY';
                    const symbol = t.symbol ?? '—';

                    return (
                      <tr key={`${t.id}-${t.orderId ?? ''}`} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4 text-[#848e9c]">
                          {formatDateTime(t.matchedAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-white font-sans">
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={symbol.split('_')[0] ?? symbol} size="xs" />
                            <span>{symbol}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge variant={isBuy ? 'green' : 'red'} size="sm">
                            {side}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge variant={t.role === 'MAKER' ? 'blue' : 'yellow'} size="sm">
                            {t.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-white font-medium">
                          {formatPrice(t.price)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatQty(t.quantity)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#848e9c]">
                          {formatDecimal(t.fee, 6)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">
                          ${formatDecimal(t.quoteAmount, 2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#848e9c]">
                          {(t.orderId ?? t.id).slice(0, 8)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Bottom Panels: Pair Insights & Tools ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <TrendingUp className="w-4 h-4 text-[#f5b642]" />
              Pair Execution Summary
            </div>
            <p className="text-xs text-[#848e9c] mb-4">
              Aggregated fill count and quote volume ({DATE_RANGE_LABELS[dateRange]}).
            </p>

            {topPairs.length === 0 ? (
              <div className="p-4 bg-[#1b2028] rounded-lg border border-[#282f3c] text-xs text-[#5e6673]">
                Chưa có giao dịch khớp lệnh nào trong khoảng thời gian đã chọn.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topPairs.map(([sym, stat]) => (
                  <div key={sym} className="p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                    <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1">
                      {stat.count} FILLS RECORDED
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-base">{sym.replace('_', '/')}</span>
                      <span className="text-xs font-semibold text-[#0ecb81] font-numeric">
                        ${stat.quoteVol.toFixed(2)} Vol
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="text-[11px] text-[#5e6673] mt-4 pt-3 border-t border-[#1c212a]">
            Dữ liệu được đối soát trực tiếp từ endpoint <code className="text-[#eaecef]">/orders/:orderId/trades</code> (tối đa 20 lệnh khớp gần nhất).
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-white mb-3">Quick Audit Actions</div>
            <div className="space-y-2.5">
              <div
                onClick={() => navigate('/ledger')}
                className="p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between cursor-pointer hover:border-[#363d4a] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 text-[#f5b642]" />
                  <div>
                    <div className="text-xs font-semibold text-white">Reconcile Ledger</div>
                    <div className="text-[10px] text-[#848e9c]">Verify trade settlement entries</div>
                  </div>
                </div>
                <span className="text-xs text-[#848e9c]">→</span>
              </div>

              <div
                onClick={handleExportCsv}
                className="p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between cursor-pointer hover:border-[#363d4a] transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#0ecb81]" />
                  <div>
                    <div className="text-xs font-semibold text-white">Export Trade CSV</div>
                    <div className="text-[10px] text-[#848e9c]">Download filtered execution history</div>
                  </div>
                </div>
                <span className="text-xs text-[#848e9c]">→</span>
              </div>
            </div>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => { void handleRefresh(); }}
            className="w-full mt-3 text-xs"
          >
            Sync Latest Executions
          </Button>
        </div>
      </div>
    </div>
  );
}
