import { HttpException, HttpStatus } from '@nestjs/common';

export class InvalidAmountException extends HttpException {
  constructor() {
    super(
      {
        error: 'INVALID_AMOUNT',
        message: 'Amount must be greater than zero.',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
