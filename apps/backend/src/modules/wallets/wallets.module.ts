import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';
import { WalletBalanceService } from './wallet-balance.service';

@Module({
  imports: [],
  controllers: [WalletsController, LedgerController],
  providers: [WalletsService, WalletBalanceService],
  exports: [WalletsService, WalletBalanceService],
})
export class WalletsModule {}
