import apiClient from './client';
import type {
  AdminUser,
  AdminAsset,
  AdminMarket,
  AdminTreasuryOverview,
  AdminTreasuryLedgerItem,
  AdminWithdrawalItem,
  CursorPaginatedResponse,
  WithdrawalStatus,
} from '../types';

export const adminApi = {
  // Users
  async getUsers(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<CursorPaginatedResponse<AdminUser>> {
    const res = await apiClient.get<CursorPaginatedResponse<AdminUser>>('/admin/users', {
      params,
    });
    return res.data;
  },

  async lockUser(id: string, reason?: string): Promise<void> {
    await apiClient.post(`/admin/users/${id}/lock`, reason ? { reason } : {});
  },

  async unlockUser(id: string): Promise<void> {
    await apiClient.post(`/admin/users/${id}/unlock`);
  },

  // Assets
  async getAssets(params?: {
    cursor?: string;
    limit?: number;
  }): Promise<CursorPaginatedResponse<AdminAsset>> {
    const res = await apiClient.get<CursorPaginatedResponse<AdminAsset>>('/admin/assets', {
      params,
    });
    return res.data;
  },

  async activateAsset(id: string): Promise<void> {
    await apiClient.post(`/admin/assets/${id}/activate`);
  },

  async deactivateAsset(id: string): Promise<void> {
    await apiClient.post(`/admin/assets/${id}/deactivate`);
  },

  // Markets
  async getMarkets(): Promise<AdminMarket[]> {
    const res = await apiClient.get<AdminMarket[]>('/admin/markets');
    return res.data;
  },

  async openMarket(id: string): Promise<{ status: string }> {
    const res = await apiClient.post<{ status: string }>(`/admin/markets/${id}/open`);
    return res.data;
  },

  async suspendMarket(id: string, reason?: string): Promise<{ status: string }> {
    const res = await apiClient.post<{ status: string }>(
      `/admin/markets/${id}/suspend`,
      reason ? { reason } : {},
    );
    return res.data;
  },

  // Treasury
  async getTreasuryOverview(): Promise<AdminTreasuryOverview> {
    const res = await apiClient.get<AdminTreasuryOverview>('/admin/treasury');
    return res.data;
  },

  async getTreasuryLedger(params?: {
    assetSymbol?: string;
    entryType?: string;
    cursor?: string;
    limit?: number;
  }): Promise<CursorPaginatedResponse<AdminTreasuryLedgerItem>> {
    const res = await apiClient.get<CursorPaginatedResponse<AdminTreasuryLedgerItem>>(
      '/admin/treasury/ledger',
      { params },
    );
    return res.data;
  },

  // Withdrawals
  async getWithdrawals(params?: {
    status?: WithdrawalStatus;
    cursor?: string;
    limit?: number;
  }): Promise<CursorPaginatedResponse<AdminWithdrawalItem>> {
    const res = await apiClient.get<CursorPaginatedResponse<AdminWithdrawalItem>>(
      '/admin/withdrawals',
      { params },
    );
    return res.data;
  },

  async completeWithdrawal(id: string, txHash?: string): Promise<AdminWithdrawalItem> {
    const res = await apiClient.post<AdminWithdrawalItem>(
      `/admin/withdrawals/${id}/complete`,
      txHash ? { txHash } : {},
    );
    return res.data;
  },

  async rejectWithdrawal(id: string, reason?: string): Promise<AdminWithdrawalItem> {
    const res = await apiClient.post<AdminWithdrawalItem>(
      `/admin/withdrawals/${id}/reject`,
      reason ? { reason } : {},
    );
    return res.data;
  },
};
