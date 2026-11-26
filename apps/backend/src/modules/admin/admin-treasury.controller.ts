import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../../common';
import { UserRole } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminTreasuryService } from './admin-treasury.service';
import { TreasuryLedgerQueryDto } from './dto/treasury-ledger-query.dto';

@Controller('admin/treasury')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTreasuryController {
  constructor(private readonly adminTreasuryService: AdminTreasuryService) {}

  @Get()
  getOverview() {
    return this.adminTreasuryService.getTreasuryOverview();
  }

  @Get('ledger')
  getLedger(@Query() query: TreasuryLedgerQueryDto) {
    return this.adminTreasuryService.getTreasuryLedger(query);
  }
}
