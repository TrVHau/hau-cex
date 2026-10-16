import { Injectable, Logger } from '@nestjs/common';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { OrderCancelledPayload, CancelOrderRejectedPayload } from './types';
import { PrismaTx, ReferenceType } from '../../common';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class OrderCancellationService {
  private readonly logger = new Logger(OrderCancellationService.name);

  constructor(private readonly walletBalance: WalletBalanceService) {}

  async handleOrderCancelled(
    payload: OrderCancelledPayload,
    tx: PrismaTx,
  ): Promise<void> {
    // 1. Find and validate the order
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payload.orderId },
      select: {
        id: true,
        userId: true,
        side: true,
        status: true,
        remainingLockedAmount: true,
        lockedAssetId: true,
      },
    });

    // 2. Update order status
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        remainingLockedAmount: 0,
      },
    });

    // 3. Unlock remaining locked amount → move locked back to available
    if (order.remainingLockedAmount.greaterThan(0)) {
      const wallet = await tx.wallet.findUniqueOrThrow({
        where: {
          userId_assetId: {
            userId: order.userId,
            assetId: order.lockedAssetId,
          },
        },
        select: { id: true },
      });

      await this.walletBalance.moveLockedToAvailable(tx, {
        walletId: wallet.id,
        amount: order.remainingLockedAmount,
        operationId: uuidv7(),
        referenceType: ReferenceType.ORDER,
        referenceId: order.id,
      });
    }

    this.logger.log(
      `Order ${order.id} cancelled, unlocked ${order.remainingLockedAmount.toString()}`,
    );
  }

  async handleCancelOrderRejected(
    payload: CancelOrderRejectedPayload,
    tx: PrismaTx,
  ): Promise<void> {
    // 1. Find the order
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payload.orderId },
      select: {
        id: true,
        status: true,
        filledQuantity: true,
      },
    });

    if (order.status !== 'CANCEL_PENDING') {
      this.logger.warn(
        `CancelOrderRejected for order ${payload.orderId} but status is ${order.status}, skipping`,
      );
      return;
    }

    // 2. Determine new status based on filled quantity
    const newStatus = order.filledQuantity.greaterThan(0)
      ? 'PARTIALLY_FILLED'
      : 'OPEN';

    // 3. Update order status — revert back from CANCEL_PENDING
    await tx.order.update({
      where: { id: order.id },
      data: { status: newStatus },
    });

    this.logger.log(
      `CancelOrderRejected for order ${order.id}: reverted to ${newStatus} (reason: ${payload.reasonCode})`,
    );
  }
}
