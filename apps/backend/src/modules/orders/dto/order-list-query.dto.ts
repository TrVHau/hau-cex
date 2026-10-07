import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class OrderListQueryDto {
  @IsString()
  @IsOptional()
  @IsNotEmpty()
  symbol?: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsString()
  @IsOptional()
  cursor?: string;
}
