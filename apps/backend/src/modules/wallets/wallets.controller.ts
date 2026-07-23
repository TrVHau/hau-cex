import { Controller, Get, UseGuards } from '@nestjs/common';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WalletService } from './wallets.service';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.type';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletService: WalletService) {}
  @Get()
  getWallets(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WalletResponseDto[]> {
    return this.walletService.getMyWallets(user.userId);
  }
}
