import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
  Award,
  Globe,
  PieChart,
} from 'lucide-react';
import { useCurrentUser } from '../hooks/useAuth';
import { useWallets, useMarkets } from '../hooks/useApi';
import { Button, Badge, Spinner, CoinIcon } from '../components/ui';
import { formatDecimal } from '../lib/utils';
import Decimal from 'decimal.js';

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const { data: balances = [], isLoading: loadingWallets } = useWallets();
  const { data: markets = [] } = useMarkets();

  // Tính total balance ước lượng USD (chỉ quy đổi khi market có lastPrice thực)
  let totalUsd = new Decimal(0);
  balances.forEach((b) => {
    try {
      if (b.asset === 'USDT') {
        totalUsd = totalUsd.add(new Decimal(b.total));
      } else {
        // Tìm market {b.asset}_USDT
        const m = markets.find((item) => item.baseAsset === b.asset && item.quoteAsset === 'USDT');
        const rawPrice = m?.lastPrice ?? m?.ticker?.lastPrice;
        if (rawPrice) {
          totalUsd = totalUsd.add(new Decimal(b.total).mul(new Decimal(rawPrice)));
        }
      }
    } catch {
      // ignore decimal error
    }
  });

  const btcMarket = markets.find((m) => m.symbol === 'BTC_USDT');
  const btcPrice = btcMarket?.lastPrice ?? btcMarket?.ticker?.lastPrice ?? null;
  let totalBtc: string;
  try {
    totalBtc =
      btcPrice && new Decimal(btcPrice).gt(0)
        ? totalUsd.div(new Decimal(btcPrice)).toFixed(8)
        : '0.00000000';
  } catch {
    totalBtc = '0.00000000';
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Overview</h1>
          <p className="text-xs text-[#848e9c] mt-1">
            Welcome back, <span className="text-[#eaecef] font-medium">{user?.email ?? 'Trader'}</span>. Here's what's happening with your portfolio today.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/wallet?action=deposit')}
            className="text-xs"
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-[#0ecb81]" />
            Deposit
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/wallet')}
            className="text-xs"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-[#f6465d]" />
            Withdraw
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/trade/BTC_USDT')}
            className="text-xs"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Trade Now
          </Button>
        </div>
      </div>

      {/* Top Banner Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Total Account Balance Card */}
        <div className="lg:col-span-7 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f5b642]" />
              <span className="text-xs font-semibold text-[#848e9c] uppercase tracking-wider">
                Total Account Balance
              </span>
            </div>
            <Badge variant="green" size="sm">
              <TrendingUp className="w-3 h-3" />
              +4.2% Today
            </Badge>
          </div>

          <div className="my-5">
            <div className="text-3xl sm:text-4xl font-black text-white font-numeric tracking-tight">
              ${totalUsd.toFixed(2)}
            </div>
            <div className="text-xs text-[#848e9c] font-numeric mt-1 flex items-center gap-2">
              <span>≈ {totalBtc} BTC</span>
              <span className="text-[#0ecb81] font-semibold">+$6,120.45 (24h)</span>
            </div>
          </div>

          {/* SVG PnL Chart Curve */}
          <div className="w-full h-24 mt-2">
            <svg viewBox="0 0 500 100" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5b642" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f5b642" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path
                d="M0,80 Q70,75 140,65 T280,45 T400,20 T500,10 L500,100 L0,100 Z"
                fill="url(#balanceGrad)"
              />
              <path
                d="M0,80 Q70,75 140,65 T280,45 T400,20 T500,10"
                fill="none"
                stroke="#f5b642"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <div className="flex items-center justify-between text-xs text-[#848e9c] pt-3 border-t border-[#1c212a] mt-2">
            <div>
              <span className="text-[#5e6673]">Active Margin:</span>{' '}
              <span className="text-[#eaecef] font-numeric font-medium">$12,500.00</span>
            </div>
            <div className="text-[11px] text-[#5e6673]">Updated real-time</div>
          </div>
        </div>

        {/* Market Stats 2x2 Grid + VIP Tier */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3.5">
            {/* Global Cap */}
            <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[#848e9c]">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-[#5e6673]" />
                  GLOBAL CAP
                </span>
                <span className="text-[11px] text-[#0ecb81] font-semibold">+1.2%</span>
              </div>
              <div className="text-xl font-bold text-white font-numeric mt-2">$2.45T</div>
            </div>

            {/* 24h Volume */}
            <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[#848e9c]">
                <span className="flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-[#5e6673]" />
                  24H VOLUME
                </span>
                <span className="text-[11px] text-[#f6465d] font-semibold">-4.5%</span>
              </div>
              <div className="text-xl font-bold text-white font-numeric mt-2">$68.4B</div>
            </div>

            {/* BTC Dominance */}
            <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[#848e9c]">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#5e6673]" />
                  BTC DOM
                </span>
                <span className="text-[11px] text-[#0ecb81] font-semibold">+0.8%</span>
              </div>
              <div className="text-xl font-bold text-white font-numeric mt-2">52.4%</div>
            </div>

            {/* Fear & Greed */}
            <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-[#848e9c]">
                <span className="flex items-center gap-1.5">
                  <PieChart className="w-3.5 h-3.5 text-[#5e6673]" />
                  FEAR / GREED
                </span>
                <span className="text-[11px] text-[#0ecb81] font-semibold">Greed</span>
              </div>
              <div className="text-xl font-bold text-white font-numeric mt-2">72/100</div>
            </div>
          </div>

          {/* VIP Trading Tier */}
          <div className="bg-gradient-to-r from-[#14171d] to-[#1e232d] border border-[#232933] rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#f5b642]/15 border border-[#f5b642]/30 flex items-center justify-center text-[#f5b642]">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  VIP Trading Tier: Pro
                  <Badge variant="yellow" size="sm">Active</Badge>
                </div>
                <div className="text-xs text-[#848e9c]">
                  Maker: 0.08% / Taker: 0.10% (30D Vol: $2.4M)
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={() => navigate('/profile')}
              className="text-xs"
            >
              Details
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom Section: Wallet Summary & Portfolio Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Wallet Summary */}
        <div className="lg:col-span-8 bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-[#232933] flex items-center justify-between">
            <div className="text-sm font-semibold text-white">Wallet Summary</div>
            <button
              onClick={() => navigate('/wallet')}
              className="text-xs text-[#f5b642] hover:underline cursor-pointer flex items-center gap-1 font-medium"
            >
              Manage Assets →
            </button>
          </div>

          {loadingWallets ? (
            <div className="p-8 flex justify-center">
              <Spinner />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[#848e9c] border-b border-[#1c212a] text-left">
                    <th className="py-3 px-4 font-medium">ASSET</th>
                    <th className="py-3 px-4 font-medium text-right">TOTAL BALANCE</th>
                    <th className="py-3 px-4 font-medium text-right">AVAILABLE</th>
                    <th className="py-3 px-4 font-medium text-right">LOCKED</th>
                    <th className="py-3 px-4 font-medium text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c212a]">
                  {balances.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#5e6673]">
                        No assets in wallet.
                      </td>
                    </tr>
                  ) : (
                    balances.map((b) => (
                      <tr key={b.asset} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <CoinIcon symbol={b.asset} size="sm" />
                            <span className="font-semibold text-white">{b.asset}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-numeric font-medium text-white">
                          {formatDecimal(b.total, 6)}
                        </td>
                        <td className="py-3 px-4 text-right font-numeric text-[#eaecef]">
                          {formatDecimal(b.available, 6)}
                        </td>
                        <td className="py-3 px-4 text-right font-numeric text-[#848e9c]">
                          {formatDecimal(b.locked, 6)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => navigate(`/trade/${b.asset === 'USDT' ? 'BTC_USDT' : `${b.asset}_USDT`}`)}
                            className="text-[#f5b642] hover:text-[#f5b642]"
                          >
                            Trade
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Portfolio Mix */}
        <div className="lg:col-span-4 bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div className="text-sm font-semibold text-white mb-4">Portfolio Mix</div>
          
          <div className="flex items-center justify-center py-4">
            {/* Visual Donut representation */}
            <div className="relative w-36 h-36 rounded-full border-8 border-[#0ecb81] border-r-[#f5b642] border-b-[#f5b642] flex items-center justify-center">
              <div className="text-center">
                <div className="text-[10px] text-[#848e9c] uppercase tracking-wider">Assets</div>
                <div className="text-lg font-bold text-white font-numeric">{balances.length || 2}</div>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f5b642]" />
                <CoinIcon symbol="BTC" size="xs" />
                <span className="text-[#eaecef]">Bitcoin (BTC)</span>
              </div>
              <span className="font-numeric font-semibold text-white">55%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ecb81]" />
                <CoinIcon symbol="USDT" size="xs" />
                <span className="text-[#eaecef]">Tether (USDT)</span>
              </div>
              <span className="font-numeric font-semibold text-white">45%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
