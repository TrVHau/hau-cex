import { HttpException, HttpStatus } from '@nestjs/common';

export class AssetNotFoundException extends HttpException {
  constructor(symbol?: string) {
    super(
      {
        error: {
          code: 'ASSET_NOT_FOUND',
          message: symbol
            ? `Asset with symbol '${symbol}' could not be found.`
            : 'The specified asset could not be found.',
        },
      },
      HttpStatus.NOT_FOUND,
    );
  }
}
