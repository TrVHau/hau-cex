import apiClient from './client';
import type { Order, OrderTrade, PlaceOrderRequest } from '../types';
import Decimal from 'decimal.js';

export interface RawOrderResponse {
  id?: string;
  orderId?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET';
  status: Order['status'];
  price: string;
  quantity: string;
  filledQuantity?: string;
  filledQty?: string;
  remainingQuantity?: string;
  remainingQty?: string;
  lockedAmount?: string;
  remainingLockedAmount?: string;
  createdAt: string;
  updatedAt: string;
}

export function normalizeOrder(raw: RawOrderResponse | Record<string, unknown>): Order {
  const r = raw as RawOrderResponse;
  const id = r.id || r.orderId || '';
  return {
    id,
    symbol: r.symbol || '',
    side: r.side || 'BUY',
    type: r.type || 'LIMIT',
    status: r.status || 'PENDING',
    price: String(r.price ?? '0'),
    quantity: String(r.quantity ?? '0'),
    filledQty: String(r.filledQty ?? r.filledQuantity ?? '0'),
    remainingQty: String(r.remainingQty ?? r.remainingQuantity ?? '0'),
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || new Date().toISOString(),
  };
}

export const ordersApi = {
  async getOrders(params?: { symbol?: string; limit?: number; cursor?: string }): Promise<Order[]> {
    const res = await apiClient.get<{ items?: RawOrderResponse[]; data?: RawOrderResponse[] } | RawOrderResponse[]>('/orders', {
      params,
    });
    const rawData = res.data;
    const list: RawOrderResponse[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.items)
      ? rawData.items
      : Array.isArray(rawData?.data)
      ? rawData.data
      : [];
    return list.map(normalizeOrder);
  },

  async getActiveOrders(symbol?: string): Promise<Order[]> {
    const res = await apiClient.get<{ items?: RawOrderResponse[]; data?: RawOrderResponse[] } | RawOrderResponse[]>('/orders/active', {
      params: symbol ? { symbol } : undefined,
    });
    const rawData = res.data;
    const list: RawOrderResponse[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.items)
      ? rawData.items
      : Array.isArray(rawData?.data)
      ? rawData.data
      : [];
    return list.map(normalizeOrder);
  },

  async getOrderTrades(orderId: string): Promise<OrderTrade[]> {
    const res = await apiClient.get<OrderTrade[]>(`/orders/${orderId}/trades`);
    return Array.isArray(res.data) ? res.data : [];
  },

  async getMyExecutedTrades(orders: Order[]): Promise<OrderTrade[]> {
    const filledOrders = orders.filter((o) => {
      try {
        return new Decimal(o.filledQty || '0').gt(0);
      } catch {
        return o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED';
      }
    });

    if (filledOrders.length === 0) return [];

    // Fetch up to 20 most recent filled/partially-filled orders to prevent request storms
    const targetOrders = filledOrders.slice(0, 20);
    const results = await Promise.all(
      targetOrders.map(async (order) => {
        try {
          const trades = await ordersApi.getOrderTrades(order.id);
          return trades.map((t) => ({
            ...t,
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
          }));
        } catch {
          return [];
        }
      }),
    );

    // Deduplicate in case two orders belonged to self-trade and sort newest first
    const byKey = new Map<string, OrderTrade>();
    for (const list of results) {
      for (const item of list) {
        const key = `${item.id}:${item.orderId ?? ''}`;
        if (!byKey.has(key)) {
          byKey.set(key, item);
        }
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime(),
    );
  },

  async placeOrder(data: PlaceOrderRequest, idempotencyKey: string): Promise<Order> {
    const res = await apiClient.post<RawOrderResponse>('/orders', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return normalizeOrder(res.data);
  },

  async cancelOrder(orderId: string): Promise<void> {
    await apiClient.post(`/orders/${orderId}/cancel`);
  },
};
