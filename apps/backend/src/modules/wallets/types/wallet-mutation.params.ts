import { LedgerEntryType, Prisma } from '../../../generated/prisma';
import { ReferenceType } from '../../../common/enums/reference-type.enum';

export interface WalletMutationParams {
  walletId: string;
  amount: Prisma.Decimal;
  operationId: string;
  referenceType: ReferenceType;
  referenceId: string;
}

export interface CreditParams extends WalletMutationParams {
  entryType: LedgerEntryType;
}

// BUG-08 fix: allow caller to override entryType for debitLocked so it can
// be reused in contexts beyond TRADE_SETTLEMENT (e.g. withdrawal).
export interface DebitLockedParams extends WalletMutationParams {
  entryType?: LedgerEntryType; // defaults to TRADE_SETTLEMENT when omitted
}
