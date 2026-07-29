import { Prisma } from '../../generated/prisma';
import { PrismaTx } from '../types/prisma-tx.type';

export async function nextOrderSequence(
  tx: PrismaTx,
  tradingPairId: string,
): Promise<bigint> {
  const seqName = `order_seq_${tradingPairId.replace(/-/g, '_')}`;
  const row = await tx.$queryRaw<[{ nextval: bigint }]>(
    Prisma.sql`SELECT nextval(${seqName}::regclass) AS nextval`,
  );
  return row[0].nextval;
}

export async function nextCommandSequence(
  tx: PrismaTx,
  tradingPairId: string,
): Promise<bigint> {
  const seqName = `cmd_seq_${tradingPairId.replace(/-/g, '_')}`;

  const row = await tx.$queryRaw<[{ nextval: bigint }]>(
    Prisma.sql`SELECT nextval(${seqName}::regclass) AS nextval`,
  );
  return row[0].nextval;
}
