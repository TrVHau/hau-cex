import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateTransferDto {
  @IsString()
  @IsNotEmpty()
  assetSymbol!: string;

  @IsEmail()
  recipientEmail!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'amount must be a positive decimal string',
  })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
