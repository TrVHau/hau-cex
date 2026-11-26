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
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletWithdrawalsService } from './wallet-withdrawals.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';

@Controller('wallets/withdrawals')
@UseGuards(JwtAuthGuard)
export class WalletWithdrawalsController {
  constructor(private readonly withdrawalsService: WalletWithdrawalsService) {}

  @Get()
  getWithdrawals(@CurrentUser() user: AuthenticatedUser) {
    return this.withdrawalsService.getWithdrawals(user.userId);
  }

  @Post()
  requestWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateWithdrawalDto,
  ) {
    return this.withdrawalsService.requestWithdrawal(user.userId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancelWithdrawal(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.withdrawalsService.cancelWithdrawal(user.userId, id);
  }
}
