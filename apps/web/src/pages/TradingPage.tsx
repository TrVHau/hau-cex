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
import { Spinner } from '../components/ui';
import { formatPrice } from '../lib/utils';

interface CandleItem {
  open: number;
  close: number;
  high: number;
  low: number;
}

// Chuỗi nến liên tục: open của nến N+1 luôn khớp chính xác close của nến N
const CANDLE_SERIES: CandleItem[] = [
  { open: 142, close: 125, high: 118, low: 148 }, // Green: 142 -> 125
  { open: 125, close: 133, high: 120, low: 138 }, // Red:   125 -> 133
  { open: 133, close: 115, high: 108, low: 136 }, // Green: 133 -> 115
  { open: 115, close: 98,  high: 92,  low: 118 }, // Green: 115 -> 98
  { open: 98,  close: 106, high: 94,  low: 112 }, // Red:   98 -> 106
  { open: 106, close: 88,  high: 82,  low: 110 }, // Green: 106 -> 88
  { open: 88,  close: 72,  high: 66,  low: 92 },  // Green: 88 -> 72
  { open: 72,  close: 82,  high: 70,  low: 88 },  // Red:   72 -> 82
  { open: 82,  close: 64,  high: 58,  low: 85 },  // Green: 82 -> 64
  { open: 64,  close: 52,  high: 46,  low: 68 },  // Green: 64 -> 52
  { open: 52,  close: 38,  high: 32,  low: 56 },  // Green: 52 -> 38
  { open: 38,  close: 46,  high: 34,  low: 50 },  // Red:   38 -> 46
  { open: 46,  close: 30,  high: 24,  low: 48 },  // Green: 46 -> 30
  { open: 30,  close: 22,  high: 16,  low: 34 },  // Green: 30 -> 22
  { open: 22,  close: 28,  high: 18,  low: 32 },  // Red:   22 -> 28
  { open: 28,  close: 18,  high: 12,  low: 30 },  // Green: 28 -> 18
  { open: 18,  close: 12,  high: 8,   low: 22 },  // Green: 18 -> 12
  { open: 12,  close: 16,  high: 10,  low: 20 },  // Red:   12 -> 16
  { open: 16,  close: 10,  high: 6,   low: 18 },  // Green: 16 -> 10
];

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
            <div className="text-white font-medium">65,120.00</div>
          </div>

          <div>
            <div className="text-[10px] text-[#5e6673] font-sans">24H LOW</div>
            <div className="text-white font-medium">62,840.10</div>
          </div>

          <div className="hidden md:block">
            <div className="text-[10px] text-[#5e6673] font-sans">24H VOLUME ({market.baseAsset})</div>
            <div className="text-white font-medium">42,501.12</div>
          </div>

          <div className="hidden lg:block">
            <div className="text-[10px] text-[#5e6673] font-sans">24H VOLUME ({market.quoteAsset})</div>
            <div className="text-white font-medium">2.73B</div>
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

            {/* SVG Candlestick Chart Visualizer */}
            <div className="w-full h-64 relative bg-[#0e1116] rounded-lg p-2 overflow-hidden flex flex-col justify-between">
              {/* Legend */}
              <div className="flex items-center gap-3 text-[10px] text-[#5e6673] z-10 font-numeric">
                <span className="text-[#f5b642]">MA(7): 63,820.10</span>
                <span className="text-[#3b82f6]">MA(25): 62,110.45</span>
                <span className="text-[#a78bfa]">EMA(99): 60,442.20</span>
              </div>

              {/* Realistic Candlestick SVG with continuous Open/Close alignment */}
              <svg className="w-full h-48 overflow-visible" viewBox="0 0 700 180">
                {/* Horizontal Grid lines */}
                <line x1="0" y1="30" x2="700" y2="30" stroke="#1c212a" strokeDasharray="3 3" />
                <line x1="0" y1="75" x2="700" y2="75" stroke="#1c212a" strokeDasharray="3 3" />
                <line x1="0" y1="120" x2="700" y2="120" stroke="#1c212a" strokeDasharray="3 3" />
                <line x1="0" y1="160" x2="700" y2="160" stroke="#1c212a" strokeDasharray="3 3" />

                {/* Candles series */}
                {CANDLE_SERIES.map((c, idx) => {
                  const isGreen = c.close <= c.open;
                  const color = isGreen ? '#0ecb81' : '#f6465d';
                  const x = 30 + idx * 34;
                  const rectY = Math.min(c.open, c.close);
                  const rectHeight = Math.max(2, Math.abs(c.open - c.close));

                  return (
                    <g key={idx}>
                      {/* High-Low Wick */}
                      <line
                        x1={x + 7}
                        y1={c.high}
                        x2={x + 7}
                        y2={c.low}
                        stroke={color}
                        strokeWidth="1.5"
                      />
                      {/* Open-Close Body */}
                      <rect
                        x={x}
                        y={rectY}
                        width={14}
                        height={rectHeight}
                        fill={color}
                        rx={1}
                      />
                    </g>
                  );
                })}

                {/* MA(7) Yellow curve passing through candle closes */}
                <polyline
                  points={CANDLE_SERIES.map((c, i) => `${30 + i * 34 + 7},${c.close}`).join(' ')}
                  fill="none"
                  stroke="#f5b642"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />

                {/* MA(25) Blue curve */}
                <polyline
                  points={CANDLE_SERIES.map((c, i) => `${30 + i * 34 + 7},${(c.close + c.open) / 2 + 6}`).join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.75"
                />
              </svg>
            </div>
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
