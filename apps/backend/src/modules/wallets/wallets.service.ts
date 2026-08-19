import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Wallet } from '../../generated/prisma';
import { formatDecimal } from '../../common/helpers/decimal.helper';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { LedgerPageDto } from './dto/ledger-page.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { LedgerItemDto } from './dto/ledger-item.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { decodeCursor, encodeCursor } from '../../common/helpers/cursor.helper';
import { ReferenceType } from '../../common/enums/reference-type.enum';

type WalletWithAsset = Prisma.WalletGetPayload<{
  include: {
    asset: {
      select: {
        symbol: true;
        name: true;
      };
    };
  };
}>;

type LedgerWithAsset = Prisma.LedgerEntryGetPayload<{
  include: {
    asset: {
      select: {
        symbol: true;
      };
    };
  };
}>;

@Injectable()
export class WalletsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyWallets(userId: string): Promise<WalletResponseDto[]> {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      include: { asset: { select: { symbol: true, name: true } } },
      orderBy: { asset: { symbol: 'asc' } },
    });

    return wallets.map((w) => this.toWalletResponseDto(w));
  }

  async getMyLedger(
    userId: string,
    query: LedgerQueryDto,
  ): Promise<LedgerPageDto> {
    const { asset, limit = 20, cursor } = query;
    const decoded = cursor ? decodeCursor(cursor) : null;

    const where: Prisma.LedgerEntryWhereInput = {
      userId,
      ...(asset && {
        asset: { symbol: { equals: asset, mode: 'insensitive' } },
      }),
      ...(decoded && {
        OR: [
          { createdAt: { lt: new Date(decoded.createdAt) } },
          {
            createdAt: { equals: new Date(decoded.createdAt) },
            id: { lt: decoded.id },
          },
        ],
      }),
    };

    const rows = await this.prisma.ledgerEntry.findMany({
      where,
      include: {
        asset: { select: { symbol: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    if (hasMore) {
      rows.pop(); // remove the extra row used to check for more
    }

    return {
      items: rows.map((row) => this.toLedgerItemDto(row)),
      nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
    };
  }

  // tra cứu ví nội bộ (throw lỗi nếu o thấy )
  async findWalletOrThrow(
    userId: string,
    assetSymbol: string,
  ): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        asset: { symbol: { equals: assetSymbol, mode: 'insensitive' } },
      },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for user ${userId} and asset ${assetSymbol}`,
      );
    }

    return wallet;
  }

  // tra cứu ví bằng asset
  async findWalletByAssetId(userId: string, assetId: string): Promise<Wallet> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId_assetId: { userId, assetId } },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for user ${userId} and asset ${assetId}`,
      );
    }

    return wallet;
  }

  //private mapping helper
  private toWalletResponseDto(wallet: WalletWithAsset): WalletResponseDto {
    const available = wallet.availableBalance;
    const locked = wallet.lockedBalance;
    return {
      id: wallet.id,
      assetSymbol: wallet.asset.symbol,
      assetName: wallet.asset.name,
      availableBalance: formatDecimal(available),
      lockedBalance: formatDecimal(locked),
      totalBalance: formatDecimal(available.plus(locked)),
      updatedAt: wallet.updatedAt.toISOString(),
    };
  }

  private toLedgerItemDto(row: LedgerWithAsset): LedgerItemDto {
    return {
      id: row.id,
      entryType: row.entryType,
      balanceType: row.balanceType,
      amount: formatDecimal(row.amount),
      beforeBalance: formatDecimal(row.beforeBalance),
      afterBalance: formatDecimal(row.afterBalance),
      assetSymbol: row.asset.symbol,
      referenceType: row.referenceType as ReferenceType,
      referenceId: row.referenceId,
      operationId: row.operationId,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
