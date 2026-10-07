import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrderQueryService } from './order-query.service';
import { OrdersService } from './orders.service';
import { WalletsModule } from '../wallets/wallets.module';
@Module({
  imports: [WalletsModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrderQueryService],
  exports: [OrdersService, OrderQueryService],
})
export class OrdersModule {}
