import { HttpException, HttpStatus } from '@nestjs/common';

export class WalletNotFoundException extends HttpException {
  constructor(detail?: string) {
    super(
      {
        error: {
          code: 'WALLET_NOT_FOUND',
          message: detail
            ? `Wallet not found: ${detail}`
            : 'The specified wallet could not be found.',
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
