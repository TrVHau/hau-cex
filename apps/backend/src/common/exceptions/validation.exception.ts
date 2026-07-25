import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor() {
    super(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed for the provided input.',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY, // 422
    );
  }
}
