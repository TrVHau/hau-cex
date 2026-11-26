import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { PrismaService } from '../../core/prisma/prisma.service';
import { Prisma } from '../../generated/prisma';
import { MarketNotFoundException, ORDERBOOK_CACHE_PREFIX } from '../../common';
import { BestBidAsk, CachedOrderBook, OrderBookResult } from './types';

@Injectable()
export class MarketOrderbookService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

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

      const sortedBids = [...(cached.bids || [])]
        .sort((a, b) =>
          new Prisma.Decimal(b[0]).comparedTo(new Prisma.Decimal(a[0])),
        )
        .slice(0, safeDepth)
        .map((item) => [item[0], item[1]] as [string, string]);

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

  async getBestBidAsk(symbol: string): Promise<BestBidAsk> {
    try {
      const cachedStr = await this.redis.get(
        `${ORDERBOOK_CACHE_PREFIX}${symbol.toUpperCase()}`,
      );
      return this.extractBestBidAsk(cachedStr);
    } catch {
      return { bestBid: null, bestAsk: null };
    }
  }

  extractBestBidAsk(cachedStr: string | null): BestBidAsk {
    if (!cachedStr) return { bestBid: null, bestAsk: null };

    try {
      const cached = JSON.parse(cachedStr) as unknown as CachedOrderBook;

      let bestBid: string | null = null;
      if (cached.bids && cached.bids.length > 0) {
        const sorted = [...cached.bids].sort((a, b) =>
          new Prisma.Decimal(b[0]).comparedTo(new Prisma.Decimal(a[0])),
        );
        bestBid = sorted[0]?.[0] ?? null;
      }

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
