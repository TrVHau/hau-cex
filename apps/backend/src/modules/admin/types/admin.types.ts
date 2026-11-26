export interface AdminUserItem {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  status: string;
  lockedAt: string | null;
  lockedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminAssetItem {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string | null;
  status: string;
  depositEnabled: boolean;
  tradingEnabled: boolean;
  createdAt: string;
}

export interface AdminMarketItem {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  pricePrecision: number;
  quantityPrecision: number;
  tickSize: string;
  stepSize: string;
  minQuantity: string;
  minNotional: string;
  makerFeeRate: string;
  takerFeeRate: string;
  status: string;
  createdAt: string;
}

export interface AdminTreasuryAccountInfo {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
}

export interface AdminTreasuryWalletItem {
  walletId: string | null;
  assetId: string;
  assetSymbol: string;
  assetName: string;
  decimals: number;
  availableBalance: string;
  lockedBalance: string;
  totalBalance: string;
  totalFeesCollected: string;
  feeEntryCount: number;
  updatedAt: string | null;
}

export interface AdminTreasuryOverview {
  account: AdminTreasuryAccountInfo;
  wallets: AdminTreasuryWalletItem[];
  totalFeeEntries: number;
  lastCollectedAt: string | null;
}

export interface AdminTreasuryLedgerItem {
  id: string;
  assetSymbol: string;
  entryType: string;
  balanceType: string;
  amount: string;
  beforeBalance: string;
  afterBalance: string;
  referenceType: string;
  referenceId: string;
  marketSymbol: string | null;
  executionPrice: string | null;
  executedQuantity: string | null;
  takerSide: string | null;
  operationId: string;
  createdAt: string;
}

export interface AdminWithdrawalItem {
  id: string;
  userId: string;
  userEmail: string;
  assetSymbol: string;
  toAddress: string;
  amount: string;
  fee: string;
  status: string;
  txHash: string | null;
  failureReason: string | null;
  processedAt: string | null;
  createdAt: string;
}
