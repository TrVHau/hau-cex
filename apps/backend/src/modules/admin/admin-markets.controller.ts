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
import { AdminMarketsService } from './admin-markets.service';
import { SuspendMarketDto } from './dto/suspend-market.dto';

@Controller('admin/markets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminMarketsController {
  constructor(private readonly adminMarketsService: AdminMarketsService) {}

  @Get()
  listMarkets() {
    return this.adminMarketsService.listMarkets();
  }

  @Post(':marketId/open')
  @HttpCode(HttpStatus.OK)
  openMarket(@Param('marketId', ParseUUIDPipe) marketId: string) {
    return this.adminMarketsService.openMarket(marketId);
  }

  @Post(':marketId/suspend')
  @HttpCode(HttpStatus.OK)
  suspendMarket(
    @Param('marketId', ParseUUIDPipe) marketId: string,
    @Body() dto?: SuspendMarketDto,
  ) {
    return this.adminMarketsService.suspendMarket(marketId, dto?.reason);
  }
}
