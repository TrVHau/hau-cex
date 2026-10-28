import { Injectable } from '@nestjs/common';
import { Prisma, Wallet } from '../../generated/prisma';
import {
  buildCursorWhere,
  buildPaginatedResult,
  formatDecimal,
  ReferenceType,
  WalletNotFoundException,
} from '../../common';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import { LedgerPageDto } from './dto/ledger-page.dto';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { LedgerItemDto } from './dto/ledger-item.dto';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WalletWithAsset, LedgerWithAsset } from './types';

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
    const {
      assetSymbol,
      asset,
      entryType,
      balanceType,
      limit = 20,
      cursor,
    } = query;
    const targetAsset = (assetSymbol || asset)?.trim().toUpperCase();
    const cursorFilter = buildCursorWhere(cursor);

    const where: Prisma.LedgerEntryWhereInput = {
      userId,
      ...(targetAsset && {
        asset: { symbol: targetAsset },
      }),
      ...(entryType && { entryType }),
      ...(balanceType && { balanceType }),
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

    return buildPaginatedResult(rows, limit, (row) =>
      this.toLedgerItemDto(row),
    );
  }

  // tra cứu ví nội bộ (throw lỗi nếu o thấy )
  async findWalletOrThrow(
    userId: string,
    assetSymbol: string,
  ): Promise<Wallet> {
    const normalizedSymbol = assetSymbol.trim().toUpperCase();
    const wallet = await this.prisma.wallet.findFirst({
      where: {
        userId,
        asset: {
          symbol: normalizedSymbol,
        },
      },
    });

    if (!wallet) {
      throw new WalletNotFoundException(
        `user ${userId} and asset ${assetSymbol}`,
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
      throw new WalletNotFoundException(`user ${userId} and asset ${assetId}`);
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
