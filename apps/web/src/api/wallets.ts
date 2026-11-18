import apiClient from './client';
import type { WalletBalance, LedgerEntry } from '../types';

interface RawWalletResponse {
  id?: string;
  asset?: string;
  assetSymbol?: string;
  assetName?: string;
  available?: string;
  availableBalance?: string;
  locked?: string;
  lockedBalance?: string;
  total?: string;
  totalBalance?: string;
}

interface RawLedgerResponse {
  id: string;
  asset?: string;
  assetSymbol?: string;
  amount: string;
  entryType: LedgerEntry['entryType'];
  afterBalance?: string;
  balanceAfter?: string;
  createdAt: string;
  operationId?: string;
}

export const walletsApi = {
  async getBalances(): Promise<WalletBalance[]> {
    const res = await apiClient.get<RawWalletResponse[] | { data: RawWalletResponse[] }>('/wallets');
    const raw = res.data;
    const items = Array.isArray(raw) ? raw : raw?.data || [];
    return items.map((w) => ({
      asset: w.asset || w.assetSymbol || '',
      available: w.available ?? w.availableBalance ?? '0',
      locked: w.locked ?? w.lockedBalance ?? '0',
      total: w.total ?? w.totalBalance ?? '0',
    }));
  },

  async getLedger(params?: { asset?: string; limit?: number; cursor?: string }): Promise<LedgerEntry[]> {
    try {
      const res = await apiClient.get<
        RawLedgerResponse[] | { items?: RawLedgerResponse[]; data?: RawLedgerResponse[] }
      >('/ledger', { params });
      const raw = res.data;
      const items = Array.isArray(raw) ? raw : raw?.items || raw?.data || [];
      return items.map((l) => ({
        id: l.id,
        asset: l.asset || l.assetSymbol || '',
        amount: l.amount || '0',
        entryType: l.entryType,
        balanceAfter: l.balanceAfter || l.afterBalance || '0',
        createdAt: l.createdAt,
        operationId: l.operationId || '',
      }));
    } catch {
      return [];
    }
  },
};
