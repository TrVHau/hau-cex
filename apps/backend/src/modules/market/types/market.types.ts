import { TradingPairStatus } from '../../../generated/prisma';

export interface CachedOrderBook {
  symbol: string;
  tradingPairId: string;
  bookSequence: string;
  bids: [string, string, string][]; // [price, quantity, count]
  asks: [string, string, string][];
  changedAt: string;
}

export interface BestBidAsk {
  bestBid: string | null;
  bestAsk: string | null;
}

export interface MarketDetailResult {
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
  status: TradingPairStatus;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
}

export interface MarketTickerResult {
  symbol?: string;
  lastPrice: string | null;
  bestBid: string | null;
  bestAsk: string | null;
  baseVolume24h: string;
  volume24h?: string;
  high24h?: string | null;
  low24h?: string | null;
  priceChange24h?: string | null;
  quoteVolume24h?: string | null;
}

export interface KlineItem {
  time: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface OrderBookResult {
  symbol: string;
  bookSequence: string;
  bids: [string, string][];
  asks: [string, string][];
  updatedAt: string | null;
}

export interface RecentTradeItem {
  id: string;
  price: string;
  quantity: string;
  quoteAmount: string;
  takerSide: string;
  matchedAt: string;
}

export interface MarketSubscribePayload {
  symbol?: string;
  market?: string;
}

export interface MarketSubscribeResponse {
  event: string;
  data: {
    symbol?: string;
    room?: string;
    message?: string;
  };
}

export type RedisStreamReadResult = [string, [string, string[]][]][] | null;
