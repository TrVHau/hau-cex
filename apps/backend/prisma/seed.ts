import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(__dirname, '../../../.env') });

import bcrypt from 'bcrypt';
import {
  PrismaClient,
  UserRole,
  AssetStatus,
  TradingPairStatus,
  LedgerEntryType,
  LedgerBalanceType,
} from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Decimal } from 'decimal.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** operationId tĩnh theo index — idempotent khi re-seed */
function opId(n: number): string {
  return `00000000-0000-0000-0000-${String(n).padStart(12, '0')}`;
}

const FAKE_ORDER_1 = '01900000-0000-7000-8000-000000000001';
const FAKE_ORDER_2 = '01900000-0000-7000-8000-000000000002';
const FAKE_TRADE_1 = '01900000-0000-7000-8000-000000000011';

async function main() {
  console.log('Starting seed...');

  const hashedPassword = await bcrypt.hash('123456', 10);

  const treasury = await prisma.user.upsert({
    where: { email: 'treasury@haucex.com' },
    update: {},
    create: {
      email: 'treasury@haucex.com',
      passwordHash: hashedPassword,
      fullName: 'System Treasury',
      role: UserRole.SYSTEM,
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: 'alice@haucex.com' },
    update: {},
    create: {
      email: 'alice@haucex.com',
      passwordHash: hashedPassword,
      fullName: 'Alice Nguyen',
      role: UserRole.USER,
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: 'bob@haucex.com' },
    update: {},
    create: {
      email: 'bob@haucex.com',
      passwordHash: hashedPassword,
      fullName: 'Bob Tran',
      role: UserRole.USER,
    },
  });

  await prisma.user.upsert({
    where: { email: 'admin@haucex.com' },
    update: {},
    create: {
      email: 'admin@haucex.com',
      passwordHash: hashedPassword,
      fullName: 'Admin',
      role: UserRole.ADMIN,
    },
  });

  const usdt = await prisma.asset.upsert({
    where: { symbol: 'USDT' },
    update: {},
    create: {
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      status: AssetStatus.ACTIVE,
      depositEnabled: true,
      tradingEnabled: true,
    },
  });

  const btc = await prisma.asset.upsert({
    where: { symbol: 'BTC' },
    update: {},
    create: {
      symbol: 'BTC',
      name: 'Bitcoin',
      decimals: 8,
      status: AssetStatus.ACTIVE,
      depositEnabled: true,
      tradingEnabled: true,
    },
  });

  const pair = await prisma.tradingPair.upsert({
    where: { symbol: 'BTC_USDT' },
    update: {},
    create: {
      symbol: 'BTC_USDT',
      baseAssetId: btc.id,
      quoteAssetId: usdt.id,
      pricePrecision: 2,
      quantityPrecision: 5,
      tickSize: '0.01',
      stepSize: '0.00001',
      minQuantity: '0.0001',
      minNotional: '5.00',
      makerFeeRate: '0.001',
      takerFeeRate: '0.001',
      status: TradingPairStatus.READY,
    },
  });

  await prisma.orderSequence.upsert({
    where: { tradingPairId: pair.id },
    update: {},
    create: { tradingPairId: pair.id, lastValue: 0 },
  });

  await prisma.engineCommandSequence.upsert({
    where: { tradingPairId: pair.id },
    update: {},
    create: { tradingPairId: pair.id, lastValue: 0 },
  });

  // Xoa ledger entries cu de seed lai sach
  await prisma.ledgerEntry.deleteMany({
    where: { userId: { in: [treasury.id, alice.id, bob.id] } },
  });

  await prisma.$transaction(async (tx) => {
    // --- Treasury USDT ---
    const treasuryUsdtWallet = await tx.wallet.upsert({
      where: { userId_assetId: { userId: treasury.id, assetId: usdt.id } },
      update: {
        availableBalance: new Decimal('1000000'),
        lockedBalance: new Decimal('0'),
      },
      create: {
        userId: treasury.id,
        assetId: usdt.id,
        availableBalance: new Decimal('1000000'),
        lockedBalance: new Decimal('0'),
      },
    });
    await tx.ledgerEntry.create({
      data: {
        walletId: treasuryUsdtWallet.id,
        userId: treasury.id,
        assetId: usdt.id,
        entryType: LedgerEntryType.INITIAL_BALANCE,
        balanceType: LedgerBalanceType.AVAILABLE,
        amount: new Decimal('1000000'),
        beforeBalance: new Decimal('0'),
        afterBalance: new Decimal('1000000'),
        referenceType: 'SYSTEM_SEED',
        referenceId: treasury.id,
        operationId: opId(1),
      },
    });

    // --- Alice USDT: 10000 initial -> lock 5000 -> unlock 2000 -> final: avail=7000 locked=3000 ---
    const aliceUsdtWallet = await tx.wallet.upsert({
      where: { userId_assetId: { userId: alice.id, assetId: usdt.id } },
      update: {
        availableBalance: new Decimal('7000'),
        lockedBalance: new Decimal('3000'),
      },
      create: {
        userId: alice.id,
        assetId: usdt.id,
        availableBalance: new Decimal('7000'),
        lockedBalance: new Decimal('3000'),
      },
    });
    await tx.ledgerEntry.createMany({
      data: [
        {
          walletId: aliceUsdtWallet.id,
          userId: alice.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.INITIAL_BALANCE,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('10000'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('10000'),
          referenceType: 'SYSTEM_SEED',
          referenceId: alice.id,
          operationId: opId(10),
        },
        {
          walletId: aliceUsdtWallet.id,
          userId: alice.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.ORDER_LOCK,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('-5000'),
          beforeBalance: new Decimal('10000'),
          afterBalance: new Decimal('5000'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_1,
          operationId: opId(11),
        },
        {
          walletId: aliceUsdtWallet.id,
          userId: alice.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.ORDER_LOCK,
          balanceType: LedgerBalanceType.LOCKED,
          amount: new Decimal('5000'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('5000'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_1,
          operationId: opId(11),
        },
        {
          walletId: aliceUsdtWallet.id,
          userId: alice.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.ORDER_UNLOCK,
          balanceType: LedgerBalanceType.LOCKED,
          amount: new Decimal('-2000'),
          beforeBalance: new Decimal('5000'),
          afterBalance: new Decimal('3000'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_1,
          operationId: opId(12),
        },
        {
          walletId: aliceUsdtWallet.id,
          userId: alice.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.ORDER_UNLOCK,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('2000'),
          beforeBalance: new Decimal('5000'),
          afterBalance: new Decimal('7000'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_1,
          operationId: opId(12),
        },
      ],
    });

    // --- Alice BTC: 0 initial -> +0.5 from trade -> final: avail=0.5 ---
    const aliceBtcWallet = await tx.wallet.upsert({
      where: { userId_assetId: { userId: alice.id, assetId: btc.id } },
      update: {
        availableBalance: new Decimal('0.5'),
        lockedBalance: new Decimal('0'),
      },
      create: {
        userId: alice.id,
        assetId: btc.id,
        availableBalance: new Decimal('0.5'),
        lockedBalance: new Decimal('0'),
      },
    });
    await tx.ledgerEntry.createMany({
      data: [
        {
          walletId: aliceBtcWallet.id,
          userId: alice.id,
          assetId: btc.id,
          entryType: LedgerEntryType.INITIAL_BALANCE,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('0'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('0'),
          referenceType: 'SYSTEM_SEED',
          referenceId: alice.id,
          operationId: opId(13),
        },
        {
          walletId: aliceBtcWallet.id,
          userId: alice.id,
          assetId: btc.id,
          entryType: LedgerEntryType.TRADE_SETTLEMENT,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('0.5'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('0.5'),
          referenceType: 'TRADE',
          referenceId: FAKE_TRADE_1,
          operationId: opId(14),
        },
      ],
    });

    // --- Bob USDT: 5000 initial -> +2000 trade -> -2 fee -> -1998 lock -> final: avail=5000 locked=1998 ---
    const bobUsdtWallet = await tx.wallet.upsert({
      where: { userId_assetId: { userId: bob.id, assetId: usdt.id } },
      update: {
        availableBalance: new Decimal('5000'),
        lockedBalance: new Decimal('1998'),
      },
      create: {
        userId: bob.id,
        assetId: usdt.id,
        availableBalance: new Decimal('5000'),
        lockedBalance: new Decimal('1998'),
      },
    });
    await tx.ledgerEntry.createMany({
      data: [
        {
          walletId: bobUsdtWallet.id,
          userId: bob.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.INITIAL_BALANCE,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('5000'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('5000'),
          referenceType: 'SYSTEM_SEED',
          referenceId: bob.id,
          operationId: opId(20),
        },
        {
          walletId: bobUsdtWallet.id,
          userId: bob.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.TRADE_SETTLEMENT,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('2000'),
          beforeBalance: new Decimal('5000'),
          afterBalance: new Decimal('7000'),
          referenceType: 'TRADE',
          referenceId: FAKE_TRADE_1,
          operationId: opId(21),
        },
        {
          walletId: bobUsdtWallet.id,
          userId: bob.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.TRADING_FEE,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('-2'),
          beforeBalance: new Decimal('7000'),
          afterBalance: new Decimal('6998'),
          referenceType: 'TRADE',
          referenceId: FAKE_TRADE_1,
          operationId: opId(21),
        },
        {
          walletId: bobUsdtWallet.id,
          userId: bob.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.ORDER_LOCK,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('-1998'),
          beforeBalance: new Decimal('6998'),
          afterBalance: new Decimal('5000'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_2,
          operationId: opId(22),
        },
        {
          walletId: bobUsdtWallet.id,
          userId: bob.id,
          assetId: usdt.id,
          entryType: LedgerEntryType.ORDER_LOCK,
          balanceType: LedgerBalanceType.LOCKED,
          amount: new Decimal('1998'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('1998'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_2,
          operationId: opId(22),
        },
      ],
    });

    // --- Bob BTC: 1 initial -> lock 0.5 sell -> sold 0.5 -> final: avail=0.5 locked=0 ---
    const bobBtcWallet = await tx.wallet.upsert({
      where: { userId_assetId: { userId: bob.id, assetId: btc.id } },
      update: {
        availableBalance: new Decimal('0.5'),
        lockedBalance: new Decimal('0'),
      },
      create: {
        userId: bob.id,
        assetId: btc.id,
        availableBalance: new Decimal('0.5'),
        lockedBalance: new Decimal('0'),
      },
    });
    await tx.ledgerEntry.createMany({
      data: [
        {
          walletId: bobBtcWallet.id,
          userId: bob.id,
          assetId: btc.id,
          entryType: LedgerEntryType.INITIAL_BALANCE,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('1'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('1'),
          referenceType: 'SYSTEM_SEED',
          referenceId: bob.id,
          operationId: opId(23),
        },
        {
          walletId: bobBtcWallet.id,
          userId: bob.id,
          assetId: btc.id,
          entryType: LedgerEntryType.ORDER_LOCK,
          balanceType: LedgerBalanceType.AVAILABLE,
          amount: new Decimal('-0.5'),
          beforeBalance: new Decimal('1'),
          afterBalance: new Decimal('0.5'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_1,
          operationId: opId(24),
        },
        {
          walletId: bobBtcWallet.id,
          userId: bob.id,
          assetId: btc.id,
          entryType: LedgerEntryType.ORDER_LOCK,
          balanceType: LedgerBalanceType.LOCKED,
          amount: new Decimal('0.5'),
          beforeBalance: new Decimal('0'),
          afterBalance: new Decimal('0.5'),
          referenceType: 'ORDER',
          referenceId: FAKE_ORDER_1,
          operationId: opId(24),
        },
        {
          walletId: bobBtcWallet.id,
          userId: bob.id,
          assetId: btc.id,
          entryType: LedgerEntryType.TRADE_SETTLEMENT,
          balanceType: LedgerBalanceType.LOCKED,
          amount: new Decimal('-0.5'),
          beforeBalance: new Decimal('0.5'),
          afterBalance: new Decimal('0'),
          referenceType: 'TRADE',
          referenceId: FAKE_TRADE_1,
          operationId: opId(25),
        },
      ],
    });
  });

  console.log('Seed completed.');
  console.log('');
  console.log('Test accounts (password: 123456):');
  console.log(
    '  alice@haucex.com  - USDT: 7000 avail / 3000 locked | BTC: 0.5 avail',
  );
  console.log(
    '  bob@haucex.com    - USDT: 5000 avail / 1998 locked | BTC: 0.5 avail',
  );
  console.log('  admin@haucex.com  - no wallets');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
