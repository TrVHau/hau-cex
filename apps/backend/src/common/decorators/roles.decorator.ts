import { UserRole } from '../../generated/prisma';
import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/auth.constants';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
