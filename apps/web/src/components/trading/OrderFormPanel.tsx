import { useState, type FormEvent } from 'react';
import { usePlaceOrder } from '../../hooks/useApi';
import { Button, Input, Alert } from '../ui';
import { parseApiError } from '../../lib/utils';
import type { WalletBalance, Market } from '../../types';
import Decimal from 'decimal.js';

interface Props {
  market: Market;
  balances: WalletBalance[];
}

function getAvailable(balances: WalletBalance[], asset: string): string {
  const b = balances.find((item) => item.asset === asset);
  return b?.available ?? '0';
}

export function OrderFormPanel({ market, balances }: Props) {
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET' | 'STOP_LIMIT'>('LIMIT');

  // Buy form state
  const [buyPrice, setBuyPrice] = useState(market.ticker?.lastPrice ?? '64231.50');
  const [buyQty, setBuyQty] = useState('');

  // Sell form state
  const [sellPrice, setSellPrice] = useState(market.ticker?.lastPrice ?? '64231.50');
  const [sellQty, setSellQty] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const placeOrder = usePlaceOrder();

  const availQuote = getAvailable(balances, market.quoteAsset);
  const availBase = getAvailable(balances, market.baseAsset);

  // Percentage click handlers
  const handleBuyPercent = (pct: number) => {
    try {
      if (!buyPrice || parseFloat(buyPrice) <= 0) return;
      const budget = new Decimal(availQuote).mul(pct).div(100);
      const qty = budget.div(new Decimal(buyPrice));
      setBuyQty(qty.toFixed(market.basePrecision));
    } catch {
      // ignore
    }
  };

  const handleSellPercent = (pct: number) => {
    try {
      const qty = new Decimal(availBase).mul(pct).div(100);
      setSellQty(qty.toFixed(market.basePrecision));
    } catch {
      // ignore
    }
  };

  const handleBuySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await placeOrder.mutateAsync({
        symbol: market.symbol,
        side: 'BUY',
        type: 'LIMIT',
        price: buyPrice,
        quantity: buyQty,
      });
      setSuccess(`Buy order placed successfully!`);
      setBuyQty('');
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  const handleSellSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await placeOrder.mutateAsync({
        symbol: market.symbol,
        side: 'SELL',
        type: 'LIMIT',
        price: sellPrice,
        quantity: sellQty,
      });
      setSuccess(`Sell order placed successfully!`);
      setSellQty('');
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  return (
    <div className="bg-[#14171d] border border-[#232933] rounded-xl p-4 flex flex-col justify-between">
      {/* Top Header: Order types + Fees */}
      <div className="flex items-center justify-between border-b border-[#232933] pb-3 mb-4">
        <div className="flex items-center gap-4 text-xs font-semibold">
          {(['LIMIT', 'MARKET', 'STOP_LIMIT'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`pb-1 transition-colors cursor-pointer ${
                orderType === t
                  ? 'text-[#f5b642] border-b-2 border-[#f5b642]'
                  : 'text-[#848e9c] hover:text-[#eaecef]'
              }`}
            >
              {t === 'LIMIT' ? 'Limit' : t === 'MARKET' ? 'Market' : 'Stop Limit'}
            </button>
          ))}
        </div>
        <div className="text-[11px] text-[#5e6673]">Trading Fees: 0.1%</div>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} className="mb-3" />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} className="mb-3" />}

      {/* Side-by-Side Buy and Sell Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* BUY COLUMN */}
        <form onSubmit={(e) => { void handleBuySubmit(e); }} className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#848e9c]">Available</span>
            <span className="text-[#eaecef] font-numeric font-medium">
              {parseFloat(availQuote).toFixed(2)} {market.quoteAsset}
            </span>
          </div>

          <Input
            label="PRICE"
            type="number"
            step={market.tickSize}
            min="0"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            suffix={market.quoteAsset}
          />

          <Input
            label="AMOUNT"
            type="number"
            step={`0.${'0'.repeat(Math.max(0, market.basePrecision - 1))}1`}
            min="0"
            value={buyQty}
            onChange={(e) => setBuyQty(e.target.value)}
            suffix={market.baseAsset}
          />

          {/* 25% 50% 75% 100% buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleBuyPercent(pct)}
                className="py-1 text-[11px] font-medium bg-[#1e232d] hover:bg-[#282f3c] text-[#848e9c] hover:text-white rounded border border-[#2b3240] transition-colors cursor-pointer"
              >
                {pct}%
              </button>
            ))}
          </div>

          <Button
            type="submit"
            variant="buy"
            size="md"
            isLoading={placeOrder.isPending}
            className="w-full mt-2 font-bold tracking-wide"
          >
            BUY {market.baseAsset}
          </Button>
        </form>

        {/* SELL COLUMN */}
        <form onSubmit={(e) => { void handleSellSubmit(e); }} className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#848e9c]">Available</span>
            <span className="text-[#eaecef] font-numeric font-medium">
              {parseFloat(availBase).toFixed(market.basePrecision)} {market.baseAsset}
            </span>
          </div>

          <Input
            label="PRICE"
            type="number"
            step={market.tickSize}
            min="0"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            suffix={market.quoteAsset}
          />

          <Input
            label="AMOUNT"
            type="number"
            step={`0.${'0'.repeat(Math.max(0, market.basePrecision - 1))}1`}
            min="0"
            value={sellQty}
            onChange={(e) => setSellQty(e.target.value)}
            suffix={market.baseAsset}
          />

          {/* 25% 50% 75% 100% buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => handleSellPercent(pct)}
                className="py-1 text-[11px] font-medium bg-[#1e232d] hover:bg-[#282f3c] text-[#848e9c] hover:text-white rounded border border-[#2b3240] transition-colors cursor-pointer"
              >
                {pct}%
              </button>
            ))}
          </div>

          <Button
            type="submit"
            variant="sell"
            size="md"
            isLoading={placeOrder.isPending}
            className="w-full mt-2 font-bold tracking-wide"
          >
            SELL {market.baseAsset}
          </Button>
        </form>
      </div>
    </div>
  );
}
