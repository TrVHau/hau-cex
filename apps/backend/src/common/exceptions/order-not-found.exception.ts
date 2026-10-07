import { HttpException, HttpStatus } from '@nestjs/common';

export class OrderNotFoundException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'ORDER_NOT_FOUND',
          message: 'The specified order could not be found.',
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
