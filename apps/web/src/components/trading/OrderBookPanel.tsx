import { useOrderBook } from '../../hooks/useApi';
import { Spinner } from '../ui';
import { formatPrice, formatQty } from '../../lib/utils';
import type { OrderBookLevel } from '../../types';
import Decimal from 'decimal.js';

interface Props {
  symbol: string;
  tickSize: string;
  basePrecision: number;
}

function calculateTotal(price: string, qty: string): string {
  try {
    return new Decimal(price).mul(new Decimal(qty)).toFixed(2);
  } catch {
    return '0.00';
  }
}

export function OrderBookPanel({ symbol, tickSize, basePrecision }: Props) {
  const { data: orderBook, isLoading } = useOrderBook(symbol);

  if (isLoading) {
    return (
      <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 h-full flex flex-col justify-center items-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  const rawAsks = orderBook?.asks ?? [];
  const rawBids = orderBook?.bids ?? [];

  // Asks hiển thị đảo ngược để giá thấp nhất ở gần giữa
  const asks = [...rawAsks].slice(0, 10).reverse();
  const bids = rawBids.slice(0, 10);

  const maxQty = Math.max(
    ...asks.map((a) => parseFloat(a.quantity) || 0),
    ...bids.map((b) => parseFloat(b.quantity) || 0),
    1,
  );

  const bestAsk = asks[asks.length - 1]?.price;
  const bestBid = bids[0]?.price;
  const midPrice = bestBid ?? bestAsk ?? '64,231.50';

  let spread = '1.2';
  let spreadPct = '0.01%';
  if (bestAsk && bestBid) {
    try {
      const askDec = new Decimal(bestAsk);
      const bidDec = new Decimal(bestBid);
      const diff = askDec.sub(bidDec);
      spread = diff.toFixed(1);
      spreadPct = diff.div(askDec).mul(100).toFixed(2) + '%';
    } catch {
      // ignore
    }
  }

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-3 flex flex-col justify-between text-xs font-numeric select-none">
      <div className="flex items-center justify-between font-sans text-xs font-bold text-white mb-2 px-1">
        <span>ORDER BOOK</span>
        <div className="flex items-center gap-1 text-[11px] text-[#5e6673]">
          <span className="w-2 h-2 rounded-full bg-[#0ecb81]" />
          <span>Real-time</span>
        </div>
      </div>

      {/* Header labels */}
      <div className="grid grid-cols-3 text-[10px] text-[#5e6673] px-1 py-1 border-b border-[#1c212a] uppercase font-sans">
        <span>PRICE (USDT)</span>
        <span className="text-right">AMOUNT</span>
        <span className="text-right">TOTAL</span>
      </div>

      {/* Asks (Sell Orders - Red) */}
      <div className="space-y-0.5 py-1">
        {asks.map((level: OrderBookLevel, idx: number) => {
          const qty = parseFloat(level.quantity) || 0;
          const barWidth = Math.min(100, Math.max(5, (qty / maxQty) * 100));
          return (
            <div
              key={`ask-${idx}`}
              className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-[#1e232d] transition-colors rounded-sm cursor-pointer"
            >
              <div
                className="absolute right-0 inset-y-0 bg-[#f6465d]/12 pointer-events-none rounded-sm"
                style={{ width: `${barWidth}%` }}
              />
              <span className="text-[#f6465d] font-semibold relative z-10">
                {formatPrice(level.price, tickSize)}
              </span>
              <span className="text-right text-[#eaecef] relative z-10">
                {formatQty(level.quantity, basePrecision)}
              </span>
              <span className="text-right text-[#848e9c] relative z-10">
                {calculateTotal(level.price, level.quantity)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Middle: Mid Price & Spread */}
      <div className="my-1.5 py-1.5 px-2 bg-[#1b2028] border-y border-[#232933] flex items-center justify-between rounded">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-[#0ecb81]">{formatPrice(midPrice, tickSize)}</span>
          <span className="text-[11px] text-[#0ecb81]">↗</span>
        </div>
        <div className="text-[10px] text-[#848e9c]">
          Spread {spread} ({spreadPct})
        </div>
      </div>

      {/* Bids (Buy Orders - Green) */}
      <div className="space-y-0.5 py-1">
        {bids.map((level: OrderBookLevel, idx: number) => {
          const qty = parseFloat(level.quantity) || 0;
          const barWidth = Math.min(100, Math.max(5, (qty / maxQty) * 100));
          return (
            <div
              key={`bid-${idx}`}
              className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-[#1e232d] transition-colors rounded-sm cursor-pointer"
            >
              <div
                className="absolute right-0 inset-y-0 bg-[#0ecb81]/12 pointer-events-none rounded-sm"
                style={{ width: `${barWidth}%` }}
              />
              <span className="text-[#0ecb81] font-semibold relative z-10">
                {formatPrice(level.price, tickSize)}
              </span>
              <span className="text-right text-[#eaecef] relative z-10">
                {formatQty(level.quantity, basePrecision)}
              </span>
              <span className="text-right text-[#848e9c] relative z-10">
                {calculateTotal(level.price, level.quantity)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
