import apiClient from './client';
import { authStore } from '../store/authStore';
import type { AuthTokens, UserProfile, UserSession } from '../types';

export interface LoginRequest {
  email: string;
  password: string;
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
};
