import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2,
  Globe,
  Zap,
  TrendingUp,
  TrendingDown,
  Star,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useMarkets } from '../hooks/useApi';
import { Button, Badge, Spinner } from '../components/ui';
import { formatPrice } from '../lib/utils';

export function MarketListPage() {
  const navigate = useNavigate();
  const { data: markets = [], isLoading, isError } = useMarkets();
  const [activeTab, setActiveTab] = useState<'ALL' | 'USDT' | 'BTC' | 'FAVORITES'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['BTC_USDT']);

  const toggleFavorite = (symbol: string) => {
    if (favorites.includes(symbol)) {
      setFavorites(favorites.filter((s) => s !== symbol));
    } else {
      setFavorites([...favorites, symbol]);
    }
  };

  const filteredMarkets = markets.filter((m) => {
    const matchesSearch =
      m.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.baseAsset.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'USDT') return m.quoteAsset === 'USDT';
    if (activeTab === 'BTC') return m.quoteAsset === 'BTC';
    if (activeTab === 'FAVORITES') return favorites.includes(m.symbol);
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold text-white tracking-tight">
            <BarChart2 className="w-6 h-6 text-[#f5b642]" />
            Markets
          </div>
          <p className="text-xs text-[#848e9c] mt-1">
            Real-time price feed and trading statistics for HAU-CEX assets.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button variant="secondary" size="sm" className="text-xs">
            <Globe className="w-3.5 h-3.5 text-[#848e9c]" />
            Global Data
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/trade/BTC_USDT')}
            className="text-xs"
          >
            <Zap className="w-3.5 h-3.5" />
            Quick Trade
          </Button>
        </div>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#5e6673]" />
              24H VOLUME
            </span>
            <span className="text-[11px] text-[#0ecb81] font-semibold">+12.5%</span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">$14.2B</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#5e6673]" />
              GLOBAL MARKET CAP
            </span>
            <span className="text-[11px] text-[#0ecb81] font-semibold">+0.8%</span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">$2.45T</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5 text-[#5e6673]" />
              BTC DOMINANCE
            </span>
            <span className="text-[11px] text-[#f6465d] font-semibold">-0.2%</span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">52.4%</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#5e6673]" />
              ACTIVE PAIRS
            </span>
            <span className="text-[11px] text-[#0ecb81] font-semibold">+4</span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">{markets.length || 482}</div>
        </div>
      </div>

      {/* Main Markets Table Card */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        {/* Controls: Tabs & Search */}
        <div className="p-4 border-b border-[#232933] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-[#0b0e11] p-1 rounded-lg border border-[#1c212a] w-fit">
            {(['ALL', 'USDT', 'BTC', 'FAVORITES'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#1e232d] text-[#f5b642] shadow-sm'
                    : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                {tab === 'ALL' ? 'ALL CRYPTO' : tab === 'FAVORITES' ? '⭐ FAVORITES' : tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search coins, pairs, or tickers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none transition-colors w-60"
              />
            </div>
            <button className="p-2 rounded-lg bg-[#1b2028] border border-[#282f3c] text-[#848e9c] hover:text-[#eaecef] cursor-pointer">
              <Filter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <Spinner />
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-[#f6465d] text-xs">
            Failed to load market data.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#848e9c] border-b border-[#1c212a] text-left">
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4 font-medium">PAIR</th>
                  <th className="py-3 px-4 font-medium text-right">LAST PRICE</th>
                  <th className="py-3 px-4 font-medium text-right">24H CHANGE</th>
                  <th className="py-3 px-4 font-medium text-right hidden sm:table-cell">BEST BID</th>
                  <th className="py-3 px-4 font-medium text-right hidden sm:table-cell">BEST ASK</th>
                  <th className="py-3 px-4 font-medium text-right hidden md:table-cell">24H VOLUME</th>
                  <th className="py-3 px-4 font-medium text-right hidden lg:table-cell">STATUS</th>
                  <th className="py-3 px-4 font-medium text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a]">
                {filteredMarkets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-[#5e6673]">
                      No markets found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredMarkets.map((m) => {
                    const ticker = m.ticker;
                    const change = parseFloat(ticker?.priceChange24h ?? '2.45');
                    const isPositive = change >= 0;
                    const isFav = favorites.includes(m.symbol);

                    return (
                      <tr key={m.id} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => toggleFavorite(m.symbol)}
                            className="cursor-pointer text-[#5e6673] hover:text-[#f5b642]"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isFav ? 'fill-[#f5b642] text-[#f5b642]' : ''
                              }`}
                            />
                          </button>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#1e232d] border border-[#2b3240] flex items-center justify-center font-bold text-xs text-[#f5b642]">
                              {m.baseAsset.slice(0, 1)}
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs">
                                {m.baseAsset}/{m.quoteAsset}
                              </div>
                              <div className="text-[10px] text-[#5e6673] uppercase">{m.baseAsset}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric font-bold text-white text-sm">
                          {ticker?.lastPrice ? formatPrice(ticker.lastPrice, m.tickSize) : '64,231.50'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric font-semibold">
                          <span className={isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                            {isPositive ? '+' : ''}
                            {change.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric text-[#0ecb81] hidden sm:table-cell">
                          {ticker?.bestBid ? formatPrice(ticker.bestBid, m.tickSize) : '64,228.00'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric text-[#f6465d] hidden sm:table-cell">
                          {ticker?.bestAsk ? formatPrice(ticker.bestAsk, m.tickSize) : '64,235.00'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric text-[#848e9c] hidden md:table-cell">
                          {ticker?.volume24h ? `${parseFloat(ticker.volume24h).toFixed(2)}M` : '1.24B'}
                        </td>
                        <td className="py-3.5 px-4 text-right hidden lg:table-cell">
                          {m.status === 'OPEN' ? (
                            <Badge variant="green" size="sm">OPEN</Badge>
                          ) : (
                            <Badge variant="yellow" size="sm">SUSPENDED</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => navigate(`/trade/${m.symbol}`)}
                            className="font-bold tracking-wider px-3"
                          >
                            TRADE
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Information Panels: Market Sentiment & Safety First */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Market Sentiment & Analysis */}
        <div className="lg:col-span-8 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <TrendingUp className="w-4 h-4 text-[#f5b642]" />
              Market Sentiment & Analysis
            </div>
            <p className="text-xs text-[#848e9c]">Based on last 24h trading activity and social signals.</p>

            <div className="mt-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-[#848e9c]">FEAR & GREED INDEX</span>
                  <span className="text-[#0ecb81] font-bold font-numeric">GREED (74)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[#1b2028] overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#f6465d] via-[#f5b642] to-[#0ecb81] w-3/4 rounded-full" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                  <span className="text-xs text-[#848e9c]">Net Buy Volume</span>
                  <span className="text-xs font-bold text-[#0ecb81] font-numeric">+$242.5M</span>
                </div>
                <div className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                  <span className="text-xs text-[#848e9c]">Net Sell Volume</span>
                  <span className="text-xs font-bold text-[#f6465d] font-numeric">-$120.1M</span>
                </div>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#5e6673] mt-4 pt-3 border-t border-[#1c212a]">
            Market momentum remains strong with BTC leading. Institutional inflows are holding steady.
          </div>
        </div>

        {/* Safety First Panel */}
        <div className="lg:col-span-4 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-2">
              <ShieldCheck className="w-4 h-4 text-[#f5b642]" />
              Safety First
            </div>
            <ul className="text-xs text-[#848e9c] space-y-2.5 mt-3">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81] shrink-0 mt-0.5" />
                <span>Always double-check ticker symbol. Some assets share similar names.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81] shrink-0 mt-0.5" />
                <span>Price data provided is for info only. Real execution prices vary with depth.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81] shrink-0 mt-0.5" />
                <span>Keep your API keys secure and never share credentials.</span>
              </li>
            </ul>
          </div>

          <Button variant="secondary" size="sm" className="w-full mt-4 text-xs font-semibold">
            TRADING POLICY
          </Button>
        </div>
      </div>
    </div>
  );
}
