import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { WalletService } from '../wallets/wallets.service';
import { WalletBalanceService } from '../wallets/wallet-balance.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Prisma, TradingPairStatus } from '../../generated/prisma';
import { hashOrderPayload } from '../../common/helpers/idempotency.helper';
import {
  IdempotencyConflictException,
  MarketNotFoundException,
  MarketNotReadyException,
  MarketSuspendedException,
  ValidationException,
} from '../../common/exceptions';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  constructor(
    private readonly PrismaService: PrismaService,
    private readonly WalletService: WalletService,
    private readonly WalletBalanceService: WalletBalanceService,
  ) {}
  // đặt lệnh
  async placeOrder(
    userId: string,
    idempotencyKey: string,
    dto: CreateOrderDto,
  ) {
    // check idempotency key
    const existing = await this.PrismaService.order.findUnique({
      where: {
        userId_idempotencyKey: {
          userId,
          idempotencyKey,
        },
      },
    });
    const price = new Prisma.Decimal(dto.price);
    const quantity = new Prisma.Decimal(dto.quantity);
    const payLoadHash = hashOrderPayload(
      dto.symbol,
      dto.side.toString(),
      dto.type.toString(),
      price,
      quantity,
    );

    if (existing) {
      if (existing.idempotencyPayloadHash !== payLoadHash) {
        throw new IdempotencyConflictException();
      }
      return {
        orderId: existing.id,
        status: existing.status,
      };
    }

    // validate
    const pair = await this.PrismaService.tradingPair.findUnique({
      where: {
        symbol: dto.symbol,
      },
    });
    if (!pair) throw new MarketNotFoundException();
    if (pair.status === TradingPairStatus.SUSPENDED)
      throw new MarketSuspendedException();
    if (pair.status !== TradingPairStatus.READY)
      throw new MarketNotReadyException();

    if (price.lte(0)) throw new ValidationException();
  }
}
