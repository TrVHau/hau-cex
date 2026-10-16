import { UserRole } from '../../../generated/prisma';

export interface UserInfo {
  id: string;
  email: string;
  role: UserRole;
  fullName: string | null;
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  sessionId: string;
  expiresAt: Date;
}

export interface TokensResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}
