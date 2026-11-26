import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class UpdatePreferencesDto {
  @IsOptional()
  @IsBoolean()
  notifLogin?: boolean;

  @IsOptional()
  @IsBoolean()
  notifOrders?: boolean;

  @IsOptional()
  @IsBoolean()
  notifSecurity?: boolean;

  @IsOptional()
  @IsBoolean()
  notifNewsletter?: boolean;

  @IsOptional()
  @IsIn(['USDT', 'USD', 'VND'])
  baseCurrency?: 'USDT' | 'USD' | 'VND';

  @IsOptional()
  @IsIn(['en', 'vi'])
  language?: 'en' | 'vi';

  @IsOptional()
  @IsBoolean()
  confirmOrder?: boolean;
}
