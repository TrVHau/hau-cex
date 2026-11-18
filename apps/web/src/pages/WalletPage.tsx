import { useState } from 'react';
import { useWallets, useLedger } from '../hooks/useApi';
import { Card, Badge, Spinner } from '../components/ui';
import { formatDecimal, formatDateTime } from '../lib/utils';
import type { LedgerEntry } from '../types';

function entryTypeBadge(type: LedgerEntry['entryType']) {
  switch (type) {
    case 'DEPOSIT':
      return <Badge variant="green">DEPOSIT</Badge>;
    case 'WITHDRAWAL':
      return <Badge variant="red">WITHDRAWAL</Badge>;
    case 'TRADE_CREDIT':
      return <Badge variant="blue">TRADE IN</Badge>;
    case 'TRADE_DEBIT':
      return <Badge variant="yellow">TRADE OUT</Badge>;
    case 'FEE':
      return <Badge variant="red">FEE</Badge>;
    default:
      return <Badge>{type}</Badge>;
  }
}

export function WalletPage() {
  const { data: balances, isLoading: loadingBalances } = useWallets();
  const [selectedAsset, setSelectedAsset] = useState<string | undefined>(undefined);
  const { data: ledger, isLoading: loadingLedger } = useLedger(selectedAsset);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-white">Wallet</h1>

      {/* Balances */}
      <Card title="Balances">
        {loadingBalances && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {balances && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 font-medium">Asset</th>
                <th className="text-right pb-2 font-medium">Available</th>
                <th className="text-right pb-2 font-medium">Locked</th>
                <th className="text-right pb-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-gray-500">
                    Chưa có tài sản nào
                  </td>
                </tr>
              )}
              {balances.map((balance) => (
                <tr
                  key={balance.asset}
                  className="border-b border-gray-700/40 hover:bg-gray-700/20 cursor-pointer"
                  onClick={() =>
                    setSelectedAsset(selectedAsset === balance.asset ? undefined : balance.asset)
                  }
                >
                  <td className="py-2 font-semibold text-white">{balance.asset}</td>
                  <td className="py-2 text-right font-mono text-gray-200">
                    {formatDecimal(balance.available, 8)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-400">
                    {formatDecimal(balance.locked, 8)}
                  </td>
                  <td className="py-2 text-right font-mono text-gray-100 font-semibold">
                    {formatDecimal(balance.total, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {selectedAsset && (
          <div className="mt-2 text-xs text-blue-400">
            Hiển thị ledger cho {selectedAsset} — click lại để bỏ filter
          </div>
        )}
      </Card>

      {/* Ledger */}
      <Card title={`Transaction History${selectedAsset ? ` — ${selectedAsset}` : ''}`}>
        {loadingLedger && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}
        {ledger && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left pb-2 font-medium">Type</th>
                <th className="text-left pb-2 font-medium">Asset</th>
                <th className="text-right pb-2 font-medium">Amount</th>
                <th className="text-right pb-2 font-medium">Balance After</th>
                <th className="text-right pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">
                    Chưa có giao dịch nào
                  </td>
                </tr>
              )}
              {ledger.map((entry) => {
                const isPositive = ['DEPOSIT', 'TRADE_CREDIT'].includes(entry.entryType);
                return (
                  <tr key={entry.id} className="border-b border-gray-700/40 hover:bg-gray-700/20">
                    <td className="py-2">{entryTypeBadge(entry.entryType)}</td>
                    <td className="py-2 text-gray-300">{entry.asset}</td>
                    <td
                      className={`py-2 text-right font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {isPositive ? '+' : '-'}
                      {formatDecimal(entry.amount, 8)}
                    </td>
                    <td className="py-2 text-right font-mono text-gray-300">
                      {formatDecimal(entry.balanceAfter, 8)}
                    </td>
                    <td className="py-2 text-right text-gray-500">
                      {formatDateTime(entry.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
