import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletsService } from './wallets.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LedgerPageDto } from './dto/ledger-page.dto';
import { LedgerQueryDto } from './dto/ledger-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

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
