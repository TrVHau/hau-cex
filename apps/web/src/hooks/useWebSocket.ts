import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { authStore } from '../store/authStore';
import type { WsOrderBookUpdate, WsTradeCreated, WsDepositUpdated, OrderBook, Trade } from '../types';

const WS_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

let sharedSocket: Socket | null = null;
let socketRefCount = 0;

function getSocket(): Socket {
  if (!sharedSocket || !sharedSocket.connected) {
    const token = authStore.getAccessToken();
    sharedSocket = io(`${WS_URL}/ws`, {
      auth: token ? { token } : undefined,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: 10,
      transports: ['websocket', 'polling'],
    });
  }
  return sharedSocket;
}

/**
 * Hook kết nối WebSocket cho một market cụ thể.
 * - Subscribe vào room `market:{symbol}`
 * - Cập nhật TanStack Query cache khi nhận event
 */
export function useMarketSocket(symbol: string | undefined) {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!symbol) return;

    socketRefCount++;
    const socket = getSocket();
    socketRef.current = socket;

    // Subscribe market room
    socket.emit('market.subscribe', { symbol });

    // ─── orderbook.update ─────────────────────────────────────────────
    const handleOrderBook = (data: WsOrderBookUpdate) => {
      if (data.symbol !== symbol) return;
      // Trực tiếp set cache từ WS payload (server đã tính toán)
      queryClient.setQueryData<OrderBook>(['orderbook', symbol], {
        symbol: data.symbol,
        bids: data.bids,
        asks: data.asks,
        timestamp: data.timestamp,
      });
    };

    // ─── trade.created ────────────────────────────────────────────────
    const handleTrade = (data: WsTradeCreated) => {
      if (data.symbol !== symbol) return;
      // Prepend trade mới vào cache, giữ tối đa 100
      queryClient.setQueryData<Trade[]>(['trades', symbol], (old) => {
        const newTrade: Trade = {
          id: data.id,
          symbol: data.symbol,
          price: data.price,
          quantity: data.quantity,
          side: data.side,
          createdAt: data.createdAt,
        };
        return [newTrade, ...(old ?? [])].slice(0, 100);
      });
    };

    socket.on('orderbook.update', handleOrderBook);
    socket.on('trade.created', handleTrade);

    return () => {
      socket.off('orderbook.update', handleOrderBook);
      socket.off('trade.created', handleTrade);
      socketRefCount--;
      if (socketRefCount <= 0) {
        sharedSocket?.disconnect();
        sharedSocket = null;
        socketRefCount = 0;
      }
    };
  }, [symbol, queryClient]);

  return socketRef;
}

/**
 * Hook subscribe vào user-specific events (deposit.updated, v.v.)
 */
export function useUserSocket(userId: string | undefined) {
  const queryClient = useQueryClient();

  const handleDepositUpdated = useCallback(
    (data: WsDepositUpdated) => {
      void data;
      // Invalidate deposits query để refetch
      void queryClient.invalidateQueries({ queryKey: ['deposits'] });
      void queryClient.invalidateQueries({ queryKey: ['wallets'] });
    },
    [queryClient],
  );

  useEffect(() => {
    if (!userId) return;

    socketRefCount++;
    const socket = getSocket();

    socket.emit('user.subscribe', { userId });
    socket.on('deposit.updated', handleDepositUpdated);

    return () => {
      socket.off('deposit.updated', handleDepositUpdated);
      socketRefCount--;
      if (socketRefCount <= 0) {
        sharedSocket?.disconnect();
        sharedSocket = null;
        socketRefCount = 0;
      }
    };
  }, [userId, handleDepositUpdated]);
}
