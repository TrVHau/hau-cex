import { UserRole } from '../../generated/prisma';

/**
 * Type của req.user sau khi Passport JWT verify thành công.
 * Được gắn vào request bởi JwtStrategy.validate().
 * Đặt ở common/ để tránh circular dependency với modules/auth/.
 */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: UserRole;
  sessionId: string;
};
