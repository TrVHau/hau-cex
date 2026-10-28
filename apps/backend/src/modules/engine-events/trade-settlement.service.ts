import { Injectable, Logger } from '@nestjs/common';
import { OrderStatus, Prisma } from '../../generated/prisma';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { TradeCreatedPayload } from './types';
import { PrismaTx, ReferenceType } from '../../common';
import { LedgerEntryType } from '../../generated/prisma';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class TradeSettlementService {
  private readonly logger = new Logger(TradeSettlementService.name);

  constructor(private readonly walletBalance: WalletBalanceService) {}

  async settleTrade(
    payload: TradeCreatedPayload,
    messageId: string,
    tx: PrismaTx,
  ): Promise<void> {
    const executedQuantity = new Prisma.Decimal(payload.executedQuantity);
    const executionPrice = new Prisma.Decimal(payload.executionPrice);
    const quoteAmount = executedQuantity.mul(executionPrice);

    //  Fetch trading pair for fee rates and asset IDs
    const tradingPair = await tx.tradingPair.findUniqueOrThrow({
      where: { id: payload.tradingPairId },
      select: {
        baseAssetId: true,
        quoteAssetId: true,
        makerFeeRate: true,
        takerFeeRate: true,
      },
    });

    //  Determine fee rates per side
    const isTakerBuy = payload.takerSide === 'BUY';
    const buyerFeeRate = isTakerBuy
      ? tradingPair.takerFeeRate
      : tradingPair.makerFeeRate;
    const sellerFeeRate = isTakerBuy
      ? tradingPair.makerFeeRate
      : tradingPair.takerFeeRate;

    // buyerFee is in BASE asset, sellerFee is in QUOTE asset
    const buyerFeeAmount = executedQuantity.mul(buyerFeeRate);
    const sellerFeeAmount = quoteAmount.mul(sellerFeeRate);

    // Pre-lock orders in ascending ID order to prevent lost updates & deadlocks
    const sortedOrderIds = Array.from(
      new Set([payload.buyOrderId, payload.sellOrderId]),
    ).sort((a, b) => a.localeCompare(b));

    await tx.$queryRaw`
      SELECT id FROM orders
      WHERE id IN (${Prisma.join(sortedOrderIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id ASC
      FOR UPDATE
    `;

    // Fetch orders to get userIds, current quantities, and status
    const [buyOrder, sellOrder] = await Promise.all([
      tx.order.findUniqueOrThrow({
        where: { id: payload.buyOrderId },
        select: {
          id: true,
          userId: true,
          status: true,
          filledQuantity: true,
          remainingQuantity: true,
        },
      }),
      tx.order.findUniqueOrThrow({
        where: { id: payload.sellOrderId },
        select: {
          id: true,
          userId: true,
          status: true,
          filledQuantity: true,
          remainingQuantity: true,
        },
      }),
    ]);

    // Create Trade record (engineMatchId UNIQUE → idempotent)
    const trade = await tx.trade.create({
      data: {
        id: payload.tradeId || undefined,
        engineMatchId: payload.engineMatchId,
        engineMessageId: messageId,
        tradingPairId: payload.tradingPairId,
        buyOrderId: payload.buyOrderId,
        sellOrderId: payload.sellOrderId,
        buyerUserId: buyOrder.userId,
        sellerUserId: sellOrder.userId,
        makerOrderId: payload.makerOrderId,
        takerOrderId: payload.takerOrderId,
        takerSide: payload.takerSide,
        executionPrice,
        executedQuantity,
        quoteAmount,
        makerFeeRate: isTakerBuy
          ? tradingPair.makerFeeRate
          : tradingPair.takerFeeRate,
        takerFeeRate: isTakerBuy
          ? tradingPair.takerFeeRate
          : tradingPair.makerFeeRate,
        buyerFeeAmount,
        sellerFeeAmount,
        sequence: BigInt(payload.tradeSequence),
        matchedAt: new Date(payload.matchedAt),
        settledAt: new Date(),
      },
    });

    // Update orders (filledQuantity, remainingQuantity, status)
    // Order updates in ascending order of order ID to prevent order row deadlocks
    const buyNewRemaining = buyOrder.remainingQuantity.minus(executedQuantity);
    const sellNewRemaining =
      sellOrder.remainingQuantity.minus(executedQuantity);

    const buyStatus = buyNewRemaining.isZero()
      ? OrderStatus.FILLED
      : buyOrder.status === OrderStatus.CANCEL_PENDING
        ? OrderStatus.CANCEL_PENDING
        : OrderStatus.PARTIALLY_FILLED;

    const sellStatus = sellNewRemaining.isZero()
      ? OrderStatus.FILLED
      : sellOrder.status === OrderStatus.CANCEL_PENDING
        ? OrderStatus.CANCEL_PENDING
        : OrderStatus.PARTIALLY_FILLED;

    const orderUpdates = [
      {
        id: buyOrder.id,
        data: {
          filledQuantity: buyOrder.filledQuantity.plus(executedQuantity),
          remainingQuantity: buyNewRemaining,
          remainingLockedAmount: { decrement: quoteAmount },
          status: buyStatus,
        },
      },
      {
        id: sellOrder.id,
        data: {
          filledQuantity: sellOrder.filledQuantity.plus(executedQuantity),
          remainingQuantity: sellNewRemaining,
          remainingLockedAmount: { decrement: executedQuantity },
          status: sellStatus,
        },
      },
    ].sort((a, b) => a.id.localeCompare(b.id));

    for (const update of orderUpdates) {
      await tx.order.update({
        where: { id: update.id },
        data: update.data,
      });
    }

    // Wallet mutations
    // Pre-lock all involved wallets in ascending ID order to prevent deadlock
    const [
      buyerQuoteWallet,
      buyerBaseWallet,
      sellerBaseWallet,
      sellerQuoteWallet,
    ] = await Promise.all([
      this.findWallet(tx, buyOrder.userId, tradingPair.quoteAssetId),
      this.findWallet(tx, buyOrder.userId, tradingPair.baseAssetId),
      this.findWallet(tx, sellOrder.userId, tradingPair.baseAssetId),
      this.findWallet(tx, sellOrder.userId, tradingPair.quoteAssetId),
    ]);

    const treasuryBaseWallet = buyerFeeAmount.greaterThan(0)
      ? await this.findOrCreateTreasuryWallet(tx, tradingPair.baseAssetId)
      : null;

    const treasuryQuoteWallet = sellerFeeAmount.greaterThan(0)
      ? await this.findOrCreateTreasuryWallet(tx, tradingPair.quoteAssetId)
      : null;

    const allWalletIds = Array.from(
      new Set(
        [
          buyerQuoteWallet.id,
          buyerBaseWallet.id,
          sellerBaseWallet.id,
          sellerQuoteWallet.id,
          treasuryBaseWallet?.id,
          treasuryQuoteWallet?.id,
        ].filter((id): id is string => Boolean(id)),
      ),
    ).sort((a, b) => a.localeCompare(b));

    // Global lock acquisition in ascending order (roadmap §11 rule: Lock wallets theo id tăng dần)
    await tx.$queryRaw`
      SELECT id FROM wallets
      WHERE id IN (${Prisma.join(allWalletIds.map((id) => Prisma.sql`${id}::uuid`))})
      ORDER BY id ASC
      FOR UPDATE
    `;

    const operationId = uuidv7();
    const tradeRef = {
      referenceType: ReferenceType.TRADE,
      referenceId: trade.id,
    } as const;

    // Buyer: debit locked QUOTE (price * qty already locked at order time)
    await this.walletBalance.debitLocked(tx, {
      walletId: buyerQuoteWallet.id,
      amount: quoteAmount,
      operationId,
      ...tradeRef,
    });

    // Buyer: credit available BASE (executedQuantity - buyerFee)
    await this.walletBalance.creditAvailable(tx, {
      walletId: buyerBaseWallet.id,
      amount: executedQuantity.minus(buyerFeeAmount),
      operationId,
      entryType: LedgerEntryType.TRADE_SETTLEMENT,
      ...tradeRef,
    });

    // Seller: debit locked BASE (already locked at order time)
    await this.walletBalance.debitLocked(tx, {
      walletId: sellerBaseWallet.id,
      amount: executedQuantity,
      operationId,
      ...tradeRef,
    });

    // Seller: credit available QUOTE (quoteAmount - sellerFee)
    await this.walletBalance.creditAvailable(tx, {
      walletId: sellerQuoteWallet.id,
      amount: quoteAmount.minus(sellerFeeAmount),
      operationId,
      entryType: LedgerEntryType.TRADE_SETTLEMENT,
      ...tradeRef,
    });

    // Fee collection — credit treasury (if fee > 0)
    if (buyerFeeAmount.greaterThan(0) && treasuryBaseWallet) {
      await this.walletBalance.creditAvailable(tx, {
        walletId: treasuryBaseWallet.id,
        amount: buyerFeeAmount,
        operationId,
        entryType: LedgerEntryType.TRADING_FEE,
        ...tradeRef,
      });
    }

    if (sellerFeeAmount.greaterThan(0) && treasuryQuoteWallet) {
      await this.walletBalance.creditAvailable(tx, {
        walletId: treasuryQuoteWallet.id,
        amount: sellerFeeAmount,
        operationId,
        entryType: LedgerEntryType.TRADING_FEE,
        ...tradeRef,
      });
    }

    this.logger.log(
      `Settled trade ${payload.engineMatchId}: ${payload.executedQuantity} @ ${payload.executionPrice}`,
    );
  }

  private async findWallet(tx: PrismaTx, userId: string, assetId: string) {
    return tx.wallet.findUniqueOrThrow({
      where: { userId_assetId: { userId, assetId } },
      select: { id: true },
    });
  }

  private async findOrCreateTreasuryWallet(tx: PrismaTx, assetId: string) {
    const treasuryUserId = process.env.TREASURY_USER_ID;
    if (!treasuryUserId) {
      throw new Error('TREASURY_USER_ID environment variable is not set');
    }
    return tx.wallet.upsert({
      where: { userId_assetId: { userId: treasuryUserId, assetId } },
      create: { userId: treasuryUserId, assetId },
      update: {},
      select: { id: true },
    });
  }
}
