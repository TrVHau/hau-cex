import { useState } from 'react';
import { useActiveOrders, useCancelOrder } from '../../hooks/useApi';
import { Button, Spinner } from '../ui';
import { formatPrice, formatQty, formatDateTime, parseApiError } from '../../lib/utils';
import type { Order } from '../../types';
import Decimal from 'decimal.js';

interface Props {
  currentSymbol?: string;
  tickSize: string;
  basePrecision: number;
}

export function ActiveOrdersPanel({ currentSymbol, tickSize, basePrecision }: Props) {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'HISTORY' | 'TRADES' | 'FUNDS'>('OPEN');
  const [hideOtherPairs, setHideOtherPairs] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useActiveOrders();
  const cancelOrder = useCancelOrder();

  const handleCancel = async (orderId: string) => {
    setCancelError(null);
    try {
      await cancelOrder.mutateAsync(orderId);
    } catch (err) {
      setCancelError(parseApiError(err));
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (hideOtherPairs && currentSymbol) {
      return o.symbol === currentSymbol;
    }
    return true;
  });

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden flex flex-col">
      {/* Tabs & Controls */}
      <div className="px-4 py-2.5 border-b border-[#232933] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('OPEN')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'OPEN'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Open Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Order History
          </button>
          <button
            onClick={() => setActiveTab('TRADES')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'TRADES'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Trade History
          </button>
          <button
            onClick={() => setActiveTab('FUNDS')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'FUNDS'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Funds
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 text-[#848e9c] hover:text-[#eaecef] cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideOtherPairs}
              onChange={(e) => setHideOtherPairs(e.target.checked)}
              className="accent-[#f5b642] rounded"
            />
            <span>HIDE OTHER PAIRS</span>
          </label>
        </div>
      </div>

      {cancelError && (
        <div className="p-2 bg-[#f6465d]/10 text-[#f6465d] text-xs px-4 border-b border-[#f6465d]/20">
          {cancelError}
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto min-h-[140px]">
        {isLoading ? (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-[#5e6673] text-xs">
            No open orders.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#848e9c] border-b border-[#1c212a] text-left">
                <th className="py-2.5 px-4 font-medium">DATE</th>
                <th className="py-2.5 px-4 font-medium">PAIR</th>
                <th className="py-2.5 px-4 font-medium">TYPE</th>
                <th className="py-2.5 px-4 font-medium">SIDE</th>
                <th className="py-2.5 px-4 font-medium text-right">PRICE</th>
                <th className="py-2.5 px-4 font-medium text-right">AMOUNT</th>
                <th className="py-2.5 px-4 font-medium text-right">FILLED</th>
                <th className="py-2.5 px-4 font-medium text-right">TOTAL</th>
                <th className="py-2.5 px-4 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c212a] font-numeric">
              {filteredOrders.map((o: Order, idx: number) => {
                const isBuy = o.side === 'BUY';
                const orderKey = o.id || (o as unknown as { orderId?: string }).orderId || `order-${idx}`;
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
                  <tr key={orderKey} className="hover:bg-[#1a1e26] transition-colors">
                    <td className="py-2.5 px-3 text-[#848e9c]">
                      {formatDateTime(o.createdAt).split(' ')[1] ?? formatDateTime(o.createdAt)}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white font-sans">{o.symbol}</td>
                    <td className="py-2.5 px-3 text-[#eaecef] font-sans">{o.type}</td>
                    <td className="py-2.5 px-3 font-bold font-sans">
                      <span className={isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                        {o.side}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-white">
                      {formatPrice(o.price, tickSize)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-white">
                      {formatQty(o.quantity, basePrecision)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#848e9c]">
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
                    <td className="py-2.5 px-3 text-right font-medium text-white">{total}</td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => { void handleCancel(o.id); }}
                        isLoading={cancelOrder.isPending && cancelOrder.variables === o.id}
                        className="text-[#f6465d] hover:text-[#f6465d] hover:bg-[#f6465d]/10 px-2"
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
