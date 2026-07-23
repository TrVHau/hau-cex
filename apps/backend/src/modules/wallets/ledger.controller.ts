import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletService } from './wallets.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LedgerPageDto } from './dto/ledger-page.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  getMyLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LedgerQueryDto,
  ): Promise<LedgerPageDto> {
    return this.walletService.getMyLedger(user.userId, query);
  }
}
