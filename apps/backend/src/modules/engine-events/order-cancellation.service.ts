import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '../../generated/prisma';
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
    // 1. Lock the order row to prevent race conditions with concurrent trade settlements
    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id = ${payload.orderId}::uuid
      FOR UPDATE
    `;

    // Fetch order state after acquiring lock
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

    // Terminal state guard: once an order is FILLED, CANCELLED, or REJECTED, it cannot be cancelled
    if (
      order.status === OrderStatus.FILLED ||
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.REJECTED
    ) {
      this.logger.warn(
        `Order ${order.id} is already in terminal state ${order.status}, ignoring OrderCancelled event`,
      );
      return;
    }

    // 2. Update order status
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        remainingLockedAmount: new Prisma.Decimal(0),
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
    // 1. Lock the order row
    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id = ${payload.orderId}::uuid
      FOR UPDATE
    `;

    // Fetch the order after lock
    const order = await tx.order.findUniqueOrThrow({
      where: { id: payload.orderId },
      select: {
        id: true,
        status: true,
        filledQuantity: true,
      },
    });

    if (order.status !== OrderStatus.CANCEL_PENDING) {
      this.logger.warn(
        `CancelOrderRejected for order ${payload.orderId} but status is ${order.status}, skipping`,
      );
      return;
    }

    // 2. Determine new status based on filled quantity
    const newStatus = order.filledQuantity.greaterThan(0)
      ? OrderStatus.PARTIALLY_FILLED
      : OrderStatus.OPEN;

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
