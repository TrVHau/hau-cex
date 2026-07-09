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

  const seedAmount = new Decimal(1_000_000);
  const operationId = '00000000-0000-0000-0000-000000000001';

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: {
        userId_assetId: {
          userId: treasury.id,
          assetId: usdt.id,
        },
      },
      update: {
        availableBalance: { increment: seedAmount },
      },
      create: {
        userId: treasury.id,
        assetId: usdt.id,
        availableBalance: seedAmount,
        lockedBalance: new Decimal(0),
      },
    });

    await tx.ledgerEntry.create({
      data: {
        walletId: wallet.id,
        userId: treasury.id,
        assetId: usdt.id,
        entryType: LedgerEntryType.INITIAL_BALANCE,
        balanceType: LedgerBalanceType.AVAILABLE,
        amount: seedAmount,
        referenceType: 'SYSTEM_SEED',
        referenceId: treasury.id,
        operationId,
      },
    });
  });

  console.log('Seed completed.');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
