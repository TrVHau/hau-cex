import { PaginatedResponseDto } from '../../../common';
import { LedgerItemDto } from './ledger-item.dto';

export class LedgerPageDto extends PaginatedResponseDto<LedgerItemDto> {}
