import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';
import { OutboxPollerService } from './modules/outbox/outbox-poller.service';
import { OpenMarketBootstrapService } from './modules/engine/open-market.bootstrap.service';
import { EngineEventConsumerService } from './modules/engine-events/engine-event-consumer.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    RedisModule,
  ],
  controllers: [],
  providers: [
    OutboxPollerService,
    OpenMarketBootstrapService,
    EngineEventConsumerService,
  ],
})
export class WorkerModule {}
