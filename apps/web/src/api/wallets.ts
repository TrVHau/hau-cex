import apiClient from './client';
import type {
  CreateTransferRequest,
  CreateWithdrawalRequest,
  InternalTransferItem,
  LedgerBalanceType,
  LedgerEntry,
  LedgerEntryType,
  WalletBalance,
  WithdrawalItem,
} from '../types';

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
  entryType: LedgerEntryType;
  balanceType?: LedgerBalanceType;
  beforeBalance?: string;
  afterBalance?: string;
  balanceAfter?: string;
  referenceType?: string;
  referenceId?: string;
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

  async getLedger(params?: {
    asset?: string;
    entryType?: LedgerEntryType;
    balanceType?: LedgerBalanceType;
    limit?: number;
    cursor?: string;
  }): Promise<LedgerEntry[]> {
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
      balanceType: l.balanceType ?? 'AVAILABLE',
      beforeBalance: l.beforeBalance ?? '0',
      balanceAfter: l.balanceAfter || l.afterBalance || '0',
      referenceType: l.referenceType,
      referenceId: l.referenceId,
      createdAt: l.createdAt,
      operationId: l.operationId || '',
    }));
  },

  async getWithdrawals(): Promise<WithdrawalItem[]> {
    const res = await apiClient.get<WithdrawalItem[]>('/wallets/withdrawals');
    return Array.isArray(res.data) ? res.data : [];
  },

  async requestWithdrawal(data: CreateWithdrawalRequest): Promise<WithdrawalItem> {
    const res = await apiClient.post<WithdrawalItem>('/wallets/withdrawals', data);
    return res.data;
  },

  async cancelWithdrawal(id: string): Promise<WithdrawalItem> {
    const res = await apiClient.post<WithdrawalItem>(`/wallets/withdrawals/${id}/cancel`);
    return res.data;
  },

  async getTransfers(): Promise<InternalTransferItem[]> {
    const res = await apiClient.get<InternalTransferItem[]>('/wallets/transfers');
    return Array.isArray(res.data) ? res.data : [];
  },

  async transferInternal(data: CreateTransferRequest): Promise<InternalTransferItem> {
    const res = await apiClient.post<InternalTransferItem>('/wallets/transfers', data);
    return res.data;
  },
};
