import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { AuthApiKeysService } from './auth-api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth/api-keys')
@UseGuards(JwtAuthGuard)
export class AuthApiKeysController {
  constructor(private readonly apiKeysService: AuthApiKeysService) {}

  @Get()
  getApiKeys(@CurrentUser() user: AuthenticatedUser) {
    return this.apiKeysService.getApiKeys(user.userId);
  }

  @Post()
  createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.createApiKey(user.userId, dto);
  }

  @Delete(':id')
  revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.apiKeysService.revokeApiKey(user.userId, id);
  }
}
