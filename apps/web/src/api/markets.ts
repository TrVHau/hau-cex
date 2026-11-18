import apiClient from './client';
import type { Market, OrderBook, Trade, Ticker } from '../types';

export const marketsApi = {
  async getMarkets(): Promise<Market[]> {
    const res = await apiClient.get<Market[]>('/markets');
    return res.data;
  },

  async getMarket(symbol: string): Promise<Market> {
    const res = await apiClient.get<Market>(`/markets/${symbol}`);
    return res.data;
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
};
