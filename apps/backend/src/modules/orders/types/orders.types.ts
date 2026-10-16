import { OrderStatus, Prisma } from '../../../generated/prisma';

export type OrderWithPair = Prisma.OrderGetPayload<{
  include: { tradingPair: { select: { symbol: true } } };
}>;

export interface PlaceOrderResult {
  orderId: string;
  status: OrderStatus;
}

export interface CancelOrderRow {
  id: string;
  user_id: string;
  trading_pair_id: string;
  status: string;
  market: string;
}

export interface OrderTradeItem {
  id: string;
  price: string;
  quantity: string;
  quoteAmount: string;
  fee: string;
  role: 'MAKER' | 'TAKER';
  takerSide: string;
  matchedAt: string;
}

export interface PlaceOrderOutboxPayload {
  tradingPairId: string;
  market: string;
  orderId: string;
  userId: string;
  side: string;
  type: string;
  price: string;
  quantity: string;
  orderSequence: string;
  createdAt: string;
}

export interface CancelOrderOutboxPayload {
  tradingPairId: string;
  market: string;
  orderId: string;
  userId: string;
  cancelledAt: string;
}
