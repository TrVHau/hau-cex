import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LedgerEntryType,
  NotificationType,
  Prisma,
  WithdrawalStatus,
} from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  buildCursorWhere,
  buildPaginatedResult,
  formatDecimal,
  PaginatedResponseDto,
  ReferenceType,
  WalletNotFoundException,
} from '../../common';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { v7 as uuidv7 } from 'uuid';
import { AdminWithdrawalItem } from './types';
import {
  AdminWithdrawalQueryDto,
  CompleteWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/process-withdrawal.dto';

type WithdrawalWithRelations = Prisma.WithdrawalGetPayload<{
  include: {
    user: { select: { email: true } };
    asset: { select: { symbol: true } };
  };
}>;

@Injectable()
export class AdminWithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletBalanceService: WalletBalanceService,
  ) {}

  /** Liệt kê yêu cầu rút tiền theo cursor pagination */
  async listWithdrawals(
    query: AdminWithdrawalQueryDto,
  ): Promise<PaginatedResponseDto<AdminWithdrawalItem>> {
    const { status, limit = 20, cursor } = query;
    const cursorFilter = buildCursorWhere(cursor);

    const rows = await this.prisma.withdrawal.findMany({
      where: {
        ...(status && { status }),
        ...(cursorFilter && { OR: cursorFilter.OR }),
      },
      include: {
        user: { select: { email: true } },
        asset: { select: { symbol: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    return buildPaginatedResult(rows, limit, (w) => this.toItem(w));
  }

  /** Admin duyệt và đánh dấu lệnh rút PENDING sang COMPLETED */
  async completeWithdrawal(
    withdrawalId: string,
    dto: CompleteWithdrawalDto,
  ): Promise<AdminWithdrawalItem> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{ id: string; userId: string; status: WithdrawalStatus }>
      >`
        SELECT id, user_id as "userId", status
        FROM withdrawals
        WHERE id = ${withdrawalId}::uuid
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) {
        throw new NotFoundException(`Withdrawal ${withdrawalId} not found`);
      }
      if (row.status !== WithdrawalStatus.PENDING) {
        throw new UnprocessableEntityException(
          'Only PENDING withdrawals can be completed',
        );
      }

      const saved = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.COMPLETED,
          txHash: dto.txHash?.trim() || null,
          processedAt: new Date(),
        },
        include: {
          user: { select: { email: true } },
          asset: { select: { symbol: true } },
        },
      });

      await tx.notification.create({
        data: {
          userId: row.userId,
          type: NotificationType.WALLET,
          title: `Rút ${formatDecimal(saved.amount)} ${saved.asset.symbol} hoàn tất`,
          message: `Lệnh rút ${formatDecimal(saved.amount)} ${saved.asset.symbol} đã được duyệt và hoàn thành.`,
        },
      });

      return saved;
    });

    return this.toItem(updated);
  }

  /** Admin từ chối lệnh rút PENDING và hoàn trả số dư về Available */
  async rejectWithdrawal(
    withdrawalId: string,
    dto: RejectWithdrawalDto,
  ): Promise<AdminWithdrawalItem> {
    const operationId = uuidv7();
    const reason = dto.reason?.trim() || 'Rejected by administrator';

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          assetId: string;
          status: WithdrawalStatus;
          amount: string;
        }>
      >`
        SELECT id, user_id as "userId", asset_id as "assetId", status, amount::text as "amount"
        FROM withdrawals
        WHERE id = ${withdrawalId}::uuid
        FOR UPDATE
      `;
      const row = rows[0];
      if (!row) {
        throw new NotFoundException(`Withdrawal ${withdrawalId} not found`);
      }
      if (row.status !== WithdrawalStatus.PENDING) {
        throw new UnprocessableEntityException(
          'Only PENDING withdrawals can be rejected',
        );
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId_assetId: { userId: row.userId, assetId: row.assetId } },
      });
      if (!wallet) {
        throw new WalletNotFoundException(
          `user ${row.userId} and asset ${row.assetId}`,
        );
      }

      const refundAmount = new Prisma.Decimal(row.amount);
      await this.walletBalanceService.creditAvailable(tx, {
        walletId: wallet.id,
        amount: refundAmount,
        entryType: LedgerEntryType.WITHDRAWAL,
        referenceType: ReferenceType.WITHDRAWAL,
        referenceId: row.id,
        operationId,
      });

      const saved = await tx.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: WithdrawalStatus.FAILED,
          failureReason: reason,
          processedAt: new Date(),
        },
        include: {
          user: { select: { email: true } },
          asset: { select: { symbol: true } },
        },
      });

      await tx.notification.create({
        data: {
          userId: row.userId,
          type: NotificationType.WALLET,
          title: `Lệnh rút ${saved.asset.symbol} bị từ chối`,
          message: `Lệnh rút ${formatDecimal(refundAmount)} ${saved.asset.symbol} đã bị từ chối (${reason}) và hoàn lại số dư.`,
        },
      });

      return saved;
    });

    return this.toItem(updated);
  }

  private toItem(w: WithdrawalWithRelations): AdminWithdrawalItem {
    return {
      id: w.id,
      userId: w.userId,
      userEmail: w.user.email,
      assetSymbol: w.asset.symbol,
      toAddress: w.toAddress,
      amount: formatDecimal(w.amount),
      fee: formatDecimal(w.fee),
      status: w.status,
      txHash: w.txHash,
      failureReason: w.failureReason,
      processedAt: w.processedAt?.toISOString() ?? null,
      createdAt: w.createdAt.toISOString(),
    };
  }
}
