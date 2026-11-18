import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ListOrdered,
  Download,
  Plus,
  Clock,
  CheckCircle,
  Zap,
  DollarSign,
  Search,
  Filter,
  Activity,
} from 'lucide-react';
import { useOrders, useActiveOrders, useCancelOrder } from '../hooks/useApi';
import { Button, Badge, Spinner } from '../components/ui';
import { formatPrice, formatQty, formatDateTime, parseApiError } from '../lib/utils';
import type { Order } from '../types';
import Decimal from 'decimal.js';

export function OrdersPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY' | 'SUBSCRIPTIONS'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: activeOrders = [], isLoading: loadingActive } = useActiveOrders();
  const { data: allOrders = [], isLoading: loadingAll } = useOrders();
  const cancelOrder = useCancelOrder();

  const handleCancel = async (orderId: string) => {
    setCancelError(null);
    try {
      await cancelOrder.mutateAsync(orderId);
    } catch (err) {
      setCancelError(parseApiError(err));
    }
  };

  const displayedOrders = activeTab === 'ACTIVE' ? activeOrders : allOrders;
  const filteredOrders = displayedOrders.filter((o) =>
    o.symbol.toLowerCase().includes(search.toLowerCase()) ||
    o.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold text-white tracking-tight">
            <ListOrdered className="w-6 h-6 text-[#f5b642]" />
            Order Management
          </div>
          <p className="text-xs text-[#848e9c] mt-1">
            Track and manage your active limit orders and complete trade execution history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" className="text-xs">
            <Download className="w-3.5 h-3.5 text-[#848e9c]" />
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/trade/BTC_USDT')}
            className="text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Order
          </Button>
        </div>
      </div>

      {/* ─── Top 4 Stat Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#5e6673]" />
              OPEN ORDERS
            </span>
            <span className="text-[11px] text-[#0ecb81] font-semibold font-numeric">+{activeOrders.length}</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">{activeOrders.length}</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#5e6673]" />
              EXECUTION RATE (30D)
            </span>
            <span className="text-[11px] text-[#0ecb81] font-semibold font-numeric">+0.8%</span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">92.4%</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#5e6673]" />
              AVG. FILL TIME
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">12.4s</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-[#5e6673]" />
              PENDING VOLUME
            </span>
          </div>
          <div className="text-2xl font-bold text-white font-numeric mt-2">$34,945</div>
        </div>
      </div>

      {/* ─── Orders Table Card ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        {/* Controls */}
        <div className="p-4 border-b border-[#232933] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-[#0b0e11] p-1 rounded-lg border border-[#1c212a] w-fit">
            <button
              onClick={() => setActiveTab('ACTIVE')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'ACTIVE'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              ACTIVE ORDERS ({activeOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('HISTORY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              ORDER HISTORY
            </button>
            <button
              onClick={() => setActiveTab('SUBSCRIPTIONS')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'SUBSCRIPTIONS'
                  ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              SUBSCRIPTIONS
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search pair or Order ID..."
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

        {cancelError && (
          <div className="p-2 bg-[#f6465d]/10 text-[#f6465d] text-xs px-4 border-b border-[#f6465d]/20">
            {cancelError}
          </div>
        )}

        {/* Table */}
        {loadingActive || loadingAll ? (
          <div className="p-12 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-numeric">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#1c212a] text-left font-sans">
                  <th className="py-3 px-4 font-medium">DATE / TIME</th>
                  <th className="py-3 px-4 font-medium">PAIR</th>
                  <th className="py-3 px-4 font-medium">TYPE</th>
                  <th className="py-3 px-4 font-medium">SIDE</th>
                  <th className="py-3 px-4 font-medium text-right">PRICE</th>
                  <th className="py-3 px-4 font-medium text-right">AMOUNT</th>
                  <th className="py-3 px-4 font-medium text-right">FILLED</th>
                  <th className="py-3 px-4 font-medium text-right">TOTAL (USDT)</th>
                  <th className="py-3 px-4 font-medium text-right font-sans">STATUS</th>
                  <th className="py-3 px-4 font-medium text-right font-sans">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-10 text-center text-[#5e6673] font-sans">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o: Order) => {
                    const isBuy = o.side === 'BUY';
                    let total = '0.00';
                    let filledPct = '0%';
                    try {
                      total = new Decimal(o.price).mul(new Decimal(o.quantity)).toFixed(2);
                      filledPct = new Decimal(o.filledQty)
                        .div(new Decimal(o.quantity))
                        .mul(100)
                        .toFixed(0) + '%';
                    } catch {
                      // ignore
                    }

                    return (
                      <tr key={o.id} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4 text-[#848e9c]">
                          {formatDateTime(o.createdAt)}
                        </td>
                        <td className="py-3 px-4 font-bold text-white font-sans">{o.symbol}</td>
                        <td className="py-3 px-4 text-[#eaecef] font-sans">{o.type}</td>
                        <td className="py-3 px-4 font-bold font-sans">
                          <span className={isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                            {o.side}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-white font-medium">
                          {formatPrice(o.price)}
                        </td>
                        <td className="py-3 px-4 text-right text-white">
                          {formatQty(o.quantity)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#848e9c]">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-[#1e232d] overflow-hidden">
                              <div
                                className="h-full bg-[#f5b642] rounded-full"
                                style={{ width: filledPct }}
                              />
                            </div>
                            <span>{filledPct}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">${total}</td>
                        <td className="py-3 px-4 text-right font-sans">
                          <Badge
                            variant={
                              o.status === 'FILLED'
                                ? 'green'
                                : o.status === 'CANCELLED'
                                ? 'red'
                                : o.status === 'PARTIALLY_FILLED'
                                ? 'yellow'
                                : 'blue'
                            }
                            size="sm"
                          >
                            {o.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          {(o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED') && (
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => { void handleCancel(o.id); }}
                              isLoading={cancelOrder.isPending && cancelOrder.variables === o.id}
                              className="text-[#f6465d] hover:text-[#f6465d] hover:bg-[#f6465d]/10 px-2"
                            >
                              Cancel
                            </Button>
                          )}
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

      {/* ─── Bottom Panels: Execution Settings & Frequently Traded Pairs ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-white mb-1">Execution Settings</div>
            <p className="text-xs text-[#848e9c] mb-4">
              Configure how your orders are executed across the exchange.
            </p>
            <div className="space-y-3">
              <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Post-Only Mode</div>
                  <div className="text-[10px] text-[#848e9c]">Ensures your limit orders are always added as maker.</div>
                </div>
                <input type="checkbox" defaultChecked className="accent-[#f5b642] w-4 h-4 cursor-pointer" />
              </div>
              <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">Time-In-Force (TIF)</div>
                  <div className="text-[10px] text-[#848e9c]">Good 'Til Canceled is the default behavior.</div>
                </div>
                <Badge variant="yellow" size="sm">GTC</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="text-sm font-bold text-white mb-1">Frequently Traded Pairs</div>
            <p className="text-xs text-[#848e9c] mb-4">Trading volume distribution across your last 100 orders.</p>
            <div className="space-y-3 font-numeric text-xs">
              <div>
                <div className="flex justify-between text-[#eaecef] mb-1">
                  <span className="font-sans font-bold">BTC/USDT</span>
                  <span className="text-[#0ecb81]">+$42k (Vol: $1.2M)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1b2028] overflow-hidden">
                  <div className="h-full bg-[#f5b642] w-[75%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[#eaecef] mb-1">
                  <span className="font-sans font-bold">ETH/USDT</span>
                  <span className="text-[#0ecb81]">+$12k (Vol: $840k)</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#1b2028] overflow-hidden">
                  <div className="h-full bg-[#3b82f6] w-[55%]" />
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#5e6673] pt-3 border-t border-[#1c212a] mt-4">
            <span className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-[#0ecb81]" />
              Match Engine Status: Operational (2ms Latency)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
