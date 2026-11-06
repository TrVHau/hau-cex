import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class CreateDepositIntentDto {
  @IsString()
  @IsNotEmpty()
  asset!: string;

  @IsString()
  @Matches(/^0x[a-fA-F0-9]{40}$/, {
    message: 'depositorAddress must be a valid Ethereum address',
  })
  depositorAddress!: string;
}
