import { LedgerItemDto } from './ledger-item.dto';

export type LedgerPageDto = {
  items: LedgerItemDto[];
  nextCursor: string | null;
};
