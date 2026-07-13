import { UserRole } from '../../../generated/prisma';

export type JwtAccessPayload = {
  sub: string; // userId,
  email: string;
  role: UserRole;
  sessionId: string; // Session.id — có trong cả access token để logout không cần gửi thêm body
};

// Refresh token dùng cùng payload với access token, chỉ khác secret và expiresIn
export type JwtRefreshPayload = JwtAccessPayload;
