import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';
import { OutboxPollerService } from './modules/outbox/outbox-poller.service';
import { OpenMarketBootstrapService } from './modules/engine/open-market.bootstrap.service';
import { EngineEventsModule } from './modules/engine-events/engine-events.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { BlockchainListenerWorker } from './workers/blockchain-listener.worker';
import { BlockchainDepositConsumer } from './workers/blockchain-deposit.consumer';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    PrismaModule,
    RedisModule,
    EngineEventsModule,
    DepositsModule,
  ],
  providers: [
    OutboxPollerService,
    OpenMarketBootstrapService,
    BlockchainListenerWorker,
    BlockchainDepositConsumer,
  ],
})
export class WorkerModule {}
