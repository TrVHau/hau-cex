import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common';

export class OrderListQueryDto extends CursorPaginationQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  symbol?: string;
}
