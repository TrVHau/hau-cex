import apiClient from './client';
import { authStore } from '../store/authStore';
import type {
  ApiKeyItem,
  ApiKeyPermission,
  AuthTokens,
  CreatedApiKey,
  NotificationsResponse,
  TwoFactorSetupResponse,
  UserPreferences,
  UserProfile,
  UserSession,
} from '../types';

export interface LoginRequest {
  email: string;
  password: string;
  totpCode?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id?: string;
    userId: string;
    email: string;
    fullName?: string | null;
    role: 'USER' | 'ADMIN' | 'SYSTEM';
  };
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
}

export const authApi = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/auth/login', data);
    return res.data;
  },

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>('/auth/register', data);
    return res.data;
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const res = await apiClient.post<AuthTokens>('/auth/refresh', { refreshToken });
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      try {
        await apiClient.delete('/auth/logout');
      } catch {
        // ignore
      }
    } finally {
      authStore.clear();
    }
  },

  async getMe(): Promise<UserProfile> {
    const res = await apiClient.get<UserProfile>('/auth/me');
    return res.data;
  },

  async changePassword(data: ChangePasswordRequest): Promise<{ message: string }> {
    const res = await apiClient.post<{ message: string }>('/auth/change-password', data);
    return res.data;
  },

  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
    const res = await apiClient.patch<UserProfile>('/auth/profile', data);
    return res.data;
  },

  async getSessions(): Promise<UserSession[]> {
    const res = await apiClient.get<UserSession[]>('/auth/sessions');
    return res.data;
  },

  async revokeSession(sessionId: string): Promise<{ message: string }> {
    const res = await apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
    return res.data;
  },

  async revokeAllOtherSessions(): Promise<{ message: string; count: number }> {
    const res = await apiClient.delete<{ message: string; count: number }>('/auth/sessions');
    return res.data;
  },

  // 2FA (TOTP)
  async setup2fa(): Promise<TwoFactorSetupResponse> {
    const res = await apiClient.post<TwoFactorSetupResponse>('/auth/2fa/setup');
    return res.data;
  },

  async verify2fa(code: string): Promise<{ twoFactorEnabled: boolean }> {
    const res = await apiClient.post<{ twoFactorEnabled: boolean }>('/auth/2fa/verify', { code });
    return res.data;
  },

  async disable2fa(payload: { password?: string; code?: string }): Promise<{ twoFactorEnabled: boolean }> {
    const res = await apiClient.post<{ twoFactorEnabled: boolean }>('/auth/2fa/disable', payload);
    return res.data;
  },

  // Preferences
  async getPreferences(): Promise<UserPreferences> {
    const res = await apiClient.get<UserPreferences>('/auth/preferences');
    return res.data;
  },

  async updatePreferences(data: Partial<UserPreferences>): Promise<UserPreferences> {
    const res = await apiClient.patch<UserPreferences>('/auth/preferences', data);
    return res.data;
  },

  // Notifications
  async getNotifications(): Promise<NotificationsResponse> {
    const res = await apiClient.get<NotificationsResponse>('/auth/notifications');
    return res.data;
  },

  async markNotificationRead(id: string): Promise<void> {
    await apiClient.patch(`/auth/notifications/${id}/read`);
  },

  async markAllNotificationsRead(): Promise<{ updatedCount: number }> {
    const res = await apiClient.post<{ updatedCount: number }>('/auth/notifications/read-all');
    return res.data;
  },

  // API Keys
  async getApiKeys(): Promise<ApiKeyItem[]> {
    const res = await apiClient.get<ApiKeyItem[]>('/auth/api-keys');
    return res.data;
  },

  async createApiKey(data: { label: string; permissions?: ApiKeyPermission }): Promise<CreatedApiKey> {
    const res = await apiClient.post<CreatedApiKey>('/auth/api-keys', data);
    return res.data;
  },

  async revokeApiKey(id: string): Promise<{ message: string }> {
    const res = await apiClient.delete<{ message: string }>(`/auth/api-keys/${id}`);
    return res.data;
  },
};
