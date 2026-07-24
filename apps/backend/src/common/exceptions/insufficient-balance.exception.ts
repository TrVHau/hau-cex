import { HttpException, HttpStatus } from '@nestjs/common';

export class InsufficientBalanceException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient balance to perform this operation.',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
