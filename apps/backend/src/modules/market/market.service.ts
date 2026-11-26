import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  MarketNotFoundException,
  formatDecimal,
  ORDERBOOK_CACHE_PREFIX,
} from '../../common';
import { MarketOrderbookService } from './market-orderbook.service';
import { MarketKlinesService } from './market-klines.service';
import {
  MarketDetailResult,
  MarketTickerResult,
  OrderBookResult,
  RecentTradeItem,
  KlineItem,
} from './types';

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private readonly orderbookService: MarketOrderbookService,
    private readonly klinesService: MarketKlinesService,
  ) {}

  async listMarkets(): Promise<MarketDetailResult[]> {
    const pairs = await this.prisma.tradingPair.findMany({
      include: {
        baseAsset: {
          select: { id: true, symbol: true, name: true, decimals: true },
        },
        quoteAsset: {
          select: { id: true, symbol: true, name: true, decimals: true },
        },
      },
      orderBy: { symbol: 'asc' },
    });

    if (pairs.length === 0) {
      return [];
    }

    const pairIds = pairs.map((p) => p.id);
    const latestTrades = await this.prisma.trade.findMany({
      where: {
        tradingPairId: { in: pairIds },
        settledAt: { not: null },
      },
      distinct: ['tradingPairId'],
      orderBy: [{ tradingPairId: 'asc' }, { matchedAt: 'desc' }],
      select: {
        tradingPairId: true,
        executionPrice: true,
      },
    });

    const lastTradesMap = new Map<string, string>();
    for (const trade of latestTrades) {
      lastTradesMap.set(
        trade.tradingPairId,
        formatDecimal(trade.executionPrice),
      );
    }

    const cacheKeys = pairs.map(
      (p) => `${ORDERBOOK_CACHE_PREFIX}${p.symbol.toUpperCase()}`,
    );
    const cachedSnapshots = await this.redis.mget(...cacheKeys);

    return pairs.map((pair, index) => {
      const { bestBid, bestAsk } = this.orderbookService.extractBestBidAsk(
        cachedSnapshots[index],
      );

      return {
        id: pair.id,
        symbol: pair.symbol,
        baseAsset: pair.baseAsset.symbol,
        quoteAsset: pair.quoteAsset.symbol,
        pricePrecision: pair.pricePrecision,
        quantityPrecision: pair.quantityPrecision,
        tickSize: formatDecimal(pair.tickSize),
        stepSize: formatDecimal(pair.stepSize),
        minQuantity: formatDecimal(pair.minQuantity),
        minNotional: formatDecimal(pair.minNotional),
        makerFeeRate: formatDecimal(pair.makerFeeRate),
        takerFeeRate: formatDecimal(pair.takerFeeRate),
        status: pair.status,
        lastPrice: lastTradesMap.get(pair.id) ?? null,
        bestBid,
        bestAsk,
      };
    });
  }

  async getMarketDetail(symbol: string): Promise<MarketDetailResult> {
    const normalized = symbol.toUpperCase();
    const pair = await this.prisma.tradingPair.findUnique({
      where: { symbol: normalized },
      include: {
        baseAsset: {
          select: { id: true, symbol: true, name: true, decimals: true },
        },
        quoteAsset: {
          select: { id: true, symbol: true, name: true, decimals: true },
        },
      },
    });

    if (!pair) {
      throw new MarketNotFoundException();
    }

    const lastTrade = await this.prisma.trade.findFirst({
      where: { tradingPairId: pair.id, settledAt: { not: null } },
      orderBy: { matchedAt: 'desc' },
      select: { executionPrice: true, matchedAt: true },
    });

    const { bestBid, bestAsk } = await this.orderbookService.getBestBidAsk(
      pair.symbol,
    );

    return {
      id: pair.id,
      symbol: pair.symbol,
      baseAsset: pair.baseAsset.symbol,
      quoteAsset: pair.quoteAsset.symbol,
      pricePrecision: pair.pricePrecision,
      quantityPrecision: pair.quantityPrecision,
      tickSize: formatDecimal(pair.tickSize),
      stepSize: formatDecimal(pair.stepSize),
      minQuantity: formatDecimal(pair.minQuantity),
      minNotional: formatDecimal(pair.minNotional),
      makerFeeRate: formatDecimal(pair.makerFeeRate),
      takerFeeRate: formatDecimal(pair.takerFeeRate),
      status: pair.status,
      lastPrice: formatDecimal(lastTrade?.executionPrice),
      bestBid,
      bestAsk,
    };
  }

  async getMarketTicker(symbol: string): Promise<MarketTickerResult> {
    const normalized = symbol.toUpperCase();
    const pair = await this.prisma.tradingPair.findUnique({
      where: { symbol: normalized },
      select: { id: true, symbol: true },
    });

    if (!pair) {
      throw new MarketNotFoundException();
    }

    const lastTrade = await this.prisma.trade.findFirst({
      where: { tradingPairId: pair.id, settledAt: { not: null } },
      orderBy: { matchedAt: 'desc' },
      select: { executionPrice: true },
    });

    const { bestBid, bestAsk } = await this.orderbookService.getBestBidAsk(
      pair.symbol,
    );

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const volume24h = await this.prisma.trade.aggregate({
      where: {
        tradingPairId: pair.id,
        settledAt: { not: null },
        matchedAt: { gte: since },
      },
      _sum: { executedQuantity: true },
      _max: { executionPrice: true },
      _min: { executionPrice: true },
    });

    const firstTrade24h = await this.prisma.trade.findFirst({
      where: {
        tradingPairId: pair.id,
        settledAt: { not: null },
        matchedAt: { gte: since },
      },
      orderBy: { matchedAt: 'asc' },
      select: { executionPrice: true },
    });

    const lastPriceVal = lastTrade?.executionPrice
      ? Number(lastTrade.executionPrice)
      : null;
    const firstPriceVal = firstTrade24h?.executionPrice
      ? Number(firstTrade24h.executionPrice)
      : lastPriceVal;
    const priceChange24h =
      lastPriceVal && firstPriceVal && firstPriceVal > 0
        ? (((lastPriceVal - firstPriceVal) / firstPriceVal) * 100).toFixed(2)
        : '0.00';

    const baseVol = formatDecimal(volume24h._sum.executedQuantity) || '0';
    const highVal =
      formatDecimal(volume24h._max.executionPrice) ||
      formatDecimal(lastTrade?.executionPrice) ||
      '0';
    const lowVal =
      formatDecimal(volume24h._min.executionPrice) ||
      formatDecimal(lastTrade?.executionPrice) ||
      '0';
    const quoteVol = (Number(baseVol) * (lastPriceVal || 0)).toFixed(2);

    return {
      symbol: pair.symbol,
      lastPrice: formatDecimal(lastTrade?.executionPrice),
      bestBid,
      bestAsk,
      baseVolume24h: baseVol,
      volume24h: baseVol,
      high24h: highVal,
      low24h: lowVal,
      priceChange24h,
      quoteVolume24h: quoteVol,
    };
  }

  getOrderBook(symbol: string, depth = 50): Promise<OrderBookResult> {
    return this.orderbookService.getOrderBook(symbol, depth);
  }

  getKlines(
    symbol: string,
    interval = '15m',
    limit = 50,
  ): Promise<KlineItem[]> {
    return this.klinesService.getKlines(symbol, interval, limit);
  }

  async getRecentTrades(
    symbol: string,
    limit = 50,
  ): Promise<RecentTradeItem[]> {
    const normalized = symbol.toUpperCase();
    const pair = await this.prisma.tradingPair.findUnique({
      where: { symbol: normalized },
      select: { id: true },
    });

    if (!pair) {
      throw new MarketNotFoundException();
    }

    const safeLimit = Math.min(Math.max(1, Number(limit) || 50), 100);

    const trades = await this.prisma.trade.findMany({
      where: {
        tradingPairId: pair.id,
        settledAt: { not: null },
      },
      orderBy: { matchedAt: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        executionPrice: true,
        executedQuantity: true,
        quoteAmount: true,
        takerSide: true,
        matchedAt: true,
      },
    });

    return trades.map((t) => ({
      id: t.id,
      price: formatDecimal(t.executionPrice),
      quantity: formatDecimal(t.executedQuantity),
      quoteAmount: formatDecimal(t.quoteAmount),
      takerSide: t.takerSide,
      matchedAt: t.matchedAt.toISOString(),
    }));
  }
}
