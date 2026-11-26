import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CreateWithdrawalDto {
  @IsString()
  @IsNotEmpty()
  assetSymbol!: string;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'toAddress must be a valid 0x EVM address',
  })
  toAddress!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'amount must be a positive decimal string',
  })
  amount!: string;
}
