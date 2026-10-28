import { Inject, Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
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

    if (pairs.length === 0) {
      return [];
    }

    // 1. Single query for latest settled trade per pair (eliminates N+1 SQL queries)
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

    // 2. Single Redis MGET for all cached orderbooks (eliminates N Redis roundtrips)
    const cacheKeys = pairs.map(
      (p) => `${ORDERBOOK_CACHE_PREFIX}${p.symbol.toUpperCase()}`,
    );
    const cachedSnapshots = await this.redis.mget(...cacheKeys);

    // 3. Assemble results in-memory
    return pairs.map((pair, index) => {
      const { bestBid, bestAsk } = this.extractBestBidAsk(
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
        .sort((a, b) =>
          new Prisma.Decimal(b[0]).comparedTo(new Prisma.Decimal(a[0])),
        )
        .slice(0, safeDepth)
        .map((item) => [item[0], item[1]] as [string, string]); // [price, quantity]

      // Asks: lowest price first (ascending)
      const sortedAsks = [...(cached.asks || [])]
        .sort((a, b) =>
          new Prisma.Decimal(a[0]).comparedTo(new Prisma.Decimal(b[0])),
        )
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
      return this.extractBestBidAsk(cachedStr);
    } catch {
      return { bestBid: null, bestAsk: null };
    }
  }

  private extractBestBidAsk(cachedStr: string | null): BestBidAsk {
    if (!cachedStr) return { bestBid: null, bestAsk: null };

    try {
      const cached = JSON.parse(cachedStr) as unknown as CachedOrderBook;

      // Best bid = highest bid
      let bestBid: string | null = null;
      if (cached.bids && cached.bids.length > 0) {
        const sorted = [...cached.bids].sort((a, b) =>
          new Prisma.Decimal(b[0]).comparedTo(new Prisma.Decimal(a[0])),
        );
        bestBid = sorted[0]?.[0] ?? null;
      }

      // Best ask = lowest ask
      let bestAsk: string | null = null;
      if (cached.asks && cached.asks.length > 0) {
        const sorted = [...cached.asks].sort((a, b) =>
          new Prisma.Decimal(a[0]).comparedTo(new Prisma.Decimal(b[0])),
        );
        bestAsk = sorted[0]?.[0] ?? null;
      }

      return { bestBid, bestAsk };
    } catch {
      return { bestBid: null, bestAsk: null };
    }
  }
}
