import { HttpException, HttpStatus } from '@nestjs/common';

export class MarketNotFoundException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'MARKET_NOT_FOUND',
          message: 'The specified market could not be found.',
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
