import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { ApiKeyPermission, NotificationType } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthSettingsService } from './auth-settings.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class AuthApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: AuthSettingsService,
  ) {}

  async getApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });
  }

  async createApiKey(userId: string, dto: CreateApiKeyDto) {
    const activeCount = await this.prisma.apiKey.count({
      where: { userId, revokedAt: null },
    });
    if (activeCount >= 10) {
      throw new UnprocessableEntityException(
        'Maximum 10 active API keys allowed per account',
      );
    }

    const rawSecret = `hau_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawSecret).digest('hex');
    const keyPrefix = rawSecret.slice(0, 12);

    const record = await this.prisma.apiKey.create({
      data: {
        userId,
        label: dto.label.trim(),
        keyPrefix,
        keyHash,
        permissions: dto.permissions ?? ApiKeyPermission.READ,
      },
      select: {
        id: true,
        label: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    });

    await this.settingsService.recordNotification(
      userId,
      NotificationType.SECURITY,
      'Đã tạo API Key mới',
      `API key "${record.label}" (${record.keyPrefix}...) với quyền ${record.permissions} vừa được tạo.`,
    );

    return {
      ...record,
      secretKey: rawSecret,
    };
  }

  async revokeApiKey(userId: string, keyId: string) {
    const existing = await this.prisma.apiKey.findFirst({
      where: { id: keyId, userId, revokedAt: null },
      select: { id: true, label: true },
    });
    if (!existing) {
      throw new NotFoundException('Active API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });

    await this.settingsService.recordNotification(
      userId,
      NotificationType.SECURITY,
      'Đã thu hồi API Key',
      `API key "${existing.label}" đã bị vô hiệu hóa.`,
    );

    return { message: 'API key revoked successfully' };
  }
}
