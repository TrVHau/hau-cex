import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { marketsApi } from '../api/markets';
import { ordersApi } from '../api/orders';
import { walletsApi } from '../api/wallets';
import { depositsApi } from '../api/deposits';
import { generateIdempotencyKey } from '../lib/utils';
import type {
  CreateDepositIntentRequest,
  CreateTransferRequest,
  CreateWithdrawalRequest,
  LedgerBalanceType,
  LedgerEntryType,
  Order,
  PlaceOrderRequest,
} from '../types';

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
    refetchInterval: 1_000,
  });
}

export function useRecentTrades(symbol: string | undefined) {
  return useQuery({
    queryKey: ['trades', symbol],
    queryFn: () => marketsApi.getRecentTrades(symbol!),
    enabled: !!symbol,
    refetchInterval: 2_000,
  });
}

export function useKlines(symbol: string | undefined, interval = '15m') {
  return useQuery({
    queryKey: ['klines', symbol, interval],
    queryFn: () => marketsApi.getKlines(symbol!, interval),
    enabled: !!symbol,
    refetchInterval: 5_000,
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

export function useMyTrades(orders: Order[]) {
  const filledSignature = orders
    .filter((o) => o.status === 'FILLED' || o.status === 'PARTIALLY_FILLED')
    .slice(0, 20)
    .map((o) => `${o.id}:${o.status}:${o.filledQty}`)
    .join('|');

  return useQuery({
    queryKey: ['orders', 'my-trades', filledSignature],
    queryFn: () => ordersApi.getMyExecutedTrades(orders),
    enabled: filledSignature.length > 0,
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

export function useLedger(params?: {
  asset?: string;
  entryType?: LedgerEntryType;
  balanceType?: LedgerBalanceType;
}) {
  return useQuery({
    queryKey: ['ledger', params?.asset, params?.entryType, params?.balanceType],
    queryFn: () => walletsApi.getLedger(params),
  });
}

// ─── Deposits ──────────────────────────────────────────────────────────────
export function useDeposits(asset?: string) {
  return useQuery({
    queryKey: ['deposits', asset],
    queryFn: () => depositsApi.getDeposits(asset),
    refetchInterval: 15_000,
  });
}

export function useDepositConfig(asset?: string) {
  return useQuery({
    queryKey: ['deposits', 'config', asset],
    queryFn: () => depositsApi.getConfig(asset!),
    enabled: Boolean(asset),
    retry: false,
  });
}

export function useCreateDepositIntent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateDepositIntentRequest) => depositsApi.createIntent(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deposits'] });
    },
  });
}

// ─── Withdrawals & Internal Transfers ──────────────────────────────────────
export function useWithdrawals() {
  return useQuery({
    queryKey: ['wallets', 'withdrawals'],
    queryFn: () => walletsApi.getWithdrawals(),
    refetchInterval: 15_000,
  });
}

export function useRequestWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWithdrawalRequest) => walletsApi.requestWithdrawal(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wallets'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useCancelWithdrawal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => walletsApi.cancelWithdrawal(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wallets'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useTransfers() {
  return useQuery({
    queryKey: ['wallets', 'transfers'],
    queryFn: () => walletsApi.getTransfers(),
    refetchInterval: 15_000,
  });
}

export function useTransferInternal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferRequest) => walletsApi.transferInternal(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wallets'] });
      void qc.invalidateQueries({ queryKey: ['ledger'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ─── Favorite Markets (localStorage synced) ────────────────────────────────
const FAVORITES_STORAGE_KEY = 'haucex_favorite_markets';
const FAVORITES_EVENT = 'haucex:favorites-updated';
const DEFAULT_FAVORITES = ['BTC_USDT'];

function readStoredFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return DEFAULT_FAVORITES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : DEFAULT_FAVORITES;
  } catch {
    return DEFAULT_FAVORITES;
  }
}

export function useFavoriteMarkets() {
  const [favorites, setFavorites] = useState<string[]>(readStoredFavorites);

  useEffect(() => {
    const sync = () => setFavorites(readStoredFavorites());
    window.addEventListener('storage', sync);
    window.addEventListener(FAVORITES_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(FAVORITES_EVENT, sync);
    };
  }, []);

  const toggleFavorite = useCallback((symbol: string) => {
    setFavorites((prev) => {
      const next = prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : [...prev, symbol];
      try {
        window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(FAVORITES_EVENT));
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  }, []);

  return { favorites, toggleFavorite };
}
