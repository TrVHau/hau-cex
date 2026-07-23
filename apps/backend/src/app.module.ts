import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { PrismaModule } from './core/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { WalletsModule } from './modules/wallets/wallets.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    AuthModule,
    WalletsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
