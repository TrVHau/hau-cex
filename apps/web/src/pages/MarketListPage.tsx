import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import {
  BarChart2,
  Globe,
  Zap,
  TrendingUp,
  Star,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useMarkets, useFavoriteMarkets } from '../hooks/useApi';
import { Button, Badge, Spinner, PairIcon } from '../components/ui';
import { formatPrice } from '../lib/utils';

export function MarketListPage() {
  const navigate = useNavigate();
  const { data: markets = [], isLoading, isError } = useMarkets();
  const [activeTab, setActiveTab] = useState<'ALL' | 'USDT' | 'BTC' | 'FAVORITES'>('ALL');
  const [onlyReady, setOnlyReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const { favorites, toggleFavorite } = useFavoriteMarkets();

  const readyMarketsCount = markets.filter((m) => m.status === 'READY' || m.status === 'OPEN').length;
  const quotedMarketsCount = markets.filter((m) => Boolean(m.lastPrice ?? m.ticker?.lastPrice)).length;
  const pausedMarketsCount = markets.length - readyMarketsCount;
  let total24hVolUsdt = new Decimal(0);
  markets.forEach((m) => {
    const v = m.ticker?.quoteVolume24h ?? m.ticker?.volume24h;
    if (v && m.quoteAsset === 'USDT') {
      try {
        total24hVolUsdt = total24hVolUsdt.add(new Decimal(v));
      } catch {
        // ignore
      }
    }
  });

  const filteredMarkets = markets.filter((m) => {
    if (onlyReady && m.status !== 'READY' && m.status !== 'OPEN') return false;
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowGlobalModal(true)}
            className="text-xs"
          >
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

      {/* Top 4 Stat Cards (Real aggregated market metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#5e6673]" />
              24H USDT VOLUME
            </span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">
            ${total24hVolUsdt.toFixed(2)}
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#5e6673]" />
              QUOTED PAIRS
            </span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">
            {quotedMarketsCount} / {markets.length}
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#5e6673]" />
              PAUSED / RECOVERING
            </span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">{pausedMarketsCount}</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#5e6673]" />
              ACTIVE PAIRS
            </span>
            <span className="text-[11px] text-[#0ecb81] font-semibold">
              {readyMarketsCount} ready
            </span>
          </div>
          <div className="text-xl font-bold text-white font-numeric mt-2">{markets.length}</div>
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
            <button
              type="button"
              onClick={() => setOnlyReady((v) => !v)}
              title="Lọc chỉ hiện các cặp READY"
              className={`px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer inline-flex items-center gap-1.5 ${
                onlyReady
                  ? 'bg-[#f5b642]/15 border-[#f5b642] text-[#f5b642]'
                  : 'bg-[#1b2028] border-[#282f3c] text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{onlyReady ? 'READY ONLY' : 'ALL STATUS'}</span>
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
                    const lastPrice = m.lastPrice ?? ticker?.lastPrice;
                    const bestBid = m.bestBid ?? ticker?.bestBid;
                    const bestAsk = m.bestAsk ?? ticker?.bestAsk;
                    const rawChange = ticker?.priceChange24h;
                    const change =
                      rawChange !== null && rawChange !== undefined ? parseFloat(rawChange) : null;
                    const isPositive = change !== null && change >= 0;
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
                            <PairIcon baseAsset={m.baseAsset} quoteAsset={m.quoteAsset} size="md" />
                            <div>
                              <div className="font-bold text-white text-xs">
                                {m.baseAsset}/{m.quoteAsset}
                              </div>
                              <div className="text-[10px] text-[#5e6673] uppercase">{m.baseAsset}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric font-bold text-white text-sm">
                          {lastPrice ? formatPrice(lastPrice, m.tickSize) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric font-semibold">
                          {change === null || Number.isNaN(change) ? (
                            <span className="text-[#848e9c]">—</span>
                          ) : (
                            <span className={isPositive ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>
                              {isPositive ? '+' : ''}
                              {change.toFixed(2)}%
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric text-[#0ecb81] hidden sm:table-cell">
                          {bestBid ? formatPrice(bestBid, m.tickSize) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric text-[#f6465d] hidden sm:table-cell">
                          {bestAsk ? formatPrice(bestAsk, m.tickSize) : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-numeric text-[#848e9c] hidden md:table-cell">
                          {ticker?.volume24h && !Number.isNaN(parseFloat(ticker.volume24h))
                            ? `${parseFloat(ticker.volume24h).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${m.quoteAsset}`
                            : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right hidden lg:table-cell">
                          {m.status === 'READY' || m.status === 'OPEN' ? (
                            <Badge variant="green" size="sm">READY</Badge>
                          ) : m.status === 'RECOVERING' ? (
                            <Badge variant="yellow" size="sm">RECOVERING</Badge>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f6465d]/15 text-[#f6465d]">
                              {m.status}
                            </span>
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

      {/* Bottom Information Panels: Market Fee Schedule & Safety First */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Market Precision & Fee Schedule */}
        <div className="lg:col-span-8 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <TrendingUp className="w-4 h-4 text-[#f5b642]" />
              Exchange Precision &amp; Fee Schedule
            </div>
            <p className="text-xs text-[#848e9c]">Live trading rules and fees configured per trading pair.</p>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 font-numeric text-xs">
              {markets.slice(0, 4).map((m) => (
                <div
                  key={m.id}
                  onClick={() => navigate(`/trade/${m.symbol}`)}
                  className="p-3 bg-[#1b2028] rounded-lg border border-[#282f3c] hover:border-[#f5b642]/50 cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-sans font-bold text-white">{m.baseAsset}/{m.quoteAsset}</span>
                    <span className="text-[#0ecb81] font-semibold">
                      Maker {(Number(m.makerFeeRate || 0) * 100).toFixed(2)}% / Taker {(Number(m.takerFeeRate || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[11px] text-[#848e9c] flex justify-between">
                    <span>Tick: {m.tickSize}</span>
                    <span>Min Qty: {m.minOrderQty}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[11px] text-[#5e6673] mt-4 pt-3 border-t border-[#1c212a]">
            Tất cả dữ liệu độ chính xác &amp; phí giao dịch được đồng bộ trực tiếp từ Backend Market Registry.
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowPolicyModal(true)}
            className="w-full mt-4 text-xs font-semibold"
          >
            TRADING POLICY
          </Button>
        </div>
      </div>

      {/* Global Data Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14171d] border border-[#232933] rounded-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#232933] pb-3">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#f5b642]" />
                HAU-CEX Exchange Overview
              </div>
              <button type="button" onClick={() => setShowGlobalModal(false)} className="text-[#848e9c] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs font-numeric">
              <div className="flex justify-between p-2.5 bg-[#1b2028] rounded-lg">
                <span className="text-[#848e9c] font-sans">Tổng số cặp niêm yết</span>
                <span className="text-white font-bold">{markets.length}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[#1b2028] rounded-lg">
                <span className="text-[#848e9c] font-sans">Cặp đang hoạt động (READY)</span>
                <span className="text-[#0ecb81] font-bold">{readyMarketsCount}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[#1b2028] rounded-lg">
                <span className="text-[#848e9c] font-sans">Tạm dừng / Phục hồi</span>
                <span className="text-[#f5b642] font-bold">{pausedMarketsCount}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-[#1b2028] rounded-lg">
                <span className="text-[#848e9c] font-sans">Tổng khối lượng 24H (USDT pairs)</span>
                <span className="text-white font-bold">${total24hVolUsdt.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowGlobalModal(false)}>Đóng</Button>
            </div>
          </div>
        </div>
      )}

      {/* Trading Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#14171d] border border-[#232933] rounded-xl w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#232933] pb-3">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#f5b642]" />
                HAU-CEX Spot Trading Policy
              </div>
              <button type="button" onClick={() => setShowPolicyModal(false)} className="text-[#848e9c] hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="text-xs text-[#848e9c] space-y-2 leading-relaxed">
              <li>• <strong className="text-white">Loại lệnh hỗ trợ:</strong> Limit Order khớp theo nguyên tắc Price-Time Priority (FIFO ở từng mức giá).</li>
              <li>• <strong className="text-white">Khóa số dư (Order Lock):</strong> Đặt lệnh Mua khóa Quote asset (`price × quantity`); đặt lệnh Bán khóa Base asset (`quantity`).</li>
              <li>• <strong className="text-white">Độ chính xác:</strong> Giá phải chia hết cho `tickSize`; khối lượng phải chia hết cho `stepSize` và &ge; `minOrderQty`.</li>
              <li>• <strong className="text-white">Huỷ lệnh:</strong> Lệnh `PENDING`, `OPEN`, `PARTIALLY_FILLED` khi huỷ sẽ hoàn phần số dư còn lại về ví Available.</li>
            </ul>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setShowPolicyModal(false)}>Đã hiểu</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
