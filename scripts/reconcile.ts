#!/usr/bin/env tsx
/**
 * Ledger Reconciliation Script — Phase 11
 *
 * Verifies ledger consistency for every wallet:
 *   1. DB.availableBalance === SUM of AVAILABLE ledger entry amounts
 *   2. DB.lockedBalance    === SUM of LOCKED   ledger entry amounts
 *   3. No negative balances in DB
 *   4. Supply summary per asset
 *
 * Run from apps/backend:
 *   cd apps/backend
 *   npx tsx ../../scripts/reconcile.ts
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient, LedgerBalanceType } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Decimal } from 'decimal.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const EPSILON = new Decimal('0.000001');

interface WalletResult {
  userEmail: string;
  asset: string;
  dbAvail: Decimal;
  dbLocked: Decimal;
  ledgerAvail: Decimal;
  ledgerLocked: Decimal;
  availOk: boolean;
  lockedOk: boolean;
  hasNeg: boolean;
}

async function reconcile(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Hau CEX — Ledger Reconciliation');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const wallets = await prisma.wallet.findMany({
    include: {
      user: { select: { email: true } },
      asset: { select: { symbol: true } },
    },
    orderBy: [{ userId: 'asc' }, { assetId: 'asc' }],
  });

  const results: WalletResult[] = [];

  await Promise.all(
    wallets.map(async (w) => {
      const [availAgg, lockedAgg] = await Promise.all([
        prisma.ledgerEntry.aggregate({
          where: { walletId: w.id, balanceType: LedgerBalanceType.AVAILABLE },
          _sum: { amount: true },
        }),
        prisma.ledgerEntry.aggregate({
          where: { walletId: w.id, balanceType: LedgerBalanceType.LOCKED },
          _sum: { amount: true },
        }),
      ]);

      const dbAvail = new Decimal(String(w.availableBalance));
      const dbLocked = new Decimal(String(w.lockedBalance));
      const ledgerAvail = new Decimal(String(availAgg._sum.amount ?? '0'));
      const ledgerLocked = new Decimal(String(lockedAgg._sum.amount ?? '0'));

      results.push({
        userEmail: w.user.email,
        asset: w.asset.symbol,
        dbAvail,
        dbLocked,
        ledgerAvail,
        ledgerLocked,
        availOk: dbAvail.minus(ledgerAvail).abs().lte(EPSILON),
        lockedOk: dbLocked.minus(ledgerLocked).abs().lte(EPSILON),
        hasNeg: dbAvail.lt(0) || dbLocked.lt(0),
      });
    }),
  );

  // Sort for readability
  results.sort((a, b) =>
    a.userEmail.localeCompare(b.userEmail) || a.asset.localeCompare(b.asset),
  );

  console.log(`Wallets checked: ${results.length}\n`);

  let failures = 0;
  for (const r of results) {
    const ok = r.availOk && r.lockedOk && !r.hasNeg;
    if (!ok) {
      failures++;
      console.log(`  ❌ ${r.userEmail} / ${r.asset}`);
      if (!r.availOk) {
        console.log(`     available: DB=${r.dbAvail}  ledger_sum=${r.ledgerAvail}  diff=${r.dbAvail.minus(r.ledgerAvail)}`);
      }
      if (!r.lockedOk) {
        console.log(`     locked:    DB=${r.dbLocked}  ledger_sum=${r.ledgerLocked}  diff=${r.dbLocked.minus(r.ledgerLocked)}`);
      }
      if (r.hasNeg) {
        console.log(`     ⚠️  NEGATIVE BALANCE (avail=${r.dbAvail}, locked=${r.dbLocked})`);
      }
      console.log('');
    }
  }

  if (failures === 0) {
    console.log('  All wallets match ledger ✅\n');
  }

  // Supply summary
  const assetMap = new Map<string, Decimal>();
  for (const r of results) {
    assetMap.set(r.asset, (assetMap.get(r.asset) ?? new Decimal(0)).plus(r.dbAvail).plus(r.dbLocked));
  }
  console.log('Supply conservation:');
  for (const [sym, total] of [...assetMap.entries()].sort()) {
    console.log(`  ${sym.padEnd(6)} = ${total.toFixed(8)}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  if (failures === 0) {
    console.log('  ✅ PASSED — all balances consistent');
  } else {
    console.log(`  ❌ FAILED — ${failures} wallet(s) have discrepancies`);
    process.exitCode = 1;
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

reconcile()
  .catch((err: unknown) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
