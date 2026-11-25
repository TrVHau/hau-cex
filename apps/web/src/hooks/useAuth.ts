import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
