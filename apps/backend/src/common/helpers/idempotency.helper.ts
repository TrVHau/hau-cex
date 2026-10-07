import { createHash } from 'node:crypto';
import { Prisma } from '../../generated/prisma';

export function hashOrderPayload(
  symbol: string,
  side: string,
  type: string,
  price: Prisma.Decimal,
  quantity: Prisma.Decimal,
): string {
  const raw = `${symbol}|${side}|${type}|${price.toFixed(18)}|${quantity.toFixed(18)}`;
  return createHash('sha256').update(raw).digest('hex');
}
