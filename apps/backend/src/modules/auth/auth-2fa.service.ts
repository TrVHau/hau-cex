import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { NotificationType } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthSettingsService } from './auth-settings.service';
import { Disable2faDto } from './dto/two-factor.dto';
import {
  buildOtpAuthUri,
  generateBase32Secret,
  verifyTotpCode,
} from './totp.helper';

@Injectable()
export class Auth2faService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: AuthSettingsService,
  ) {}

  async setup2fa(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true, twoFactorEnabled: true },
    });

    if (user.twoFactorEnabled) {
      throw new ConflictException(
        '2FA is already enabled. Disable it first before generating a new secret.',
      );
    }

    const secret = generateBase32Secret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return {
      secret,
      otpauthUrl: buildOtpAuthUri(secret, user.email),
    };
  }

  async verify2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, twoFactorEnabled: true, twoFactorSecret: true },
    });

    if (!user.twoFactorSecret) {
      throw new UnprocessableEntityException(
        'Please initialize 2FA setup first',
      );
    }

    if (!verifyTotpCode(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Invalid 6-digit verification code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    await this.settingsService.recordNotification(
      userId,
      NotificationType.SECURITY,
      'Đã bật xác thực 2 bước (2FA)',
      'Google Authenticator TOTP đã được kích hoạt để bảo vệ tài khoản của bạn.',
    );

    return { twoFactorEnabled: true };
  }

  async disable2fa(userId: string, dto: Disable2faDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (!user.twoFactorEnabled) {
      throw new UnprocessableEntityException('2FA is not currently enabled');
    }

    const hasCode = Boolean(dto.code?.trim());
    const hasPassword = Boolean(dto.password);
    if (!hasCode && !hasPassword) {
      throw new UnprocessableEntityException(
        'Provide either your password or current 6-digit 2FA code to disable 2FA',
      );
    }

    if (hasCode) {
      if (
        !user.twoFactorSecret ||
        !verifyTotpCode(user.twoFactorSecret, dto.code!)
      ) {
        throw new UnauthorizedException('Invalid 2FA verification code');
      }
    } else if (hasPassword) {
      const ok = await bcrypt.compare(dto.password!, user.passwordHash);
      if (!ok) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    await this.settingsService.recordNotification(
      userId,
      NotificationType.SECURITY,
      'Đã tắt xác thực 2 bước (2FA)',
      'Tài khoản của bạn đã tắt bảo mật 2FA TOTP.',
    );

    return { twoFactorEnabled: false };
  }
}
