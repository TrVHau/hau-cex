import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { WalletsController } from './wallets.controller';
import { WalletWithdrawalsController } from './wallet-withdrawals.controller';
import { WalletTransfersController } from './wallet-transfers.controller';
import { WalletsService } from './wallets.service';
import { WalletBalanceService } from './wallet-balance.service';
import { WalletWithdrawalsService } from './wallet-withdrawals.service';
import { WalletTransfersService } from './wallet-transfers.service';

@Module({
  imports: [],
  controllers: [
    WalletsController,
    LedgerController,
    WalletWithdrawalsController,
    WalletTransfersController,
  ],
  providers: [
    WalletsService,
    WalletBalanceService,
    WalletWithdrawalsService,
    WalletTransfersService,
  ],
  exports: [WalletsService, WalletBalanceService],
})
export class WalletsModule {}
