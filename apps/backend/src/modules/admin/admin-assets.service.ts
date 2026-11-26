import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AssetStatus } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  buildCursorWhere,
  buildPaginatedResult,
  PaginatedResponseDto,
} from '../../common';
import { AdminAssetItem } from './types';

@Injectable()
export class AdminAssetsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liệt kê tất cả assets theo cursor pagination */
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

  /** Kích hoạt asset (ACTIVE) */
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

  /** Vô hiệu hóa asset (INACTIVE) */
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
}
