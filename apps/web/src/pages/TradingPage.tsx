import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Search,
  Maximize2,
  SlidersHorizontal,
} from 'lucide-react';
import { useMarket, useMarkets, useWallets, useTicker } from '../hooks/useApi';
import { useMarketSocket } from '../hooks/useWebSocket';
import { OrderBookPanel } from '../components/trading/OrderBookPanel';
import { RecentTradesPanel } from '../components/trading/RecentTradesPanel';
import { OrderFormPanel } from '../components/trading/OrderFormPanel';
import { ActiveOrdersPanel } from '../components/trading/ActiveOrdersPanel';
import { CandlestickChart } from '../components/trading/CandlestickChart';
import { Spinner } from '../components/ui';
import { formatPrice } from '../lib/utils';

export function TradingPage() {
  const { symbol = 'BTC_USDT' } = useParams<{ symbol: string }>();
  const navigate = useNavigate();

  const { data: market, isLoading: loadingMarket } = useMarket(symbol);
  const { data: allMarkets = [] } = useMarkets();
  const { data: balances = [] } = useWallets();
  const { data: ticker } = useTicker(symbol);

  // Timeframe state
  const [timeframe, setTimeframe] = useState<'1M' | '5M' | '15M' | '1H' | '4H' | '1D' | '1W'>('15M');
  const [marketTab, setMarketTab] = useState<'SPOT' | 'FAVORITES'>('SPOT');
  const [marketSearch, setMarketSearch] = useState('');

  // Connect WebSocket cho market
  useMarketSocket(symbol);

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

  const lastPrice = ticker?.lastPrice ?? market.ticker?.lastPrice ?? '64231.50';
  const change24h = parseFloat(ticker?.priceChange24h ?? '2.45');
  const isPositive = change24h >= 0;

  const filteredMiniMarkets = allMarkets.filter((m) =>
    m.symbol.toLowerCase().includes(marketSearch.toLowerCase()) ||
    m.baseAsset.toLowerCase().includes(marketSearch.toLowerCase())
  );

  return (
    <div className="p-3 sm:p-4 space-y-3 bg-[#0b0e11] min-h-screen text-[#eaecef]">
      {/* ─── Top Symbol & Stats Bar ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        {/* Left: Pair Info & Price */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#f5b642] flex items-center justify-center text-black font-black text-xs shadow-sm">
              ⚡
            </div>
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
              {formatPrice(lastPrice, market.tickSize)}
            </div>
            <div className="text-[10px] text-[#848e9c] font-numeric">${formatPrice(lastPrice, market.tickSize)}</div>
          </div>
        </div>

        {/* Right: 24h Stats Row */}
        <div className="flex items-center gap-5 text-xs font-numeric overflow-x-auto py-1">
          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H CHANGE</div>
            <div className={`font-semibold ${isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {isPositive ? '+' : ''}
              {change24h.toFixed(2)}%
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H HIGH</div>
            <div className="text-white font-medium">
              {ticker?.high24h ? formatPrice(ticker.high24h, market.tickSize) : formatPrice(lastPrice, market.tickSize)}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H LOW</div>
            <div className="text-white font-medium">
              {ticker?.low24h ? formatPrice(ticker.low24h, market.tickSize) : formatPrice(lastPrice, market.tickSize)}
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
                : (Number(ticker?.baseVolume24h ?? 0) * Number(lastPrice)).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main 3-Column Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Mini Markets List (col-span-12 xl:col-span-2 lg:col-span-3) */}
        <div className="col-span-12 lg:col-span-3 xl:col-span-2 bg-[#14171d] border border-[#232933] rounded-xl p-3 flex flex-col justify-between">
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
              {filteredMiniMarkets.map((m) => {
                const isSelected = m.symbol === market.symbol;
                const mPrice = m.ticker?.lastPrice ? formatPrice(m.ticker.lastPrice, m.tickSize) : '64,231.50';
                const mChange = parseFloat(m.ticker?.priceChange24h ?? '2.45');
                const mPos = mChange >= 0;

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
                    <div>
                      <div className="font-bold">{m.baseAsset}/{m.quoteAsset}</div>
                    </div>
                    <div className="text-right font-numeric">
                      <div className="font-semibold">{mPrice}</div>
                      <div className={`text-[10px] ${mPos ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {mPos ? '+' : ''}{mChange.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Column: Chart + Order Form + Active Orders (col-span-12 lg:col-span-6 xl:col-span-7) */}
        <div className="col-span-12 lg:col-span-6 xl:col-span-7 space-y-3">
          {/* Candlestick Chart Card */}
          <div className="bg-[#14171d] border border-[#232933] rounded-xl p-3.5 flex flex-col justify-between overflow-hidden">
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
                <button className="p-1 hover:text-white cursor-pointer" title="Indicators">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 hover:text-white cursor-pointer" title="Fullscreen">
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Dynamic Real-Time Candlestick Chart */}
            <CandlestickChart
              symbol={symbol}
              timeframe={timeframe}
              currentPrice={lastPrice}
              tickSize={market.tickSize}
            />
          </div>

          {/* Side-by-Side Order Form */}
          <OrderFormPanel market={market} balances={balances} />

          {/* Active Orders Panel with Tabs */}
          <ActiveOrdersPanel
            currentSymbol={market.symbol}
            tickSize={market.tickSize}
            basePrecision={market.basePrecision}
          />
        </div>

        {/* Right Column: Order Book & Market Trades (col-span-12 lg:col-span-3) */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <OrderBookPanel
            symbol={market.symbol}
            tickSize={market.tickSize}
            basePrecision={market.basePrecision}
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
