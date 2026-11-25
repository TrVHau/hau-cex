import { useRecentTrades } from '../../hooks/useApi';
import { Spinner } from '../ui';
import { formatPrice, formatQty, formatTime } from '../../lib/utils';
import type { Trade } from '../../types';

interface Props {
  symbol: string;
  tickSize: string;
  basePrecision: number;
}

export function RecentTradesPanel({ symbol, tickSize, basePrecision }: Props) {
  const { data: trades = [], isLoading } = useRecentTrades(symbol);

  if (isLoading) {
    return (
      <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-center items-center min-h-[220px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-3 flex flex-col text-xs font-numeric select-none">
      <div className="flex items-center justify-between font-sans text-xs font-bold text-white mb-2 px-1">
        <span>MARKET TRADES</span>
        <span className="text-[10px] text-[#5e6673]">Recent executions</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-3 text-[10px] text-[#5e6673] px-1 py-1 border-b border-[#1c212a] uppercase font-sans">
        <span>PRICE (USDT)</span>
        <span className="text-right">AMOUNT</span>
        <span className="text-right">TIME</span>
      </div>

      {/* Trade Rows */}
      <div className="space-y-0.5 py-1 overflow-y-auto max-h-[240px]">
        {trades.length === 0 ? (
          <div className="py-8 text-center text-[#5e6673] text-[11px] font-sans">
            No trades executed yet.
          </div>
        ) : (
          trades.slice(0, 25).map((t: Trade, idx: number) => {
            const isBuy = t.side === 'BUY' || (t as any).takerSide === 'BUY';
            const rawTime = t.createdAt || (t as any).matchedAt || (t as any).time;
            const tradeId = t.id || (t as any).tradeId || `trade-${idx}-${t.price}`;
            return (
              <div
                key={tradeId}
                className="grid grid-cols-3 px-1 py-0.5 hover:bg-[#1e232d] transition-colors rounded-sm cursor-pointer"
              >
                <span className={`font-semibold ${isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                  {formatPrice(t.price, tickSize)}
                </span>
                <span className="text-right text-[#eaecef]">
                  {formatQty(t.quantity, basePrecision)}
                </span>
                <span className="text-right text-[#848e9c] text-[11px]">
                  {rawTime ? formatTime(rawTime) : '—'}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
