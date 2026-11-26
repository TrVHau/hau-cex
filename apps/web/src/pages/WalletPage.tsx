import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Lock,
} from 'lucide-react';
import Decimal from 'decimal.js';
import { useWallets, useMarkets, useDeposits } from '../hooks/useApi';
import { useCurrentUser } from '../hooks/useAuth';
import { useUserSocket } from '../hooks/useWebSocket';
import { DepositModal } from '../components/wallet/DepositModal';
import { WithdrawModal } from '../components/wallet/WithdrawModal';
import { TransferModal } from '../components/wallet/TransferModal';
import { WalletAssetsTable } from '../components/wallet/WalletAssetsTable';
import { WalletHistorySection } from '../components/wallet/WalletHistorySection';
import { Button, Badge } from '../components/ui';

export function WalletPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: user } = useCurrentUser();
  useUserSocket(user?.userId);
  const { data: balances = [], isLoading } = useWallets();
  const { data: markets = [] } = useMarkets();
  const { data: deposits = [], isLoading: loadingDeposits } = useDeposits();

  const [depositModal, setDepositModal] = useState<{ open: boolean; asset?: string }>({ open: false });
  const [withdrawModal, setWithdrawModal] = useState<{ open: boolean; asset?: string }>({ open: false });
  const [transferModal, setTransferModal] = useState<{ open: boolean; asset?: string }>({ open: false });

  const actionParam = searchParams.get('action');
  const assetParam = searchParams.get('asset');
  const isDepositOpen = depositModal.open || actionParam === 'deposit';
  const depositInitialAsset = depositModal.asset ?? assetParam ?? undefined;

  const openDepositModal = (asset?: string) => {
    setDepositModal({ open: true, asset });
  };

  const closeDepositModal = () => {
    setDepositModal({ open: false });
    if (actionParam === 'deposit' || assetParam) {
      setSearchParams({}, { replace: true });
    }
  };

  const depositAssets = Array.from(
    new Set([
      ...balances.map((b) => b.asset),
      ...markets.flatMap((m) => [m.baseAsset, m.quoteAsset]),
      'USDT',
      'BTC',
    ]),
  );

  // Tính toán Equity ước lượng
  let totalEquityUsd = new Decimal(0);
  let availableEquityUsd = new Decimal(0);
  let lockedEquityUsd = new Decimal(0);

  balances.forEach((b) => {
    try {
      let price: Decimal | null = null;
      if (b.asset === 'USDT') {
        price = new Decimal(1);
      } else {
        const m = markets.find((item) => item.baseAsset === b.asset && item.quoteAsset === 'USDT');
        const rawPrice = m?.lastPrice ?? m?.ticker?.lastPrice;
        if (rawPrice) {
          price = new Decimal(rawPrice);
        }
      }

      if (price) {
        totalEquityUsd = totalEquityUsd.add(new Decimal(b.total).mul(price));
        availableEquityUsd = availableEquityUsd.add(new Decimal(b.available).mul(price));
        lockedEquityUsd = lockedEquityUsd.add(new Decimal(b.locked).mul(price));
      }
    } catch {
      // ignore
    }
  });

  const btcMarket = markets.find((m) => m.symbol === 'BTC_USDT');
  const btcPrice = btcMarket?.lastPrice ?? btcMarket?.ticker?.lastPrice ?? null;
  let totalBtc = '0.000000';
  let availBtc = '0.000000';
  let lockedBtc = '0.000000';
  try {
    if (btcPrice && new Decimal(btcPrice).gt(0)) {
      const p = new Decimal(btcPrice);
      totalBtc = totalEquityUsd.div(p).toFixed(6);
      availBtc = availableEquityUsd.div(p).toFixed(6);
      lockedBtc = lockedEquityUsd.div(p).toFixed(6);
    }
  } catch {
    // ignore
  }

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
          <Button
            variant="primary"
            size="sm"
            onClick={() => openDepositModal()}
            className="font-semibold text-xs"
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            DEPOSIT
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setWithdrawModal({ open: true })}
            className="text-xs font-semibold"
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-[#f6465d]" />
            WITHDRAW
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setTransferModal({ open: true })}
            className="text-xs font-semibold"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#f5b642]" />
            TRANSFER
          </Button>
        </div>
      </div>

      {/* ─── Top 3 Stat Cards ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="font-semibold uppercase tracking-wider">Estimated Total Equity</span>
            <Wallet className="w-4 h-4 text-[#f5b642]" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-numeric tracking-tight">
              ${totalEquityUsd.toFixed(2)}
            </div>
            <div className="text-xs text-[#848e9c] font-numeric mt-1">≈ {totalBtc} BTC</div>
          </div>
          <div className="text-xs text-[#848e9c] flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-[#0ecb81]" />
            <span>{balances.length} wallet assets tracked</span>
          </div>
        </div>

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
            <div className="text-xs text-[#848e9c] font-numeric mt-1">≈ {availBtc} BTC</div>
          </div>
          <div className="text-xs text-[#848e9c]">Ready for trading or withdrawal</div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-[#848e9c]">
            <span className="font-semibold uppercase tracking-wider">Locked (In Orders)</span>
            <Lock className="w-4 h-4 text-[#f5b642]" />
          </div>
          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-black text-white font-numeric tracking-tight">
              ${lockedEquityUsd.toFixed(2)}
            </div>
            <div className="text-xs text-[#848e9c] font-numeric mt-1">≈ {lockedBtc} BTC</div>
          </div>
          <div className="text-xs text-[#848e9c]">Committed to active limit orders</div>
        </div>
      </div>

      {/* ─── Spot Assets Section ─── */}
      <WalletAssetsTable
        balances={balances}
        markets={markets}
        isLoading={isLoading}
        onDeposit={openDepositModal}
      />

      {/* ─── Deposits, Withdrawals & Transfers History ─── */}
      <WalletHistorySection
        deposits={deposits}
        loadingDeposits={loadingDeposits}
        onOpenDeposit={() => openDepositModal()}
        onOpenWithdraw={() => setWithdrawModal({ open: true })}
        onOpenTransfer={() => setTransferModal({ open: true })}
      />

      {/* ─── Bottom Panels (Security Checklist, Quick Wallet Actions) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <ShieldCheck className="w-4 h-4 text-[#f5b642]" />
              Security Checklist
            </div>
            <ul className="text-xs space-y-3">
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#eaecef]">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      user?.twoFactorEnabled ? 'text-[#0ecb81]' : 'text-[#5e6673]'
                    }`}
                  />
                  <span>2FA Authenticator</span>
                </div>
                {user?.twoFactorEnabled ? (
                  <Badge variant="green" size="sm">ENABLED</Badge>
                ) : (
                  <button
                    onClick={() => navigate('/profile')}
                    className="text-xs text-[#f5b642] hover:underline cursor-pointer"
                  >
                    ENABLE
                  </button>
                )}
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#eaecef]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#0ecb81]" />
                  <span>Account Status</span>
                </div>
                <Badge variant="green" size="sm">{user?.status ?? 'ACTIVE'}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#eaecef]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#f5b642]" />
                  <span>Session Management</span>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="text-xs text-[#f5b642] hover:underline cursor-pointer"
                >
                  MANAGE
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-3">
              <TrendingUp className="w-4 h-4 text-[#0ecb81]" />
              Account Audit Tools
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => navigate('/ledger')}
                className="w-full p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between hover:border-[#363d4a] cursor-pointer text-left"
              >
                <div>
                  <div className="text-xs font-semibold text-white">Financial Ledger</div>
                  <div className="text-[10px] text-[#848e9c]">Đối soát mọi biến động số dư</div>
                </div>
                <span className="text-xs text-[#f5b642] font-semibold">Open →</span>
              </button>

              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="w-full p-2.5 bg-[#1b2028] rounded-lg border border-[#282f3c] flex items-center justify-between hover:border-[#363d4a] cursor-pointer text-left"
              >
                <div>
                  <div className="text-xs font-semibold text-white">Active Locked Orders</div>
                  <div className="text-[10px] text-[#848e9c]">Quản lý lệnh đang giữ vốn</div>
                </div>
                <span className="text-xs text-[#f5b642] font-semibold">View →</span>
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#14171d] border border-[#232933] rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-white mb-1">
              <ArrowLeftRight className="w-4 h-4 text-[#f5b642]" />
              Spot Trading Terminal
            </div>
            <p className="text-xs text-[#848e9c] mt-1">
              Đặt lệnh Limit realtime trực tiếp qua Sổ lệnh HAU-CEX với phí cạnh tranh.
            </p>
          </div>

          <div className="mt-4">
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/trade/BTC_USDT')}
              className="w-full font-bold"
            >
              TRADE BTC / USDT
            </Button>
          </div>
        </div>
      </div>

      {isDepositOpen && (
        <DepositModal
          onClose={closeDepositModal}
          assets={depositAssets}
          initialAsset={depositInitialAsset}
          deposits={deposits}
        />
      )}

      {withdrawModal.open && (
        <WithdrawModal
          onClose={() => setWithdrawModal({ open: false })}
          balances={balances}
          initialAsset={withdrawModal.asset}
        />
      )}

      {transferModal.open && (
        <TransferModal
          onClose={() => setTransferModal({ open: false })}
          balances={balances}
          initialAsset={transferModal.asset}
        />
      )}
    </div>
  );
}
