import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import Decimal from 'decimal.js';
import { Spinner, CoinIcon } from '../ui';
import { formatDecimal } from '../../lib/utils';
import type { Market, WalletBalance } from '../../types';

interface WalletAssetsTableProps {
  balances: WalletBalance[];
  markets: Market[];
  isLoading: boolean;
  onDeposit: (asset: string) => void;
}

export function WalletAssetsTable({
  balances,
  markets,
  isLoading,
  onDeposit,
}: WalletAssetsTableProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ALL' | 'AVAILABLE' | 'LOCKED'>('ALL');
  const [sortBy, setSortBy] = useState<'ASSET' | 'TOTAL'>('ASSET');
  const [search, setSearch] = useState('');
  const [hideSmall, setHideSmall] = useState(false);

  const filteredBalances = balances
    .filter((b) => {
      const assetStr = b.asset || '';
      const matchesSearch = assetStr.toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;
      if (activeTab === 'AVAILABLE' && parseFloat(b.available) <= 0) return false;
      if (activeTab === 'LOCKED' && parseFloat(b.locked) <= 0) return false;
      if (hideSmall && parseFloat(b.total) <= 0.001) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'TOTAL') {
        return parseFloat(b.total) - parseFloat(a.total);
      }
      return a.asset.localeCompare(b.asset);
    });

  return (
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

            <button
              type="button"
              onClick={() => setSortBy((prev) => (prev === 'ASSET' ? 'TOTAL' : 'ASSET'))}
              title={`Sắp xếp theo: ${sortBy === 'ASSET' ? 'Tên Asset' : 'Số dư giảm dần'}`}
              className="px-2.5 py-1.5 rounded-lg bg-[#1b2028] border border-[#282f3c] text-xs text-[#848e9c] hover:text-[#eaecef] cursor-pointer inline-flex items-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{sortBy === 'ASSET' ? 'A-Z' : 'Balance'}</span>
            </button>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-5 text-xs font-semibold pt-1">
          {(
            [
              { key: 'ALL', label: 'ALL ASSETS' },
              { key: 'AVAILABLE', label: 'AVAILABLE > 0' },
              { key: 'LOCKED', label: 'IN ORDERS (LOCKED)' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-1 transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              {tab.label}
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
                  const pairMarket = markets.find(
                    (m) => m.baseAsset === b.asset && m.quoteAsset === 'USDT',
                  );
                  const price =
                    b.asset === 'USDT'
                      ? '1.00'
                      : (pairMarket?.lastPrice ?? pairMarket?.ticker?.lastPrice ?? null);
                  const valUsd = price
                    ? `$${new Decimal(b.total).mul(new Decimal(price)).toFixed(2)}`
                    : '—';
                  const rawChange = pairMarket?.ticker?.priceChange24h;
                  const changeVal =
                    rawChange !== null && rawChange !== undefined ? Number(rawChange) : null;

                  return (
                    <tr key={b.asset} className="hover:bg-[#1a1e26] transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <CoinIcon symbol={b.asset} size="md" />
                          <div>
                            <div className="font-bold text-white font-sans">{b.asset}</div>
                            <div className="text-[10px] text-[#5e6673] font-sans uppercase">
                              {b.asset === 'BTC'
                                ? 'BITCOIN'
                                : b.asset === 'USDT'
                                  ? 'TETHER'
                                  : b.asset}
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
                      <td className="py-3 px-4 text-right font-bold text-white">{valUsd}</td>
                      <td
                        className={`py-3 px-4 text-right font-semibold ${
                          changeVal === null || Number.isNaN(changeVal)
                            ? 'text-[#848e9c]'
                            : changeVal >= 0
                              ? 'text-[#0ecb81]'
                              : 'text-[#f6465d]'
                        }`}
                      >
                        {b.asset === 'USDT'
                          ? '0.00%'
                          : changeVal === null || Number.isNaN(changeVal)
                            ? '—'
                            : `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%`}
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => onDeposit(b.asset)}
                            className="text-xs font-semibold text-[#0ecb81] hover:underline cursor-pointer"
                          >
                            Deposit
                          </button>
                          <span className="text-[#2b3240]">|</span>
                          <button
                            onClick={() =>
                              navigate(`/trade/${b.asset === 'USDT' ? 'BTC_USDT' : `${b.asset}_USDT`}`)
                            }
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
  );
}
