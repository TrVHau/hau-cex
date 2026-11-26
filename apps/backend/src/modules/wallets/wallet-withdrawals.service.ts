import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AssetStatus,
  LedgerEntryType,
  NotificationType,
  Prisma,
  WithdrawalStatus,
} from '../../generated/prisma';
import {
  formatDecimal,
  InvalidAmountException,
  ReferenceType,
  WalletNotFoundException,
} from '../../common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WalletBalanceService } from './wallet-balance.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { v7 as uuidv7 } from 'uuid';

type WithdrawalWithAsset = Prisma.WithdrawalGetPayload<{
  include: { asset: { select: { symbol: true } } };
}>;

@Injectable()
export class WalletWithdrawalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletBalanceService: WalletBalanceService,
  ) {}

  async getWithdrawals(userId: string) {
    const rows = await this.prisma.withdrawal.findMany({
      where: { userId },
      include: { asset: { select: { symbol: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });

    return rows.map((w) => this.toItem(w));
  }

  async requestWithdrawal(userId: string, dto: CreateWithdrawalDto) {
    const symbol = dto.assetSymbol.trim().toUpperCase();
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new InvalidAmountException();
    }

    const asset = await this.prisma.asset.findUnique({ where: { symbol } });
    if (!asset || asset.status !== AssetStatus.ACTIVE) {
      throw new BadRequestException(
        `Asset ${symbol} is not available for withdrawal`,
      );
    }
    if (amount.decimalPlaces() > asset.decimals) {
      throw new BadRequestException(
        `Amount exceeds max ${asset.decimals} decimals for ${symbol}`,
      );
    }

    const withdrawalId = uuidv7();
    const operationId = uuidv7();

    const created = await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId_assetId: { userId, assetId: asset.id } },
      });
      if (!wallet) {
        throw new WalletNotFoundException(`user ${userId} and asset ${symbol}`);
      }

      await this.walletBalanceService.debitAvailable(tx, {
        walletId: wallet.id,
        amount,
        entryType: LedgerEntryType.WITHDRAWAL,
        referenceType: ReferenceType.WITHDRAWAL,
        referenceId: withdrawalId,
        operationId,
      });

      const row = await tx.withdrawal.create({
        data: {
          id: withdrawalId,
          userId,
          assetId: asset.id,
          toAddress: dto.toAddress,
          amount,
          status: WithdrawalStatus.PENDING,
        },
        include: { asset: { select: { symbol: true } } },
      });

      await tx.notification.create({
        data: {
          userId,
          type: NotificationType.WALLET,
          title: `Yêu cầu rút ${formatDecimal(amount)} ${symbol}`,
          message: `Lệnh rút ${formatDecimal(amount)} ${symbol} tới ví ${dto.toAddress} đang chờ xử lý.`,
        },
      });

      return row;
    });

    return this.toItem(created);
  }

  async cancelWithdrawal(userId: string, withdrawalId: string) {
    const operationId = uuidv7();

    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          id: string;
          status: WithdrawalStatus;
          assetId: string;
          amount: string;
        }>
      >`
        SELECT id, status, asset_id as "assetId", amount::text as "amount"
        FROM withdrawals
        WHERE id = ${withdrawalId}::uuid AND user_id = ${userId}::uuid
        FOR UPDATE
      `;

      const row = rows[0];
      if (!row) {
        throw new NotFoundException('Withdrawal request not found');
      }
      if (row.status !== WithdrawalStatus.PENDING) {
        throw new UnprocessableEntityException(
          'Only PENDING withdrawals can be cancelled',
        );
      }

      const wallet = await tx.wallet.findUnique({
        where: { userId_assetId: { userId, assetId: row.assetId } },
      });
      if (!wallet) {
        throw new WalletNotFoundException(
          `user ${userId} and asset ${row.assetId}`,
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
        where: { id: row.id },
        data: {
          status: WithdrawalStatus.CANCELLED,
          processedAt: new Date(),
        },
        include: { asset: { select: { symbol: true } } },
      });

      await tx.notification.create({
        data: {
          userId,
          type: NotificationType.WALLET,
          title: `Đã huỷ rút ${saved.asset.symbol}`,
          message: `Lệnh rút ${formatDecimal(refundAmount)} ${saved.asset.symbol} đã được huỷ và hoàn lại vào số dư khả dụng.`,
        },
      });

      return saved;
    });

    return this.toItem(updated);
  }

  private toItem(w: WithdrawalWithAsset) {
    return {
      id: w.id,
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
