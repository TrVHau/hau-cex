import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from './core/prisma/prisma.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
  ],
  controllers: [],
  providers: [],
})
export class WorkerModule {}
