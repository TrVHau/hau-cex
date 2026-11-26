import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletTransfersService } from './wallet-transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Controller('wallets/transfers')
@UseGuards(JwtAuthGuard)
export class WalletTransfersController {
  constructor(private readonly transfersService: WalletTransfersService) {}

  @Get()
  getTransfers(@CurrentUser() user: AuthenticatedUser) {
    return this.transfersService.getTransfers(user.userId);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  transferInternal(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTransferDto,
  ) {
    return this.transfersService.transferInternal(user.userId, dto);
  }
}
