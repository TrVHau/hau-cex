import { Link } from 'react-router-dom';
import { useMarkets } from '../hooks/useApi';
import { Card, Badge, Spinner } from '../components/ui';
import { formatPrice } from '../lib/utils';
import type { Market } from '../types';

function statusBadge(status: Market['status']) {
  switch (status) {
    case 'OPEN':
      return <Badge variant="green">OPEN</Badge>;
    case 'SUSPENDED':
      return <Badge variant="yellow">SUSPENDED</Badge>;
    default:
      return <Badge variant="gray">{status}</Badge>;
  }
}

export function MarketListPage() {
  const { data: markets, isLoading, isError } = useMarkets();

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">Markets</h1>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      )}

      {isError && (
        <div className="text-red-400 text-center py-16">
          Không thể tải danh sách market. Vui lòng thử lại.
        </div>
      )}

      {markets && (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-3 font-medium">Pair</th>
                <th className="text-right pb-3 font-medium">Last Price</th>
                <th className="text-right pb-3 font-medium hidden sm:table-cell">24h Change</th>
                <th className="text-right pb-3 font-medium hidden md:table-cell">Volume 24h</th>
                <th className="text-right pb-3 font-medium">Status</th>
                <th className="text-right pb-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {markets.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    Chưa có market nào
                  </td>
                </tr>
              )}
              {markets.map((market) => {
                const ticker = market.ticker;
                const change = ticker?.priceChange24h;
                const isPositive = change && parseFloat(change) >= 0;

                return (
                  <tr
                    key={market.id}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="py-3 font-semibold text-white">
                      {market.baseAsset}
                      <span className="text-gray-400">/{market.quoteAsset}</span>
                    </td>
                    <td className="py-3 text-right text-white">
                      {ticker?.lastPrice
                        ? formatPrice(ticker.lastPrice, market.tickSize)
                        : '—'}
                    </td>
                    <td className="py-3 text-right hidden sm:table-cell">
                      {change ? (
                        <span className={isPositive ? 'text-green-400' : 'text-red-400'}>
                          {isPositive ? '+' : ''}
                          {parseFloat(change).toFixed(2)}%
                        </span>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="py-3 text-right text-gray-300 hidden md:table-cell">
                      {ticker?.volume24h ? formatPrice(ticker.volume24h, '1') : '—'}
                    </td>
                    <td className="py-3 text-right">{statusBadge(market.status)}</td>
                    <td className="py-3 text-right">
                      {market.status === 'OPEN' ? (
                        <Link
                          to={`/trade/${market.symbol}`}
                          className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                        >
                          Trade →
                        </Link>
                      ) : (
                        <span className="text-gray-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
