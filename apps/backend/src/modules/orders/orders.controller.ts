import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  Headers,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  ValidationException,
  type AuthenticatedUser,
} from '../../common';
import { ActiveOrderQueryDto } from './dto/active-order-query.dto';
import { OrderListQueryDto } from './dto/order-list-query.dto';
import { OrderQueryService } from './order-query.service';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderQueryService: OrderQueryService,
  ) {}

  @Post()
  async placeOrder(
    @Headers('idempotency-key') key: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
  ) {
    if (!key?.trim()) {
      throw new ValidationException('Idempotency-Key header is required');
    }
    return this.ordersService.placeOrder(user.userId, key, dto);
  }

  @Get('active')
  getActiveOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActiveOrderQueryDto,
  ) {
    return this.orderQueryService.getActiveOrders(user.userId, query.symbol);
  }

  @Get()
  getOrderHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: OrderListQueryDto,
  ) {
    return this.orderQueryService.getOrderHistory(user.userId, query);
  }

  @Get(':orderId')
  getOrderById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderQueryService.getOrderById(user.userId, orderId);
  }

  @Get(':orderId/trades')
  getOrderTrades(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.orderQueryService.getOrderTrades(user.userId, orderId);
  }

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.cancelOrder(user.userId, orderId);
  }
}
