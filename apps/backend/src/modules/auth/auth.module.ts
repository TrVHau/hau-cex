import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthSessionsController } from './auth-sessions.controller';
import { Auth2faController } from './auth-2fa.controller';
import { AuthSettingsController } from './auth-settings.controller';
import { AuthApiKeysController } from './auth-api-keys.controller';
import { AuthService } from './auth.service';
import { AuthSessionsService } from './auth-sessions.service';
import { Auth2faService } from './auth-2fa.service';
import { AuthSettingsService } from './auth-settings.service';
import { AuthApiKeysService } from './auth-api-keys.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [
    AuthController,
    AuthSessionsController,
    Auth2faController,
    AuthSettingsController,
    AuthApiKeysController,
  ],
  providers: [
    AuthService,
    AuthSessionsService,
    Auth2faService,
    AuthSettingsService,
    AuthApiKeysService,
    JwtAccessStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
