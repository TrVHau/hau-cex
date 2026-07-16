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
import { UserRole, UserStatus } from '../../generated/prisma';
import { PrismaService } from '../../core/prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user.type';
import { JwtRefreshPayload } from './types/jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import ms, { type StringValue } from 'ms';
import { v7 as uuidv7 } from 'uuid';

type UserInfo = {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
};

type GeneratedTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  sessionId: string;
  expiresAt: Date;
};

type TokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
};

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

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.LOCKED) {
      throw new ForbiddenException('Account has been locked');
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

  async getMe(userId: string): Promise<Omit<AuthenticatedUser, 'sessionId'>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
    return { userId: user.id, email: user.email, role: user.role };
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

    const payload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.jwtAccessSecret,
        expiresIn: this.accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.jwtRefreshSecret,
        expiresIn: this.refreshTokenExpiresIn,
      }),
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
