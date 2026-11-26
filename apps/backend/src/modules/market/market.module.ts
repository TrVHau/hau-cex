import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketOrderbookService } from './market-orderbook.service';
import { MarketKlinesService } from './market-klines.service';
import { MarketGateway } from './market.gateway';
import { MarketEventsConsumerService } from './market-events-consumer.service';

@Module({
  controllers: [MarketController],
  providers: [
    MarketGateway,
    MarketService,
    MarketOrderbookService,
    MarketKlinesService,
    MarketEventsConsumerService,
  ],
  exports: [MarketService, MarketOrderbookService, MarketGateway],
})
export class MarketModule {}
