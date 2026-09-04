// đọc và phân trang
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { OrderStatus, Prisma } from '../../generated/prisma';
import {
  OrderListResponseDto,
  OrderResponseDto,
} from './dto/order-response.dto';
import { OrderType } from '../../common/enums/order-type.enum';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { encodeCursor, decodeCursor } from '../../common/helpers/cursor.helper';

// ─── Kiểu Prisma inferred cho Order kèm tradingPair ────────────────────────
type OrderWithPair = Prisma.OrderGetPayload<{
  include: { tradingPair: { select: { symbol: true } } };
}>;

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
    const decoded = cursor ? decodeCursor(cursor) : null;

    const where: Prisma.OrderWhereInput = {
      userId,
      ...(symbol && { tradingPair: { symbol } }),
      ...(decoded && {
        OR: [
          { createdAt: { lt: new Date(decoded.createdAt) } },
          {
            createdAt: { equals: new Date(decoded.createdAt) },
            id: { lt: decoded.id },
          },
        ],
      }),
    };

    const rows = await this.prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        tradingPair: { select: { symbol: true } },
      },
    });

    const hasMore = rows.length > limit;
    if (hasMore) {
      rows.pop(); // xóa row thừa dùng để check hasMore
    }

    return {
      items: rows.map((row) => this.toResponseDto(row)),
      nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    };
  }

  // lấy chi tiết 1 lệnh bằng id
  async getOrderById(
    userId: string,
    orderId: string,
  ): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        tradingPair: { select: { symbol: true } },
      },
    });

    if (!order || order.userId !== userId) {
      throw new NotFoundException(`Order not found`);
    }

    return this.toResponseDto(order);
  }

  // ─── Mapper ───────────────────────────────────────────────────────────────
  private toResponseDto(order: OrderWithPair): OrderResponseDto {
    // Decimal.toFixed(18) rồi trim trailing zeros để response gọn gàng
    const fmt = (d: Prisma.Decimal) => d.toFixed(18).replace(/\.?0+$/, '');

    return {
      orderId: order.id,
      symbol: order.tradingPair.symbol,
      side: order.side,
      type: OrderType.LIMIT,
      status: order.status,
      price: fmt(order.price),
      quantity: fmt(order.quantity),
      filledQuantity: fmt(order.filledQuantity),
      remainingQuantity: fmt(order.remainingQuantity),
      lockedAmount: fmt(order.lockedAmount),
      remainingLockedAmount: fmt(order.remainingLockedAmount),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };
  }
}
