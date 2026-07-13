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
import { JwtAccessPayload } from './types/jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import ms, { type StringValue } from 'ms';

type UserInfo = {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
};

type TokensResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

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

    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.getOrThrow<number>('BCRYPT_SALT_ROUNDS'),
    );
    const user = await this.prisma.user.create({
      data: { email: dto.email, passwordHash, fullName: dto.fullName ?? null },
      select: { id: true, email: true, role: true, fullName: true },
    });

    return this._issueTokens(user);
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

    return this._issueTokens({
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
  }

  async refresh(dto: RefreshDto): Promise<TokensResponse> {
    let payload: JwtAccessPayload;
    try {
      payload = this.jwtService.verify<JwtAccessPayload>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
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

    // Refresh Token Rotation: revoke session cũ, tạo session mới
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this._issueTokens(user);
  }

  async logout(sessionId: string): Promise<{ message: string }> {
    await this.prisma.session.update({
      where: { id: sessionId },
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
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    return { userId: user.id, email: user.email, role: user.role };
  }

  private async _issueTokens(user: UserInfo): Promise<TokensResponse> {
    const accessTokenExpiresIn = this.config.getOrThrow<StringValue>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    const refreshTokenExpiresIn = this.config.getOrThrow<StringValue>(
      'JWT_REFRESH_EXPIRES_IN',
    );

    const expiresAt = new Date(Date.now() + ms(refreshTokenExpiresIn));

    // Tạo session trước để lấy sessionId cho JWT payload
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'pending', // tạm thời, sẽ update sau
        expiresAt,
      },
    });

    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    };

    const accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');

    const accessToken = this.jwtService.sign(payload, {
      secret: accessSecret,
      expiresIn: accessTokenExpiresIn,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshTokenExpiresIn,
    });

    // Lưu hash của refresh token vào session
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.config.getOrThrow<number>('BCRYPT_SALT_ROUNDS'),
    );
    await this.prisma.session.update({
      where: { id: session.id },
      data: { refreshTokenHash },
    });

    return { accessToken, refreshToken, user };
  }
}
