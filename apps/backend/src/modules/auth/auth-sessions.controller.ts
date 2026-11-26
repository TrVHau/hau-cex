import { Controller, Delete, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthenticatedUser } from '../../common';
import { AuthSessionsService } from './auth-sessions.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
export class AuthSessionsController {
  constructor(private readonly sessionsService: AuthSessionsService) {}

  @Get()
  getActiveSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.getActiveSessions(user.userId, user.sessionId);
  }

  @Delete()
  revokeAllOtherSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.sessionsService.revokeAllOtherSessions(
      user.userId,
      user.sessionId,
    );
  }

  @Delete(':sessionId')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.sessionsService.revokeSession(user.userId, sessionId);
  }
}
