import { HttpException, HttpStatus } from '@nestjs/common';

export class IdempotencyConflictException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message:
            'A request with the same idempotency key has already been processed.',
        },
      },
      HttpStatus.CONFLICT, // 409
    );
  }
}
