import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  Filter,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Lock,
} from 'lucide-react';
import { useWallets, useMarkets } from '../hooks/useApi';
import { Button, Badge, Spinner } from '../components/ui';
import { formatDecimal } from '../lib/utils';
import Decimal from 'decimal.js';

export function WalletPage() {
  const navigate = useNavigate();
  const { data: balances = [], isLoading } = useWallets();
  const { data: markets = [] } = useMarkets();

  const [activeTab, setActiveTab] = useState<'ALL' | 'MAIN' | 'TRADING' | 'STAKING' | 'EARN'>('ALL');
  const [search, setSearch] = useState('');
  const [hideSmall, setHideSmall] = useState(false);

  // Tính toán Equity ước lượng
  let totalEquityUsd = new Decimal(0);
  let availableEquityUsd = new Decimal(0);
  let lockedEquityUsd = new Decimal(0);

  balances.forEach((b) => {
    try {
      const price = b.asset === 'USDT'
        ? new Decimal(1)
        : new Decimal(markets.find((m) => m.baseAsset === b.asset && m.quoteAsset === 'USDT')?.ticker?.lastPrice ?? 64231.5);

      totalEquityUsd = totalEquityUsd.add(new Decimal(b.total).mul(price));
      availableEquityUsd = availableEquityUsd.add(new Decimal(b.available).mul(price));
      lockedEquityUsd = lockedEquityUsd.add(new Decimal(b.locked).mul(price));
    } catch {
      // ignore
    }
  });

  const btcPrice = markets.find((m) => m.symbol === 'BTC_USDT')?.ticker?.lastPrice ?? '64231.50';
  let totalBtc = '0.000000';
  let availBtc = '0.000000';
  let lockedBtc = '0.000000';
  try {
    const p = new Decimal(btcPrice);
    totalBtc = totalEquityUsd.div(p).toFixed(6);
    availBtc = availableEquityUsd.div(p).toFixed(6);
    lockedBtc = lockedEquityUsd.div(p).toFixed(6);
  } catch {
    // ignore
  }

  const filteredBalances = balances.filter((b) => {
    const matchesSearch = b.asset.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (hideSmall && parseFloat(b.total) <= 0.001) return false;
    return true;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">Asset Wallet</h1>
            <Badge variant="yellow" size="sm">
              <ShieldCheck className="w-3 h-3 text-[#f5b642]" />
              VERIFIED ACCOUNT
            </Badge>
          </div>
          <p className="text-xs text-[#848e9c] mt-1">
            Manage your cryptocurrency holdings and account equity.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="primary" size="sm" className="font-semibold text-xs">
            <ArrowDownRight className="w-3.5 h-3.5" />
            DEPOSIT
          </Button>
          <Button variant="secondary" size="sm" className="text-xs">
            <ArrowUpRight className="w-3.5 h-3.5" />
            WITHDRAW
          </Button>
          <Button variant="secondary" size="sm" className="text-xs">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            TRANSFER
          </Button>
        </div>
      </div>

      {/* ─── Top 3 Stat Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Estimated Total Equity */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="font-semibold uppercase tracking-wider">Estimated Total Equity</span>
            <Wallet className="w-4 h-4 text-[#f5b642]" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-numeric tracking-tight">
              ${totalEquityUsd.toFixed(2)}
            </div>
            <div className="text-xs text-[#848e9c] font-numeric mt-1">
              ≈ {totalBtc} BTC
            </div>
          </div>
          <div className="text-xs text-[#0ecb81] font-semibold flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            +$1,240 (2.1%)
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="font-semibold uppercase tracking-wider">Available Balance</span>
            <span className="w-4 h-4 rounded-full bg-[#0ecb81]/20 flex items-center justify-center text-[#0ecb81] text-[10px] font-bold">
              ✓
            </span>
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-numeric tracking-tight">
              ${availableEquityUsd.toFixed(2)}
            </div>
            <div className="text-xs text-[#848e9c] font-numeric mt-1">
              ≈ {availBtc} BTC
            </div>
          </div>
          <div className="text-xs text-[#848e9c]">
            Ready for trading or withdrawal
          </div>
        </div>

        {/* Locked In Orders */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="font-semibold uppercase tracking-wider">Locked (In Orders)</span>
            <Lock className="w-4 h-4 text-[#f5b642]" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-numeric tracking-tight">
              ${lockedEquityUsd.toFixed(2)}
            </div>
            <div className="text-xs text-[#848e9c] font-numeric mt-1">
              ≈ {lockedBtc} BTC
            </div>
          </div>
          <div className="text-xs text-[#848e9c]">
            Committed to active limit orders
          </div>
        </div>
      </div>

      {/* ─── Spot Assets Section ─── */}
      <div className="bg-[#14171d] border border-[#232933] rounded-xl overflow-hidden">
        {/* Title & Controls */}
        <div className="p-4 border-b border-[#232933] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-white">Spot Assets</div>
              <div className="text-[11px] text-[#848e9c]">
                DETAILED BREAKDOWN OF YOUR CRYPTOCURRENCY POSITIONS.
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#5e6673] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-[#1b2028] border border-[#282f3c] focus:border-[#f5b642] rounded-lg py-1.5 pl-8 pr-3 text-xs text-[#eaecef] placeholder-[#5e6673] outline-none"
                />
              </div>

              <label className="flex items-center gap-1.5 text-xs text-[#848e9c] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hideSmall}
                  onChange={(e) => setHideSmall(e.target.checked)}
                  className="accent-[#f5b642] rounded"
                />
                <span>Hide small assets</span>
              </label>

              <button className="p-2 rounded-lg bg-[#1b2028] border border-[#282f3c] text-[#848e9c] hover:text-[#eaecef] cursor-pointer">
                <Filter className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-5 text-xs font-semibold pt-1">
            {(['ALL', 'MAIN', 'TRADING', 'STAKING', 'EARN'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-1 transition-colors cursor-pointer ${
                  activeTab === tab
                    ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                    : 'text-[#848e9c] hover:text-[#eaecef]'
                }`}
              >
                {tab === 'ALL' ? 'ALL ASSETS' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Assets Table */}
        {isLoading ? (
          <div className="p-12 flex justify-center">
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
                  <th className="py-3 px-4 font-medium text-right">VALUE (USD)</th>
                  <th className="py-3 px-4 font-medium text-right">24H CHANGE</th>
                  <th className="py-3 px-4 font-medium text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1c212a] font-numeric">
                {filteredBalances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-[#5e6673] font-sans">
                      No assets found.
                    </td>
                  </tr>
                ) : (
                  filteredBalances.map((b) => {
                    const price = b.asset === 'USDT'
                      ? '1.00'
                      : (markets.find((m) => m.baseAsset === b.asset && m.quoteAsset === 'USDT')?.ticker?.lastPrice ?? '64231.50');
                    const valUsd = new Decimal(b.total).mul(new Decimal(price)).toFixed(2);

                    return (
                      <tr key={b.asset} className="hover:bg-[#1a1e26] transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-7 h-7 rounded-full bg-[#1e232d] border border-[#2b3240] flex items-center justify-center font-bold text-xs text-[#f5b642] font-sans">
                              {b.asset.slice(0, 3)}
                            </div>
                            <div>
                              <div className="font-bold text-white font-sans">{b.asset}</div>
                              <div className="text-[10px] text-[#5e6673] font-sans uppercase">
                                {b.asset === 'BTC' ? 'BITCOIN' : b.asset === 'USDT' ? 'TETHER' : b.asset}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-white">
                          {formatDecimal(b.total, 8)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#eaecef]">
                          {formatDecimal(b.available, 8)}
                        </td>
                        <td className="py-3 px-4 text-right text-[#848e9c]">
                          {formatDecimal(b.locked, 8)}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-white">
                          ${valUsd}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold text-[#0ecb81]">
                          +2.45%
                        </td>
                        <td className="py-3 px-4 text-right font-sans">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => navigate(`/trade/${b.asset === 'USDT' ? 'BTC_USDT' : `${b.asset}_USDT`}`)}
                              className="text-xs font-semibold text-[#f5b642] hover:underline cursor-pointer"
                            >
                              Trade
                            </button>
                            <span className="text-[#2b3240]">|</span>
                            <button
                              onClick={() => navigate('/ledger')}
                              className="text-xs text-[#848e9c] hover:text-[#eaecef] cursor-pointer"
                            >
                              Ledger
                            </button>
                          </div>
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

      {/* ─── Bottom Panels (Security Checklist, Growth, Buy Crypto) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Security Checklist */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <ShieldCheck className="w-4 h-4 text-[#f5b642]" />
              Security Checklist
            </div>
            <ul className="text-xs space-y-3">
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#eaecef]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" />
                  <span>2FA Authenticator</span>
                </div>
                <Badge variant="green" size="sm">ENABLED</Badge>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#eaecef]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" />
                  <span>Anti-Phishing Code</span>
                </div>
                <Badge variant="green" size="sm">VERIFIED</Badge>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#eaecef]">
                  <span className="w-3.5 h-3.5 rounded-full border border-[#f5b642] flex items-center justify-center text-[9px] text-[#f5b642]">
                    !
                  </span>
                  <span>Withdrawal Whitelist</span>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="text-xs text-[#f5b642] hover:underline cursor-pointer"
                >
                  CONFIGURE
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Growth Opportunities */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <TrendingUp className="w-4 h-4 text-[#0ecb81]" />
              Growth Opportunities
            </div>
            <div className="space-y-2.5">
              <div className="p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">ETH Liquid Staking</div>
                  <div className="text-[10px] text-[#848e9c]">Up to 4.5% APR</div>
                </div>
                <span className="text-xs text-[#f5b642] font-semibold">Stake →</span>
              </div>

              <div className="p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">USDT Savings</div>
                  <div className="text-[10px] text-[#848e9c]">7.2% APY (Fixed)</div>
                </div>
                <span className="text-xs text-[#f5b642] font-semibold">Earn →</span>
              </div>
            </div>
          </div>
        </div>

        {/* Buy Crypto */}
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <CreditCard className="w-4 h-4 text-[#f5b642]" />
              Buy Crypto
            </div>
            <p className="text-xs text-[#848e9c] mt-1">
              Instantly purchase assets using your linked credit card or bank account.
            </p>
          </div>

          <div className="mt-4">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/trade/BTC_USDT')}
              className="w-full font-bold"
            >
              GET STARTED
            </Button>
            <div className="flex items-center justify-center gap-3 text-[10px] text-[#5e6673] mt-2 uppercase tracking-wider">
              <span>Visa</span>
              <span>•</span>
              <span>Mastercard</span>
              <span>•</span>
              <span>Apple Pay</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
