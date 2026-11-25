import apiClient from './client';
import type { Order, PlaceOrderRequest } from '../types';

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

export function normalizeOrder(raw: RawOrderResponse | any): Order {
  const id = raw.id || raw.orderId || '';
  return {
    id,
    symbol: raw.symbol || '',
    side: raw.side || 'BUY',
    type: raw.type || 'LIMIT',
    status: raw.status || 'PENDING',
    price: String(raw.price ?? '0'),
    quantity: String(raw.quantity ?? '0'),
    filledQty: String(raw.filledQty ?? raw.filledQuantity ?? '0'),
    remainingQty: String(raw.remainingQty ?? raw.remainingQuantity ?? '0'),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export const ordersApi = {
  async getOrders(): Promise<Order[]> {
    const res = await apiClient.get<any>('/orders');
    const rawData = res.data;
    const list: any[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.items)
      ? rawData.items
      : Array.isArray(rawData?.data)
      ? rawData.data
      : [];
    return list.map(normalizeOrder);
  },

  async getActiveOrders(): Promise<Order[]> {
    const res = await apiClient.get<any>('/orders/active');
    const rawData = res.data;
    const list: any[] = Array.isArray(rawData)
      ? rawData
      : Array.isArray(rawData?.items)
      ? rawData.items
      : Array.isArray(rawData?.data)
      ? rawData.data
      : [];
    return list.map(normalizeOrder);
  },

  async placeOrder(data: PlaceOrderRequest, idempotencyKey: string): Promise<Order> {
    const res = await apiClient.post<any>('/orders', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return normalizeOrder(res.data);
  },

  async cancelOrder(orderId: string): Promise<void> {
    await apiClient.delete(`/orders/${orderId}`);
  },
};
