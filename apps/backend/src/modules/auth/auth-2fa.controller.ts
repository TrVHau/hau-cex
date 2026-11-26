import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { Auth2faService } from './auth-2fa.service';
import { Disable2faDto, Verify2faDto } from './dto/two-factor.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth/2fa')
@UseGuards(JwtAuthGuard)
export class Auth2faController {
  constructor(private readonly twoFactorService: Auth2faService) {}

  @Post('setup')
  setup2fa(@CurrentUser() user: AuthenticatedUser) {
    return this.twoFactorService.setup2fa(user.userId);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: Verify2faDto) {
    return this.twoFactorService.verify2fa(user.userId, dto.code);
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: Disable2faDto,
  ) {
    return this.twoFactorService.disable2fa(user.userId, dto);
  }
}
