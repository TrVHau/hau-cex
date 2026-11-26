import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiKeyPermission, UserPreferences } from '../types';
import {
  authApi,
  type LoginRequest,
  type RegisterRequest,
  type ChangePasswordRequest,
  type UpdateProfileRequest,
} from '../api/auth';
import { authStore } from '../store/authStore';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (result) => {
      authStore.setTokens(result.accessToken, result.refreshToken);
      const user = result.user as unknown as {
        id?: string;
        userId?: string;
        email: string;
        role: 'USER' | 'ADMIN' | 'SYSTEM';
        fullName?: string | null;
        twoFactorEnabled?: boolean;
      };
      authStore.setUser({
        userId: user.userId || user.id || '',
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        twoFactorEnabled: user.twoFactorEnabled,
      });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
    onSuccess: (result) => {
      authStore.setTokens(result.accessToken, result.refreshToken);
      const user = result.user as unknown as { id?: string; userId?: string; email: string; role: 'USER' | 'ADMIN' | 'SYSTEM'; fullName?: string | null };
      authStore.setUser({
        userId: user.userId || user.id || '',
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      });
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.logout(),
    onSettled: () => {
      authStore.clear();
      queryClient.clear();
      window.location.href = '/login';
    },
  });
}

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      if (!authStore.isLoggedIn()) return null;
      try {
        const profile = await authApi.getMe();
        authStore.setUser(profile);
        return profile;
      } catch {
        return authStore.getUser();
      }
    },
    staleTime: 30_000,
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => authApi.updateProfile(data),
    onSuccess: (updated) => {
      authStore.setUser(updated);
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.getSessions(),
    enabled: authStore.isLoggedIn(),
    refetchInterval: 15_000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useRevokeAllOtherSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.revokeAllOtherSessions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

// ─── 2FA ───────────────────────────────────────────────────────────────────
export function useSetup2fa() {
  return useMutation({
    mutationFn: () => authApi.setup2fa(),
  });
}

export function useVerify2fa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => authApi.verify2fa(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDisable2fa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { password?: string; code?: string }) => authApi.disable2fa(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ─── Preferences ───────────────────────────────────────────────────────────
export function usePreferences() {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => authApi.getPreferences(),
    enabled: authStore.isLoggedIn(),
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserPreferences>) => authApi.updatePreferences(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['preferences'], updated);
    },
  });
}

// ─── Notifications ─────────────────────────────────────────────────────────
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => authApi.getNotifications(),
    enabled: authStore.isLoggedIn(),
    refetchInterval: 15_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ─── API Keys ──────────────────────────────────────────────────────────────
export function useApiKeys() {
  return useQuery({
    queryKey: ['api-keys'],
    queryFn: () => authApi.getApiKeys(),
    enabled: authStore.isLoggedIn(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { label: string; permissions?: ApiKeyPermission }) =>
      authApi.createApiKey(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
