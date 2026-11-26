import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TradingPairStatus } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  ENGINE_COMMANDS_STREAM,
  formatDecimal,
  nextCommandSequence,
} from '../../common';
import { OpenMarketPayload, SuspendMarketPayload } from '../engine/types';
import { v7 as uuidv7 } from 'uuid';
import { AdminMarketItem } from './types';

@Injectable()
export class AdminMarketsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liệt kê tất cả trading pairs kèm thông tin cấu hình */
  async listMarkets(): Promise<AdminMarketItem[]> {
    const pairs = await this.prisma.tradingPair.findMany({
      include: {
        baseAsset: { select: { symbol: true } },
        quoteAsset: { select: { symbol: true } },
      },
      orderBy: { symbol: 'asc' },
    });

    return pairs.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      baseAsset: p.baseAsset.symbol,
      quoteAsset: p.quoteAsset.symbol,
      pricePrecision: p.pricePrecision,
      quantityPrecision: p.quantityPrecision,
      tickSize: formatDecimal(p.tickSize),
      stepSize: formatDecimal(p.stepSize),
      minQuantity: formatDecimal(p.minQuantity),
      minNotional: formatDecimal(p.minNotional),
      makerFeeRate: formatDecimal(p.makerFeeRate),
      takerFeeRate: formatDecimal(p.takerFeeRate),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }));
  }

  /** Ghi outbox OpenMarket command để Matching Engine mở lại market đang SUSPENDED */
  async openMarket(marketId: string): Promise<{ status: string }> {
    await this.prisma.$transaction(
      async (tx) => {
        const pair = await tx.tradingPair.findUnique({
          where: { id: marketId },
          include: {
            baseAsset: { select: { symbol: true } },
            quoteAsset: { select: { symbol: true } },
          },
        });

        if (!pair) {
          throw new NotFoundException(`Market ${marketId} not found`);
        }
        if (pair.status !== TradingPairStatus.SUSPENDED) {
          throw new ConflictException(
            `Market must be SUSPENDED to open, current status: ${pair.status}`,
          );
        }

        const pendingOpen = await tx.outboxEvent.findFirst({
          where: {
            messageType: 'OpenMarket',
            partitionKey: pair.id,
            status: 'PENDING',
          },
          select: { id: true },
        });

        if (pendingOpen) {
          throw new ConflictException(
            'An OpenMarket command is already pending for this market',
          );
        }

        const cmdSeq = await nextCommandSequence(tx, pair.id);

        const payload: OpenMarketPayload = {
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
        };

        await tx.outboxEvent.create({
          data: {
            messageId: uuidv7(),
            version: 1,
            correlationId: uuidv7(),
            streamName: ENGINE_COMMANDS_STREAM,
            messageType: 'OpenMarket',
            partitionKey: pair.id,
            commandSequence: cmdSeq,
            occurredAt: new Date(),
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 10_000 },
    );

    return { status: 'OPENING' };
  }

  /** Set DB SUSPENDED và ghi outbox SuspendMarket trong cùng transaction */
  async suspendMarket(
    marketId: string,
    reason?: string,
  ): Promise<{ status: string }> {
    await this.prisma.$transaction(
      async (tx) => {
        const pair = await tx.tradingPair.findUnique({
          where: { id: marketId },
        });

        if (!pair) {
          throw new NotFoundException(`Market ${marketId} not found`);
        }
        if (pair.status !== TradingPairStatus.READY) {
          throw new ConflictException(
            `Market must be READY to suspend, current status: ${pair.status}`,
          );
        }

        await tx.tradingPair.update({
          where: { id: marketId },
          data: { status: TradingPairStatus.SUSPENDED },
        });

        const cmdSeq = await nextCommandSequence(tx, pair.id);

        const payload: SuspendMarketPayload = {
          tradingPairId: pair.id,
          market: pair.symbol,
          reason: reason ?? 'Admin suspended',
          suspendedAt: new Date().toISOString(),
        };

        await tx.outboxEvent.create({
          data: {
            messageId: uuidv7(),
            version: 1,
            correlationId: uuidv7(),
            streamName: ENGINE_COMMANDS_STREAM,
            messageType: 'SuspendMarket',
            partitionKey: pair.id,
            commandSequence: cmdSeq,
            occurredAt: new Date(),
            payload: payload as unknown as Prisma.InputJsonValue,
          },
        });
      },
      { timeout: 10_000 },
    );

    return { status: 'SUSPENDED' };
  }
}
