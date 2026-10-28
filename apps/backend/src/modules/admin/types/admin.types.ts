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
