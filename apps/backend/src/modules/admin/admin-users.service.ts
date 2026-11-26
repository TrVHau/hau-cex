import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, UserStatus } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  buildCursorWhere,
  buildPaginatedResult,
  PaginatedResponseDto,
} from '../../common';
import { AdminUserItem } from './types';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Liệt kê tất cả users (loại trừ SYSTEM) theo cursor pagination */
  async listUsers(
    cursor?: string,
    limit = 20,
  ): Promise<PaginatedResponseDto<AdminUserItem>> {
    const cursorFilter = buildCursorWhere(cursor);
    const take = limit + 1;

    const rows = await this.prisma.user.findMany({
      where: {
        role: { not: UserRole.SYSTEM },
        ...(cursorFilter && { OR: cursorFilter.OR }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        lockedAt: true,
        lockedReason: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return buildPaginatedResult(rows, limit, (u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      lockedAt: u.lockedAt?.toISOString() ?? null,
      lockedReason: u.lockedReason ?? null,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    }));
  }

  /** Lock user và revoke toàn bộ session đang hoạt động trong cùng transaction */
  async lockUser(userId: string, reason?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId } });

      if (!user) {
        throw new NotFoundException(`User ${userId} not found`);
      }
      if (user.role !== UserRole.USER) {
        throw new ForbiddenException(
          'Only accounts with role USER can be locked',
        );
      }
      if (user.status === UserStatus.LOCKED) {
        throw new ConflictException('User is already locked');
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserStatus.LOCKED,
          lockedAt: new Date(),
          lockedReason: reason ?? null,
        },
      });

      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  /** Unlock tài khoản user đang bị khóa */
  async unlockUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }
    if (user.status !== UserStatus.LOCKED) {
      throw new ConflictException('User is not locked');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.ACTIVE,
        lockedAt: null,
        lockedReason: null,
      },
    });
  }
}
