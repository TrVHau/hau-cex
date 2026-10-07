import { UserRole } from '../../../generated/prisma';

type BaseJwtPayload = {
  sub: string; // userId
  email: string;
  role: UserRole;
  sessionId: string; // Session.id — present in access tokens to allow logout without extra body
};

export type JwtAccessPayload = BaseJwtPayload & { type: 'access' };
export type JwtRefreshPayload = BaseJwtPayload & { type: 'refresh' };
