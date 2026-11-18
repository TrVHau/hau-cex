import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketsApi } from '../api/markets';
import { ordersApi } from '../api/orders';
import { walletsApi } from '../api/wallets';
import { generateIdempotencyKey } from '../lib/utils';
import type { PlaceOrderRequest } from '../types';

// ─── Markets ───────────────────────────────────────────────────────────────
export function useMarkets() {
  return useQuery({
    queryKey: ['markets'],
    queryFn: () => marketsApi.getMarkets(),
    refetchInterval: 10_000,
  });
}

export function useMarket(symbol: string | undefined) {
  return useQuery({
    queryKey: ['market', symbol],
    queryFn: () => marketsApi.getMarket(symbol!),
    enabled: !!symbol,
    staleTime: 30_000,
  });
}

export function useTicker(symbol: string | undefined) {
  return useQuery({
    queryKey: ['ticker', symbol],
    queryFn: () => marketsApi.getTicker(symbol!),
    enabled: !!symbol,
    refetchInterval: 5_000,
  });
}

export function useOrderBook(symbol: string | undefined) {
  return useQuery({
    queryKey: ['orderbook', symbol],
    queryFn: () => marketsApi.getOrderBook(symbol!),
    enabled: !!symbol,
    staleTime: Infinity, // WS sẽ update, REST chỉ dùng khi khởi tạo
  });
}

export function useRecentTrades(symbol: string | undefined) {
  return useQuery({
    queryKey: ['trades', symbol],
    queryFn: () => marketsApi.getRecentTrades(symbol!),
    enabled: !!symbol,
    staleTime: Infinity, // WS sẽ prepend trades mới
  });
}

// ─── Orders ────────────────────────────────────────────────────────────────
export function useActiveOrders() {
  return useQuery({
    queryKey: ['orders', 'active'],
    queryFn: () => ordersApi.getActiveOrders(),
    refetchInterval: 5_000,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: () => ordersApi.getOrders(),
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PlaceOrderRequest) =>
      ordersApi.placeOrder(data, generateIdempotencyKey()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => ordersApi.cancelOrder(orderId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
  });
}

// ─── Wallets ───────────────────────────────────────────────────────────────
export function useWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: () => walletsApi.getBalances(),
    refetchInterval: 10_000,
  });
}

export function useLedger(asset?: string) {
  return useQuery({
    queryKey: ['ledger', asset],
    queryFn: () => walletsApi.getLedger({ asset }),
  });
}
