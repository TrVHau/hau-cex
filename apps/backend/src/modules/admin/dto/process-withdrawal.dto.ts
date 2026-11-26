import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common';
import { WithdrawalStatus } from '../../../generated/prisma';

export class AdminWithdrawalQueryDto extends CursorPaginationQueryDto {
  @IsOptional()
  @IsEnum(WithdrawalStatus)
  status?: WithdrawalStatus;
}

export class CompleteWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(66)
  txHash?: string;
}

export class RejectWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
