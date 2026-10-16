import { OrderType, PaginatedResponseDto } from '../../../common';
import { OrderSide } from '../../../generated/prisma';

export type OrderResponseDto = {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  status: string;
  price: string;
  quantity: string;
  filledQuantity: string;
  remainingQuantity: string;
  lockedAmount: string;
  remainingLockedAmount: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderListResponseDto = PaginatedResponseDto<OrderResponseDto>;
