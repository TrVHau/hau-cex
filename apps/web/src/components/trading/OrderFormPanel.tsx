import { useState, type FormEvent } from 'react';
import { usePlaceOrder } from '../../hooks/useApi';
import { Card, Button, Input, Alert } from '../ui';
import { parseApiError } from '../../lib/utils';
import type { WalletBalance, Market } from '../../types';

interface Props {
  market: Market;
  balances: WalletBalance[];
}

type Side = 'BUY' | 'SELL';

function getBalance(balances: WalletBalance[], asset: string): string {
  return balances.find((b) => b.asset === asset)?.available ?? '0';
}

export function OrderFormPanel({ market, balances }: Props) {
  const [side, setSide] = useState<Side>('BUY');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const placeOrder = usePlaceOrder();

  const availableBase = getBalance(balances, market.baseAsset);
  const availableQuote = getBalance(balances, market.quoteAsset);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!price || !quantity) {
      setError('Vui lòng nhập đầy đủ giá và số lượng');
      return;
    }
    if (parseFloat(price) <= 0 || parseFloat(quantity) <= 0) {
      setError('Giá và số lượng phải lớn hơn 0');
      return;
    }

    try {
      const order = await placeOrder.mutateAsync({
        symbol: market.symbol,
        side,
        type: 'LIMIT',
        price,
        quantity,
      });
      setSuccess(`Đặt lệnh thành công! ID: ${order.id.slice(0, 8)}...`);
      setPrice('');
      setQuantity('');
    } catch (err) {
      setError(parseApiError(err));
    }
  };

  return (
    <Card title="Place Order" className="h-full">
      {/* Side selector */}
      <div className="flex mb-4 rounded overflow-hidden border border-gray-600">
        <button
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            side === 'BUY'
              ? 'bg-green-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          onClick={() => setSide('BUY')}
          type="button"
        >
          BUY
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${
            side === 'SELL'
              ? 'bg-red-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
          onClick={() => setSide('SELL')}
          type="button"
        >
          SELL
        </button>
      </div>

      {/* Balance info */}
      <div className="text-xs text-gray-400 mb-3 flex justify-between">
        <span>Available {market.quoteAsset}:</span>
        <span className="text-gray-200">{parseFloat(availableQuote).toFixed(2)}</span>
      </div>
      <div className="text-xs text-gray-400 mb-4 flex justify-between">
        <span>Available {market.baseAsset}:</span>
        <span className="text-gray-200">{parseFloat(availableBase).toFixed(market.basePrecision)}</span>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-3">
        {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

        <div className="text-xs text-gray-500 uppercase tracking-wider">Limit Order</div>

        <Input
          label={`Price (${market.quoteAsset})`}
          type="number"
          placeholder={`0.${'0'.repeat(Math.max(0, market.quotePrecision - 1))}1`}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          suffix={market.quoteAsset}
          step={market.tickSize}
          min="0"
        />

        <Input
          label={`Quantity (${market.baseAsset})`}
          type="number"
          placeholder="0.00000001"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          suffix={market.baseAsset}
          step={`0.${'0'.repeat(market.basePrecision - 1)}1`}
          min="0"
        />

        {/* Total preview */}
        {price && quantity && (
          <div className="text-xs flex justify-between text-gray-400 bg-gray-700/50 rounded px-3 py-2">
            <span>Total ≈</span>
            <span className="text-gray-200">
              {(parseFloat(price) * parseFloat(quantity)).toFixed(2)} {market.quoteAsset}
            </span>
          </div>
        )}

        <Button
          type="submit"
          variant={side === 'BUY' ? 'buy' : 'sell'}
          size="lg"
          isLoading={placeOrder.isPending}
          className="w-full mt-2"
        >
          {side === 'BUY' ? `Buy ${market.baseAsset}` : `Sell ${market.baseAsset}`}
        </Button>
      </form>
    </Card>
  );
}
