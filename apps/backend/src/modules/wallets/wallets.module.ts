import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { WalletsController } from './wallets.controller';
import { WalletService } from './wallets.service';
import { WalletBalanceService } from './wallet-balance.service';

@Module({
  imports: [],
  controllers: [WalletsController, LedgerController],
  providers: [WalletService, WalletBalanceService],
  exports: [WalletService, WalletBalanceService],
})
export class WalletsModule {}
