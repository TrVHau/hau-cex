import { Controller, Get, UseGuards } from '@nestjs/common';
import { WalletResponseDto } from './dto/wallet-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { WalletsService } from './wallets.service';

@Controller('wallets')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}
  @Get()
  getWallets(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WalletResponseDto[]> {
    return this.walletsService.getMyWallets(user.userId);
  }
}
