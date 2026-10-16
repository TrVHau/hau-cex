import { Module } from '@nestjs/common';
import { MarketController } from './market.controller';
import { MarketService } from './market.service';
import { MarketGateway } from './market.gateway';
import { MarketEventsConsumerService } from './market-events-consumer.service';

@Module({
  controllers: [MarketController],
  providers: [MarketGateway, MarketService, MarketEventsConsumerService],
  exports: [MarketService, MarketGateway],
})
export class MarketModule {}
