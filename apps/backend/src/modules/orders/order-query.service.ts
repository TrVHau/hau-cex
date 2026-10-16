// đọc và phân trang
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OrderStatus, Prisma } from '../../generated/prisma';
import {
  buildCursorWhere,
  buildPaginatedResult,
  formatDecimal,
  OrderNotFoundException,
  OrderType,
} from '../../common';
import {
  OrderListResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { OrderWithPair, OrderTradeItem } from './types';

@Injectable()
export class OrderQueryService {
  constructor(private readonly prisma: PrismaService) {}

  // lấy danh sách lệnh đang hoạt động
  async getActiveOrders(
    userId: string,
    symbol?: string,
  ): Promise<OrderResponseDto[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        userId,
        status: {
          in: [
            OrderStatus.PENDING,
            OrderStatus.OPEN,
            OrderStatus.PARTIALLY_FILLED,
            OrderStatus.CANCEL_PENDING,
          ],
        },
        ...(symbol && { tradingPair: { symbol } }),
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        tradingPair: { select: { symbol: true } },
      },
    });

    return orders.map((order) => this.toResponseDto(order));
  }

  // lấy lịch sử lệnh, phân trang bằng cursor
  async getOrderHistory(
    userId: string,
    query: OrderListQueryDto,
  ): Promise<OrderListResponseDto> {
    const { symbol, limit = 20, cursor } = query;
    const cursorFilter = buildCursorWhere(cursor);

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(symbol && { tradingPair: { symbol } }),
      ...(cursorFilter && { OR: cursorFilter.OR }),
    };

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        tradingPair: { select: { symbol: true } },
      },
    });

    return buildPaginatedResult(rows, limit, (row) => this.toResponseDto(row));
  }

  // lấy chi tiết 1 lệnh bằng id
  async getOrderById(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, userId },
      include: {
        tradingPair: { select: { symbol: true } },
      },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    return this.toResponseDto(order);
  }

  // lấy danh sách khớp lệnh (trades) của 1 lệnh
  async getOrderTrades(
    userId: string,
    orderId: string,
  ): Promise<OrderTradeItem[]> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId, userId },
      select: { id: true },
    });

    if (!order) {
      throw new OrderNotFoundException();
    }

    const trades = await this.prisma.trade.findMany({
      where: {
        OR: [{ buyOrderId: orderId }, { sellOrderId: orderId }],
        settledAt: { not: null },
      },
      orderBy: { matchedAt: 'desc' },
      select: {
        id: true,
        executionPrice: true,
        executedQuantity: true,
        quoteAmount: true,
        buyerFeeAmount: true,
        sellerFeeAmount: true,
        takerSide: true,
        matchedAt: true,
        buyOrderId: true,
        sellOrderId: true,
      },
    });

    return trades.map((t) => {
      const isBuyer = t.buyOrderId === orderId;
      const isTaker =
        (isBuyer && t.takerSide === 'BUY') ||
        (!isBuyer && t.takerSide === 'SELL');
      return {
        id: t.id,
        price: formatDecimal(t.executionPrice),
        quantity: formatDecimal(t.executedQuantity),
        quoteAmount: formatDecimal(t.quoteAmount),
        fee: formatDecimal(isBuyer ? t.buyerFeeAmount : t.sellerFeeAmount),
        role: isTaker ? 'TAKER' : 'MAKER',
        takerSide: t.takerSide,
        matchedAt: t.matchedAt.toISOString(),
      };
    });
  }

  // ─── Mapper ───────────────────────────────────────────────────────────────
  private toResponseDto(order: OrderWithPair): OrderResponseDto {
    return {
      orderId: order.id,
      symbol: order.tradingPair.symbol,
      side: order.side,
      type: OrderType.LIMIT,
      status: order.status,
      price: formatDecimal(order.price),
      quantity: formatDecimal(order.quantity),
      filledQuantity: formatDecimal(order.filledQuantity),
      remainingQuantity: formatDecimal(order.remainingQuantity),
      lockedAmount: formatDecimal(order.lockedAmount),
      remainingLockedAmount: formatDecimal(order.remainingLockedAmount),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
