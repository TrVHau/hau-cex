import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { LedgerPageDto } from './dto/ledger-page.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';

@Controller('ledger')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  getMyLedger(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: LedgerQueryDto,
  ): Promise<LedgerPageDto> {
    return this.walletsService.getMyLedger(user.userId, query);
  }
}
