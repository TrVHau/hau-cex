import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';

interface OutboxRow {
  id: string;
  message_id: string;
  stream_name: string;
  partition_key: string | null;
  command_sequence: bigint | null;
  message_type: string;
  payload: Prisma.JsonValue;
  retry_count: number;
}

@Injectable()
export class OutboxPollerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OutboxPollerService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  onApplicationBootstrap(): void {
    this.running = true;
    void this.pollLoop();
  }

  onApplicationShutdown(): void {
    this.running = false;
  }

  private async pollLoop(): Promise<void> {
    while (this.running) {
      try {
        const hadWork = await this.processBatch();
        // If no rows processed, back off briefly; otherwise drain immediately
        if (!hadWork) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      } catch (error) {
        this.logger.error('Outbox poll failed', error);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  }

  private async processBatch(): Promise<boolean> {
    // Step 1: Fetch and lock rows in a short Postgres-only transaction.
    // No Redis calls here — Redis is NOT part of the Postgres transaction.
    const rows = await this.prisma.$transaction(async (tx) => {
      return tx.$queryRaw<OutboxRow[]>`
        SELECT id, message_id, stream_name, partition_key,
               command_sequence, message_type, payload, retry_count
        FROM outbox_events
        WHERE status = 'PENDING'::outbox_status
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY command_sequence ASC NULLS LAST, created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `;
    });

    if (rows.length === 0) return false;

    // Step 2 & 3: Publish to Redis, then update Postgres — both outside the lock tx.
    // If Redis succeeds but Postgres update fails, the row stays PENDING and will be
    // retried; the engine-event consumer's processedEvent idempotency guard prevents
    // double-processing on re-delivery.
    for (const row of rows) {
      try {
        await this.redis.xadd(
          row.stream_name,
          '*',
          'messageId',
          row.message_id,
          'messageType',
          row.message_type,
          'partitionKey',
          row.partition_key ?? '',
          'commandSeq',
          row.command_sequence?.toString() ?? '',
          'payload',
          JSON.stringify(row.payload),
        );

        await this.prisma.$executeRaw`
          UPDATE outbox_events
          SET status = 'PUBLISHED'::outbox_status,
              published_at = NOW()
          WHERE id = ${row.id}::uuid
        `;
      } catch (error) {
        // Exponential backoff: 1, 2, 4, 8, 16, 32 seconds (capped at 32)
        const delaySeconds = Math.min(Math.pow(2, row.retry_count), 32);

        await this.prisma.$executeRaw`
          UPDATE outbox_events
          SET retry_count = retry_count + 1,
              last_error = ${String(error)},
              next_retry_at = NOW() + (${delaySeconds} * INTERVAL '1 second'),
              status = CASE
                WHEN retry_count + 1 >= 5 THEN 'FAILED'::outbox_status
                ELSE status
              END
          WHERE id = ${row.id}::uuid
        `;
      }
    }

    return true;
  }
}
