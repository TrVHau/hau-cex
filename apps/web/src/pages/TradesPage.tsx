import { useState } from 'react';
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
import { useOrders } from '../hooks/useApi';
import { Button, Badge, Spinner } from '../components/ui';
import { formatPrice, formatQty, formatDateTime } from '../lib/utils';
import type { Order } from '../types';
import Decimal from 'decimal.js';

export function TradesPage() {
  const [activeTab, setActiveTab] = useState<'ALL' | 'SPOT' | 'MARGIN'>('ALL');
  const [subTab, setSubTab] = useState<'EXECUTED' | 'PNL' | 'LOG'>('EXECUTED');
  const [search, setSearch] = useState('');

  const { data: allOrders = [], isLoading, refetch } = useOrders();

  // Lọc các order đã FILLED (các lệnh đã khớp thành công)
  const executedTrades = allOrders.filter(
    (o) => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED'
  );

  const filteredTrades = executedTrades.filter((t) =>
    t.symbol.toLowerCase().includes(search.toLowerCase()) ||
    t.id.toLowerCase().includes(search.toLowerCase())
  );

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
            A comprehensive record of all executed trades across spot and margin accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" className="text-xs">
            <Clock className="w-3.5 h-3.5 text-[#848e9c]" />
            Last 30 Days
          </Button>
          <Button variant="secondary" size="sm" className="text-xs">
            <Download className="w-3.5 h-3.5 text-[#848e9c]" />
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => { void refetch(); }}
            className="text-xs"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* ─── Top 4 Stat Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>TOTAL TRADES (30D)</span>
            <span className="text-[11px] text-[#0ecb81] font-semibold font-numeric">+12.5%</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">
            {executedTrades.length || 1248}
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>WINNING TRADES</span>
            <span className="text-[11px] text-[#0ecb81] font-semibold font-numeric">+2.1%</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">72%</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>AVG TRADE DURATION</span>
            <span className="text-[11px] text-[#f6465d] font-semibold font-numeric">-5.2%</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">4h 12m</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span>TOTAL PNL (30D)</span>
            <span className="text-[11px] text-[#0ecb81] font-semibold font-numeric">+8.4%</span>
          </div>
          <div className="text-2xl font-bold text-[#0ecb81] font-numeric mt-2">+$14,250.80</div>
        </div>
      </div>

      {/* ─── Trades Table Card ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-[#232933] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Primary filter tabs */}
            <div className="flex items-center gap-1 bg-[#0b0e11] p-1 rounded-lg border border-[#1c212a]">
              {(['ALL', 'SPOT', 'MARGIN'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === tab
                      ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                      : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-3 text-xs font-semibold pl-3 border-l border-[#232933]">
              <button
                onClick={() => setSubTab('EXECUTED')}
                className={`cursor-pointer ${
                  subTab === 'EXECUTED' ? 'text-[#f5b642]' : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                Executed Trades
              </button>
              <button
                onClick={() => setSubTab('PNL')}
                className={`cursor-pointer ${
                  subTab === 'PNL' ? 'text-[#f5b642]' : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                PnL History
              </button>
              <button
                onClick={() => setSubTab('LOG')}
                className={`cursor-pointer ${
                  subTab === 'LOG' ? 'text-[#f5b642]' : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                Detailed Log
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by pair or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none w-56"
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
                  <th className="py-3 px-4 font-medium">TIME</th>
                  <th className="py-3 px-4 font-medium">TRADING PAIR</th>
                  <th className="py-3 px-4 font-medium">SIDE</th>
                  <th className="py-3 px-4 font-medium">ORDER TYPE</th>
                  <th className="py-3 px-4 font-medium text-right">PRICE</th>
                  <th className="py-3 px-4 font-medium text-right">AMOUNT</th>
                  <th className="py-3 px-4 font-medium text-right">FEE</th>
                  <th className="py-3 px-4 font-medium text-right">TOTAL (USDT)</th>
                  <th className="py-3 px-4 font-medium text-right font-sans">STATUS</th>
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
                  filteredTrades.map((t: Order) => {
                    const isBuy = t.side === 'BUY';
                    let total = '0.00';
                    let fee = '0.00';
                    try {
                      total = new Decimal(t.price).mul(new Decimal(t.filledQty || t.quantity)).toFixed(2);
                      fee = new Decimal(total).mul(0.001).toFixed(2);
                    } catch {
                      // ignore
                    }

                    return (
                      <tr key={t.id} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4 text-[#848e9c]">
                          {formatDateTime(t.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-white font-sans">{t.symbol}</td>
                        <td className="py-3 px-4 font-sans">
                          <Badge variant={isBuy ? 'green' : 'red'} size="sm">
                            {t.side}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-[#eaecef] font-sans">{t.type}</td>
                        <td className="py-3 px-4 text-right text-white font-medium">
                          {formatPrice(t.price)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatQty(t.filledQty || t.quantity)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#848e9c]">{fee} USDT</td>
                        <td className="py-3 px-4 text-right font-bold text-white">${total}</td>
                        <td className="py-3 px-4 text-right font-sans">
                          <Badge variant="green" size="sm">FILLED</Badge>
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

      {/* ─── Bottom Panels: Weekly Insights & Advanced Tools ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <TrendingUp className="w-4 h-4 text-[#f5b642]" />
              Weekly Trading Insights
            </div>
            <p className="text-xs text-[#848e9c] mb-4">Analysis based on your trade patterns from May 14 - May 20.</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1">
                  BEST PERFORMING PAIR
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-base">BTC/USDT</span>
                  <span className="text-xs font-semibold text-[#0ecb81] font-numeric">+12.4% Avg Profit</span>
                </div>
              </div>

              <div className="p-3.5 bg-[#1b2028] rounded-lg border border-[#282f3c]">
                <div className="text-[10px] text-[#848e9c] uppercase tracking-wider mb-1">
                  TRADING ACTIVITY PEAK
                </div>
                <div className="font-bold text-white text-base font-numeric">
                  14:00 - 16:00 UTC <span className="text-xs font-normal text-[#848e9c]">(64% of vol)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#5e6673] mt-4 pt-3 border-t border-[#1c212a]">
            Your win rate has increased by <span className="text-[#0ecb81] font-semibold">4.2%</span> this week. Average trading fee remains optimal at 0.12%.
          </div>
        </div>

        <div className="lg:col-span-4 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-white mb-3">Advanced Tools</div>
            <div className="space-y-2.5">
              <div className="p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between cursor-pointer hover:border-[#363d4a] transition-colors">
                <div className="flex items-center gap-2.5">
                  <RotateCw className="w-4 h-4 text-[#f5b642]" />
                  <div>
                    <div className="text-xs font-semibold text-white">Reconcile Account</div>
                    <div className="text-[10px] text-[#848e9c]">Verify trade-to-ledger consistency</div>
                  </div>
                </div>
                <span className="text-xs text-[#848e9c]">→</span>
              </div>

              <div className="p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between cursor-pointer hover:border-[#363d4a] transition-colors">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#0ecb81]" />
                  <div>
                    <div className="text-xs font-semibold text-white">Tax Statement</div>
                    <div className="text-[10px] text-[#848e9c]">Generate annual financial report</div>
                  </div>
                </div>
                <span className="text-xs text-[#848e9c]">→</span>
              </div>
            </div>
          </div>

          <Button variant="secondary" size="sm" className="w-full mt-3 text-xs">
            Sync External API Data
          </Button>
        </div>
      </div>
    </div>
  );
}
