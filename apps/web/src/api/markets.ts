import apiClient from './client';
import type { Market, OrderBook, Trade, Ticker, Kline } from '../types';

interface RawMarketResponse {
  id: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  status: Market['status'];
  makerFeeRate: string;
  takerFeeRate: string;
  tickSize: string;
  stepSize?: string;
  minQuantity?: string;
  minOrderQty?: string;
  minNotional?: string;
  pricePrecision?: number;
  quantityPrecision?: number;
  basePrecision?: number;
  quotePrecision?: number;
  lastPrice?: string | null;
  bestBid?: string | null;
  bestAsk?: string | null;
  ticker?: Ticker;
}

function normalizeMarket(raw: RawMarketResponse): Market {
  const lastPrice = raw.lastPrice ?? raw.ticker?.lastPrice ?? null;
  const bestBid = raw.bestBid ?? raw.ticker?.bestBid ?? null;
  const bestAsk = raw.bestAsk ?? raw.ticker?.bestAsk ?? null;

  return {
    id: raw.id,
    symbol: raw.symbol,
    baseAsset: raw.baseAsset,
    quoteAsset: raw.quoteAsset,
    status: raw.status,
    makerFeeRate: raw.makerFeeRate,
    takerFeeRate: raw.takerFeeRate,
    tickSize: raw.tickSize,
    stepSize: raw.stepSize,
    minQuantity: raw.minQuantity ?? raw.minOrderQty,
    minNotional: raw.minNotional,
    minOrderQty: raw.minOrderQty ?? raw.minQuantity ?? '0.0001',
    basePrecision: raw.basePrecision ?? raw.quantityPrecision ?? 5,
    quotePrecision: raw.quotePrecision ?? raw.pricePrecision ?? 2,
    pricePrecision: raw.pricePrecision,
    quantityPrecision: raw.quantityPrecision,
    lastPrice,
    bestBid,
    bestAsk,
    ticker: raw.ticker ?? {
      symbol: raw.symbol,
      lastPrice,
      bestBid,
      bestAsk,
      volume24h: null,
      priceChange24h: null,
    },
  };
}

export const marketsApi = {
  async getMarkets(): Promise<Market[]> {
    const res = await apiClient.get<RawMarketResponse[]>('/markets');
    const items = Array.isArray(res.data) ? res.data : [];
    return items.map(normalizeMarket);
  },

  async getMarket(symbol: string): Promise<Market> {
    const res = await apiClient.get<RawMarketResponse>(`/markets/${symbol}`);
    return normalizeMarket(res.data);
  },

  async getTicker(symbol: string): Promise<Ticker> {
    const res = await apiClient.get<Ticker>(`/markets/${symbol}/ticker`);
    return res.data;
  },

  async getOrderBook(symbol: string): Promise<OrderBook> {
    const res = await apiClient.get<OrderBook>(`/markets/${symbol}/orderbook`);
    return res.data;
  },

  async getRecentTrades(symbol: string, limit = 50): Promise<Trade[]> {
    const res = await apiClient.get<Trade[]>(`/markets/${symbol}/trades`, {
      params: { limit },
    });
    return res.data;
  },

  async getKlines(symbol: string, interval = '15m', limit = 40): Promise<Kline[]> {
    const res = await apiClient.get<Kline[]>(`/markets/${symbol}/klines`, {
      params: { interval, limit },
    });
    return res.data;
  },
};
