import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi, type LoginRequest, type RegisterRequest } from '../api/auth';
import { authStore } from '../store/authStore';

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
    onSuccess: (result) => {
      authStore.setTokens(result.accessToken, result.refreshToken);
      authStore.setUser(result.user);
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
      authStore.setUser(result.user);
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
    queryFn: () => authStore.getUser(),
    staleTime: Infinity,
  });
}
