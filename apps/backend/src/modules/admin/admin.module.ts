import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminMarketsController } from './admin-markets.controller';
import { AdminAssetsController } from './admin-assets.controller';
import { AdminTreasuryController } from './admin-treasury.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [
    AdminUsersController,
    AdminAssetsController,
    AdminMarketsController,
    AdminTreasuryController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
