import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import type { MarketSubscribePayload, MarketSubscribeResponse } from './types';

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class MarketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MarketGateway.name);

  afterInit() {
    this.logger.log('Market WebSocket Gateway initialized on namespace /ws');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('market.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MarketSubscribePayload,
  ): Promise<MarketSubscribeResponse> {
    const rawSymbol = data?.symbol || data?.market;
    if (!rawSymbol) {
      return { event: 'error', data: { message: 'symbol is required' } };
    }

    const symbol = rawSymbol.toUpperCase();
    await Promise.all([
      client.join(`market:${symbol}`),
      client.join(`orderbook:${symbol}`),
      client.join(`trades:${symbol}`),
    ]);
    this.logger.log(`Client ${client.id} subscribed to market:${symbol}`);

    return {
      event: 'market.subscribed',
      data: { symbol, room: `market:${symbol}` },
    };
  }

  @SubscribeMessage('market.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MarketSubscribePayload,
  ): Promise<MarketSubscribeResponse> {
    const rawSymbol = data?.symbol || data?.market;
    if (!rawSymbol) {
      return { event: 'error', data: { message: 'symbol is required' } };
    }

    const symbol = rawSymbol.toUpperCase();
    await Promise.all([
      client.leave(`market:${symbol}`),
      client.leave(`orderbook:${symbol}`),
      client.leave(`trades:${symbol}`),
    ]);
    this.logger.log(`Client ${client.id} unsubscribed from market:${symbol}`);

    return {
      event: 'market.unsubscribed',
      data: { symbol, room: `market:${symbol}` },
    };
  }

  broadcastOrderBook(symbol: string, payload: unknown): void {
    if (!this.server) return;
    const sym = symbol.toUpperCase();
    this.server.to(`market:${sym}`).emit('orderbook.update', payload);
    this.server.to(`orderbook:${sym}`).emit('orderbook.update', payload);
    this.server.to(`orderbook:${sym}`).emit('ORDERBOOK_UPDATE', payload);
  }

  broadcastTrade(symbol: string, payload: unknown): void {
    if (!this.server) return;
    const sym = symbol.toUpperCase();
    this.server.to(`market:${sym}`).emit('trade.created', payload);
    this.server.to(`trades:${sym}`).emit('trade.created', payload);
    this.server.to(`trades:${sym}`).emit('TRADE', payload);
  }
}
