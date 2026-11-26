import { IsOptional, IsString, Matches } from 'class-validator';

export class Verify2faDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be exactly 6 digits' })
  code!: string;
}

export class Disable2faDto {
  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'TOTP code must be exactly 6 digits' })
  code?: string;
}
