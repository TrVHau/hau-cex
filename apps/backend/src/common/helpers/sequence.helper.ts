import { Prisma } from '../../generated/prisma';
import { PrismaTx } from '../types/prisma-tx.type';

async function nextSequence(tx: PrismaTx, seqName: string): Promise<bigint> {
  const rows = await tx.$queryRaw<[{ nextval: bigint }]>(
    Prisma.sql`SELECT nextval(${seqName}::regclass) AS nextval`,
  );
  return rows[0].nextval;
}

export async function nextOrderSequence(
  tx: PrismaTx,
  tradingPairId: string,
): Promise<bigint> {
  return nextSequence(tx, `order_seq_${tradingPairId.replace(/-/g, '_')}`);
}

export async function nextCommandSequence(
  tx: PrismaTx,
  tradingPairId: string,
): Promise<bigint> {
  return nextSequence(tx, `cmd_seq_${tradingPairId.replace(/-/g, '_')}`);
}
