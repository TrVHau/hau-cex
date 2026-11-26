import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiKeyPermission } from '../../../generated/prisma';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  label!: string;

  @IsOptional()
  @IsEnum(ApiKeyPermission)
  permissions?: ApiKeyPermission;
}
