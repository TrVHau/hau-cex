import { Prisma } from '../../../generated/prisma';

export interface WalletRawRow {
  id: string;
  userId: string;
  assetId: string;
  availableBalance: string;
  lockedBalance: string;
}

export type WalletWithAsset = Prisma.WalletGetPayload<{
  include: {
    asset: {
      select: {
        symbol: true;
        name: true;
      };
    };
  };
}>;

export type LedgerWithAsset = Prisma.LedgerEntryGetPayload<{
  include: {
    asset: {
      select: {
        symbol: true;
      };
    };
  };
}>;
