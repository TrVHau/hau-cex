import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SuspendMarketDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
