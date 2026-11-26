import { useState } from 'react';
import Decimal from 'decimal.js';
import {
  FileText,
  Calendar,
  Download,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useLedger } from '../hooks/useApi';
import { Button, Badge, Spinner, CoinIcon } from '../components/ui';
import { formatDecimal, formatDateTime, downloadCsv } from '../lib/utils';
import type { LedgerEntry } from '../types';

type DateRangeFilter = 'ALL' | '24H' | '7D' | '30D';
const DATE_RANGE_LABELS: Record<DateRangeFilter, string> = {
  ALL: 'All Time',
  '24H': 'Last 24H',
  '7D': 'Last 7D',
  '30D': 'Last 30D',
};

export function LedgerPage() {
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'DEPOSIT' | 'WITHDRAW' | 'TRANSFER' | 'LOCK' | 'TRADE' | 'FEE'
  >('ALL');
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'AVAILABLE' | 'LOCKED'>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL');
  const [search, setSearch] = useState('');

  const { data: ledger = [], isLoading } = useLedger();

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

  const dateFilteredLedger = ledger.filter((entry) => {
    if (maxAgeMs === null) return true;
    const ts = new Date(entry.createdAt).getTime();
    return Number.isFinite(ts) && nowMs - ts <= maxAgeMs;
  });

  const filteredLedger = dateFilteredLedger.filter((entry) => {
    const q = search.toLowerCase();
    const matchesSearch =
      entry.asset.toLowerCase().includes(q) ||
      entry.id.toLowerCase().includes(q) ||
      entry.operationId.toLowerCase().includes(q) ||
      (entry.referenceId ?? '').toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (balanceFilter !== 'ALL' && entry.balanceType !== balanceFilter) return false;
    if (activeTab === 'DEPOSIT') return entry.entryType === 'DEPOSIT' || entry.entryType === 'INITIAL_BALANCE';
    if (activeTab === 'WITHDRAW') return entry.entryType === 'WITHDRAWAL';
    if (activeTab === 'TRANSFER') {
      return entry.entryType === 'INTERNAL_TRANSFER_IN' || entry.entryType === 'INTERNAL_TRANSFER_OUT';
    }
    if (activeTab === 'LOCK') return entry.entryType === 'ORDER_LOCK' || entry.entryType === 'ORDER_UNLOCK';
    if (activeTab === 'TRADE') return entry.entryType === 'TRADE_SETTLEMENT';
    if (activeTab === 'FEE') return entry.entryType === 'TRADING_FEE';
    return true;
  });

  // Real summary statistics computed with Decimal.js
  let creditEntries = 0;
  let debitEntries = 0;
  let feeEntries = 0;
  let usdtNetMovement = new Decimal(0);
  const assetNetTotals: Record<string, Decimal> = {};

  dateFilteredLedger.forEach((entry) => {
    try {
      const amt = new Decimal(entry.amount);
      if (amt.gt(0)) creditEntries += 1;
      if (amt.lt(0)) debitEntries += 1;
      if (entry.entryType === 'TRADING_FEE') feeEntries += 1;

      if (entry.balanceType === 'AVAILABLE') {
        if (entry.asset === 'USDT') {
          usdtNetMovement = usdtNetMovement.add(amt);
        }
        assetNetTotals[entry.asset] = (assetNetTotals[entry.asset] ?? new Decimal(0)).add(amt);
      }
    } catch {
      // ignore invalid decimal
    }
  });

  const handleExportCsv = () => {
    downloadCsv(
      `hau-cex-ledger-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'ID',
        'Timestamp',
        'EntryType',
        'BalanceType',
        'Asset',
        'Amount',
        'BeforeBalance',
        'BalanceAfter',
        'ReferenceType',
        'ReferenceID',
        'OperationID',
      ],
      filteredLedger.map((entry) => [
        entry.id,
        entry.createdAt,
        entry.entryType,
        entry.balanceType,
        entry.asset,
        entry.amount,
        entry.beforeBalance,
        entry.balanceAfter,
        entry.referenceType ?? '',
        entry.referenceId ?? '',
        entry.operationId,
      ]),
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold text-white tracking-tight">
            <FileText className="w-6 h-6 text-[#f5b642]" />
            Financial Ledger
          </div>
          <p className="text-xs text-[#848e9c] mt-1">
            Detailed transaction log for audit, tax, and portfolio tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" onClick={cycleDateRange} className="text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#f5b642]" />
            {DATE_RANGE_LABELS[dateRange]}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCsv}
            disabled={filteredLedger.length === 0}
            className="text-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#848e9c]" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ─── Top 4 Stat Cards (Real Ledger Metrics) ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>CREDITS (+)</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#0ecb81]" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">{creditEntries} Entries</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>DEBITS (-)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#f6465d]" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">{debitEntries} Entries</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>NET AVAILABLE USDT</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#0ecb81]" />
          </div>
          <div
            className={`text-2xl font-bold font-numeric mt-2 ${
              usdtNetMovement.gte(0) ? 'text-[#0ecb81]' : 'text-[#f6465d]'
            }`}
          >
            {usdtNetMovement.gte(0) ? '+' : ''}
            {usdtNetMovement.toFixed(2)} USDT
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>TRADING FEE ENTRIES</span>
            <Clock className="w-3.5 h-3.5 text-[#f5b642]" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">{feeEntries} Entries</div>
        </div>
      </div>

      {/* ─── Transaction Journal Table Card ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-[#232933] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">Transaction Journal</span>
            <Badge variant="gray" size="sm">{filteredLedger.length} TOTAL</Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-[#0b0e11] p-1 rounded-lg border border-[#1c212a]">
              {(['ALL', 'DEPOSIT', 'WITHDRAW', 'TRANSFER', 'LOCK', 'TRADE', 'FEE'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {tab === 'ALL'
                    ? 'ALL'
                    : tab === 'TRADE'
                      ? 'TRADES'
                      : tab === 'WITHDRAW'
                        ? 'WITHDRAWS'
                        : `${tab}S`}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, Ref or Asset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none w-52"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setBalanceFilter((prev) =>
                  prev === 'ALL' ? 'AVAILABLE' : prev === 'AVAILABLE' ? 'LOCKED' : 'ALL',
                )
              }
              title={`Lọc Balance Type (hiện tại: ${balanceFilter})`}
              className="px-2.5 py-1.5 rounded-lg bg-[#1b2028] border border-[#282f3c] text-xs text-[#848e9c] hover:text-[#eaecef] cursor-pointer inline-flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{balanceFilter}</span>
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
                  <th className="py-3 px-4 font-medium">TIMESTAMP / ID</th>
                  <th className="py-3 px-4 font-medium">TYPE</th>
                  <th className="py-3 px-4 font-medium">WALLET BUCKET</th>
                  <th className="py-3 px-4 font-medium">ASSET</th>
                  <th className="py-3 px-4 font-medium text-right">AMOUNT</th>
                  <th className="py-3 px-4 font-medium text-right">BEFORE → AFTER</th>
                  <th className="py-3 px-4 font-medium font-sans text-right">REFERENCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-[#5e6673] font-sans">
                      No ledger transactions recorded.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry: LedgerEntry) => {
                    let isCredit = false;
                    let isDebit = false;
                    try {
                      const d = new Decimal(entry.amount);
                      isCredit = d.gt(0);
                      isDebit = d.lt(0);
                    } catch {
                      // ignore
                    }

                    return (
                      <tr key={entry.id} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4">
                          <div className="text-white font-medium">{formatDateTime(entry.createdAt)}</div>
                          <div className="text-[10px] text-[#5e6673] font-mono">
                            LDG-{entry.id.slice(0, 8)}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge
                            variant={
                              entry.entryType === 'DEPOSIT' || entry.entryType === 'INITIAL_BALANCE'
                                ? 'green'
                                : entry.entryType === 'ORDER_LOCK'
                                ? 'red'
                                : entry.entryType === 'TRADING_FEE'
                                ? 'yellow'
                                : 'blue'
                            }
                            size="sm"
                          >
                            {entry.entryType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge
                            variant={entry.balanceType === 'AVAILABLE' ? 'gray' : 'yellow'}
                            size="sm"
                          >
                            {entry.balanceType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-white font-sans">
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={entry.asset} size="xs" />
                            <span>{entry.asset}</span>
                          </div>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            isCredit ? 'text-[#0ecb81]' : isDebit ? 'text-[#f6465d]' : 'text-white'
                          }`}
                        >
                          {isCredit ? '+' : ''}
                          {formatDecimal(entry.amount, 6)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#848e9c]">
                          {formatDecimal(entry.beforeBalance, 4)} →{' '}
                          <span className="text-[#eaecef]">{formatDecimal(entry.balanceAfter, 4)}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#848e9c] text-[11px]">
                          <div>{entry.referenceType ?? 'OP'}</div>
                          <div className="text-[10px] text-[#5e6673]">
                            {(entry.referenceId ?? entry.operationId).slice(0, 12)}...
                          </div>
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

      {/* ─── Bottom Section: Immutable Ledger Verification & Asset Summary ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
              <ShieldCheck className="w-4 h-4 text-[#f5b642]" />
              Immutable Ledger Verification
            </div>
            <p className="text-xs text-[#848e9c] leading-relaxed">
              Every balance mutation in HAU-CEX records exact <span className="text-[#eaecef]">beforeBalance</span> and{' '}
              <span className="text-[#eaecef]">balanceAfter</span> snapshots for both AVAILABLE and LOCKED buckets.
              Use the Export CSV button above to download filtered audit logs.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1c212a] text-xs text-[#5e6673]">
            Window: {DATE_RANGE_LABELS[dateRange]} • Showing {filteredLedger.length} of {ledger.length} entries
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold mb-3">
              AVAILABLE ASSET NET MOVEMENT ({DATE_RANGE_LABELS[dateRange].toUpperCase()})
            </div>
            <div className="space-y-3 font-numeric text-xs">
              {Object.entries(assetNetTotals).length === 0 ? (
                <div className="text-[#5e6673] font-sans">Chưa có biến động số dư khả dụng.</div>
              ) : (
                Object.entries(assetNetTotals).map(([asset, net]) => (
                  <div key={asset} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CoinIcon symbol={asset} size="xs" />
                      <span className="text-white font-sans font-semibold">{asset}</span>
                    </div>
                    <span className={`font-bold ${net.gte(0) ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {net.gte(0) ? '+' : ''}
                      {net.toFixed(6)} {asset}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
