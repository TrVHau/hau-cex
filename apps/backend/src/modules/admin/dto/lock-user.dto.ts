import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LockUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
