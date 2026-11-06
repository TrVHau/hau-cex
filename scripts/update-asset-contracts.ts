#!/usr/bin/env tsx
/**
 * Update asset contract addresses from deployment output.
 *
 * Usage (from repo root):
 *   cd apps/backend && npx tsx ../../scripts/update-asset-contracts.ts --usdt 0x... --usdc 0x...
 *
 * Or pass any symbol: --btc 0x...
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient } from '../apps/backend/src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env['DATABASE_URL'] });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  const getArg = (flag: string): string | null => {
    const i = args.indexOf(flag);
    return i >= 0 && args[i + 1] ? (args[i + 1] ?? null) : null;
  };

  const updates: Array<{ symbol: string; address: string }> = [];

  // Support --usdt, --usdc, --btc, --eth, or any --<symbol>
  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const addr = args[i + 1];
    if (flag?.startsWith('--') && addr) {
      const symbol = flag.slice(2).toUpperCase();
      updates.push({ symbol, address: addr.toLowerCase() });
    }
  }

  if (updates.length === 0) {
    console.error(
      'No arguments provided. Usage: --usdt 0x... --usdc 0x... [--btc 0x...]',
    );
    process.exit(1);
  }

  for (const { symbol, address } of updates) {
    const asset = await prisma.asset.findFirst({ where: { symbol } });
    if (!asset) {
      console.warn(`Asset ${symbol} not found in DB, skipping`);
      continue;
    }
    await prisma.asset.update({
      where: { symbol },
      data: { contractAddress: address },
    });
    console.log(`✓ ${symbol} contractAddress = ${address}`);
  }

  console.log('Done.');
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
