import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Roles, RolesGuard } from '../../common';
import { UserRole } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { SuspendMarketDto } from './dto/suspend-market.dto';

@Controller('admin/markets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMarketsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listMarkets() {
    return this.adminService.listMarkets();
  }

  @Post(':marketId/open')
  @HttpCode(HttpStatus.OK)
  openMarket(@Param('marketId', ParseUUIDPipe) marketId: string) {
    return this.adminService.openMarket(marketId);
  }

  @Post(':marketId/suspend')
  @HttpCode(HttpStatus.OK)
  suspendMarket(
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Body() dto?: SuspendMarketDto,
  ) {
    return this.adminService.suspendMarket(marketId, dto?.reason);
  }
}
