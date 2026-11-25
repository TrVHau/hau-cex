import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles, RolesGuard } from '../../common';
import { UserRole } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { TreasuryLedgerQueryDto } from './dto/treasury-ledger-query.dto';

@Controller('admin/treasury')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminTreasuryController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  getOverview() {
    return this.adminService.getTreasuryOverview();
  }

  @Get('ledger')
  getLedger(@Query() query: TreasuryLedgerQueryDto) {
    return this.adminService.getTreasuryLedger(query);
  }
}
