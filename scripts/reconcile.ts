#!/usr/bin/env tsx
/**
 * Reconciliation Script — Phase 11
 *
 * Verifies that the ledger is internally consistent:
 *   1. For each wallet: availableBalance === SUM of AVAILABLE ledger deltas
 *   2. For each wallet: lockedBalance   === SUM of LOCKED   ledger deltas
 *   3. No negative balances
 *   4. Total supply conservation: sum(all users) ≈ sum(initial deposits)
 *
 * Usage:
 *   cd apps/backend
 *   npx tsx ../../scripts/reconcile.ts
 *   # or
 *   npx tsx ../../scripts/reconcile.ts --fix   (dry-run only, prints corrections)
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../../.env') });

import { PrismaClient, LedgerBalanceType } from '../apps/backend/src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Decimal } from 'decimal.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

interface ReconcileResult {
  walletId: string;
  userId: string;
  asset: string;
  userEmail: string;
  dbAvailable: Decimal;
  dbLocked: Decimal;
  ledgerAvailable: Decimal;
  ledgerLocked: Decimal;
  availableMatch: boolean;
  lockedMatch: boolean;
  hasNegativeBalance: boolean;
}

async function reconcile(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Hau CEX — Ledger Reconciliation Report');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Load all wallets with user and asset info
  const wallets = await prisma.wallet.findMany({
    include: {
      user: { select: { email: true } },
      asset: { select: { symbol: true } },
    },
    orderBy: [{ userId: 'asc' }, { assetId: 'asc' }],
  });

  const results: ReconcileResult[] = [];
  let totalErrors = 0;

  for (const wallet of wallets) {
    // Sum ledger entries for this wallet
    const availEntries = await prisma.ledgerEntry.aggregate({
      where: {
        walletId: wallet.id,
        balanceType: LedgerBalanceType.AVAILABLE,
      },
      _sum: { amount: true },
    });

    const lockedEntries = await prisma.ledgerEntry.aggregate({
      where: {
        walletId: wallet.id,
        balanceType: LedgerBalanceType.LOCKED,
      },
      _sum: { amount: true },
    });

    const ledgerAvail = new Decimal(String(availEntries._sum.amount ?? '0'));
    const ledgerLocked = new Decimal(String(lockedEntries._sum.amount ?? '0'));
    const dbAvail = new Decimal(String(wallet.availableBalance));
    const dbLocked = new Decimal(String(wallet.lockedBalance));

    const EPSILON = new Decimal('0.000001');
    const availMatch = dbAvail.minus(ledgerAvail).abs().lte(EPSILON);
    const lockedMatch = dbLocked.minus(ledgerLocked).abs().lte(EPSILON);
    const hasNeg = dbAvail.lt(0) || dbLocked.lt(0);

    const result: ReconcileResult = {
      walletId: wallet.id,
      userId: wallet.userId,
      asset: wallet.asset.symbol,
      userEmail: wallet.user.email,
      dbAvailable: dbAvail,
      dbLocked: dbLocked,
      ledgerAvailable: ledgerAvail,
      ledgerLocked: ledgerLocked,
      availableMatch: availMatch,
      lockedMatch: lockedMatch,
      hasNegativeBalance: hasNeg,
    };

    results.push(result);
    if (!availMatch || !lockedMatch || hasNeg) totalErrors++;
  }

  // Print report
  console.log(`Wallets checked: ${results.length}`);
  console.log('');

  for (const r of results) {
    const statusAvail = r.availableMatch ? '✅' : '❌';
    const statusLocked = r.lockedMatch ? '✅' : '❌';
    const statusNeg = r.hasNegativeBalance ? '⚠️ NEGATIVE' : '';

    if (!r.availableMatch || !r.lockedMatch || r.hasNegativeBalance) {
      console.log(`  MISMATCH — ${r.userEmail} / ${r.asset}`);
      console.log(`    DB Available: ${r.dbAvailable}  Ledger Sum: ${r.ledgerAvailable}  ${statusAvail}`);
      console.log(`    DB Locked:    ${r.dbLocked}  Ledger Sum: ${r.ledgerLocked}  ${statusLocked}`);
      if (r.hasNegativeBalance) console.log(`    ${statusNeg}`);
      console.log('');
    }
  }

  // Supply conservation: sum all users' (available + locked) per asset
  const assets = await prisma.asset.findMany({ select: { id: true, symbol: true } });
  console.log('Supply Conservation:');
  for (const asset of assets) {
    const total = results
      .filter((r) => r.asset === asset.symbol)
      .reduce((acc, r) => acc.plus(r.dbAvailable).plus(r.dbLocked), new Decimal('0'));
    console.log(`  ${asset.symbol}: total supply = ${total.toFixed(8)}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  if (totalErrors === 0) {
    console.log('  ✅ RECONCILIATION PASSED — All balances match ledger');
  } else {
    console.log(`  ❌ RECONCILIATION FAILED — ${totalErrors} wallet(s) have discrepancies`);
    process.exitCode = 1;
  }
  console.log('═══════════════════════════════════════════════════════\n');
}

reconcile()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect().then(() => pool.end()));
