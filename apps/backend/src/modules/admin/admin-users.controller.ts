import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CursorPaginationQueryDto, Roles, RolesGuard } from '../../common';
import { UserRole } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { LockUserDto } from './dto/lock-user.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  listUsers(@Query() query: CursorPaginationQueryDto) {
    return this.adminUsersService.listUsers(query.cursor, query.limit);
  }

  @Post(':userId/lock')
  @HttpCode(HttpStatus.OK)
  lockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto?: LockUserDto,
  ) {
    return this.adminUsersService.lockUser(userId, dto?.reason);
  }

  @Post(':userId/unlock')
  @HttpCode(HttpStatus.OK)
  unlockUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminUsersService.unlockUser(userId);
  }
}
