import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminMarketsController } from './admin-markets.controller';
import { AdminAssetsController } from './admin-assets.controller';
import { AdminTreasuryController } from './admin-treasury.controller';
import { AdminWithdrawalsController } from './admin-withdrawals.controller';
import { AdminUsersService } from './admin-users.service';
import { AdminAssetsService } from './admin-assets.service';
import { AdminMarketsService } from './admin-markets.service';
import { AdminTreasuryService } from './admin-treasury.service';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { WalletsModule } from '../wallets/wallets.module';

@Module({
  imports: [WalletsModule],
  controllers: [
    AdminUsersController,
    AdminAssetsController,
    AdminMarketsController,
    AdminTreasuryController,
    AdminWithdrawalsController,
  ],
  providers: [
    AdminUsersService,
    AdminAssetsService,
    AdminMarketsService,
    AdminTreasuryService,
    AdminWithdrawalsService,
  ],
})
export class AdminModule {}
