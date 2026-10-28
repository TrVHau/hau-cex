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
import { AdminService } from './admin.service';
import { LockUserDto } from './dto/lock-user.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listUsers(@Query() query: CursorPaginationQueryDto) {
    return this.adminService.listUsers(query.cursor, query.limit);
  }

  @Post(':userId/lock')
  @HttpCode(HttpStatus.OK)
  lockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto?: LockUserDto,
  ) {
    return this.adminService.lockUser(userId, dto?.reason);
  }

  @Post(':userId/unlock')
  @HttpCode(HttpStatus.OK)
  unlockUser(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.adminService.unlockUser(userId);
  }
}
