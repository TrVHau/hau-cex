import apiClient from './client';
import type { DepositConfig, DepositIntent, CreateDepositIntentRequest } from '../types';

export const depositsApi = {
  async getConfig(asset: string): Promise<DepositConfig> {
    const res = await apiClient.get<DepositConfig>('/deposits/config', {
      params: { asset },
    });
    return res.data;
  },

  async createIntent(data: CreateDepositIntentRequest): Promise<DepositIntent> {
    const res = await apiClient.post<DepositIntent>('/deposits/intents', data);
    return res.data;
  },

  async getDeposits(asset?: string): Promise<DepositIntent[]> {
    const res = await apiClient.get<DepositIntent[]>('/deposits', {
      params: asset ? { asset } : undefined,
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  async getDepositById(depositId: string): Promise<DepositIntent> {
    const res = await apiClient.get<DepositIntent>(`/deposits/${depositId}`);
    return res.data;
  },
};
