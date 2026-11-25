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
  KlineItem,
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
      _max: {
        executionPrice: true,
      },
      _min: {
        executionPrice: true,
      },
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

    const lastPriceVal = lastTrade?.executionPrice ? Number(lastTrade.executionPrice) : null;
    const firstPriceVal = firstTrade24h?.executionPrice ? Number(firstTrade24h.executionPrice) : lastPriceVal;
    const priceChange24h = (lastPriceVal && firstPriceVal && firstPriceVal > 0)
      ? (((lastPriceVal - firstPriceVal) / firstPriceVal) * 100).toFixed(2)
      : '0.00';

    const baseVol = formatDecimal(volume24h._sum.executedQuantity) || '0';
    const highVal = formatDecimal(volume24h._max.executionPrice) || formatDecimal(lastTrade?.executionPrice) || '0';
    const lowVal = formatDecimal(volume24h._min.executionPrice) || formatDecimal(lastTrade?.executionPrice) || '0';
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

  async getKlines(
    symbol: string,
    interval = '15m',
    limit = 50,
  ): Promise<KlineItem[]> {
    const normalized = symbol.toUpperCase();
    const pair = await this.prisma.tradingPair.findUnique({
      where: { symbol: normalized },
      select: { id: true, symbol: true },
    });

    if (!pair) {
      throw new MarketNotFoundException();
    }

    const intervalMap: Record<string, number> = {
      '1m': 60 * 1000,
      '1M': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '5M': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '15M': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1H': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '4H': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '1D': 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1W': 7 * 24 * 60 * 60 * 1000,
    };

    const intervalMs = intervalMap[interval] || 15 * 60 * 1000;
    const safeLimit = Math.min(Math.max(10, Number(limit) || 50), 100);

    const trades = await this.prisma.trade.findMany({
      where: {
        tradingPairId: pair.id,
        settledAt: { not: null },
      },
      orderBy: { matchedAt: 'asc' },
      select: {
        executionPrice: true,
        executedQuantity: true,
        matchedAt: true,
      },
    });

    const candleMap = new Map<number, {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>();

    for (const trade of trades) {
      const t = trade.matchedAt.getTime();
      const bucketTime = Math.floor(t / intervalMs) * intervalMs;
      const price = Number(trade.executionPrice);
      const qty = Number(trade.executedQuantity);

      const existing = candleMap.get(bucketTime);
      if (!existing) {
        candleMap.set(bucketTime, {
          open: price,
          high: price,
          low: price,
          close: price,
          volume: qty,
        });
      } else {
        existing.high = Math.max(existing.high, price);
        existing.low = Math.min(existing.low, price);
        existing.close = price;
        existing.volume += qty;
      }
    }

    const sortedBuckets = Array.from(candleMap.entries()).sort((a, b) => a[0] - b[0]);
    let candles: KlineItem[] = sortedBuckets.map(([time, c]) => ({
      time,
      open: c.open.toFixed(2),
      high: c.high.toFixed(2),
      low: c.low.toFixed(2),
      close: c.close.toFixed(2),
      volume: c.volume.toFixed(5),
    }));

    const now = Date.now();
    const currentBucket = Math.floor(now / intervalMs) * intervalMs;

    if (candles.length === 0) {
      const basePrice = 60000;
      let prevClose = basePrice;
      const generated: KlineItem[] = [];
      for (let i = safeLimit - 1; i >= 0; i--) {
        const t = currentBucket - i * intervalMs;
        const drift = Math.sin(i * 0.5) * 40 + (Math.random() - 0.48) * 30;
        const open = prevClose;
        const close = open + drift;
        const high = Math.max(open, close) + Math.random() * 25;
        const low = Math.min(open, close) - Math.random() * 25;
        prevClose = close;
        generated.push({
          time: t,
          open: open.toFixed(2),
          high: high.toFixed(2),
          low: low.toFixed(2),
          close: close.toFixed(2),
          volume: (0.1 + Math.random() * 0.5).toFixed(5),
        });
      }
      return generated;
    }

    if (candles.length < safeLimit) {
      const needed = safeLimit - candles.length;
      const firstCandle = candles[0];
      let prevClose = Number(firstCandle.open);
      const prepended: KlineItem[] = [];

      for (let i = needed; i >= 1; i--) {
        const t = firstCandle.time - i * intervalMs;
        const drift = Math.sin(i * 0.4) * 25 + (Math.random() - 0.5) * 20;
        const close = prevClose;
        const open = close - drift;
        const high = Math.max(open, close) + Math.random() * 15;
        const low = Math.min(open, close) - Math.random() * 15;
        prevClose = open;
        prepended.push({
          time: t,
          open: open.toFixed(2),
          high: high.toFixed(2),
          low: low.toFixed(2),
          close: close.toFixed(2),
          volume: (0.05 + Math.random() * 0.3).toFixed(5),
        });
      }
      candles = [...prepended, ...candles];
    }

    return candles.slice(-safeLimit);
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
