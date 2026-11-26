import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { useMarket, useMarkets, useWallets, useTicker, useFavoriteMarkets } from '../hooks/useApi';
import { useMarketSocket } from '../hooks/useWebSocket';
import { OrderBookPanel } from '../components/trading/OrderBookPanel';
import { RecentTradesPanel } from '../components/trading/RecentTradesPanel';
import { OrderFormPanel } from '../components/trading/OrderFormPanel';
import { ActiveOrdersPanel } from '../components/trading/ActiveOrdersPanel';
import { CandlestickChart } from '../components/trading/CandlestickChart';
import { Spinner, CoinIcon, PairIcon } from '../components/ui';
import { formatPrice } from '../lib/utils';

export function TradingPage() {
  const { symbol = 'BTC_USDT' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const { data: market, isLoading: loadingMarket } = useMarket(symbol);
  const { data: allMarkets = [] } = useMarkets();
  const { data: balances = [] } = useWallets();
  const { data: ticker } = useTicker(symbol);

  // Timeframe & terminal UI state
  const [timeframe, setTimeframe] = useState<'1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'>('15M');
  const [marketTab, setMarketTab] = useState<'SPOT' | 'FAVORITES'>('SPOT');
  const [marketSearch, setMarketSearch] = useState('');
  const [selectedPrice, setSelectedPrice] = useState<{ price: string; seq: number } | null>(null);
  const [isChartFullscreen, setIsChartFullscreen] = useState(false);

  const { favorites, toggleFavorite } = useFavoriteMarkets();

  // Connect WebSocket cho market
  useMarketSocket(symbol);

  useEffect(() => {
    if (!isChartFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsChartFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isChartFullscreen]);

  if (loadingMarket) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Spinner />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="text-[#f6465d] text-base font-semibold">Market not found ({symbol})</div>
        <button
          onClick={() => navigate('/markets')}
          className="text-xs text-[#f5b642] hover:underline cursor-pointer"
        >
          ← Return to Markets list
        </button>
      </div>
    );
  }

  const lastPrice = ticker?.lastPrice ?? market.lastPrice ?? market.ticker?.lastPrice ?? null;
  const rawChange24h = ticker?.priceChange24h ?? market.ticker?.priceChange24h ?? null;
  const change24h = rawChange24h !== null ? parseFloat(rawChange24h) : null;
  const isPositive = change24h !== null && change24h >= 0;
  const isCurrentFav = favorites.includes(market.symbol);

  const filteredMiniMarkets = allMarkets.filter((m) => {
    if (marketTab === 'FAVORITES' && !favorites.includes(m.symbol)) {
      return false;
    }
    return (
      m.symbol.toLowerCase().includes(marketSearch.toLowerCase()) ||
      m.baseAsset.toLowerCase().includes(marketSearch.toLowerCase())
    );
  });

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-[#0b0e11] min-h-screen text-[#eaecef]">
      {/* ─── Top Symbol & Stats Bar ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Pair Info & Price */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => toggleFavorite(market.symbol)}
              className="text-[#5e6673] hover:text-[#f5b642] cursor-pointer"
              title={isCurrentFav ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
              <Star className={`w-4 h-4 ${isCurrentFav ? 'fill-[#f5b642] text-[#f5b642]' : ''}`} />
            </button>
            <PairIcon baseAsset={market.baseAsset} quoteAsset={market.quoteAsset} size="lg" />
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-1.5">
                {market.baseAsset}/{market.quoteAsset}
                <span className="text-[10px] text-[#5e6673]">SPOT</span>
              </div>
              <div className="text-[11px] text-[#848e9c]">{market.baseAsset}</div>
            </div>
          </div>

          <div className="h-7 w-[1px] bg-[#232933] hidden sm:block" />

          {/* Big Price */}
          <div>
            <div className="text-lg font-black font-numeric text-[#0ecb81] tracking-tight">
              {lastPrice ? formatPrice(lastPrice, market.tickSize) : '—'}
            </div>
            <div className="text-[10px] text-[#848e9c] font-numeric">
              {lastPrice ? `$${formatPrice(lastPrice, market.tickSize)}` : 'No trades yet'}
            </div>
          </div>
        </div>

        {/* Right: 24h Stats Row */}
        <div className="flex items-center gap-5 text-xs font-numeric overflow-x-auto py-1">
          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H CHANGE</div>
            <div
              className={`font-semibold ${
                change24h === null || Number.isNaN(change24h)
                  ? 'text-[#848e9c]'
                  : isPositive
                    ? 'text-[#0ecb81]'
                    : 'text-[#f6465d]'
              }`}
            >
              {change24h === null || Number.isNaN(change24h)
                ? '—'
                : `${isPositive ? '+' : ''}${change24h.toFixed(2)}%`}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H HIGH</div>
            <div className="text-white font-medium">
              {ticker?.high24h
                ? formatPrice(ticker.high24h, market.tickSize)
                : lastPrice
                  ? formatPrice(lastPrice, market.tickSize)
                  : '—'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H LOW</div>
            <div className="text-white font-medium">
              {ticker?.low24h
                ? formatPrice(ticker.low24h, market.tickSize)
                : lastPrice
                  ? formatPrice(lastPrice, market.tickSize)
                  : '—'}
            </div>
          </div>

          <div className="hidden md:block">
            <div className="text-[10px] text-[#5e6673] font-sans">24H VOLUME ({market.baseAsset})</div>
            <div className="text-white font-medium">
              {Number(ticker?.volume24h ?? ticker?.baseVolume24h ?? 0).toFixed(4)}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="text-[10px] text-[#5e6673] font-sans">24H VOLUME ({market.quoteAsset})</div>
            <div className="text-white font-medium">
              ${ticker?.quoteVolume24h
                ? Number(ticker.quoteVolume24h).toLocaleString('en-US', { maximumFractionDigits: 0 })
                : (Number(ticker?.baseVolume24h ?? 0) * Number(lastPrice ?? 0)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main 3-Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Mini Markets List (visible on xl+ so chart and orderbook are roomy on lg) */}
        <div className="hidden xl:flex xl:col-span-2 bg-[#14171d] border border-[#232933] rounded-xl p-3 flex-col justify-between">
          <div>
            {/* Search */}
            <div className="relative mb-2.5">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search markets..."
                value={marketSearch}
                onChange={(e) => setMarketSearch(e.target.value)}
                className="w-full bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-2 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none"
              />
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 text-xs font-semibold border-b border-[#1c212a] pb-2 mb-2">
              <button
                onClick={() => setMarketTab('SPOT')}
                className={`cursor-pointer ${
                  marketTab === 'SPOT' ? 'text-[#f5b642]' : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                SPOT
              </button>
              <button
                onClick={() => setMarketTab('FAVORITES')}
                className={`cursor-pointer ${
                  marketTab === 'FAVORITES' ? 'text-[#f5b642]' : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                FAVORITES
              </button>
            </div>

            {/* Markets Table */}
            <div className="space-y-1 overflow-y-auto max-h-[380px] lg:max-h-[560px]">
              {filteredMiniMarkets.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#5e6673]">
                  {marketTab === 'FAVORITES' ? 'Chưa có cặp yêu thích.' : 'Không tìm thấy cặp phù hợp.'}
                </div>
              ) : (
                filteredMiniMarkets.map((m) => {
                  const isSelected = m.symbol === market.symbol;
                  const mLastPrice = m.lastPrice ?? m.ticker?.lastPrice;
                  const mPrice = mLastPrice ? formatPrice(mLastPrice, m.tickSize) : '—';
                  const rawMChange = m.ticker?.priceChange24h;
                  const mChange =
                    rawMChange !== null && rawMChange !== undefined ? parseFloat(rawMChange) : null;
                  const mPos = mChange !== null && mChange >= 0;
                  const isFav = favorites.includes(m.symbol);

                  return (
                    <div
                      key={m.id}
                      onClick={() => navigate(`/trade/${m.symbol}`)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#1e232d] border border-[#2b3240] text-[#f5b642]'
                          : 'hover:bg-[#1a1e26] text-[#eaecef]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(m.symbol);
                          }}
                          className="text-[#5e6673] hover:text-[#f5b642] cursor-pointer shrink-0"
                        >
                          <Star className={`w-3 h-3 ${isFav ? 'fill-[#f5b642] text-[#f5b642]' : ''}`} />
                        </button>
                        <CoinIcon symbol={m.baseAsset} size="xs" />
                        <div className="leading-tight min-w-0">
                          <div className="font-bold text-[11px]">{m.baseAsset}</div>
                          <div className="text-[9px] text-[#5e6673]">/{m.quoteAsset}</div>
                        </div>
                      </div>
                      <div className="text-right font-numeric shrink-0 ml-1 text-[11px]">
                        <div className="font-semibold">{mPrice}</div>
                        <div
                          className={`text-[10px] ${
                            mChange === null || Number.isNaN(mChange)
                              ? 'text-[#848e9c]'
                              : mPos
                                ? 'text-[#0ecb81]'
                                : 'text-[#f6465d]'
                          }`}
                        >
                          {mChange === null || Number.isNaN(mChange)
                            ? '—'
                            : `${mPos ? '+' : ''}${mChange.toFixed(2)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Center Column: Chart + Order Form + Active Orders (col-span-12 lg:col-span-8 xl:col-span-7) */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-7 space-y-3">
          {isChartFullscreen && (
            <div
              className="fixed inset-0 bg-black/75 z-40"
              onClick={() => setIsChartFullscreen(false)}
            />
          )}

          {/* Candlestick Chart Card */}
          <div
            className={
              isChartFullscreen
                ? 'fixed inset-4 z-50 bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between shadow-2xl overflow-hidden'
                : 'bg-[#14171d] border border-[#232933] rounded-xl p-3.5 flex flex-col justify-between overflow-hidden'
            }
          >
            {/* Chart Toolbar */}
            <div className="flex items-center justify-between border-b border-[#232933] pb-2.5 mb-2">
              {/* Timeframe buttons */}
              <div className="flex items-center gap-1">
                {(['1M', '5M', '15M', '1H', '4H', '1D', '1W'] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                      timeframe === tf
                        ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                        : 'text-[#848e9c] hover:text-[#eaecef]'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Tools */}
              <div className="flex items-center gap-2 text-[#848e9c]">
                <span
                  className="p-1 text-[#5e6673] cursor-default inline-flex items-center gap-1 text-[10px]"
                  title="MA(7) & MA(25) overlays enabled"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>MA 7/25</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsChartFullscreen((prev) => !prev)}
                  className="p-1 hover:text-white cursor-pointer"
                  title={isChartFullscreen ? 'Thu nhỏ (Esc)' : 'Phóng to biểu đồ'}
                >
                  {isChartFullscreen ? (
                    <Minimize2 className="w-3.5 h-3.5 text-[#f5b642]" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Dynamic Real-Time Candlestick Chart */}
            <CandlestickChart
              symbol={symbol}
              timeframe={timeframe}
              currentPrice={lastPrice ?? ''}
              tickSize={market.tickSize}
            />
          </div>

          {/* Side-by-Side Order Form */}
          <OrderFormPanel market={market} balances={balances} selectedPrice={selectedPrice} />

          {/* Active Orders Panel with Tabs */}
          <ActiveOrdersPanel
            currentSymbol={market.symbol}
            tickSize={market.tickSize}
            basePrecision={market.basePrecision}
          />
        </div>

        {/* Right Column: Order Book & Market Trades (col-span-12 lg:col-span-4 xl:col-span-3) */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3 space-y-3">
          <OrderBookPanel
            symbol={market.symbol}
            tickSize={market.tickSize}
            basePrecision={market.basePrecision}
            onSelectPrice={(price) =>
              setSelectedPrice((prev) => ({ price, seq: (prev?.seq ?? 0) + 1 }))
            }
          />
          <RecentTradesPanel
            symbol={market.symbol}
            tickSize={market.tickSize}
            basePrecision={market.basePrecision}
          />
        </div>
      </div>
    </div>
  );
}
