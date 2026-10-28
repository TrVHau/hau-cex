import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { MarketGateway } from './market.gateway';
import {
  MARKET_CONSUMER_GROUP,
  MARKET_EVENTS_STREAM,
} from './market.constants';
import { RedisStreamReadResult } from './types';
import { hostname } from 'node:os';

@Injectable()
export class MarketEventsConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(MarketEventsConsumerService.name);
  private running = false;
  private readonly consumerName = `api-fanout-${hostname()}-${process.pid}`;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly gateway: MarketGateway,
  ) {}

  onApplicationBootstrap(): void {
    this.running = true;
    this.consumeLoop().catch((error) => {
      this.logger.error('Market events consumer loop failed', error);
    });
  }

  onApplicationShutdown(): void {
    this.running = false;
  }

  private async consumeLoop(): Promise<void> {
    try {
      await this.redis.xgroup(
        'CREATE',
        MARKET_EVENTS_STREAM,
        MARKET_CONSUMER_GROUP,
        '$',
        'MKSTREAM',
      );
    } catch (error) {
      if (!String(error).includes('BUSYGROUP')) {
        this.logger.error(
          'Failed to create market events consumer group',
          error,
        );
        return;
      }
    }

    while (this.running) {
      try {
        await this.processBatch();
      } catch (error) {
        this.logger.error('Error reading market events stream', error);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private async processBatch(): Promise<void> {
    const result = (await this.redis.xreadgroup(
      'GROUP',
      MARKET_CONSUMER_GROUP,
      this.consumerName,
      'COUNT',
      '20',
      'BLOCK',
      '200',
      'STREAMS',
      MARKET_EVENTS_STREAM,
      '>',
    )) as RedisStreamReadResult;

    if (!result) return;

    const ackIds: string[] = [];

    for (const [, messages] of result) {
      for (const [msgId, fieldArray] of messages) {
        ackIds.push(msgId);
        const fields: Record<string, string> = {};
        if (fieldArray) {
          for (let i = 0; i < fieldArray.length; i += 2) {
            fields[fieldArray[i]] = fieldArray[i + 1] ?? '';
          }
        }

        try {
          const messageType = fields.messageType;
          const market = fields.market;
          let payload: unknown;
          try {
            payload = JSON.parse(fields.payload ?? '{}');
          } catch {
            payload = {};
          }

          if (messageType === 'orderbook.update') {
            this.gateway.broadcastOrderBook(market, payload);
          } else if (messageType === 'trade.created') {
            this.gateway.broadcastTrade(market, payload);
          }
        } catch (err) {
          this.logger.error(`Error processing market event ${msgId}`, err);
        }
      }
    }

    if (ackIds.length > 0) {
      await this.redis.xack(
        MARKET_EVENTS_STREAM,
        MARKET_CONSUMER_GROUP,
        ...ackIds,
      );
    }
  }
}
