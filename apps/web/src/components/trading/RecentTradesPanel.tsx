import { useRecentTrades } from '../../hooks/useApi';
import { Card, Spinner } from '../ui';
import { formatPrice, formatQty, formatTime } from '../../lib/utils';

interface Props {
  symbol: string;
  tickSize: string;
  basePrecision: number;
}

export function RecentTradesPanel({ symbol, tickSize, basePrecision }: Props) {
  const { data: trades, isLoading } = useRecentTrades(symbol);

  if (isLoading) {
    return (
      <Card title="Recent Trades" className="h-full">
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      </Card>
    );
  }

  return (
    <Card title="Recent Trades" className="h-full">
      <div className="text-xs text-gray-400 flex justify-between mb-1 px-1">
        <span>Price</span>
        <span>Qty</span>
        <span className="hidden sm:block">Time</span>
      </div>
      <div className="space-y-0 overflow-y-auto max-h-96">
        {(!trades || trades.length === 0) && (
          <div className="text-gray-500 text-center py-8 text-sm">Chưa có giao dịch</div>
        )}
        {trades?.map((trade) => (
          <div
            key={trade.id}
            className="flex justify-between text-xs py-0.5 px-1 hover:bg-gray-700/30"
          >
            <span
              className={`font-mono ${trade.side === 'BUY' ? 'text-green-400' : 'text-red-400'}`}
            >
              {formatPrice(trade.price, tickSize)}
            </span>
            <span className="font-mono text-gray-300">
              {formatQty(trade.quantity, basePrecision)}
            </span>
            <span className="text-gray-500 hidden sm:block">{formatTime(trade.createdAt)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
