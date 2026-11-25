import { useOrderBook } from '../../hooks/useApi';
import { Spinner } from '../ui';
import { formatPrice, formatQty } from '../../lib/utils';
import Decimal from 'decimal.js';

interface Props {
  symbol: string;
  tickSize: string;
  basePrecision: number;
}

interface NormalizedLevel {
  price: string;
  quantity: string;
}

function normalizeLevels(raw: unknown): NormalizedLevel[] {
  if (!Array.isArray(raw)) return [];
  const list: NormalizedLevel[] = [];
  for (const item of raw) {
    if (Array.isArray(item)) {
      const price = String(item[0] ?? '');
      const quantity = String(item[1] ?? '');
      if (price && quantity && !isNaN(Number(price)) && Number(price) > 0) {
        list.push({ price, quantity });
      }
    } else if (item && typeof item === 'object') {
      const obj = item as {
        price?: string | number;
        quantity?: string | number;
        qty?: string | number;
        amount?: string | number;
      };
      const price = String(obj.price ?? '');
      const quantity = String(obj.quantity ?? obj.qty ?? obj.amount ?? '');
      if (price && quantity && !isNaN(Number(price)) && Number(price) > 0) {
        list.push({ price, quantity });
      }
    }
  }
  return list;
}

function calculateTotal(price: string, qty: string): string {
  try {
    const p = new Decimal(price || 0);
    const q = new Decimal(qty || 0);
    return p.mul(q).toFixed(2);
  } catch {
    return '0.00';
  }
}

export function OrderBookPanel({ symbol, tickSize, basePrecision }: Props) {
  const { data: orderBook, isLoading } = useOrderBook(symbol);

  if (isLoading && !orderBook) {
    return (
      <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 h-full flex flex-col justify-center items-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  const normalizedAsks = normalizeLevels(orderBook?.asks);
  const normalizedBids = normalizeLevels(orderBook?.bids);

  // Sort asks ascending (lowest sell price first)
  normalizedAsks.sort((a, b) => Number(a.price) - Number(b.price));
  // Sort bids descending (highest buy price first)
  normalizedBids.sort((a, b) => Number(b.price) - Number(a.price));

  // Asks hiển thị đảo ngược để giá bán thấp nhất nằm ngay phía trên midPrice
  const asks = normalizedAsks.slice(0, 8).reverse();
  const bids = normalizedBids.slice(0, 8);

  const maxQty = Math.max(
    ...asks.map((a) => parseFloat(a.quantity) || 0),
    ...bids.map((b) => parseFloat(b.quantity) || 0),
    0.01
  );

  const bestAsk = normalizedAsks[0]?.price;
  const bestBid = normalizedBids[0]?.price;
  const midPrice = bestBid ?? bestAsk ?? '60000.00';

  let spread = '0.0';
  let spreadPct = '0.00%';
  if (bestAsk && bestBid) {
    try {
      const askDec = new Decimal(bestAsk);
      const bidDec = new Decimal(bestBid);
      const diff = askDec.sub(bidDec);
      spread = diff.toFixed(2);
      spreadPct = diff.div(askDec).mul(100).toFixed(2) + '%';
    } catch {
      // ignore
    }
  }

  const hasOrders = asks.length > 0 || bids.length > 0;

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-3 flex flex-col justify-between text-xs font-numeric select-none">
      <div className="flex items-center justify-between font-sans text-xs font-bold text-white mb-2 px-1">
        <span>ORDER BOOK</span>
        <div className="flex items-center gap-1.5 text-[11px] text-[#5e6673]">
          <span className="w-2 h-2 rounded-full bg-[#0ecb81] animate-pulse" />
          <span>Real-time</span>
        </div>
      </div>

      {/* Header labels */}
      <div className="grid grid-cols-3 text-[10px] text-[#5e6673] px-1 py-1 border-b border-[#1c212a] uppercase font-sans">
        <span>PRICE (USDT)</span>
        <span className="text-right">AMOUNT</span>
        <span className="text-right">TOTAL</span>
      </div>

      {!hasOrders ? (
        <div className="py-12 text-center text-[#5e6673] text-[11px] font-sans">
          No active orders in book. Waiting for market depth...
        </div>
      ) : (
        <>
          {/* Asks (Sell Orders - Red) */}
          <div className="space-y-0.5 py-1">
            {asks.map((level: NormalizedLevel, idx: number) => {
              const qty = parseFloat(level.quantity) || 0;
              const barWidth = Math.min(100, Math.max(3, (qty / maxQty) * 100));
              return (
                <div
                  key={`ask-${idx}`}
                  className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-[#1e232d] transition-colors rounded-sm cursor-pointer"
                >
                  <div
                    className="absolute right-0 inset-y-0 bg-[#f6465d]/15 pointer-events-none rounded-sm transition-all duration-300"
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
              <span className="text-sm font-bold text-[#0ecb81]">
                ${formatPrice(midPrice, tickSize)}
              </span>
              <span className="text-[11px] text-[#0ecb81]">↗</span>
            </div>
            <div className="text-[10px] text-[#848e9c]">
              Spread {spread} ({spreadPct})
            </div>
          </div>

          {/* Bids (Buy Orders - Green) */}
          <div className="space-y-0.5 py-1">
            {bids.map((level: NormalizedLevel, idx: number) => {
              const qty = parseFloat(level.quantity) || 0;
              const barWidth = Math.min(100, Math.max(3, (qty / maxQty) * 100));
              return (
                <div
                  key={`bid-${idx}`}
                  className="relative grid grid-cols-3 px-1 py-0.5 hover:bg-[#1e232d] transition-colors rounded-sm cursor-pointer"
                >
                  <div
                    className="absolute right-0 inset-y-0 bg-[#0ecb81]/15 pointer-events-none rounded-sm transition-all duration-300"
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
        </>
      )}
    </div>
  );
}
