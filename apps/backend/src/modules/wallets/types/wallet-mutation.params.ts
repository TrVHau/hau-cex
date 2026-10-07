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
