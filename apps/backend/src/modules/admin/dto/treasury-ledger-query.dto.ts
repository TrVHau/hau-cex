import { IsEnum, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common';
import { LedgerEntryType } from '../../../generated/prisma';

export class TreasuryLedgerQueryDto extends CursorPaginationQueryDto {
  @IsString()
  @IsOptional()
  assetSymbol?: string;

  @IsEnum(LedgerEntryType)
  @IsOptional()
  entryType?: LedgerEntryType;
}
