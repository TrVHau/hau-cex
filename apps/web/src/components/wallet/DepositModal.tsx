import { useState, type ChangeEvent, type FormEvent } from 'react';
import { X, Copy, CheckCircle2, ArrowDownRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, Input, Alert, Spinner, CoinIcon } from '../ui';
import { useDepositConfig, useCreateDepositIntent } from '../../hooks/useApi';
import { parseApiError, formatDateTime, formatDecimal, getDepositStatusMeta } from '../../lib/utils';
import type { DepositIntent } from '../../types';

interface DepositModalProps {
  onClose: () => void;
  assets: string[];
  initialAsset?: string;
  deposits: DepositIntent[];
}

const DEPOSIT_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export function DepositModal({ onClose, assets, initialAsset, deposits }: DepositModalProps) {
  const availableAssets = assets.length > 0 ? assets : ['USDT', 'BTC'];
  const [selectedAsset, setSelectedAsset] = useState<string>(
    initialAsset && availableAssets.includes(initialAsset) ? initialAsset : availableAssets[0],
  );
  const [depositorAddress, setDepositorAddress] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [createdIntent, setCreatedIntent] = useState<DepositIntent | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const {
    data: config,
    isLoading: loadingConfig,
    isError: isConfigError,
    error: configError,
    refetch: refetchConfig,
  } = useDepositConfig(selectedAsset);

  const createIntent = useCreateDepositIntent();

  // Sync realtime status từ danh sách deposits (nếu useUserSocket vừa cập nhật)
  const liveIntent = createdIntent
    ? (deposits.find((d) => d.depositId === createdIntent.depositId) ?? createdIntent)
    : null;

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(key);
      window.setTimeout(() => setCopiedField(null), 1800);
    } catch {
      // ignore clipboard permission errors
    }
  };

  const handleAssetChange = (asset: string) => {
    setSelectedAsset(asset);
    setCreatedIntent(null);
    setValidationError(null);
    createIntent.reset();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = depositorAddress.trim();
    if (!DEPOSIT_ADDRESS_REGEX.test(trimmed)) {
      setValidationError('Địa chỉ ví gửi phải có định dạng EVM hợp lệ (0x + 40 ký tự hex).');
      return;
    }
    setValidationError(null);
    createIntent.mutate(
      { asset: selectedAsset, depositorAddress: trimmed },
      {
        onSuccess: (intent) => {
          setCreatedIntent(intent);
        },
      },
    );
  };

  const renderCopyRow = (label: string, key: string, value: string) => (
    <div className="bg-[#0e1116] border border-[#232933] rounded-lg px-3 py-2 flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-[11px] text-[#5e6673] mb-0.5">{label}</div>
        <div className="text-xs font-mono text-[#eaecef] truncate">{value}</div>
      </div>
      <button
        type="button"
        onClick={() => handleCopy(key, value)}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-[#1e232d] text-[#848e9c] hover:text-white cursor-pointer"
        title="Sao chép"
      >
        {copiedField === key ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" />
            <span className="text-[#0ecb81]">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#14171d] border border-[#232933] rounded-xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#232933]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0ecb81]/15 flex items-center justify-center text-[#0ecb81]">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#eaecef]">Nạp tài sản On-Chain (Deposit)</h2>
              <p className="text-xs text-[#848e9c]">Tạo Deposit Intent để hệ thống theo dõi giao dịch vào Vault</p>
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

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Asset selector */}
          <div>
            <label className="text-xs font-medium text-[#848e9c] block mb-2">Chọn tài sản</label>
            <div className="flex flex-wrap gap-2">
              {availableAssets.map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => handleAssetChange(asset)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    selectedAsset === asset
                      ? 'bg-[#f5b642]/15 border-[#f5b642] text-[#f5b642]'
                      : 'bg-[#1b2028] border-[#282f3c] text-[#848e9c] hover:text-white'
                  }`}
                >
                  <CoinIcon symbol={asset} size="xs" />
                  <span>{asset}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Deposit Config */}
          {loadingConfig && (
            <div className="flex items-center gap-2 text-xs text-[#848e9c] py-3">
              <Spinner className="w-4 h-4" />
              Đang tải cấu hình nạp {selectedAsset}...
            </div>
          )}

          {isConfigError && (
            <Alert
              type="warning"
              message={`Chưa thể nạp ${selectedAsset}: ${parseApiError(configError)}`}
              onClose={() => refetchConfig()}
            />
          )}

          {config && !liveIntent && (
            <>
              <div className="bg-[#1b2028] border border-[#282f3c] rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#848e9c] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#0ecb81]" />
                    Chain ID: <span className="text-[#eaecef] font-mono">{config.chainId}</span>
                  </span>
                  <span className="text-[#848e9c]">
                    Confirmations: <span className="text-[#eaecef] font-mono">{config.requiredConfirmations}</span>
                  </span>
                </div>
                {renderCopyRow('Vault Contract Address', 'cfg-vault', config.vaultAddress)}
                {renderCopyRow(`${config.asset} Token Contract`, 'cfg-token', config.tokenAddress)}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  label="Địa chỉ ví gửi (Depositor Wallet Address)"
                  placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                  value={depositorAddress}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    setDepositorAddress(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  error={validationError ?? undefined}
                />

                {createIntent.isError && (
                  <Alert type="error" message={parseApiError(createIntent.error)} />
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={onClose}>
                    Huỷ
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={createIntent.isPending}
                    disabled={!depositorAddress.trim()}
                  >
                    Tạo Deposit Intent
                  </Button>
                </div>
              </form>
            </>
          )}

          {/* Created Intent Result */}
          {liveIntent && (
            <div className="space-y-3">
              {(() => {
                const statusMeta = getDepositStatusMeta(liveIntent.status);
                return (
                  <div className="bg-[#1b2028] border border-[#282f3c] rounded-lg p-3.5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-[#848e9c]">Deposit ID</div>
                        <div className="text-xs font-mono text-[#eaecef]">{liveIntent.depositId}</div>
                      </div>
                      <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold ${statusMeta.className}`}>
                        {statusMeta.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#0e1116] rounded px-2.5 py-2">
                        <div className="text-[#5e6673]">Tài sản / Số lượng</div>
                        <div className="font-mono text-[#eaecef] mt-0.5">
                          {liveIntent.amount ? `${formatDecimal(liveIntent.amount, 6)} ${liveIntent.asset}` : `Chờ gửi ${liveIntent.asset}`}
                        </div>
                      </div>
                      <div className="bg-[#0e1116] rounded px-2.5 py-2">
                        <div className="text-[#5e6673]">Confirmations / Hết hạn</div>
                        <div className="font-mono text-[#eaecef] mt-0.5">
                          {liveIntent.confirmationCount ?? 0} • {formatDateTime(liveIntent.expiresAt)}
                        </div>
                      </div>
                    </div>

                    {renderCopyRow('Account Reference (truyền vào deposit contract)', 'intent-ref', liveIntent.accountReference)}
                    {renderCopyRow('Vault Address', 'intent-vault', liveIntent.vaultAddress)}
                    {renderCopyRow('Token Address', 'intent-token', liveIntent.tokenAddress)}

                    {liveIntent.txHash && (
                      renderCopyRow('Transaction Hash', 'intent-tx', liveIntent.txHash)
                    )}
                  </div>
                );
              })()}

              <div className="text-xs text-[#848e9c] bg-[#0e1116] border border-[#232933] rounded-lg px-3 py-2 flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 text-[#f5b642] shrink-0" />
                <span>
                  Thực hiện chuyển {liveIntent.asset} vào Vault kèm Account Reference trước thời điểm hết hạn. Số dư sẽ tự động cập nhật khi đủ confirmations.
                </span>
              </div>

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreatedIntent(null);
                    createIntent.reset();
                  }}
                >
                  Tạo intent khác
                </Button>
                <Button type="button" variant="primary" size="sm" onClick={onClose}>
                  Hoàn tất
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
