// ─── Auth ──────────────────────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface User {
  id?: string;
  userId: string;
  email: string;
  fullName?: string | null;
  role: 'USER' | 'ADMIN' | 'SYSTEM';
  status?: 'ACTIVE' | 'LOCKED';
  twoFactorEnabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export interface UserProfile {
  id: string;
  userId: string;
  email: string;
  fullName?: string | null;
  role: 'USER' | 'ADMIN' | 'SYSTEM';
  status: 'ACTIVE' | 'LOCKED';
  twoFactorEnabled?: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface UserSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

// ─── Market ────────────────────────────────────────────────────────────────
export type MarketStatus = 'READY' | 'SUSPENDED' | 'RECOVERING' | 'OPEN' | 'CLOSED';

export interface Market {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: MarketStatus;
  makerFeeRate: string;
  takerFeeRate: string;
  tickSize: string;
  stepSize?: string;
  minQuantity?: string;
  minNotional?: string;
  minOrderQty: string;
  basePrecision: number;
  quotePrecision: number;
  pricePrecision?: number;
  quantityPrecision?: number;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  ticker?: Ticker;
}

export interface Ticker {
  symbol: string;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  volume24h: string | null;
  baseVolume24h?: string | null;
  high24h?: string | null;
  low24h?: string | null;
  priceChange24h: string | null;
  quoteVolume24h?: string | null;
}

export interface Kline {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
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

export interface OrderTrade {
  id: string;
  orderId?: string;
  symbol?: string;
  side?: TradeSide;
  price: string;
  quantity: string;
  quoteAmount: string;
  fee: string;
  role: 'MAKER' | 'TAKER';
  takerSide: string;
  matchedAt: string;
}

// ─── Order ─────────────────────────────────────────────────────────────────
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT' | 'MARKET';
export type OrderStatus =
  | 'PENDING'
  | 'OPEN'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCEL_PENDING'
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

// ─── Wallet & Ledger ───────────────────────────────────────────────────────
export interface WalletBalance {
  asset: string;
  available: string;
  locked: string;
  total: string;
}

export type LedgerEntryType =
  | 'INITIAL_BALANCE'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'INTERNAL_TRANSFER_IN'
  | 'INTERNAL_TRANSFER_OUT'
  | 'ORDER_LOCK'
  | 'ORDER_UNLOCK'
  | 'TRADE_SETTLEMENT'
  | 'TRADING_FEE';

export type LedgerBalanceType = 'AVAILABLE' | 'LOCKED';

export interface LedgerEntry {
  id: string;
  asset: string;
  amount: string;
  entryType: LedgerEntryType;
  balanceType: LedgerBalanceType;
  beforeBalance: string;
  balanceAfter: string;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  operationId: string;
}

// ─── Deposit ───────────────────────────────────────────────────────────────
export type DepositStatus =
  | 'PENDING'
  | 'DETECTED'
  | 'CONFIRMING'
  | 'CREDITED'
  | 'FAILED'
  | 'EXPIRED';

export interface DepositIntent {
  depositId: string;
  asset: string;
  chainId: string;
  tokenAddress: string;
  vaultAddress: string;
  accountReference: string;
  status: DepositStatus;
  amount: string | null;
  txHash?: string | null;
  blockNumber?: string | null;
  confirmationCount?: number;
  expiresAt: string;
  creditedAt?: string | null;
  createdAt: string;
}

export interface DepositConfig {
  asset: string;
  chainId: string;
  tokenAddress: string;
  vaultAddress: string;
  requiredConfirmations: number;
}

export interface CreateDepositIntentRequest {
  asset: string;
  depositorAddress: string;
}

// ─── Withdrawals, Transfers, Security & Preferences ────────────────────────
export type WithdrawalStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface WithdrawalItem {
  id: string;
  assetSymbol: string;
  toAddress: string;
  amount: string;
  fee: string;
  status: WithdrawalStatus;
  txHash?: string | null;
  failureReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

export interface CreateWithdrawalRequest {
  assetSymbol: string;
  toAddress: string;
  amount: string;
}

export interface InternalTransferItem {
  id: string;
  assetSymbol: string;
  senderEmail: string;
  recipientEmail: string;
  direction: 'IN' | 'OUT';
  amount: string;
  note?: string | null;
  createdAt: string;
}

export interface CreateTransferRequest {
  assetSymbol: string;
  recipientEmail: string;
  amount: string;
  note?: string;
}

export type NotificationType = 'SECURITY' | 'WALLET' | 'ORDER' | 'SYSTEM';

export interface UserNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  items: UserNotification[];
  unreadCount: number;
}

export interface UserPreferences {
  notifLogin: boolean;
  notifOrders: boolean;
  notifSecurity: boolean;
  notifNewsletter: boolean;
  baseCurrency: 'USDT' | 'USD' | 'VND';
  language: 'en' | 'vi';
  confirmOrder: boolean;
  updatedAt?: string;
}

export type ApiKeyPermission = 'READ' | 'TRADE';

export interface ApiKeyItem {
  id: string;
  label: string;
  keyPrefix: string;
  permissions: ApiKeyPermission;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface CreatedApiKey extends ApiKeyItem {
  secretKey: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface AdminWithdrawalItem {
  id: string;
  userId: string;
  userEmail: string;
  assetSymbol: string;
  toAddress: string;
  amount: string;
  fee: string;
  status: WithdrawalStatus;
  txHash?: string | null;
  failureReason?: string | null;
  processedAt?: string | null;
  createdAt: string;
}

// ─── Admin ─────────────────────────────────────────────────────────────────
export interface CursorPaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  role: 'USER' | 'ADMIN' | 'SYSTEM';
  status: 'ACTIVE' | 'LOCKED';
  lockedAt: string | null;
  lockedReason: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminAsset {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  contractAddress: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  depositEnabled: boolean;
  tradingEnabled: boolean;
  createdAt: string;
}

export interface AdminMarket {
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
  status: 'RECOVERING' | 'READY' | 'SUSPENDED';
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
