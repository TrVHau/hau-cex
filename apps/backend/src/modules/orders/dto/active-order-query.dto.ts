import { IsNotEmpty, IsString } from 'class-validator';

export class ActiveOrderQueryDto {
  @IsString()
  @IsNotEmpty()
  symbol?: string;
}
