import { IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common';

export class LedgerQueryDto extends CursorPaginationQueryDto {
  @IsString()
  @IsOptional()
  asset?: string;

  @IsString()
  @IsOptional()
  assetSymbol?: string;

  @IsString()
  @IsOptional()
  entryType?: string;

  @IsString()
  @IsOptional()
  balanceType?: string;
}
