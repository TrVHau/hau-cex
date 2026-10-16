import { Controller, Get, Param, Query } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller()
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  // ─── Standard routes (08-api-design.md) ───────────────────────────────────

  @Get('markets')
  listMarkets() {
    return this.marketService.listMarkets();
  }

  @Get('markets/:symbol')
  getMarketDetail(@Param('symbol') symbol: string) {
    return this.marketService.getMarketDetail(symbol);
  }

  @Get('markets/:symbol/order-book')
  getOrderBook(
    @Param('symbol') symbol: string,
    @Query('depth') depth?: number,
  ) {
    return this.marketService.getOrderBook(symbol, depth);
  }

  @Get('markets/:symbol/trades')
  getRecentTrades(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: number,
  ) {
    return this.marketService.getRecentTrades(symbol, limit);
  }

  @Get('markets/:symbol/ticker')
  getMarketTicker(@Param('symbol') symbol: string) {
    return this.marketService.getMarketTicker(symbol);
  }

  // ─── Phase 7 Plan aliases (/market/*) ─────────────────────────────────────

  @Get('market/pairs')
  listMarketPairs() {
    return this.marketService.listMarkets();
  }

  @Get('market/orderbook/:symbol')
  getOrderBookAlias(
    @Param('symbol') symbol: string,
    @Query('depth') depth?: number,
  ) {
    return this.marketService.getOrderBook(symbol, depth);
  }

  @Get('market/trades/:symbol')
  getRecentTradesAlias(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: number,
  ) {
    return this.marketService.getRecentTrades(symbol, limit);
  }

  @Get('market/ticker/:symbol')
  getMarketTickerAlias(@Param('symbol') symbol: string) {
    return this.marketService.getMarketTicker(symbol);
  }
}
