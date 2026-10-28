import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common';
import { LedgerBalanceType, LedgerEntryType } from '../../../generated/prisma';

export class LedgerQueryDto extends CursorPaginationQueryDto {
  @IsString()
  @IsOptional()
  asset?: string;

  @IsString()
  @IsOptional()
  assetSymbol?: string;

  @IsEnum(LedgerEntryType)
  @IsOptional()
  entryType?: LedgerEntryType;

  @IsEnum(LedgerBalanceType)
  @IsOptional()
  balanceType?: LedgerBalanceType;
}
