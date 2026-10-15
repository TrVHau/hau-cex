import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { TradeCreatedPayload } from './types/engine-events.types';
import { PrismaTx } from '../../common/types/prisma-tx.type';
import { ReferenceType } from '../../common/enums/reference-type.enum';
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

    // 1. Fetch trading pair for fee rates and asset IDs
    const tradingPair = await tx.tradingPair.findUniqueOrThrow({
      where: { id: payload.tradingPairId },
      select: {
        baseAssetId: true,
        quoteAssetId: true,
        makerFeeRate: true,
        takerFeeRate: true,
      },
    });

    // 2. Determine fee rates per side
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

    // 3. Fetch orders to get userIds
    const [buyOrder, sellOrder] = await Promise.all([
      tx.order.findUniqueOrThrow({
        where: { id: payload.buyOrderId },
        select: {
          id: true,
          userId: true,
          filledQuantity: true,
          remainingQuantity: true,
        },
      }),
      tx.order.findUniqueOrThrow({
        where: { id: payload.sellOrderId },
        select: {
          id: true,
          userId: true,
          filledQuantity: true,
          remainingQuantity: true,
        },
      }),
    ]);

    // 4. Create Trade record (engineMatchId UNIQUE → idempotent)
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

    // 5. Update orders (filledQuantity, remainingQuantity, status)
    const buyNewRemaining = buyOrder.remainingQuantity.minus(executedQuantity);
    const sellNewRemaining =
      sellOrder.remainingQuantity.minus(executedQuantity);

    await Promise.all([
      tx.order.update({
        where: { id: buyOrder.id },
        data: {
          filledQuantity: buyOrder.filledQuantity.plus(executedQuantity),
          remainingQuantity: buyNewRemaining,
          remainingLockedAmount: { decrement: quoteAmount },
          status: buyNewRemaining.isZero() ? 'FILLED' : 'PARTIALLY_FILLED',
        },
      }),
      tx.order.update({
        where: { id: sellOrder.id },
        data: {
          filledQuantity: sellOrder.filledQuantity.plus(executedQuantity),
          remainingQuantity: sellNewRemaining,
          remainingLockedAmount: { decrement: executedQuantity },
          status: sellNewRemaining.isZero() ? 'FILLED' : 'PARTIALLY_FILLED',
        },
      }),
    ]);

    // 6. Wallet mutations — find wallets by (userId, assetId) unique key
    const operationId = uuidv7();
    const tradeRef = {
      referenceType: ReferenceType.TRADE,
      referenceId: trade.id,
    } as const;

    // 6a. Buyer: debit locked QUOTE (price * qty already locked at order time)
    const buyerQuoteWallet = await this.findWallet(
      tx,
      buyOrder.userId,
      tradingPair.quoteAssetId,
    );
    await this.walletBalance.debitLocked(tx, {
      walletId: buyerQuoteWallet.id,
      amount: quoteAmount,
      operationId,
      ...tradeRef,
    });

    // 6b. Buyer: credit available BASE (executedQuantity - buyerFee)
    const buyerBaseWallet = await this.findWallet(
      tx,
      buyOrder.userId,
      tradingPair.baseAssetId,
    );
    await this.walletBalance.creditAvailable(tx, {
      walletId: buyerBaseWallet.id,
      amount: executedQuantity.minus(buyerFeeAmount),
      operationId,
      entryType: LedgerEntryType.TRADE_SETTLEMENT,
      ...tradeRef,
    });

    // 6c. Seller: debit locked BASE (already locked at order time)
    const sellerBaseWallet = await this.findWallet(
      tx,
      sellOrder.userId,
      tradingPair.baseAssetId,
    );
    await this.walletBalance.debitLocked(tx, {
      walletId: sellerBaseWallet.id,
      amount: executedQuantity,
      operationId,
      ...tradeRef,
    });

    // 6d. Seller: credit available QUOTE (quoteAmount - sellerFee)
    const sellerQuoteWallet = await this.findWallet(
      tx,
      sellOrder.userId,
      tradingPair.quoteAssetId,
    );
    await this.walletBalance.creditAvailable(tx, {
      walletId: sellerQuoteWallet.id,
      amount: quoteAmount.minus(sellerFeeAmount),
      operationId,
      entryType: LedgerEntryType.TRADE_SETTLEMENT,
      ...tradeRef,
    });

    // 6e. Fee collection — credit treasury (if fee > 0)
    if (buyerFeeAmount.greaterThan(0)) {
      const treasuryBaseWallet = await this.findOrCreateTreasuryWallet(
        tx,
        tradingPair.baseAssetId,
      );
      await this.walletBalance.creditAvailable(tx, {
        walletId: treasuryBaseWallet.id,
        amount: buyerFeeAmount,
        operationId,
        entryType: LedgerEntryType.TRADING_FEE,
        ...tradeRef,
      });
    }

    if (sellerFeeAmount.greaterThan(0)) {
      const treasuryQuoteWallet = await this.findOrCreateTreasuryWallet(
        tx,
        tradingPair.quoteAssetId,
      );
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
