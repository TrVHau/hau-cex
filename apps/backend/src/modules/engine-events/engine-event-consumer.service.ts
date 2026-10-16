import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TradeSettlementService } from './trade-settlement.service';
import { OrderCancellationService } from './order-cancellation.service';
import {
  TradeCreatedPayload,
  OrderCancelledPayload,
  CancelOrderRejectedPayload,
} from './types';
import {
  ENGINE_EVENTS_STREAM,
  MARKET_EVENTS_STREAM,
  ENGINE_EVENTS_CONSUMER_GROUP,
  ORDERBOOK_CACHE_PREFIX,
} from '../../common';

const CONSUMER_GROUP = ENGINE_EVENTS_CONSUMER_GROUP;
const CONSUMER_NAME = 'backend-1';

@Injectable()
export class EngineEventConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(EngineEventConsumerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly tradeSettlementService: TradeSettlementService,
    private readonly orderCancellationService: OrderCancellationService,
  ) {}

  onApplicationBootstrap(): void {
    this.running = true;
    void this.consumeLoop();
  }

  onApplicationShutdown(): void {
    this.running = false;
  }

  private async consumeLoop(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        ENGINE_EVENTS_STREAM,
        CONSUMER_GROUP,
        '$',
        'MKSTREAM',
      );
    } catch (error) {
      if (!String(error).includes('BUSYGROUP')) {
        this.logger.error('Failed to create consumer group', error);
        return;
      }
    }

    // Drain any unacknowledged events in PEL before listening for new events
    try {
      await this.drainPending();
    } catch (error) {
      this.logger.error('Failed to drain pending engine events', error);
    }

    while (this.running) {
      try {
        await this.processBatch();
      } catch (error) {
        this.logger.error('Engine event consumer error', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async drainPending(): Promise<void> {
    while (this.running) {
      const result = (await this.redis.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        CONSUMER_NAME,
        'COUNT',
        '10',
        'STREAMS',
        ENGINE_EVENTS_STREAM,
        '0',
      )) as [string, [string, string[]][]][] | null;

      if (
        !result ||
        result.length === 0 ||
        !result[0][1] ||
        result[0][1].length === 0
      ) {
        break;
      }

      for (const [, messages] of result) {
        for (const [msgId, fieldArray] of messages) {
          await this.handleMessage(msgId, this.parseFieldArray(fieldArray));
        }
      }
    }
  }

  private async processBatch(): Promise<void> {
    const result = (await this.redis.xreadgroup(
      'GROUP',
      CONSUMER_GROUP,
      CONSUMER_NAME,
      'COUNT',
      '10',
      'BLOCK',
      '200',
      'STREAMS',
      ENGINE_EVENTS_STREAM,
      '>',
    )) as [string, [string, string[]][]][] | null;

    if (!result) return;

    for (const [, messages] of result) {
      for (const [msgId, fieldArray] of messages) {
        await this.handleMessage(msgId, this.parseFieldArray(fieldArray));
      }
    }
  }

  private parseFieldArray(fieldArray: string[]): Record<string, string> {
    const fields: Record<string, string> = {};
    if (fieldArray) {
      for (let i = 0; i < fieldArray.length; i += 2) {
        fields[fieldArray[i]] = fieldArray[i + 1] ?? '';
      }
    }
    return fields;
  }

  private async handleMessage(
    msgId: string,
    fields: Record<string, string>,
  ): Promise<void> {
    const messageId = fields.messageId;
    const messageType = fields.messageType;

    // Guard against malformed payload — ACK to prevent infinite PEL loop
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(fields.payload ?? '{}') as Record<string, unknown>;
    } catch {
      this.logger.error(
        `Malformed JSON payload for msg ${msgId} (type=${messageType}), acknowledging to prevent loop`,
      );
      await this.ack(msgId);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.processedEvent.findUnique({
        where: {
          consumerName_messageId: {
            consumerName: CONSUMER_NAME,
            messageId,
          },
        },
      });

      if (existing) return;

      // Use || (not ??) so empty string also falls back to partitionKey
      const tradingPairId =
        (payload.tradingPairId as string | undefined) || fields.partitionKey;
      await this.dispatch(messageType, tradingPairId, messageId, payload, tx);

      await tx.processedEvent.create({
        data: {
          consumerName: CONSUMER_NAME,
          messageId,
          messageType,
          payloadHash: JSON.stringify(payload),
          result: 'PROCESSED',
        },
      });
    });

    // Post-commit: Cache orderbook and publish to stream:market:events for WebSocket fanout
    const tradingPairId =
      (payload.tradingPairId as string | undefined) || fields.partitionKey;
    await this.postProcessMarketEvent(messageType, tradingPairId, payload);

    await this.ack(msgId);
  }

  private async postProcessMarketEvent(
    messageType: string,
    tradingPairId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const market = typeof payload.market === 'string' ? payload.market : '';
      if (messageType === 'OrderBookChanged') {
        const bookSequence =
          typeof payload.bookSequence === 'string'
            ? payload.bookSequence
            : typeof payload.bookSequence === 'number'
              ? String(payload.bookSequence)
              : '0';
        const orderbookData = {
          symbol: market,
          tradingPairId,
          bookSequence,
          bids: payload.bids ?? [],
          asks: payload.asks ?? [],
          changedAt: payload.changedAt ?? new Date().toISOString(),
        };

        const jsonStr = JSON.stringify(orderbookData);
        await this.redis.set(
          `${ORDERBOOK_CACHE_PREFIX}${tradingPairId}`,
          jsonStr,
        );
        if (market) {
          await this.redis.set(
            `${ORDERBOOK_CACHE_PREFIX}${market.toUpperCase()}`,
            jsonStr,
          );
        }

        await this.redis.xadd(
          MARKET_EVENTS_STREAM,
          '*',
          'messageType',
          'orderbook.update',
          'market',
          market.toUpperCase(),
          'tradingPairId',
          tradingPairId,
          'payload',
          jsonStr,
        );
      } else if (messageType === 'TradeCreated') {
        const tradeData = {
          symbol: market,
          tradeId: payload.tradeId,
          engineMatchId: payload.engineMatchId,
          price: payload.executionPrice,
          quantity: payload.executedQuantity,
          takerSide: payload.takerSide,
          matchedAt: payload.matchedAt,
        };

        const jsonStr = JSON.stringify(tradeData);
        await this.redis.xadd(
          MARKET_EVENTS_STREAM,
          '*',
          'messageType',
          'trade.created',
          'market',
          market.toUpperCase(),
          'tradingPairId',
          tradingPairId,
          'payload',
          jsonStr,
        );
      }
    } catch (error) {
      this.logger.error('Failed to post-process market event', error);
    }
  }

  private async dispatch(
    messageType: string,
    tradingPairId: string,
    messageId: string,
    payload: Record<string, unknown>,
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
  ): Promise<void> {
    switch (messageType) {
      case 'MarketOpened':
        await tx.tradingPair.updateMany({
          where: { id: tradingPairId },
          data: { status: 'READY' },
        });
        break;

      case 'OrderOpened':
        await tx.order.updateMany({
          where: {
            id: payload.orderId as string,
            status: 'PENDING',
          },
          data: { status: 'OPEN' },
        });
        break;

      case 'OrderRejected':
        await tx.order.updateMany({
          where: {
            id: payload.orderId as string,
            status: 'PENDING',
          },
          data: { status: 'REJECTED' },
        });
        break;

      case 'EngineFailed':
        await tx.tradingPair.updateMany({
          where: { id: tradingPairId },
          data: { status: 'SUSPENDED' },
        });
        break;

      case 'TradeCreated':
        await this.tradeSettlementService.settleTrade(
          payload as unknown as TradeCreatedPayload,
          messageId,
          tx,
        );
        break;

      case 'OrderCancelled':
        await this.orderCancellationService.handleOrderCancelled(
          payload as unknown as OrderCancelledPayload,
          tx,
        );
        break;

      case 'CancelOrderRejected':
        await this.orderCancellationService.handleCancelOrderRejected(
          payload as unknown as CancelOrderRejectedPayload,
          tx,
        );
        break;

      case 'OrderBookChanged':
        // Handled in postProcessMarketEvent after transaction commit
        break;

      default:
        this.logger.warn(`Unknown engine event type: ${messageType}`);
    }
  }

  private async ack(msgId: string): Promise<void> {
    await this.redis.xack(ENGINE_EVENTS_STREAM, CONSUMER_GROUP, msgId);
  }
}
