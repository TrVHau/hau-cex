import { IsString, IsNotEmpty, IsEnum, Matches } from 'class-validator';
import { OrderSide } from '../../../generated/prisma';
import { OrderType } from '../../../common/enums/order-type.enum'; // Import Enum

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  symbol!: string;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsEnum(OrderType)
  type!: OrderType;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Price must be a valid positive decimal string',
  })
  price!: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, {
    message: 'Quantity must be a valid positive decimal string',
  })
  quantity!: string;
}
