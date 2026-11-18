import apiClient from './client';
import type { Order, PlaceOrderRequest } from '../types';

export const ordersApi = {
  async getOrders(): Promise<Order[]> {
    const res = await apiClient.get<Order[]>('/orders');
    return res.data;
  },

  async getActiveOrders(): Promise<Order[]> {
    const res = await apiClient.get<Order[]>('/orders/active');
    return res.data;
  },

  async placeOrder(data: PlaceOrderRequest, idempotencyKey: string): Promise<Order> {
    const res = await apiClient.post<Order>('/orders', data, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    return res.data;
  },

  async cancelOrder(orderId: string): Promise<void> {
    await apiClient.delete(`/orders/${orderId}`);
  },
};
