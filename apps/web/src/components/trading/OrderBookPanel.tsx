import { useOrderBook } from '../../hooks/useApi';
import { Card, Spinner } from '../ui';
import { formatPrice, formatQty } from '../../lib/utils';
import type { OrderBookLevel } from '../../types';

interface Props {
  symbol: string;
  tickSize: string;
  basePrecision: number;
}

function PriceRow({
  level,
  side,
  tickSize,
  basePrecision,
  maxQty,
}: {
  level: OrderBookLevel;
  side: 'bid' | 'ask';
  tickSize: string;
  basePrecision: number;
  maxQty: number;
}) {
  const qty = parseFloat(level.quantity);
  const widthPct = maxQty > 0 ? Math.min((qty / maxQty) * 100, 100) : 0;
  const color = side === 'bid' ? 'bg-green-900/30' : 'bg-red-900/30';
  const textColor = side === 'bid' ? 'text-green-400' : 'text-red-400';

  return (
    <div className="relative flex justify-between text-xs py-0.5 px-2 hover:bg-gray-700/30">
      <div
        className={`absolute inset-y-0 ${side === 'bid' ? 'right-0' : 'left-0'} ${color}`}
        style={{ width: `${widthPct}%` }}
      />
      <span className={`relative z-10 font-mono ${textColor}`}>
        {formatPrice(level.price, tickSize)}
      </span>
      <span className="relative z-10 font-mono text-gray-300">
        {formatQty(level.quantity, basePrecision)}
      </span>
    </div>
  );
}

export function OrderBookPanel({ symbol, tickSize, basePrecision }: Props) {
  const { data: orderBook, isLoading } = useOrderBook(symbol);

  if (isLoading) {
    return (
      <Card title="Order Book" className="h-full">
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Card>
    );
  }

  if (!orderBook) {
    return (
      <Card title="Order Book" className="h-full">
        <div className="text-gray-500 text-center py-8 text-sm">Không có dữ liệu</div>
      </Card>
    );
  }

  const asks = [...orderBook.asks].reverse().slice(0, 15);
  const bids = orderBook.bids.slice(0, 15);
  const maxQty = Math.max(
    ...asks.map((a) => parseFloat(a.quantity)),
    ...bids.map((b) => parseFloat(b.quantity)),
    1,
  );

  const spread =
    orderBook.asks.length > 0 && orderBook.bids.length > 0
      ? (parseFloat(orderBook.asks[0].price) - parseFloat(orderBook.bids[0].price)).toFixed(
          new Intl.NumberFormat().format(parseFloat(tickSize)).split('.')[1]?.length ?? 2,
        )
      : null;

  return (
    <Card className="h-full" title="Order Book">
      <div className="text-xs text-gray-400 flex justify-between px-2 mb-1">
        <span>Price</span>
        <span>Qty</span>
      </div>

      {/* Asks (đỏ) — hiện từ cao → thấp */}
      <div className="space-y-0">
        {asks.map((level, i) => (
          <PriceRow
            key={`ask-${i}`}
            level={level}
            side="ask"
            tickSize={tickSize}
            basePrecision={basePrecision}
            maxQty={maxQty}
          />
        ))}
      </div>

      {/* Spread */}
      <div className="flex justify-between items-center px-2 py-1.5 border-y border-gray-700 my-1">
        <span className="text-xs text-gray-400">Spread</span>
        <span className="text-xs text-gray-300">{spread ?? '—'}</span>
      </div>

      {/* Bids (xanh) */}
      <div className="space-y-0">
        {bids.map((level, i) => (
          <PriceRow
            key={`bid-${i}`}
            level={level}
            side="bid"
            tickSize={tickSize}
            basePrecision={basePrecision}
            maxQty={maxQty}
          />
        ))}
      </div>
    </Card>
  );
}
