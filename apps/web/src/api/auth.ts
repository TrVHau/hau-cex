import apiClient from './client';
import { authStore } from '../store/authStore';
import type { AuthTokens } from '../types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    userId: string;
    email: string;
    role: 'USER' | 'ADMIN';
  };
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
      await apiClient.delete('/auth/logout');
    } finally {
      authStore.clear();
    }
  },
};
