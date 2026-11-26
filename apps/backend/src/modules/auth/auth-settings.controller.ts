import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { AuthSettingsService } from './auth-settings.service';
import { UpdatePreferencesDto } from './dto/preferences.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthSettingsController {
  constructor(private readonly settingsService: AuthSettingsService) {}

  @Get('preferences')
  getPreferences(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getPreferences(user.userId);
  }

  @Patch('preferences')
  updatePreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.settingsService.updatePreferences(user.userId, dto);
  }

  @Get('notifications')
  getNotifications(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getNotifications(user.userId);
  }

  @Post('notifications/read-all')
  @HttpCode(HttpStatus.OK)
  markAllNotificationsRead(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.markAllNotificationsRead(user.userId);
  }

  @Patch('notifications/:id/read')
  markNotificationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.settingsService.markNotificationRead(user.userId, id);
  }
}
