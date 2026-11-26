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
import { Roles, RolesGuard } from '../../common';
import { UserRole } from '../../generated/prisma';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import {
  AdminWithdrawalQueryDto,
  CompleteWithdrawalDto,
  RejectWithdrawalDto,
} from './dto/process-withdrawal.dto';

@Controller('admin/withdrawals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminWithdrawalsController {
  constructor(
    private readonly adminWithdrawalsService: AdminWithdrawalsService,
  ) {}

  @Get()
  listWithdrawals(@Query() query: AdminWithdrawalQueryDto) {
    return this.adminWithdrawalsService.listWithdrawals(query);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  completeWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteWithdrawalDto,
  ) {
    return this.adminWithdrawalsService.completeWithdrawal(id, dto);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  rejectWithdrawal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectWithdrawalDto,
  ) {
    return this.adminWithdrawalsService.rejectWithdrawal(id, dto);
  }
}
