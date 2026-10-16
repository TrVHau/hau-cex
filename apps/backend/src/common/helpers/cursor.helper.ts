import { BadRequestException } from '@nestjs/common';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

export interface CursorPayload {
  id: string;
  createdAt: string; // ISO string representation of Date
}

export function encodeCursor(item: { id: string; createdAt: Date }): string {
  return Buffer.from(
    JSON.stringify({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
    }),
  ).toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
    const parsed = JSON.parse(decoded) as CursorPayload;

    if (typeof parsed.id !== 'string' || typeof parsed.createdAt !== 'string') {
      throw new Error();
    }
    return parsed;
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

/**
 * Builds Prisma OR filter for cursor-based pagination (descending order by createdAt, then id)
 */
export function buildCursorWhere(cursor?: string) {
  if (!cursor) return undefined;
  const decoded = decodeCursor(cursor);
  const cursorDate = new Date(decoded.createdAt);
  return {
    OR: [
      { createdAt: { lt: cursorDate } },
      {
        createdAt: cursorDate,
        id: { lt: decoded.id },
      },
    ],
  };
}

/**
 * Formats fetched rows (where query used limit + 1) into a standard PaginatedResponseDto
 */
export function buildPaginatedResult<
  TRow extends { id: string; createdAt: Date },
  TDto,
>(
  rows: TRow[],
  limit: number,
  mapper: (row: TRow) => TDto,
): PaginatedResponseDto<TDto> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const lastItem = items.length > 0 ? items[items.length - 1] : null;

  return {
    items: items.map(mapper),
    nextCursor: hasMore && lastItem ? encodeCursor(lastItem) : null,
    hasMore,
  };
}
