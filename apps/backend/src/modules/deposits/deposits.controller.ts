import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { DepositsService } from './deposits.service';
import { CreateDepositIntentDto } from './dto/create-deposit-intent.dto';

@Controller('deposits')
@UseGuards(JwtAuthGuard)
export class DepositsController {
  constructor(private readonly depositsService: DepositsService) {}

  @Get('config')
  getConfig(@Query('asset') asset: string) {
    return this.depositsService.getDepositConfig(asset);
  }

  @Post('intents')
  createIntent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDepositIntentDto,
  ) {
    return this.depositsService.createIntent(user.userId, dto);
  }

  @Get()
  getMyDeposits(
    @CurrentUser() user: AuthenticatedUser,
    @Query('asset') asset?: string,
  ) {
    return this.depositsService.getMyDeposits(user.userId, asset);
  }

  @Get(':depositId')
  getDeposit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('depositId', ParseUUIDPipe) depositId: string,
  ) {
    return this.depositsService.getDepositById(user.userId, depositId);
  }
}
