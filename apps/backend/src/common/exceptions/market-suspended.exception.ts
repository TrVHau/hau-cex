import { HttpException, HttpStatus } from '@nestjs/common';

export class MarketSuspendedException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'MARKET_SUSPENDED',
          message: 'The specified market is suspended.',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY, // 422
    );
  }
}
