import apiClient from './client';
import type { AdminUser, AdminAsset, AdminMarket } from '../types';

export const adminApi = {
  // Users
  async getUsers(): Promise<AdminUser[]> {
    const res = await apiClient.get<AdminUser[]>('/admin/users');
    return res.data;
  },

  async lockUser(id: string): Promise<void> {
    await apiClient.post(`/admin/users/${id}/lock`);
  },

  async unlockUser(id: string): Promise<void> {
    await apiClient.post(`/admin/users/${id}/unlock`);
  },

  // Assets
  async getAssets(): Promise<AdminAsset[]> {
    const res = await apiClient.get<AdminAsset[]>('/admin/assets');
    return res.data;
  },

  // Markets
  async getMarkets(): Promise<AdminMarket[]> {
    const res = await apiClient.get<AdminMarket[]>('/admin/markets');
    return res.data;
  },

  async openMarket(id: string): Promise<void> {
    await apiClient.post(`/admin/markets/${id}/open`);
  },

  async suspendMarket(id: string): Promise<void> {
    await apiClient.post(`/admin/markets/${id}/suspend`);
  },
};
