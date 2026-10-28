import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WalletsService } from '../wallets/wallets.service';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma, TradingPairStatus } from '../../generated/prisma';
import {
  ENGINE_COMMANDS_STREAM,
  hashOrderPayload,
  IdempotencyConflictException,
  MarketNotFoundException,
  MarketNotReadyException,
  MarketSuspendedException,
  nextCommandSequence,
  nextOrderSequence,
  OrderNotCancellableException,
  OrderNotFoundException,
  PrismaTx,
  ReferenceType,
  ValidationException,
  WalletNotFoundException,
} from '../../common';
import { v7 as uuidv7 } from 'uuid';
import { CancelOrderRow } from './types';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly walletsService: WalletsService,
    private readonly walletBalanceService: WalletBalanceService,
  ) {}
  // đặt lệnh
  async placeOrder(
    userId: string,
    idempotencyKey: string,
    dto: CreateOrderDto,
  ) {
    const orderId = uuidv7();

    return this.prismaService.$transaction(
      async (tx) => {
        // check idempotency key
        const existing = await tx.order.findUnique({
          where: {
            userId_idempotencyKey: {
              userId,
              idempotencyKey,
            },
          },
        });

        const normalizedSymbol = dto.symbol.trim().toUpperCase();
        const price = new Prisma.Decimal(dto.price);
        const quantity = new Prisma.Decimal(dto.quantity);
        const payLoadHash = hashOrderPayload(
          normalizedSymbol,
          dto.side.toString(),
          dto.type.toString(),
          price,
          quantity,
        );

        if (existing) {
          if (existing.idempotencyPayloadHash !== payLoadHash) {
            throw new IdempotencyConflictException();
          }
          return {
            orderId: existing.id,
            status: existing.status,
          };
        }

        // validate
        const pair = await tx.tradingPair.findUnique({
          where: {
            symbol: normalizedSymbol,
          },
        });
        if (!pair) throw new MarketNotFoundException();
        if (pair.status === TradingPairStatus.SUSPENDED)
          throw new MarketSuspendedException();
        if (pair.status !== TradingPairStatus.READY)
          throw new MarketNotReadyException();

        if (price.lte(0)) {
          throw new ValidationException('Price must be greater than zero');
        }
        if (quantity.lte(0)) {
          throw new ValidationException('Quantity must be greater than zero');
        }
        if (!price.mod(pair.tickSize).isZero()) {
          throw new ValidationException(
            `Price must be a multiple of tick size (${pair.tickSize.toString()})`,
          );
        }
        if (!quantity.mod(pair.stepSize).isZero()) {
          throw new ValidationException(
            `Quantity must be a multiple of step size (${pair.stepSize.toString()})`,
          );
        }
        if (quantity.lt(pair.minQuantity)) {
          throw new ValidationException(
            `Quantity must be at least min quantity (${pair.minQuantity.toString()})`,
          );
        }
        if (quantity.mul(price).lt(pair.minNotional)) {
          throw new ValidationException(
            `Order notional (price * quantity) must be at least min notional (${pair.minNotional.toString()})`,
          );
        }

        // calculate lockamount
        const isBuy = dto.side === 'BUY';
        const lockedAssetId = isBuy ? pair.quoteAssetId : pair.baseAssetId;
        const lockedAmount = isBuy ? price.mul(quantity) : quantity;

        // lock wallet balance inside current transaction
        const wallet = await tx.wallet.findUnique({
          where: {
            userId_assetId: {
              userId,
              assetId: lockedAssetId,
            },
          },
          select: { id: true },
        });
        if (!wallet) {
          throw new WalletNotFoundException(
            `user ${userId} and asset ${lockedAssetId}`,
          );
        }
        await this.walletBalanceService.moveAvailableToLocked(tx, {
          walletId: wallet.id,
          amount: lockedAmount,
          operationId: orderId,
          referenceType: ReferenceType.ORDER,
          referenceId: orderId,
        });

        // seq (nonblocking )
        const orderSeq = await nextOrderSequence(tx, pair.id);

        // create order

        const order = await tx.order.create({
          data: {
            id: orderId,
            userId,
            tradingPairId: pair.id,
            side: dto.side,
            status: OrderStatus.PENDING,
            price,
            quantity,
            filledQuantity: new Prisma.Decimal(0),
            remainingQuantity: quantity,
            lockedAssetId,
            lockedAmount,
            remainingLockedAmount: lockedAmount,
            orderSequence: orderSeq,
            idempotencyKey,
            idempotencyPayloadHash: payLoadHash,
          },
        });

        // command
        const cmdSeq = await nextCommandSequence(tx, pair.id);

        // outbox
        await tx.outboxEvent.create({
          data: {
            messageId: uuidv7(),
            version: 1,
            correlationId: uuidv7(),
            streamName: ENGINE_COMMANDS_STREAM,
            messageType: 'PlaceOrder',
            partitionKey: pair.id,
            commandSequence: cmdSeq,
            occurredAt: new Date(),
            payload: {
              tradingPairId: pair.id,
              market: pair.symbol,
              orderId: order.id,
              userId,
              side: dto.side,
              type: 'LIMIT',
              price: price.toFixed(18),
              quantity: quantity.toFixed(18),
              orderSequence: orderSeq.toString(),
              createdAt: new Date().toISOString(),
            },
          },
        });

        return { orderId: order.id, status: order.status };
      },
      { timeout: 10_000 },
    );
  }

  async cancelOrder(userId: string, orderId: string) {
    return this.prismaService.$transaction(async (tx: PrismaTx) => {
      // Lock only the order row (FOR UPDATE OF o) to prevent blocking other transactions on the same trading pair
      const rows = await tx.$queryRaw<
        CancelOrderRow[]
      >`SELECT o.id, o.user_id, o.status, o.trading_pair_id,
               tp.symbol as market
        FROM orders o
        JOIN trading_pairs tp ON tp.id = o.trading_pair_id
        WHERE o.id = ${orderId}::uuid
        FOR UPDATE OF o`;

      const order = rows[0];
      if (!order || order.user_id !== userId)
        throw new OrderNotFoundException();

      // validate status — PENDING đã được gửi outbox nhưng chưa được engine xác nhận
      const cancellableStatuses: OrderStatus[] = [
        OrderStatus.PENDING,
        OrderStatus.OPEN,
        OrderStatus.PARTIALLY_FILLED,
      ];
      const statusUpper = order.status.toUpperCase() as OrderStatus;
      if (!cancellableStatuses.includes(statusUpper))
        throw new OrderNotCancellableException();

      //update order status
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCEL_PENDING },
      });

      //cmd seq
      const cmdSeq = await nextCommandSequence(tx, order.trading_pair_id);

      // outbox
      await tx.outboxEvent.create({
        data: {
          messageId: uuidv7(),
          version: 1,
          correlationId: uuidv7(),
          streamName: ENGINE_COMMANDS_STREAM,
          messageType: 'CancelOrder',
          partitionKey: order.trading_pair_id,
          commandSequence: cmdSeq,
          occurredAt: new Date(),
          payload: {
            tradingPairId: order.trading_pair_id,
            market: order.market,
            orderId,
            userId,
            requestedBy: 'USER',
            requestedAt: new Date().toISOString(),
          },
        },
      });
      return { orderId, status: OrderStatus.CANCEL_PENDING };
    });
  }
}
