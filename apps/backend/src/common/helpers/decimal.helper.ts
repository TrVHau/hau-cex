import { Prisma } from '../../generated/prisma';

/**
 * Formats a Prisma Decimal, string, or number to a trimmed string representation.
 * Always preserves full precision up to 18 decimals but strips trailing zeros
 * for cleaner API responses (e.g. "1.5" instead of "1.500000000000000000").
 */
export function formatDecimal(d: Prisma.Decimal | string | number): string;
export function formatDecimal(d: null | undefined): null;
export function formatDecimal(
  d: Prisma.Decimal | string | number | null | undefined,
): string | null;
export function formatDecimal(
  d: Prisma.Decimal | string | number | null | undefined,
): string | null {
  if (d === null || d === undefined) {
    return null;
  }
  const dec = d instanceof Prisma.Decimal ? d : new Prisma.Decimal(d);
  return dec.toFixed(18).replace(/\.?0+$/, '');
}
