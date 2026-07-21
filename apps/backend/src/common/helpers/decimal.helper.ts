import { Prisma } from '../../generated/prisma';

export function formatDecimal(d: Prisma.Decimal): string {
  return d.toDecimalPlaces(18).toFixed(18);
}
