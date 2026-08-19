import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActiveOrderQueryDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  symbol?: string;
}
