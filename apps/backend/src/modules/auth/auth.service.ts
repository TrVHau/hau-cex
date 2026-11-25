import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserStatus } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import { type AuthenticatedUser } from '../../common';
import {
  JwtRefreshPayload,
  UserInfo,
  GeneratedTokens,
  TokensResponse,
} from './types';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import ms, { type StringValue } from 'ms';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class AuthService {
  private readonly accessTokenExpiresIn: StringValue;
  private readonly refreshTokenExpiresIn: StringValue;
  private readonly bcryptSaltRounds: number;
  private readonly jwtAccessSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTokenExpiresIn = this.config.getOrThrow<StringValue>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    this.refreshTokenExpiresIn = this.config.getOrThrow<StringValue>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    this.bcryptSaltRounds = Number(
      this.config.getOrThrow<string>('BCRYPT_SALT_ROUNDS'),
    );
    this.jwtAccessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.jwtRefreshSecret =
      this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
  }

  async register(dto: RegisterDto): Promise<TokensResponse> {
    if (dto.password !== dto.confirmPassword) {
      throw new UnprocessableEntityException('Passwords do not match');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, this.bcryptSaltRounds);
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, fullName: dto.fullName ?? null },
      select: { id: true, email: true, role: true, fullName: true },
    });

    return this._createSessionAndIssueTokens(user);
  }

  async login(dto: LoginDto): Promise<TokensResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Không phân biệt lỗi email/password để tránh user enumeration
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException('Account has been locked');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this._createSessionAndIssueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
  }

  async refresh(dto: RefreshDto): Promise<TokensResponse> {
    let payload: JwtRefreshPayload;
    try {
      payload = this.jwtService.verify<JwtRefreshPayload>(dto.refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: payload.sessionId },
    });
    if (!session) throw new UnauthorizedException('Session not found');
    if (session.revokedAt)
      throw new UnauthorizedException('Session has been revoked');
    if (session.expiresAt < new Date())
      throw new UnauthorizedException('Session expired');

    const isTokenValid = await bcrypt.compare(
      dto.refreshToken,
      session.refreshTokenHash,
    );
    // thu hồi session nếu refresh token không hợp lệ (Refresh Token Rotation)
    if (!isTokenValid) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        status: true,
      },
    });
    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException('Account has been locked');
    }

    const tokens = await this._generateTokens(user);

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu khi thu hồi session cũ và tạo session mới
    await this.prisma.$transaction(async (tx) => {
      await tx.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });

      await tx.session.create({
        data: {
          id: tokens.sessionId,
          userId: user.id,
          refreshTokenHash: tokens.refreshTokenHash,
          expiresAt: tokens.expiresAt,
        },
      });
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
    };
  }

  async logout(sessionId: string): Promise<{ message: string }> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });
    return {
      userId: user.id,
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (dto.confirmPassword && dto.newPassword !== dto.confirmPassword) {
      throw new UnprocessableEntityException('New passwords do not match');
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    const isCurrentValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new UnprocessableEntityException(
        'New password must be different from current password',
      );
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      this.bcryptSaltRounds,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.fullName !== undefined ? dto.fullName : undefined,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
    });

    return {
      userId: updated.id,
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
      createdAt: updated.createdAt,
      lastLoginAt: updated.lastLoginAt,
    };
  }

  async getActiveSessions(userId: string, currentSessionId?: string) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(
    userId: string,
    sessionId: string,
  ): Promise<{ message: string }> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null },
    });
    if (!session) {
      throw new UnprocessableEntityException(
        'Session not found or already revoked',
      );
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    return { message: 'Session revoked successfully' };
  }

  async revokeAllOtherSessions(
    userId: string,
    currentSessionId: string,
  ): Promise<{ message: string; count: number }> {
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return {
      message: 'All other sessions revoked successfully',
      count: result.count,
    };
  }

  // xử lý database
  private async _createSessionAndIssueTokens(
    user: UserInfo,
  ): Promise<TokensResponse> {
    const tokens = await this._generateTokens(user);

    await this.prisma.session.create({
      data: {
        id: tokens.sessionId,
        userId: user.id,
        refreshTokenHash: tokens.refreshTokenHash,
        expiresAt: tokens.expiresAt,
      },
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    };
  }

  // tính toán
  private async _generateTokens(user: UserInfo): Promise<GeneratedTokens> {
    const expiresAt = new Date(Date.now() + ms(this.refreshTokenExpiresIn));

    const sessionId = uuidv7();

    const payload: Omit<JwtRefreshPayload, 'type'> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { ...payload, type: 'access' },
        {
          secret: this.jwtAccessSecret,
          expiresIn: this.accessTokenExpiresIn,
        },
      ),
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.jwtRefreshSecret,
          expiresIn: this.refreshTokenExpiresIn,
        },
      ),
    ]);

    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.bcryptSaltRounds,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenHash,
      sessionId,
      expiresAt,
    };
  }
}
