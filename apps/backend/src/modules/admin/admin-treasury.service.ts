import { Injectable, NotFoundException } from '@nestjs/common';
import { LedgerEntryType, Prisma, UserRole } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  buildCursorWhere,
  buildPaginatedResult,
  formatDecimal,
  PaginatedResponseDto,
  ReferenceType,
} from '../../common';
import {
  AdminTreasuryAccountInfo,
  AdminTreasuryLedgerItem,
  AdminTreasuryOverview,
} from './types';
import { TreasuryLedgerQueryDto } from './dto/treasury-ledger-query.dto';

@Injectable()
export class AdminTreasuryService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveTreasuryAccount(): Promise<AdminTreasuryAccountInfo> {
    const envTreasuryId = process.env['TREASURY_USER_ID']?.trim();
    const select = {
      id: true,
      email: true,
      fullName: true,
      role: true,
    } as const;

    const account = envTreasuryId
      ? await this.prisma.user.findUnique({
          where: { id: envTreasuryId },
          select,
        })
      : await this.prisma.user.findFirst({
          where: { role: UserRole.SYSTEM },
          orderBy: { createdAt: 'asc' },
          select,
        });

    if (!account) {
      throw new NotFoundException(
        'Treasury system account not found (check TREASURY_USER_ID or seed data)',
      );
    }

    return account;
  }

  /** Tổng quan ví Treasury và tổng doanh thu phí giao dịch theo asset */
  async getTreasuryOverview(): Promise<AdminTreasuryOverview> {
    const account = await this.resolveTreasuryAccount();

    const [assets, wallets, feeStats, lastFeeEntry] = await Promise.all([
      this.prisma.asset.findMany({
        orderBy: { symbol: 'asc' },
        select: {
          id: true,
          symbol: true,
          name: true,
          decimals: true,
        },
      }),
      this.prisma.wallet.findMany({
        where: { userId: account.id },
        select: {
          id: true,
          assetId: true,
          availableBalance: true,
          lockedBalance: true,
          updatedAt: true,
        },
      }),
      this.prisma.ledgerEntry.groupBy({
        by: ['assetId'],
        where: {
          userId: account.id,
          entryType: LedgerEntryType.TRADING_FEE,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.ledgerEntry.findFirst({
        where: {
          userId: account.id,
          entryType: LedgerEntryType.TRADING_FEE,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { createdAt: true },
      }),
    ]);

    const walletByAsset = new Map(wallets.map((w) => [w.assetId, w]));
    const feeByAsset = new Map(feeStats.map((s) => [s.assetId, s]));

    let totalFeeEntries = 0;
    const zero = new Prisma.Decimal(0);

    const treasuryWallets = assets.map((asset) => {
      const wallet = walletByAsset.get(asset.id);
      const stat = feeByAsset.get(asset.id);
      const available = wallet?.availableBalance ?? zero;
      const locked = wallet?.lockedBalance ?? zero;
      const total = available.plus(locked);
      const feesCollected = stat?._sum.amount ?? zero;
      const entryCount = stat?._count.id ?? 0;

      totalFeeEntries += entryCount;

      return {
        walletId: wallet?.id ?? null,
        assetId: asset.id,
        assetSymbol: asset.symbol,
        assetName: asset.name,
        decimals: asset.decimals,
        availableBalance: formatDecimal(available),
        lockedBalance: formatDecimal(locked),
        totalBalance: formatDecimal(total),
        totalFeesCollected: formatDecimal(feesCollected),
        feeEntryCount: entryCount,
        updatedAt: wallet?.updatedAt.toISOString() ?? null,
      };
    });

    return {
      account,
      wallets: treasuryWallets,
      totalFeeEntries,
      lastCollectedAt: lastFeeEntry?.createdAt.toISOString() ?? null,
    };
  }

  /** Liệt kê lịch sử dòng tiền của Treasury kèm thông tin Trade */
  async getTreasuryLedger(
    query: TreasuryLedgerQueryDto,
  ): Promise<PaginatedResponseDto<AdminTreasuryLedgerItem>> {
    const account = await this.resolveTreasuryAccount();
    const { assetSymbol, entryType, limit = 20, cursor } = query;
    const normalizedSymbol = assetSymbol?.trim().toUpperCase();
    const cursorFilter = buildCursorWhere(cursor);

    const where: Prisma.LedgerEntryWhereInput = {
      userId: account.id,
      ...(normalizedSymbol && { asset: { symbol: normalizedSymbol } }),
      ...(entryType && { entryType }),
      ...(cursorFilter && { OR: cursorFilter.OR }),
    };

    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      include: {
        asset: { select: { symbol: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const pageRows = rows.length > limit ? rows.slice(0, limit) : rows;
    const tradeRefType = String(ReferenceType.TRADE);
    const tradeIds = Array.from(
      new Set(
        pageRows
          .filter((r) => r.referenceType === tradeRefType)
          .map((r) => r.referenceId),
      ),
    );

    const trades =
      tradeIds.length > 0
        ? await this.prisma.trade.findMany({
            where: { id: { in: tradeIds } },
            select: {
              id: true,
              executionPrice: true,
              executedQuantity: true,
              takerSide: true,
              tradingPair: { select: { symbol: true } },
            },
          })
        : [];

    const tradeMap = new Map(trades.map((t) => [t.id, t]));

    return buildPaginatedResult(rows, limit, (row) => {
      const trade =
        row.referenceType === tradeRefType
          ? tradeMap.get(row.referenceId)
          : undefined;

      return {
        id: row.id,
        assetSymbol: row.asset.symbol,
        entryType: row.entryType,
        balanceType: row.balanceType,
        amount: formatDecimal(row.amount),
        beforeBalance: formatDecimal(row.beforeBalance),
        afterBalance: formatDecimal(row.afterBalance),
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        marketSymbol: trade?.tradingPair.symbol ?? null,
        executionPrice: trade ? formatDecimal(trade.executionPrice) : null,
        executedQuantity: trade ? formatDecimal(trade.executedQuantity) : null,
        takerSide: trade?.takerSide ?? null,
        operationId: row.operationId,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }
}
