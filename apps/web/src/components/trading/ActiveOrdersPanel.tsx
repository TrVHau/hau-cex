import { useState } from 'react';
import {
  useActiveOrders,
  useOrders,
  useMyTrades,
  useWallets,
  useCancelOrder,
} from '../../hooks/useApi';
import { Button, Badge, Spinner, CoinIcon } from '../ui';
import {
  formatPrice,
  formatQty,
  formatDecimal,
  formatDateTime,
  parseApiError,
} from '../../lib/utils';
import type { Order, OrderStatus, OrderTrade, WalletBalance } from '../../types';
import Decimal from 'decimal.js';

interface Props {
  currentSymbol?: string;
  tickSize: string;
  basePrecision: number;
}

function getOrderStatusVariant(status: OrderStatus): 'green' | 'blue' | 'yellow' | 'red' | 'gray' {
  switch (status) {
    case 'FILLED':
      return 'green';
    case 'OPEN':
    case 'PARTIALLY_FILLED':
      return 'blue';
    case 'PENDING':
    case 'CANCEL_PENDING':
      return 'yellow';
    case 'CANCELLED':
    case 'REJECTED':
      return 'red';
    default:
      return 'gray';
  }
}

export function ActiveOrdersPanel({ currentSymbol, tickSize, basePrecision }: Props) {
  const [activeTab, setActiveTab] = useState<'OPEN' | 'HISTORY' | 'TRADES' | 'FUNDS'>('OPEN');
  const [hideOtherPairs, setHideOtherPairs] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { data: openOrders = [], isLoading: loadingOpen } = useActiveOrders();
  const { data: allOrders = [], isLoading: loadingHistory } = useOrders();
  const { data: myTrades = [], isLoading: loadingTrades } = useMyTrades(allOrders);
  const { data: balances = [], isLoading: loadingFunds } = useWallets();
  const cancelOrder = useCancelOrder();

  const handleCancel = async (orderId: string) => {
    setCancelError(null);
    try {
      await cancelOrder.mutateAsync(orderId);
    } catch (err) {
      setCancelError(parseApiError(err));
    }
  };

  const filterBySymbol = (symbol: string) => {
    if (hideOtherPairs && currentSymbol) {
      return symbol === currentSymbol;
    }
    return true;
  };

  const filteredOpenOrders = openOrders.filter((o) => filterBySymbol(o.symbol));
  const filteredHistoryOrders = allOrders.filter((o) => filterBySymbol(o.symbol));
  const filteredTrades = myTrades.filter((t) => !t.symbol || filterBySymbol(t.symbol));
  const currentPairAssets = currentSymbol ? currentSymbol.split('_') : [];
  const filteredFunds = balances.filter((b) => {
    if (hideOtherPairs && currentSymbol) {
      return currentPairAssets.includes(b.asset);
    }
    return true;
  });

  const renderOrderRows = (list: Order[], showStatus: boolean) => (
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
          {showStatus ? (
            <th className="py-2.5 px-4 font-medium text-right">STATUS</th>
          ) : (
            <th className="py-2.5 px-4 font-medium text-right">ACTION</th>
          )}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#1c212a] font-numeric">
        {list.map((o: Order, idx: number) => {
          const isBuy = o.side === 'BUY';
          const orderKey = o.id || (o as unknown as { orderId?: string }).orderId || `order-${idx}`;
          const canCancel = o.status === 'PENDING' || o.status === 'OPEN' || o.status === 'PARTIALLY_FILLED';
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
              <td className="py-2.5 px-3 font-bold text-white font-sans">
                <div className="flex items-center gap-2">
                  <CoinIcon symbol={o.symbol.split('_')[0] ?? o.symbol} size="xs" />
                  <span>{o.symbol}</span>
                </div>
              </td>
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
                {showStatus ? (
                  <Badge variant={getOrderStatusVariant(o.status)} size="sm">
                    {o.status}
                  </Badge>
                ) : o.status === 'CANCEL_PENDING' ? (
                  <Badge variant="yellow" size="sm">Cancelling...</Badge>
                ) : canCancel ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => { void handleCancel(o.id); }}
                    isLoading={cancelOrder.isPending && cancelOrder.variables === o.id}
                    className="text-[#f6465d] hover:text-[#f6465d] hover:bg-[#f6465d]/10 px-2"
                  >
                    Cancel
                  </Button>
                ) : (
                  <span className="text-[#5e6673]">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

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
            Open Orders ({filteredOpenOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Order History ({filteredHistoryOrders.length})
          </button>
          <button
            onClick={() => setActiveTab('TRADES')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'TRADES'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Trade History ({filteredTrades.length})
          </button>
          <button
            onClick={() => setActiveTab('FUNDS')}
            className={`pb-1 transition-colors cursor-pointer ${
              activeTab === 'FUNDS'
                ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                : 'text-[#848e9c] hover:text-[#eaecef]'
            }`}
          >
            Funds ({filteredFunds.length})
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
        {activeTab === 'OPEN' && (
          loadingOpen ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : filteredOpenOrders.length === 0 ? (
            <div className="p-8 text-center text-[#5e6673] text-xs">No open orders.</div>
          ) : (
            renderOrderRows(filteredOpenOrders, false)
          )
        )}

        {activeTab === 'HISTORY' && (
          loadingHistory ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : filteredHistoryOrders.length === 0 ? (
            <div className="p-8 text-center text-[#5e6673] text-xs">No order history found.</div>
          ) : (
            renderOrderRows(filteredHistoryOrders, true)
          )
        )}

        {activeTab === 'TRADES' && (
          loadingTrades ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : filteredTrades.length === 0 ? (
            <div className="p-8 text-center text-[#5e6673] text-xs">No executed trades yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#1c212a] text-left">
                  <th className="py-2.5 px-4 font-medium">TIME</th>
                  <th className="py-2.5 px-4 font-medium">PAIR</th>
                  <th className="py-2.5 px-4 font-medium">SIDE</th>
                  <th className="py-2.5 px-4 font-medium">ROLE</th>
                  <th className="py-2.5 px-4 font-medium text-right">PRICE</th>
                  <th className="py-2.5 px-4 font-medium text-right">AMOUNT</th>
                  <th className="py-2.5 px-4 font-medium text-right">FEE</th>
                  <th className="py-2.5 px-4 font-medium text-right">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a] font-numeric">
                {filteredTrades.map((t: OrderTrade) => {
                  const side = t.side ?? t.takerSide;
                  const isBuy = side === 'BUY';
                  return (
                    <tr key={`${t.id}-${t.orderId ?? ''}`} className="hover:bg-[#1a1e26] transition-colors">
                      <td className="py-2.5 px-4 text-[#848e9c]">{formatDateTime(t.matchedAt)}</td>
                      <td className="py-2.5 px-4 font-bold text-white font-sans">
                        {t.symbol ? (
                          <div className="flex items-center gap-2">
                            <CoinIcon symbol={t.symbol.split('_')[0] ?? t.symbol} size="xs" />
                            <span>{t.symbol}</span>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-bold font-sans">
                        <span className={isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{side}</span>
                      </td>
                      <td className="py-2.5 px-4 font-sans">
                        <Badge variant={t.role === 'MAKER' ? 'blue' : 'yellow'} size="sm">{t.role}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right text-white">{formatPrice(t.price, tickSize)}</td>
                      <td className="py-2.5 px-4 text-right text-white">{formatQty(t.quantity, basePrecision)}</td>
                      <td className="py-2.5 px-4 text-right text-[#848e9c]">{formatDecimal(t.fee, 6)}</td>
                      <td className="py-2.5 px-4 text-right font-medium text-white">{formatDecimal(t.quoteAmount, 2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}

        {activeTab === 'FUNDS' && (
          loadingFunds ? (
            <div className="p-8 flex justify-center"><Spinner /></div>
          ) : filteredFunds.length === 0 ? (
            <div className="p-8 text-center text-[#5e6673] text-xs">No wallet balances found.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#1c212a] text-left">
                  <th className="py-2.5 px-4 font-medium">ASSET</th>
                  <th className="py-2.5 px-4 font-medium text-right">AVAILABLE</th>
                  <th className="py-2.5 px-4 font-medium text-right">LOCKED IN ORDERS</th>
                  <th className="py-2.5 px-4 font-medium text-right">TOTAL BALANCE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a] font-numeric">
                {filteredFunds.map((b: WalletBalance) => (
                  <tr key={b.asset} className="hover:bg-[#1a1e26] transition-colors">
                    <td className="py-2.5 px-4 font-bold text-white font-sans">
                      <div className="flex items-center gap-2">
                        <CoinIcon symbol={b.asset} size="xs" />
                        <span>{b.asset}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#0ecb81] font-medium">
                      {formatDecimal(b.available, 8)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#f5b642]">
                      {formatDecimal(b.locked, 8)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-white">
                      {formatDecimal(b.total, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
