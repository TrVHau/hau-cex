import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  MarketNotFoundException,
  formatDecimal,
  ORDERBOOK_CACHE_PREFIX,
} from '../../common';
import {
  CachedOrderBook,
  BestBidAsk,
  MarketDetailResult,
  MarketTickerResult,
  OrderBookResult,
  RecentTradeItem,
} from './types';

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
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

    const results = await Promise.all(
      pairs.map(async (pair) => {
        // Last price from latest settled trade
        const lastTrade = await this.prisma.trade.findFirst({
          where: { tradingPairId: pair.id, settledAt: { not: null } },
          orderBy: { matchedAt: 'desc' },
          select: { executionPrice: true },
        });

        // Best bid and ask from Redis cache
        const { bestBid, bestAsk } = await this.getBestBidAsk(pair.symbol);

        return {
          id: pair.id,
          symbol: pair.symbol,
          baseAsset: pair.baseAsset.symbol,
          quoteAsset: pair.quoteAsset.symbol,
          pricePrecision: pair.pricePrecision,
          quantityPrecision: pair.quantityPrecision,
          tickSize: pair.tickSize.toString(),
          stepSize: pair.stepSize.toString(),
          minQuantity: pair.minQuantity.toString(),
          minNotional: pair.minNotional.toString(),
          makerFeeRate: pair.makerFeeRate.toString(),
          takerFeeRate: pair.takerFeeRate.toString(),
          status: pair.status,
          lastPrice: lastTrade ? lastTrade.executionPrice.toString() : null,
          bestBid,
          bestAsk,
        };
      }),
    );

    return results;
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

    const { bestBid, bestAsk } = await this.getBestBidAsk(pair.symbol);

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

    const { bestBid, bestAsk } = await this.getBestBidAsk(pair.symbol);

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const volume24h = await this.prisma.trade.aggregate({
      where: {
        tradingPairId: pair.id,
        settledAt: { not: null },
        matchedAt: { gte: since },
      },
      _sum: {
        executedQuantity: true,
      },
    });

    return {
      lastPrice: formatDecimal(lastTrade?.executionPrice),
      bestBid,
      bestAsk,
      baseVolume24h: formatDecimal(volume24h._sum.executedQuantity) || '0',
    };
  }

  async getOrderBook(symbol: string, depth = 50): Promise<OrderBookResult> {
    const normalized = symbol.toUpperCase();
    const pair = await this.prisma.tradingPair.findUnique({
      where: { symbol: normalized },
      select: { id: true, symbol: true },
    });

    if (!pair) {
      throw new MarketNotFoundException();
    }

    const safeDepth = Math.min(Math.max(1, Number(depth) || 50), 100);

    const cachedStr = await this.redis.get(
      `${ORDERBOOK_CACHE_PREFIX}${pair.symbol}`,
    );
    if (!cachedStr) {
      return {
        symbol: pair.symbol,
        bookSequence: '0',
        bids: [],
        asks: [],
        updatedAt: null,
      };
    }

    try {
      const cached = JSON.parse(cachedStr) as unknown as CachedOrderBook;

      // Bids: highest price first (descending)
      const sortedBids = [...(cached.bids || [])]
        .sort((a, b) => Number(b[0]) - Number(a[0]))
        .slice(0, safeDepth)
        .map((item) => [item[0], item[1]] as [string, string]); // [price, quantity]

      // Asks: lowest price first (ascending)
      const sortedAsks = [...(cached.asks || [])]
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .slice(0, safeDepth)
        .map((item) => [item[0], item[1]] as [string, string]);

      return {
        symbol: pair.symbol,
        bookSequence: cached.bookSequence || '0',
        bids: sortedBids,
        asks: sortedAsks,
        updatedAt: cached.changedAt || null,
      };
    } catch {
      return {
        symbol: pair.symbol,
        bookSequence: '0',
        bids: [],
        asks: [],
        updatedAt: null,
      };
    }
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

  private async getBestBidAsk(symbol: string): Promise<BestBidAsk> {
    try {
      const cachedStr = await this.redis.get(
        `${ORDERBOOK_CACHE_PREFIX}${symbol.toUpperCase()}`,
      );
      if (!cachedStr) return { bestBid: null, bestAsk: null };

      const cached = JSON.parse(cachedStr) as unknown as CachedOrderBook;

      // Best bid = highest bid
      let bestBid: string | null = null;
      if (cached.bids && cached.bids.length > 0) {
        const sorted = [...cached.bids].sort(
          (a, b) => Number(b[0]) - Number(a[0]),
        );
        bestBid = sorted[0]?.[0] ?? null;
      }

      // Best ask = lowest ask
      let bestAsk: string | null = null;
      if (cached.asks && cached.asks.length > 0) {
        const sorted = [...cached.asks].sort(
          (a, b) => Number(a[0]) - Number(b[0]),
        );
        bestAsk = sorted[0]?.[0] ?? null;
      }

      return { bestBid, bestAsk };
    } catch {
      return { bestBid: null, bestAsk: null };
    }
  }
}
