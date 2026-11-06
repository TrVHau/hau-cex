import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { v7 as uuidv7 } from 'uuid';

const CONSUMER_NAME = 'deposit-credit-v1';

@Injectable()
export class DepositCreditService {
  private readonly logger = new Logger(DepositCreditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async creditDeposit(depositId: string, messageId: string): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        // 1. Idempotency guard
        const existing = await tx.processedEvent.findFirst({
          where: { consumerName: CONSUMER_NAME, messageId },
        });
        if (existing) {
          this.logger.log(`Duplicate message ${messageId}, skipping credit`);
          return;
        }

        // 2. Lock Deposit row + join Asset for decimals
        const deposits = await tx.$queryRaw<
          Array<{
            id: string;
            status: string;
            user_id: string;
            asset_id: string;
            amount: string | null;
            decimals: number;
          }>
        >`
          SELECT d.id, d.status, d.user_id, d.asset_id, d.amount::text, a.decimals
          FROM deposits d
          JOIN assets a ON a.id = d.asset_id
          WHERE d.id = ${depositId}::uuid
          FOR UPDATE
        `;
        const dep = deposits[0];
        if (!dep) throw new Error(`Deposit ${depositId} not found`);

        if (dep.status === 'CREDITED') {
          this.logger.log(`Deposit ${depositId} already CREDITED, skipping`);
          return;
        }
        if (dep.status === 'FAILED' || dep.status === 'EXPIRED') {
          this.logger.warn(
            `Deposit ${depositId} in terminal state ${dep.status}, skipping`,
          );
          return;
        }
        if (!dep.amount) {
          throw new Error(
            `Deposit ${depositId} has no amount yet — cannot credit`,
          );
        }

        const amount = new Prisma.Decimal(dep.amount);

        // 3. Upsert Wallet (ensure row exists)
        await tx.$executeRaw`
          INSERT INTO wallets (id, user_id, asset_id, available_balance, locked_balance, created_at, updated_at)
          VALUES (gen_random_uuid(), ${dep.user_id}::uuid, ${dep.asset_id}::uuid, 0, 0, now(), now())
          ON CONFLICT (user_id, asset_id) DO NOTHING
        `;

        // 4. Lock Wallet row
        const wallets = await tx.$queryRaw<
          Array<{ id: string; available_balance: string }>
        >`
          SELECT id, available_balance::text
          FROM wallets
          WHERE user_id = ${dep.user_id}::uuid AND asset_id = ${dep.asset_id}::uuid
          FOR UPDATE
        `;
        const wallet = wallets[0];
        if (!wallet)
          throw new Error(`Wallet not found for deposit ${depositId}`);

        const beforeBalance = new Prisma.Decimal(wallet.available_balance);
        const afterBalance = beforeBalance.plus(amount);

        // 5. Update Wallet balance
        await tx.$executeRaw`
          UPDATE wallets
          SET available_balance = ${afterBalance.toFixed(18)}::numeric, updated_at = now()
          WHERE id = ${wallet.id}::uuid
        `;

        // 6. Ledger Entry
        await tx.ledgerEntry.create({
          data: {
            walletId: wallet.id,
            userId: dep.user_id,
            assetId: dep.asset_id,
            entryType: 'DEPOSIT',
            balanceType: 'AVAILABLE',
            amount,
            beforeBalance,
            afterBalance,
            referenceType: 'DEPOSIT',
            referenceId: depositId,
            operationId: depositId,
          },
        });

        // 7. Update Deposit → CREDITED
        await tx.$executeRaw`
          UPDATE deposits
          SET status = 'CREDITED', credited_at = now(), updated_at = now()
          WHERE id = ${depositId}::uuid
        `;

        // 8. Outbox DepositUpdated event
        await tx.outboxEvent.create({
          data: {
            messageId: uuidv7(),
            version: 1,
            correlationId: depositId,
            streamName: 'stream:market:events',
            messageType: 'DepositUpdated',
            partitionKey: dep.user_id,
            occurredAt: new Date(),
            payload: {
              depositId,
              userId: dep.user_id,
              assetId: dep.asset_id,
              amount: amount.toFixed(18),
              status: 'CREDITED',
              creditedAt: new Date().toISOString(),
            },
          },
        });

        // 9. Mark processedEvent for idempotency
        await tx.processedEvent.create({
          data: {
            consumerName: CONSUMER_NAME,
            messageId,
            messageType: 'DepositConfirmed',
            payloadHash: messageId,
            result: 'CREDITED',
            resultReferenceId: depositId,
          },
        });

        this.logger.log(
          `Credited ${amount.toFixed()} to wallet ${wallet.id} for deposit ${depositId}`,
        );
      },
      { timeout: 15_000 },
    );
  }
}
