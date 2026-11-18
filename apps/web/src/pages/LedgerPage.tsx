import { useState } from 'react';
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
  ExternalLink,
} from 'lucide-react';
import { useLedger } from '../hooks/useApi';
import { Button, Badge, Spinner } from '../components/ui';
import { formatDecimal, formatDateTime } from '../lib/utils';
import type { LedgerEntry } from '../types';

export function LedgerPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL' | 'TRADE' | 'FEE'>('ALL');
  const [search, setSearch] = useState('');

  const { data: ledger = [], isLoading } = useLedger();

  const filteredLedger = ledger.filter((entry) => {
    const matchesSearch =
      entry.asset.toLowerCase().includes(search.toLowerCase()) ||
      entry.id.toLowerCase().includes(search.toLowerCase()) ||
      entry.operationId.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'DEPOSIT') return entry.entryType === 'DEPOSIT';
    if (activeTab === 'WITHDRAWAL') return entry.entryType === 'WITHDRAWAL';
    if (activeTab === 'TRADE') return entry.entryType === 'TRADE_CREDIT' || entry.entryType === 'TRADE_DEBIT';
    if (activeTab === 'FEE') return entry.entryType === 'FEE';
    return true;
  });

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
          <Button variant="secondary" size="sm" className="text-xs">
            <Calendar className="w-3.5 h-3.5 text-[#848e9c]" />
            Filter Date
          </Button>
          <Button variant="secondary" size="sm" className="text-xs">
            <Download className="w-3.5 h-3.5 text-[#848e9c]" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ─── Top 4 Stat Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>TOTAL DEPOSITS (30D)</span>
            <ArrowDownLeft className="w-3.5 h-3.5 text-[#0ecb81]" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">$142,500.00</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>TOTAL WITHDRAWALS (30D)</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#f6465d]" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">$68,120.45</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>NET MOVEMENT</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#0ecb81]" />
          </div>
          <div className="text-2xl font-bold text-[#0ecb81] font-numeric mt-2">+$74,379.55</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>PENDING VERIFICATION</span>
            <Clock className="w-3.5 h-3.5 text-[#f5b642]" />
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">0 Entries</div>
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
              {(['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRADE', 'FEE'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {tab === 'ALL' ? 'ALL' : tab === 'TRADE' ? 'TRANSFERS' : `${tab}S`}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ID, Hash or Asset..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none w-52"
              />
            </div>
            <button className="p-2 rounded-lg bg-[#1b2028] border border-[#282f3c] text-[#848e9c] hover:text-[#eaecef] cursor-pointer">
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
                  <th className="py-3 px-4 font-medium">TIMESTAMP / ID</th>
                  <th className="py-3 px-4 font-medium">TYPE</th>
                  <th className="py-3 px-4 font-medium">ASSET</th>
                  <th className="py-3 px-4 font-medium text-right">AMOUNT</th>
                  <th className="py-3 px-4 font-medium font-sans">STATUS</th>
                  <th className="py-3 px-4 font-medium font-sans">DETAILS / DESTINATION</th>
                  <th className="py-3 px-4 font-medium font-sans text-right">TX HASH</th>
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
                    const isCredit = entry.entryType === 'DEPOSIT' || entry.entryType === 'TRADE_CREDIT';
                    const isDebit = entry.entryType === 'WITHDRAWAL' || entry.entryType === 'TRADE_DEBIT' || entry.entryType === 'FEE';

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
                              entry.entryType === 'DEPOSIT'
                                ? 'green'
                                : entry.entryType === 'WITHDRAWAL'
                                ? 'red'
                                : entry.entryType === 'FEE'
                                ? 'yellow'
                                : 'blue'
                            }
                            size="sm"
                          >
                            {entry.entryType}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-bold text-white font-sans">{entry.asset}</td>
                        <td
                          className={`py-3 px-4 text-right font-bold ${
                            isCredit ? 'text-[#0ecb81]' : isDebit ? 'text-[#f6465d]' : 'text-white'
                          }`}
                        >
                          {isCredit ? '+' : isDebit ? '-' : ''}
                          {formatDecimal(entry.amount, 6)}
                        </td>
                        <td className="py-3 px-4 font-sans">
                          <Badge variant="green" size="sm">COMPLETED</Badge>
                        </td>
                        <td className="py-3 px-4 text-[#848e9c] font-sans">
                          {entry.entryType === 'FEE'
                            ? 'Internal Exchange Fee'
                            : entry.operationId
                            ? `Ref: ${entry.operationId.slice(0, 12)}...`
                            : 'Standard Settlement'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[#f5b642] text-[11px]">
                          <span className="flex items-center justify-end gap-1 hover:underline cursor-pointer">
                            0x{entry.id.slice(0, 6)}...{entry.id.slice(-4)}
                            <ExternalLink className="w-3 h-3" />
                          </span>
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
              Every entry in your HAU-CEX ledger is cryptographically hashed and linked to our on-chain proof-of-reserves. For enterprise auditing or tax reporting, you can generate a signed PDF export of your entire history using the Export tool above.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1c212a]">
            <a href="#settlement" className="text-xs font-semibold text-[#f5b642] hover:underline">
              Learn about our Settlement Engine →
            </a>
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-[10px] text-[#848e9c] uppercase tracking-wider font-semibold mb-3">
              ASSET SUMMARY (LAST 30D)
            </div>
            <div className="space-y-3 font-numeric text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#f5b642]" />
                  <span className="text-white font-sans font-semibold">BTC</span>
                </div>
                <span className="text-[#0ecb81] font-bold">+0.45 BTC</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#0ecb81]" />
                  <span className="text-white font-sans font-semibold">USDT</span>
                </div>
                <span className="text-[#f6465d] font-bold">-1,240.50 USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                  <span className="text-white font-sans font-semibold">ETH</span>
                </div>
                <span className="text-[#0ecb81] font-bold">+4.12 ETH</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
