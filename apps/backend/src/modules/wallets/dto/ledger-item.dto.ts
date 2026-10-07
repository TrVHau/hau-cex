import { ReferenceType } from '../../../common/enums/reference-type.enum';
import { LedgerEntryType } from '../../../generated/prisma';

export type LedgerItemDto = {
  id: string;
  entryType: LedgerEntryType;
  balanceType: string; // Available or Locked
  amount: string; // Decimal(18)
  beforeBalance: string; // Decimal(18)
  afterBalance: string; // Decimal(18)
  assetSymbol: string;
  referenceType: ReferenceType; // ReferenceType
  referenceId: string;
  operationId: string;
  createdAt: string; // ISO string representation of Date
};
