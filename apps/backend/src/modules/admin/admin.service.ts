import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  AssetStatus,
  TradingPairStatus,
  UserRole,
  UserStatus,
} from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  buildCursorWhere,
  buildPaginatedResult,
  ENGINE_COMMANDS_STREAM,
  formatDecimal,
  nextCommandSequence,
  PaginatedResponseDto,
} from '../../common';
import { OpenMarketPayload, SuspendMarketPayload } from '../engine/types';
import { v7 as uuidv7 } from 'uuid';
import { AdminUserItem, AdminAssetItem, AdminMarketItem } from './types';
// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  /**
   * Liệt kê tất cả users, loại trừ SYSTEM accounts.
   * Cursor-based pagination (createdAt desc, id desc).
   */
  async listUsers(
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<AdminUserItem>> {
    const cursorFilter = buildCursorWhere(cursor);
    const take = limit + 1;

    const rows = await this.prisma.user.findMany({
      where: {
        role: { not: UserRole.SYSTEM },
        ...(cursorFilter && { OR: cursorFilter.OR }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        lockedAt: true,
        lockedReason: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return buildPaginatedResult(rows, limit, (u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      lockedAt: u.lockedAt?.toISOString() ?? null,
      lockedReason: u.lockedReason ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /**
   * Lock user: chỉ áp dụng cho role USER.
   * Cùng transaction: set status=LOCKED + revoke tất cả sessions (force logout).
   */
  async lockUser(userId: string, reason?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      if (user.role !== UserRole.USER) {
        throw new ForbiddenException(
          'Only accounts with role USER can be locked',
        );
      }
      if (user.status === UserStatus.LOCKED) {
        throw new ConflictException('User is already locked');
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.LOCKED,
          lockedAt: new Date(),
          lockedReason: reason ?? null,
        },
      });

      // Revoke tất cả sessions còn hoạt động → force logout ngay lập tức
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /**
   * Unlock user: chỉ unlock được user đang LOCKED.
   * Xóa lockedAt và lockedReason.
   */
  async unlockUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (user.status !== UserStatus.LOCKED) {
      throw new ConflictException('User is not locked');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        lockedAt: null,
        lockedReason: null,
      },
    });
  }

  // Assets

  /**
   * Liệt kê tất cả assets.
   * Cursor-based pagination (createdAt desc, id desc).
   */
  async listAssets(
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<AdminAssetItem>> {
    const cursorFilter = buildCursorWhere(cursor);
    const take = limit + 1;

    const rows = await this.prisma.asset.findMany({
      where: cursorFilter ? { OR: cursorFilter.OR } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
    });

    return buildPaginatedResult(rows, limit, (a) => ({
      id: a.id,
      symbol: a.symbol,
      name: a.name,
      decimals: a.decimals,
      contractAddress: a.contractAddress ?? null,
      status: a.status,
      depositEnabled: a.depositEnabled,
      tradingEnabled: a.tradingEnabled,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  /**
   * Activate asset: set status = ACTIVE.
   */
  async activateAsset(assetId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    if (asset.status === AssetStatus.ACTIVE) {
      throw new ConflictException('Asset is already active');
    }

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.ACTIVE },
    });
  }

  /**
   * Deactivate asset: set status = INACTIVE.
   */
  async deactivateAsset(assetId: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found`);
    }
    if (asset.status === AssetStatus.INACTIVE) {
      throw new ConflictException('Asset is already inactive');
    }

    await this.prisma.asset.update({
      where: { id: assetId },
      data: { status: AssetStatus.INACTIVE },
    });
  }

  // Markets

  /**
   * Liệt kê tất cả markets kèm base/quote asset info.
   * Không phân trang (thường ít pairs).
   */
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

  /**
   * Open market: Ghi outbox OpenMarket command.
   * DB giữ nguyên SUSPENDED → đợi Engine trả MarketOpened → Consumer set READY.
   *
   * Chỉ mở được khi market đang SUSPENDED.
   */
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

        // Kiểm tra không có OpenMarket outbox đang chờ xử lý cho pair này
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

  /**
   * Suspend market: Set DB = SUSPENDED + Outbox SuspendMarket trong cùng transaction.
   * PlaceOrder bị block ngay lập tức vì DB check status !== READY.
   * Engine cũng nhận lệnh qua Outbox → set internal state = SUSPENDED.
   *
   * Chỉ suspend được khi market đang READY.
   */
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

        // 1. Set DB SUSPENDED ngay → PlaceOrder bị reject ở tầng API
        await tx.tradingPair.update({
          where: { id: marketId },
          data: { status: TradingPairStatus.SUSPENDED },
        });

        // 2. Ghi outbox SuspendMarket → Engine nhận và set internal state SUSPENDED
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
