import { HttpException, HttpStatus } from '@nestjs/common';

export class ValidationException extends HttpException {
  constructor(message?: string) {
    super(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: message || 'Validation failed for the provided input.',
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY, // 422
    );
  }
}
