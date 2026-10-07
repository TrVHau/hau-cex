import { Prisma } from '../../generated/prisma';

/**
 * Formats a Prisma Decimal to a trimmed string representation.
 * Always preserves full 18-decimal precision but strips trailing zeros
 * for cleaner API responses (e.g. "1.5" instead of "1.500000000000000000").
 */
export function formatDecimal(d: Prisma.Decimal): string {
  return d.toFixed(18).replace(/\.?0+$/, '');
}

