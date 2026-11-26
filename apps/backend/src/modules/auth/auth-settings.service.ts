import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationType } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import { UpdatePreferencesDto } from './dto/preferences.dto';

@Injectable()
export class AuthSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async recordNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
  ): Promise<void> {
    await this.prisma.notification.create({
      data: { userId, type, title, message },
    });
  }

  async getPreferences(userId: string) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: {
        notifLogin: true,
        notifOrders: true,
        notifSecurity: true,
        notifNewsletter: true,
        baseCurrency: true,
        language: true,
        confirmOrder: true,
        updatedAt: true,
      },
    });
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    return this.prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        notifLogin: dto.notifLogin ?? true,
        notifOrders: dto.notifOrders ?? true,
        notifSecurity: dto.notifSecurity ?? true,
        notifNewsletter: dto.notifNewsletter ?? false,
        baseCurrency: dto.baseCurrency ?? 'USDT',
        language: dto.language ?? 'en',
        confirmOrder: dto.confirmOrder ?? true,
      },
      update: {
        ...(dto.notifLogin !== undefined && { notifLogin: dto.notifLogin }),
        ...(dto.notifOrders !== undefined && { notifOrders: dto.notifOrders }),
        ...(dto.notifSecurity !== undefined && {
          notifSecurity: dto.notifSecurity,
        }),
        ...(dto.notifNewsletter !== undefined && {
          notifNewsletter: dto.notifNewsletter,
        }),
        ...(dto.baseCurrency !== undefined && {
          baseCurrency: dto.baseCurrency,
        }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.confirmOrder !== undefined && {
          confirmOrder: dto.confirmOrder,
        }),
      },
      select: {
        notifLogin: true,
        notifOrders: true,
        notifSecurity: true,
        notifNewsletter: true,
        baseCurrency: true,
        language: true,
        confirmOrder: true,
        updatedAt: true,
      },
    });
  }

  async getNotifications(userId: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
        },
      }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return { items, unreadCount };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    return { message: 'Notification marked as read' };
  }

  async markAllNotificationsRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: res.count };
  }
}
