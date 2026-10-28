import {
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

@Controller('admin/assets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminAssetsController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  listAssets(@Query() query: CursorPaginationQueryDto) {
    return this.adminService.listAssets(query.cursor, query.limit);
  }

  @Post(':assetId/activate')
  @HttpCode(HttpStatus.OK)
  activateAsset(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.adminService.activateAsset(assetId);
  }

  @Post(':assetId/deactivate')
  @HttpCode(HttpStatus.OK)
  deactivateAsset(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.adminService.deactivateAsset(assetId);
  }
}
