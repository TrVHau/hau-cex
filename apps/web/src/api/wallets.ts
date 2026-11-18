import apiClient from './client';
import type { WalletBalance, LedgerEntry } from '../types';

export const walletsApi = {
  async getBalances(): Promise<WalletBalance[]> {
    const res = await apiClient.get<WalletBalance[]>('/wallets');
    return res.data;
  },

  async getLedger(params?: { asset?: string; limit?: number; cursor?: string }): Promise<LedgerEntry[]> {
    const res = await apiClient.get<LedgerEntry[]>('/wallets/ledger', { params });
    return res.data;
  },
};
