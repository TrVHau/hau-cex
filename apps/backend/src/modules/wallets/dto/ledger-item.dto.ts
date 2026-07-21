export type LedgerItemDto = {
  id: string;
  entryType: string; // LedgerEntryType
  balanceType: string; // Available or Locked
  amount: string; // Decimal(18)
  beforeBalance: string; // Decimal(18)
  afterBalance: string; // Decimal(18)
  assetSymbol: string;
  referenceType: string; // ReferenceType
  referenceId: string;
  operationId: string;
  createdAt: string; // ISO string representation of Date
};
