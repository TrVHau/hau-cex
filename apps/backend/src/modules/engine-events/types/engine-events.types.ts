// ─── Payload types from Go matching engine events ───────────────────────────

export interface TradeCreatedPayload {
  tradeId: string;
  engineMatchId: string;
  tradingPairId: string;
  market: string;
  tradeSequence: string;
  matchIndex: number;
  buyOrderId: string;
  sellOrderId: string;
  makerOrderId: string;
  takerOrderId: string;
  takerSide: 'BUY' | 'SELL';
  executionPrice: string;
  executedQuantity: string;
  buyOrderRemainingQuantity: string;
  sellOrderRemainingQuantity: string;
  matchedAt: string;
}

export interface OrderCancelledPayload {
  orderId: string;
  tradingPairId: string;
  market: string;
  cancelledQuantity: string;
  cancelledAt: string;
}

export interface CancelOrderRejectedPayload {
  orderId: string;
  tradingPairId: string;
  market: string;
  reasonCode: string;
  reason: string;
  rejectedAt: string;
}
