import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  WalletMutationParams,
  CreditParams,
} from './types/wallet-mutation.params';
import {
  LedgerEntryType,
  Prisma,
  Wallet,
  LedgerBalanceType,
} from '../../generated/prisma';
import { PrismaTx } from '../../common/types/prisma-tx.type';
import { InsufficientBalanceException } from '../../common/exceptions/insufficient-balance.exception';
import { InvalidAmountException } from '../../common/exceptions/invalid-amount.exception';

interface WalletRawRow {
  id: string;
  userId: string;
  assetId: string;
  availableBalance: string;
  lockedBalance: string;
}

@Injectable()
export class WalletBalanceService {
  private readonly logger = new Logger(WalletBalanceService.name);

  // available => locked (khi đặt lệnh)
  async moveAvailableToLocked(
    tx: PrismaTx,
    p: WalletMutationParams,
  ): Promise<Wallet> {
    this.validateAmount(p.amount);
    const { walletRow, available, locked } = await this.lockWallet(
      tx,
      p.walletId,
    );
    if (available.lessThan(p.amount)) {
      throw new InsufficientBalanceException();
    }

    const updated = await tx.wallet.update({
      where: { id: p.walletId },
      data: {
        lockedBalance: { increment: p.amount },
        availableBalance: { decrement: p.amount },
      },
    });

    await tx.ledgerEntry.createMany({
      data: [
        this.entry(
          walletRow,
          p,
          LedgerBalanceType.AVAILABLE,
          LedgerEntryType.ORDER_LOCK,
          p.amount.negated(),
          available,
          available.minus(p.amount),
        ),
        this.entry(
          walletRow,
          p,
          LedgerBalanceType.LOCKED,
          LedgerEntryType.ORDER_LOCK,
          p.amount,
          locked,
          locked.plus(p.amount),
        ),
      ],
    });

    return updated;
  }

  // khi hủy lệnh => locked => available
  async moveLockedToAvailable(
    tx: PrismaTx,
    p: WalletMutationParams,
  ): Promise<Wallet> {
    this.validateAmount(p.amount);
    const { walletRow, available, locked } = await this.lockWallet(
      tx,
      p.walletId,
    );

    if (locked.lessThan(p.amount)) {
      throw new InsufficientBalanceException();
    }

    const updated = await tx.wallet.update({
      where: { id: p.walletId },
      data: {
        lockedBalance: { decrement: p.amount },
        availableBalance: { increment: p.amount },
      },
    });

    await tx.ledgerEntry.createMany({
      data: [
        this.entry(
          walletRow,
          p,
          LedgerBalanceType.AVAILABLE,
          LedgerEntryType.ORDER_UNLOCK,
          p.amount,
          available,
          available.plus(p.amount),
        ),
        this.entry(
          walletRow,
          p,
          LedgerBalanceType.LOCKED,
          LedgerEntryType.ORDER_UNLOCK,
          p.amount.negated(),
          locked,
          locked.minus(p.amount),
        ),
      ],
    });

    return updated;
  }

  // credit available (cộng tiền khi nạp tiền hoặc khớp lệnh)
  async creditAvailable(tx: PrismaTx, p: CreditParams): Promise<Wallet> {
    this.validateAmount(p.amount);
    const { walletRow, available } = await this.lockWallet(tx, p.walletId);

    const updated = await tx.wallet.update({
      where: { id: p.walletId },
      data: {
        availableBalance: { increment: p.amount },
      },
    });

    await tx.ledgerEntry.create({
      data: this.entry(
        walletRow,
        p,
        LedgerBalanceType.AVAILABLE,
        p.entryType,
        p.amount,
        available,
        available.plus(p.amount),
      ),
    });

    return updated;
  }

  // debit locked (trừ tiền khi rút tiền hoặc khớp lệnh)
  async debitLocked(tx: PrismaTx, p: WalletMutationParams): Promise<Wallet> {
    this.validateAmount(p.amount);
    const { walletRow, locked } = await this.lockWallet(tx, p.walletId);

    if (locked.lessThan(p.amount)) {
      throw new InsufficientBalanceException();
    }

    const updated = await tx.wallet.update({
      where: { id: p.walletId },
      data: {
        lockedBalance: { decrement: p.amount },
      },
    });

    await tx.ledgerEntry.create({
      data: this.entry(
        walletRow,
        p,
        LedgerBalanceType.LOCKED,
        LedgerEntryType.TRADE_SETTLEMENT,
        p.amount.negated(),
        locked,
        locked.minus(p.amount),
      ),
    });

    return updated;
  }

  // chưa có nhưng dùng cho việc rút tiền
  async debitAvailable(tx: PrismaTx, p: CreditParams): Promise<Wallet> {
    this.validateAmount(p.amount);
    const { walletRow, available } = await this.lockWallet(tx, p.walletId);

    if (available.lessThan(p.amount)) {
      throw new InsufficientBalanceException();
    }

    const updated = await tx.wallet.update({
      where: { id: p.walletId },
      data: {
        availableBalance: { decrement: p.amount },
      },
    });

    await tx.ledgerEntry.create({
      data: this.entry(
        walletRow,
        p,
        LedgerBalanceType.AVAILABLE,
        p.entryType,
        p.amount.negated(),
        available,
        available.minus(p.amount),
      ),
    });

    return updated;
  }

  // helpers

  private validateAmount(amount: Prisma.Decimal): void {
    if (amount.lessThanOrEqualTo(0)) {
      throw new InvalidAmountException();
    }
  }

  private async lockWallet(
    tx: PrismaTx,
    walletId: string,
  ): Promise<{
    walletRow: WalletRawRow;
    locked: Prisma.Decimal;
    available: Prisma.Decimal;
  }> {
    const walletRow = await this.lockRow(tx, walletId);
    const locked = new Prisma.Decimal(walletRow.lockedBalance);
    const available = new Prisma.Decimal(walletRow.availableBalance);
    return { walletRow, locked, available };
  }

  private async lockRow(tx: PrismaTx, walletId: string): Promise<WalletRawRow> {
    const rows = await tx.$queryRaw<WalletRawRow[]>`
      SELECT id, 
      user_id as "userId",
       asset_id as "assetId",
        available_balance as "availableBalance",
         locked_balance as "lockedBalance" 
      FROM wallets
      WHERE id = ${walletId}::uuid
      FOR UPDATE
    `;

    if (!rows[0]) {
      throw new NotFoundException(`Wallet with id ${walletId} not found`);
    }

    return rows[0];
  }

  private entry(
    wallet: WalletRawRow,
    p: WalletMutationParams,
    balanceType: LedgerBalanceType,
    entryType: LedgerEntryType,
    amount: Prisma.Decimal,
    beforeBalance: Prisma.Decimal,
    afterBalance: Prisma.Decimal,
  ) {
    return {
      walletId: wallet.id,
      userId: wallet.userId,
      assetId: wallet.assetId,
      entryType,
      balanceType,
      amount,
      beforeBalance,
      afterBalance,
      referenceType: p.referenceType,
      referenceId: p.referenceId,
      operationId: p.operationId,
    };
  }
}
