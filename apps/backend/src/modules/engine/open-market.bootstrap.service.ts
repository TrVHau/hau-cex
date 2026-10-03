import { Injectable, Logger } from '@nestjs/common';
import { OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { nextCommandSequence } from '../../common/helpers/sequence.helper';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class OpenMarketBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(OpenMarketBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.bootstrapMarkets().catch((error) => {
      this.logger.error('Failed to bootstrap markets', error);
    });
  }

  private async bootstrapMarkets(): Promise<void> {
    const pairs = await this.prisma.tradingPair.findMany({
      where: { status: { not: 'READY' } },
    });

    for (const pair of pairs) {
      await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.outboxEvent.findFirst({
            where: {
              messageType: 'OpenMarket',
              partitionKey: pair.id,
              status: { in: ['PENDING', 'PUBLISHED'] },
            },
            select: { id: true },
          });

          if (existing) {
            this.logger.log(
              `OpenMarket outbox already exists for pair ${pair.symbol}, skipping`,
            );
            return;
          }

          const cmdSeq = await nextCommandSequence(tx, pair.id);

          await tx.outboxEvent.create({
            data: {
              messageId: uuidv7(),
              version: 1,
              correlationId: uuidv7(),
              streamName: 'stream:engine:commands',
              messageType: 'OpenMarket',
              partitionKey: pair.id,
              commandSequence: cmdSeq,
              occurredAt: new Date(),
              payload: {
                tradingPairId: pair.id,
                market: pair.symbol,
                baseAssetId: pair.baseAssetId,
                quoteAssetId: pair.quoteAssetId,
                pricePrecision: pair.pricePrecision,
                quantityPrecision: pair.quantityPrecision,
                tickSize: pair.tickSize.toFixed(18),
                stepSize: pair.stepSize.toFixed(18),
                minQuantity: pair.minQuantity.toFixed(18),
                minNotional: pair.minNotional.toFixed(18),
                openedAt: new Date().toISOString(),
              },
            },
          });

          this.logger.log(`Created OpenMarket outbox for pair ${pair.symbol}`);
        },
        { timeout: 10_000 },
      );
    }
  }
}
