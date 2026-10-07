import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';

const ENGINE_EVENTS_STREAM = 'stream:engine:events';
const CONSUMER_GROUP = 'backend-engine-events-v1';
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

    while (this.running) {
      try {
        await this.processBatch();
      } catch (error) {
        this.logger.error('Engine event consumer error', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async processBatch(): Promise<void> {
    const result = await this.redis.xreadgroup(
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
    );

    if (!result) return;

    for (const [, messages] of result) {
      for (const [msgId, fieldArray] of messages) {
        const fields: Record<string, string> = {};
        if (fieldArray) {
          for (let i = 0; i < fieldArray.length; i += 2) {
            fields[fieldArray[i]] = fieldArray[i + 1] ?? '';
          }
        }
        await this.handleMessage(msgId, fields);
      }
    }
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
      await this.dispatch(messageType, tradingPairId, payload, tx);

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

    await this.ack(msgId);
  }


  private async dispatch(
    messageType: string,
    tradingPairId: string,
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
      case 'OrderCancelled':
      case 'CancelOrderRejected':
      case 'OrderBookChanged':
        this.logger.log(
          `${messageType} received — Phase 7 will handle settlement`,
        );
        break;

      default:
        this.logger.warn(`Unknown engine event type: ${messageType}`);
    }
  }

  private async ack(msgId: string): Promise<void> {
    await this.redis.xack(ENGINE_EVENTS_STREAM, CONSUMER_GROUP, msgId);
  }
}
