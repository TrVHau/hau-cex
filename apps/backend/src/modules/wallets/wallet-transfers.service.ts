import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AssetStatus,
  LedgerEntryType,
  NotificationType,
  Prisma,
  UserStatus,
} from '../../generated/prisma';
import {
  formatDecimal,
  InvalidAmountException,
  ReferenceType,
  WalletNotFoundException,
} from '../../common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WalletBalanceService } from './wallet-balance.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class WalletTransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletBalanceService: WalletBalanceService,
  ) {}

  async getTransfers(userId: string) {
    const rows = await this.prisma.internalTransfer.findMany({
      where: {
        OR: [{ senderUserId: userId }, { recipientUserId: userId }],
      },
      include: {
        asset: { select: { symbol: true } },
        sender: { select: { email: true } },
        recipient: { select: { email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });

    return rows.map((t) => ({
      id: t.id,
      assetSymbol: t.asset.symbol,
      senderEmail: t.sender.email,
      recipientEmail: t.recipient.email,
      direction: t.senderUserId === userId ? ('OUT' as const) : ('IN' as const),
      amount: formatDecimal(t.amount),
      note: t.note,
      createdAt: t.createdAt.toISOString(),
    }));
  }

  async transferInternal(senderUserId: string, dto: CreateTransferDto) {
    const symbol = dto.assetSymbol.trim().toUpperCase();
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lessThanOrEqualTo(0)) {
      throw new InvalidAmountException();
    }

    const asset = await this.prisma.asset.findUnique({ where: { symbol } });
    if (!asset || asset.status !== AssetStatus.ACTIVE) {
      throw new BadRequestException(
        `Asset ${symbol} is not available for transfer`,
      );
    }
    if (amount.decimalPlaces() > asset.decimals) {
      throw new BadRequestException(
        `Amount exceeds max ${asset.decimals} decimals for ${symbol}`,
      );
    }

    const recipient = await this.prisma.user.findFirst({
      where: {
        email: { equals: dto.recipientEmail.trim(), mode: 'insensitive' },
      },
      select: { id: true, email: true, status: true },
    });

    if (!recipient) {
      throw new NotFoundException('Recipient email does not exist');
    }
    if (recipient.id === senderUserId) {
      throw new BadRequestException('Cannot transfer to your own account');
    }
    if (recipient.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Recipient account is locked');
    }

    const transferId = uuidv7();
    const operationId = uuidv7();

    const created = await this.prisma.$transaction(async (tx) => {
      const sender = await tx.user.findUniqueOrThrow({
        where: { id: senderUserId },
        select: { email: true },
      });

      const senderWallet = await tx.wallet.findUnique({
        where: { userId_assetId: { userId: senderUserId, assetId: asset.id } },
      });
      if (!senderWallet) {
        throw new WalletNotFoundException(
          `user ${senderUserId} and asset ${symbol}`,
        );
      }

      const recipientWallet = await tx.wallet.upsert({
        where: {
          userId_assetId: { userId: recipient.id, assetId: asset.id },
        },
        create: {
          userId: recipient.id,
          assetId: asset.id,
        },
        update: {},
      });

      // Khóa theo thứ tự UUID tăng dần để tránh deadlock khi 2 user chuyển qua lại đồng thời
      const [firstId, secondId] =
        senderWallet.id < recipientWallet.id
          ? [senderWallet.id, recipientWallet.id]
          : [recipientWallet.id, senderWallet.id];
      await tx.$queryRaw`
        SELECT id FROM wallets WHERE id IN (${firstId}::uuid, ${secondId}::uuid) ORDER BY id ASC FOR UPDATE
      `;

      await this.walletBalanceService.debitAvailable(tx, {
        walletId: senderWallet.id,
        amount,
        entryType: LedgerEntryType.INTERNAL_TRANSFER_OUT,
        referenceType: ReferenceType.TRANSFER,
        referenceId: transferId,
        operationId,
      });

      await this.walletBalanceService.creditAvailable(tx, {
        walletId: recipientWallet.id,
        amount,
        entryType: LedgerEntryType.INTERNAL_TRANSFER_IN,
        referenceType: ReferenceType.TRANSFER,
        referenceId: transferId,
        operationId,
      });

      const row = await tx.internalTransfer.create({
        data: {
          id: transferId,
          senderUserId,
          recipientUserId: recipient.id,
          assetId: asset.id,
          amount,
          note: dto.note?.trim() || null,
        },
        include: {
          asset: { select: { symbol: true } },
          sender: { select: { email: true } },
          recipient: { select: { email: true } },
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: senderUserId,
            type: NotificationType.WALLET,
            title: `Chuyển nội bộ -${formatDecimal(amount)} ${symbol}`,
            message: `Đã chuyển ${formatDecimal(amount)} ${symbol} tới ${recipient.email}.`,
          },
          {
            userId: recipient.id,
            type: NotificationType.WALLET,
            title: `Nhận chuyển khoản +${formatDecimal(amount)} ${symbol}`,
            message: `Bạn vừa nhận ${formatDecimal(amount)} ${symbol} từ ${sender.email}.`,
          },
        ],
      });

      return row;
    });

    return {
      id: created.id,
      assetSymbol: created.asset.symbol,
      senderEmail: created.sender.email,
      recipientEmail: created.recipient.email,
      direction: 'OUT' as const,
      amount: formatDecimal(created.amount),
      note: created.note,
      createdAt: created.createdAt.toISOString(),
    };
  }
}
