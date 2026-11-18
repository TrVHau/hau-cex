// ─── Auth ──────────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
}

// ─── Market ────────────────────────────────────────────────────────────────
export type MarketStatus = 'OPEN' | 'SUSPENDED' | 'CLOSED';

export interface Market {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: MarketStatus;
  makerFeeRate: string;
  takerFeeRate: string;
  tickSize: string;
  minOrderQty: string;
  basePrecision: number;
  quotePrecision: number;
  ticker?: Ticker;
}

export interface Ticker {
  symbol: string;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  volume24h: string | null;
  priceChange24h: string | null;
}

// ─── Order Book ────────────────────────────────────────────────────────────
export interface OrderBookLevel {
  price: string;
  quantity: string;
}

export interface OrderBook {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

// ─── Trade ─────────────────────────────────────────────────────────────────
export type TradeSide = 'BUY' | 'SELL';

export interface Trade {
  id: string;
  symbol: string;
  price: string;
  quantity: string;
  side: TradeSide;
  createdAt: string;
}

// ─── Order ─────────────────────────────────────────────────────────────────
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET';
export type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELLED'
  | 'REJECTED';

export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  price: string;
  quantity: string;
  filledQty: string;
  remainingQty: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: string;
  quantity: string;
}

// ─── Wallet ────────────────────────────────────────────────────────────────
export interface WalletBalance {
  asset: string;
  available: string;
  locked: string;
  total: string;
}

export type LedgerEntryType =
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'TRADE_CREDIT'
  | 'TRADE_DEBIT'
  | 'FEE'
  | 'LOCK'
  | 'UNLOCK';

export interface LedgerEntry {
  id: string;
  asset: string;
  amount: string;
  entryType: LedgerEntryType;
  balanceAfter: string;
  createdAt: string;
  operationId: string;
}

// ─── Deposit ───────────────────────────────────────────────────────────────
export type DepositStatus =
  | 'PENDING'
  | 'CONFIRMING'
  | 'CREDITED'
  | 'FAILED'
  | 'EXPIRED';

export interface DepositIntent {
  id: string;
  asset: string;
  depositAddress: string;
  contractAddress: string;
  chainId: number;
  status: DepositStatus;
  amount: string | null;
  txHash: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface DepositConfig {
  asset: string;
  contractAddress: string;
  depositAddress: string;
  chainId: number;
  confirmationsRequired: number;
}

// ─── Admin ─────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  isLocked: boolean;
  createdAt: string;
}

export interface AdminAsset {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string | null;
  chainId: number | null;
  isActive: boolean;
}

export interface AdminMarket {
  id: string;
  symbol: string;
  status: MarketStatus;
  baseAsset: string;
  quoteAsset: string;
}

// ─── API Response ──────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  requestId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ─── WebSocket Events ──────────────────────────────────────────────────────
export interface WsOrderBookUpdate {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
}

export interface WsTradeCreated {
  id: string;
  symbol: string;
  price: string;
  quantity: string;
  side: TradeSide;
  createdAt: string;
}

export interface WsDepositUpdated {
  depositId: string;
  status: DepositStatus;
  amount: string | null;
  txHash: string | null;
}
