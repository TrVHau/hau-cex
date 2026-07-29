import { OrderType } from '../../../common/enums/order-type.enum';
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
  createdAt: Date;
  updatedAt: Date;
};

export type OrderListResponseDto = {
  items: OrderResponseDto[];
  nextCursor: string | null;
};
