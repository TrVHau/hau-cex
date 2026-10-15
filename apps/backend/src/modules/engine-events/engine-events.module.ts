import { Module } from '@nestjs/common';
import { EngineEventConsumerService } from './engine-event-consumer.service';
import { TradeSettlementService } from './trade-settlement.service';
import { OrderCancellationService } from './order-cancellation.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [WalletsModule],
  providers: [
    EngineEventConsumerService,
    TradeSettlementService,
    OrderCancellationService,
  ],
  exports: [EngineEventConsumerService],
})
export class EngineEventsModule {}
