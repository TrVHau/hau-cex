import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
  Inject,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../core/prisma/prisma.service';
import { DepositCreditService } from '../modules/deposits/deposit-credit.service';
import { Decimal } from 'decimal.js';

const STREAM = 'stream:blockchain:events';
const GROUP = 'blockchain-deposit-v1';
const CONSUMER = 'deposit-consumer-1';

type DepositDetectedPayload = {
  depositId: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  blockHash: string;
  depositorAddress: string;
  tokenAddress: string;
  amountRaw: string;
  chainId: string;
};

type DepositDetectedEnvelope = {
  messageId?: string;
  payload: DepositDetectedPayload;
};

@Injectable()
export class BlockchainDepositConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BlockchainDepositConsumer.name);
  private running = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly prisma: PrismaService,
    private readonly depositCredit: DepositCreditService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!process.env['BLOCKCHAIN_RPC_URL']) {
      this.logger.warn(
        'Deposit consumer disabled (BLOCKCHAIN_RPC_URL not set)',
      );
      return;
    }

    try {
      await this.redis.xgroup('CREATE', STREAM, GROUP, '0', 'MKSTREAM');
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message.includes('BUSYGROUP')) {
        throw err;
      }
    }

    this.running = true;
    this.loopPromise = this.consumeLoop();
    this.logger.log(
      `Blockchain deposit consumer started, stream=${STREAM} group=${GROUP}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    await this.loopPromise;
  }

  private async consumeLoop(): Promise<void> {
    while (this.running) {
      try {
        const results = (await this.redis.xreadgroup(
          'GROUP',
          GROUP,
          CONSUMER,
          'COUNT',
          '10',
          'BLOCK',
          '2000',
          'STREAMS',
          STREAM,
          '>',
        )) as Array<[string, Array<[string, string[]]>]> | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [streamMsgId, fields] of messages) {
            await this.processMessage(streamMsgId, fields);
          }
        }
      } catch (err) {
        if (this.running) {
          this.logger.error('Consumer loop error', err);
          await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  private async processMessage(
    streamMsgId: string,
    fields: string[],
  ): Promise<void> {
    // Parse flat field array → map
    const fieldMap: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i];
      const val = fields[i + 1];
      if (key !== undefined && val !== undefined) {
        fieldMap[key] = val;
      }
    }

    const rawPayload = fieldMap['payload'];
    if (!rawPayload) {
      await this.redis.xack(STREAM, GROUP, streamMsgId);
      return;
    }

    let envelope: DepositDetectedEnvelope;
    try {
      envelope = JSON.parse(rawPayload) as DepositDetectedEnvelope;
    } catch {
      this.logger.error(
        `Failed to parse payload for stream msg ${streamMsgId}`,
      );
      await this.redis.xack(STREAM, GROUP, streamMsgId);
      return;
    }

    const p = envelope.payload;
    const messageId = envelope.messageId ?? streamMsgId;
    const requiredConfirmations = Number(
      process.env['BLOCKCHAIN_CONFIRMATIONS'] ?? '1',
    );

    try {
      await this.prisma.$transaction(async (tx) => {
        const deposits = await tx.$queryRaw<
          Array<{ id: string; status: string; asset_decimals: number }>
        >`
          SELECT d.id, d.status, a.decimals AS asset_decimals
          FROM deposits d
          JOIN assets a ON a.id = d.asset_id
          WHERE d.id = ${p.depositId}::uuid
          FOR UPDATE
        `;

        const dep = deposits[0];
        if (!dep || dep.status !== 'PENDING') return;

        const amount = new Decimal(p.amountRaw).div(
          new Decimal(10).pow(dep.asset_decimals),
        );
        const newStatus =
          requiredConfirmations <= 1 ? 'CONFIRMING' : 'DETECTED';

        await tx.$executeRaw`
          UPDATE deposits SET
            status = ${newStatus}::deposit_status,
            tx_hash = ${p.txHash},
            log_index = ${p.logIndex}::integer,
            block_number = ${BigInt(p.blockNumber)}::bigint,
            block_hash = ${p.blockHash},
            amount_raw = ${p.amountRaw}::numeric,
            amount = ${amount.toFixed(18)}::numeric,
            detected_at = now(),
            updated_at = now()
          WHERE id = ${p.depositId}::uuid
        `;
      });

      // Credit immediately when confirmations <= 1
      if (requiredConfirmations <= 1) {
        await this.depositCredit.creditDeposit(p.depositId, messageId);
      }

      await this.redis.xack(STREAM, GROUP, streamMsgId);
    } catch (err) {
      this.logger.error(
        `Error processing stream msg ${streamMsgId} (depositId=${p.depositId})`,
        err,
      );
      // Do NOT ack — let it be retried
    }
  }
}
