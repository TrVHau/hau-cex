import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WalletService } from '../wallets/wallets.service';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderStatus, Prisma, TradingPairStatus } from '../../generated/prisma';
import { hashOrderPayload } from '../../common/helpers/idempotency.helper';
import {
  IdempotencyConflictException,
  MarketNotFoundException,
  MarketNotReadyException,
  MarketSuspendedException,
  OrderNotCancellableException,
  OrderNotFoundException,
  ValidationException,
} from '../../common/exceptions';
import { v7 as uuidv7 } from 'uuid';
import { ReferenceType } from '../../common/enums/reference-type.enum';
import {
  nextCommandSequence,
  nextOrderSequence,
} from '../../common/helpers/sequence.helper';
import { PrismaTx } from '../../common/types/prisma-tx.type';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly PrismaService: PrismaService,
    private readonly WalletService: WalletService,
    private readonly WalletBalanceService: WalletBalanceService,
  ) {}
  // đặt lệnh
  async placeOrder(
    userId: string,
    idempotencyKey: string,
    dto: CreateOrderDto,
  ) {
    const orderId = uuidv7();

    return this.PrismaService.$transaction(
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

        const price = new Prisma.Decimal(dto.price);
        const quantity = new Prisma.Decimal(dto.quantity);
        const payLoadHash = hashOrderPayload(
          dto.symbol,
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
            symbol: dto.symbol,
          },
        });
        if (!pair) throw new MarketNotFoundException();
        if (pair.status === TradingPairStatus.SUSPENDED)
          throw new MarketSuspendedException();
        if (pair.status !== TradingPairStatus.READY)
          throw new MarketNotReadyException();

        if (price.lte(0)) throw new ValidationException();
        if (quantity.lte(0)) throw new ValidationException();
        if (!price.mod(pair.tickSize).isZero()) throw new ValidationException();
        if (!quantity.mod(pair.stepSize).isZero())
          throw new ValidationException();
        if (quantity.lt(pair.minQuantity)) throw new ValidationException();
        if (quantity.mul(price).lt(pair.minNotional))
          throw new ValidationException();

        // caculate lockamount
        const isBuy = dto.side === 'BUY';
        const lockedAssetId = isBuy ? pair.quoteAssetId : pair.baseAssetId;
        const lockedAmount = isBuy ? price.mul(quantity) : quantity;

        // lock wallet balance
        const wallet = await this.WalletService.findWalletByAssetId(
          userId,
          lockedAssetId,
        );
        await this.WalletBalanceService.moveAvailableToLocked(tx, {
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
            streamName: `stream:engine:commands`,
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
    return this.PrismaService.$transaction(async (tx: PrismaTx) => {
      // lockrow to prevent race settle race condition
      const rows = await tx.$queryRaw<
        {
          id: string;
          user_id: string;
          trading_pair_id: string;
          status: string;
        }[]
      >`SELECT id,user_id ,status, trading_pair_id 
      FROM orders WHERE id = ${orderId}::uuid
       FOR UPDATE`;

      const order = rows[0];
      if (!order || order.user_id !== userId)
        throw new OrderNotFoundException();

      // validate stat
      const cancellableStatuses: OrderStatus[] = [
        OrderStatus.OPEN,
        OrderStatus.PARTIALLY_FILLED,
      ];
      if (!cancellableStatuses.includes(order.status as OrderStatus))
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
          streamName: 'stream:engine:commands',
          messageType: 'CancelOrder',
          partitionKey: order.trading_pair_id,
          commandSequence: cmdSeq,
          occurredAt: new Date(),
          payload: {
            tradingPairId: order.trading_pair_id,
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
