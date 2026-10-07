import { BadRequestException } from '@nestjs/common';

interface CursorPayload {
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
