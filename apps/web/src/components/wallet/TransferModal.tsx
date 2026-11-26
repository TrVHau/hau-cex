import { useState, type FormEvent } from 'react';
import { X, ArrowLeftRight } from 'lucide-react';
import Decimal from 'decimal.js';
import { Button, Input, Alert } from '../ui';
import { useTransferInternal } from '../../hooks/useApi';
import { formatDecimal, parseApiError } from '../../lib/utils';
import type { WalletBalance } from '../../types';

interface TransferModalProps {
  onClose: () => void;
  balances: WalletBalance[];
  initialAsset?: string;
}

export function TransferModal({ onClose, balances, initialAsset }: TransferModalProps) {
  const assets = balances.length > 0 ? balances.map((b) => b.asset) : ['USDT', 'BTC'];
  const defaultAsset =
    initialAsset && assets.includes(initialAsset)
      ? initialAsset
      : (balances.find((b) => Number(b.available) > 0)?.asset ?? assets[0]);

  const [selectedAsset, setSelectedAsset] = useState(defaultAsset);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const transferMutation = useTransferInternal();
  const currentBalance = balances.find((b) => b.asset === selectedAsset);
  const available = currentBalance?.available ?? '0';

  const handleSetMax = () => {
    try {
      const dec = new Decimal(available);
      if (dec.gt(0)) setAmount(dec.toFixed());
    } catch {
      // ignore
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMsg(null);

    const email = recipientEmail.trim();
    if (!email.includes('@')) {
      setValidationError('Email người nhận không hợp lệ.');
      return;
    }

    let amtDec: Decimal;
    let availDec: Decimal;
    try {
      amtDec = new Decimal(amount.trim());
      availDec = new Decimal(available);
    } catch {
      setValidationError('Số lượng chuyển không hợp lệ.');
      return;
    }

    if (amtDec.lte(0)) {
      setValidationError('Số lượng chuyển phải lớn hơn 0.');
      return;
    }
    if (amtDec.gt(availDec)) {
      setValidationError(`Số dư khả dụng ${selectedAsset} không đủ.`);
      return;
    }

    transferMutation.mutate(
      {
        assetSymbol: selectedAsset,
        recipientEmail: email,
        amount: amtDec.toFixed(),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      {
        onSuccess: (t) => {
          setSuccessMsg(
            `Đã chuyển ${formatDecimal(t.amount, 6)} ${t.assetSymbol} tới ${t.recipientEmail} (Phí 0%).`,
          );
          setAmount('');
          setNote('');
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#14171d] border border-[#232933] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232933]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f5b642]/15 flex items-center justify-center text-[#f5b642]">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Chuyển nội bộ (Internal Transfer)</h2>
              <p className="text-xs text-[#848e9c]">Chuyển tức thì qua email giữa tài khoản HAU-CEX (Miễn phí)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#848e9c] hover:text-white p-1 rounded-lg hover:bg-[#1e232d] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-[#848e9c] block mb-2">Tài sản</label>
            <div className="flex flex-wrap gap-2">
              {assets.map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => {
                    setSelectedAsset(asset);
                    setValidationError(null);
                    setSuccessMsg(null);
                    transferMutation.reset();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    selectedAsset === asset
                      ? 'bg-[#f5b642]/15 border-[#f5b642] text-[#f5b642]'
                      : 'bg-[#1b2028] border-[#282f3c] text-[#848e9c] hover:text-white'
                  }`}
                >
                  {asset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs bg-[#1b2028] border border-[#282f3c] rounded-lg px-3 py-2">
            <span className="text-[#848e9c]">Khả dụng ({selectedAsset})</span>
            <span className="font-mono font-semibold text-white">{formatDecimal(available, 8)}</span>
          </div>

          <Input
            label="Email người nhận"
            type="email"
            placeholder="recipient@hau.edu.vn"
            value={recipientEmail}
            onChange={(e) => {
              setRecipientEmail(e.target.value);
              if (validationError) setValidationError(null);
            }}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#848e9c]">Số lượng</label>
              <button
                type="button"
                onClick={handleSetMax}
                className="text-[11px] font-semibold text-[#f5b642] hover:underline cursor-pointer"
              >
                MAX
              </button>
            </div>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (validationError) setValidationError(null);
              }}
              suffix={selectedAsset}
              required
            />
          </div>

          <Input
            label="Ghi chú (không bắt buộc)"
            type="text"
            maxLength={200}
            placeholder="Thanh toán..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {validationError && <Alert type="error" message={validationError} />}
          {transferMutation.isError && (
            <Alert type="error" message={parseApiError(transferMutation.error)} />
          )}
          {successMsg && <Alert type="success" message={successMsg} />}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={transferMutation.isPending}
            >
              Chuyển ngay
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
