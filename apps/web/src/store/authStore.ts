/**
 * Auth store — lưu tokens trong localStorage.
 * KHÔNG dùng state management phức tạp, chỉ cần simple store.
 */

const ACCESS_TOKEN_KEY = 'hau_cex_access_token';
const REFRESH_TOKEN_KEY = 'hau_cex_refresh_token';
const USER_KEY = 'hau_cex_user';

export interface StoredUser {
  id?: string;
  userId: string;
  email: string;
  fullName?: string | null;
  role: 'USER' | 'ADMIN' | 'SYSTEM';
  status?: 'ACTIVE' | 'LOCKED';
  twoFactorEnabled?: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
}

export const authStore = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  getUser(): StoredUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },

  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  setUser(user: StoredUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  isLoggedIn(): boolean {
    return !!this.getAccessToken();
  },
};
