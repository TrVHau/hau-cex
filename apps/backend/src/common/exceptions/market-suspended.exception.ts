import { HttpException, HttpStatus } from '@nestjs/common';

export class MarketNotReadyException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'MARKET_NOT_READY',
          message: 'The specified market is not ready for trading.',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY, // 422
    );
  }
}
