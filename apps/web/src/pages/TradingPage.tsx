import { useParams, Link } from 'react-router-dom';
import { useMarket, useWallets, useTicker } from '../hooks/useApi';
import { useMarketSocket } from '../hooks/useWebSocket';
import { OrderBookPanel } from '../components/trading/OrderBookPanel';
import { RecentTradesPanel } from '../components/trading/RecentTradesPanel';
import { OrderFormPanel } from '../components/trading/OrderFormPanel';
import { ActiveOrdersPanel } from '../components/trading/ActiveOrdersPanel';
import { Badge, Spinner } from '../components/ui';
import { formatPrice } from '../lib/utils';

export function TradingPage() {
  const { symbol } = useParams<{ symbol: string }>();

  const { data: market, isLoading: loadingMarket } = useMarket(symbol);
  const { data: balances = [] } = useWallets();
  const { data: ticker } = useTicker(symbol);

  // Connect WebSocket cho market này
  useMarketSocket(symbol);

  if (loadingMarket) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <Spinner />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-900 gap-4">
        <div className="text-red-400 text-lg">Market không tồn tại</div>
        <Link to="/markets" className="text-blue-400 hover:text-blue-300">
          ← Quay về Markets
        </Link>
      </div>
    );
  }

  const lastPrice = ticker?.lastPrice ?? market.ticker?.lastPrice;
  const isOpen = market.status === 'OPEN';

  return (
    <div className="bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="border-b border-gray-700 px-4 py-3 flex items-center gap-6 overflow-x-auto">
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-white font-bold text-lg">{market.symbol.replace('_', '/')}</span>
          {market.status !== 'OPEN' && (
            <Badge variant={market.status === 'SUSPENDED' ? 'yellow' : 'gray'}>
              {market.status}
            </Badge>
          )}
        </div>

        {lastPrice && (
          <div className="shrink-0">
            <span className="text-2xl font-bold text-green-400">
              {formatPrice(lastPrice, market.tickSize)}
            </span>
          </div>
        )}

        {ticker && (
          <div className="flex items-center gap-6 text-xs text-gray-400">
            <div>
              <div className="text-gray-500">24h Change</div>
              <div
                className={
                  parseFloat(ticker.priceChange24h ?? '0') >= 0
                    ? 'text-green-400'
                    : 'text-red-400'
                }
              >
                {ticker.priceChange24h ? `${parseFloat(ticker.priceChange24h).toFixed(2)}%` : '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Best Bid</div>
              <div className="text-green-400">
                {ticker.bestBid ? formatPrice(ticker.bestBid, market.tickSize) : '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Best Ask</div>
              <div className="text-red-400">
                {ticker.bestAsk ? formatPrice(ticker.bestAsk, market.tickSize) : '—'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Volume 24h</div>
              <div className="text-gray-200">
                {ticker.volume24h ? formatPrice(ticker.volume24h, '1') : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Market suspended warning */}
      {!isOpen && (
        <div className="bg-yellow-900/30 border-b border-yellow-700/50 text-yellow-400 text-sm text-center py-2">
          ⚠️ Market đang tạm dừng. Không thể đặt lệnh.
        </div>
      )}

      {/* Main layout */}
      <div className="grid grid-cols-12 gap-2 p-2 h-[calc(100vh-120px)]">
        {/* Order Book */}
        <div className="col-span-12 md:col-span-3 overflow-auto">
          <OrderBookPanel
            symbol={market.symbol}
            tickSize={market.tickSize}
            basePrecision={market.basePrecision}
          />
        </div>

        {/* Center: Recent Trades + Active Orders */}
        <div className="col-span-12 md:col-span-6 flex flex-col gap-2">
          <div className="flex-1 overflow-auto">
            <RecentTradesPanel
              symbol={market.symbol}
              tickSize={market.tickSize}
              basePrecision={market.basePrecision}
            />
          </div>
          <div className="flex-1 overflow-auto">
            <ActiveOrdersPanel
              symbol={market.symbol}
              tickSize={market.tickSize}
              basePrecision={market.basePrecision}
            />
          </div>
        </div>

        {/* Order Form */}
        <div className="col-span-12 md:col-span-3 overflow-auto">
          {isOpen ? (
            <OrderFormPanel market={market} balances={balances} />
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center text-gray-500 text-sm">
              Market đang tạm dừng
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
