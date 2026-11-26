import { useState, type FormEvent } from 'react';
import { X, ArrowUpRight, ShieldAlert } from 'lucide-react';
import Decimal from 'decimal.js';
import { Button, Input, Alert } from '../ui';
import { useRequestWithdrawal } from '../../hooks/useApi';
import { formatDecimal, parseApiError } from '../../lib/utils';
import type { WalletBalance } from '../../types';

interface WithdrawModalProps {
  onClose: () => void;
  balances: WalletBalance[];
  initialAsset?: string;
}

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function WithdrawModal({ onClose, balances, initialAsset }: WithdrawModalProps) {
  const assets = balances.length > 0 ? balances.map((b) => b.asset) : ['USDT', 'BTC'];
  const defaultAsset =
    initialAsset && assets.includes(initialAsset)
      ? initialAsset
      : (balances.find((b) => Number(b.available) > 0)?.asset ?? assets[0]);

  const [selectedAsset, setSelectedAsset] = useState(defaultAsset);
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const requestWithdrawal = useRequestWithdrawal();
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

    const addr = toAddress.trim();
    if (!ETH_ADDRESS_REGEX.test(addr)) {
      setValidationError('Địa chỉ nhận phải đúng chuẩn EVM (0x + 40 ký tự hex).');
      return;
    }

    let amtDec: Decimal;
    let availDec: Decimal;
    try {
      amtDec = new Decimal(amount.trim());
      availDec = new Decimal(available);
    } catch {
      setValidationError('Số lượng rút không hợp lệ.');
      return;
    }

    if (amtDec.lte(0)) {
      setValidationError('Số lượng rút phải lớn hơn 0.');
      return;
    }
    if (amtDec.gt(availDec)) {
      setValidationError(`Số dư khả dụng ${selectedAsset} không đủ.`);
      return;
    }

    requestWithdrawal.mutate(
      {
        assetSymbol: selectedAsset,
        toAddress: addr,
        amount: amtDec.toFixed(),
      },
      {
        onSuccess: (w) => {
          setSuccessMsg(
            `Đã tạo lệnh rút ${formatDecimal(w.amount, 6)} ${w.assetSymbol} (ID: ${w.id.slice(0, 8)}...).`,
          );
          setAmount('');
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#14171d] border border-[#232933] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232933]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f6465d]/15 flex items-center justify-center text-[#f6465d]">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Rút tài sản (Withdraw)</h2>
              <p className="text-xs text-[#848e9c]">Số dư khả dụng sẽ được trừ và chờ duyệt</p>
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
                    requestWithdrawal.reset();
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
            label="Địa chỉ ví nhận (0x...)"
            placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
            value={toAddress}
            onChange={(e) => {
              setToAddress(e.target.value);
              if (validationError) setValidationError(null);
            }}
            required
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[#848e9c]">Số lượng rút</label>
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

          {validationError && <Alert type="error" message={validationError} />}
          {requestWithdrawal.isError && (
            <Alert type="error" message={parseApiError(requestWithdrawal.error)} />
          )}
          {successMsg && <Alert type="success" message={successMsg} />}

          <div className="text-[11px] text-[#848e9c] bg-[#0e1116] border border-[#232933] rounded-lg px-3 py-2 flex items-start gap-2">
            <ShieldAlert className="w-3.5 h-3.5 text-[#f5b642] shrink-0 mt-0.5" />
            <span>Kiểm tra kỹ địa chỉ nhận. Bạn có thể tự huỷ khi lệnh còn trạng thái PENDING để hoàn số dư.</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Đóng
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={requestWithdrawal.isPending}
            >
              Xác nhận rút
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
