import { HttpException, HttpStatus } from '@nestjs/common';

export class OrderNotCancellableException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'ORDER_NOT_CANCELLABLE',
          message: 'The specified order cannot be cancelled.',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY, // 422
    );
  }
}
