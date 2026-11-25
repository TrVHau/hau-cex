import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../.env') });

import bcrypt from 'bcrypt';
import {
  PrismaClient,
  UserRole,
  TradingPairStatus,
} from '../apps/backend/src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { Decimal } from 'decimal.js';
import Redis from 'ioredis';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('--- Setting up Trading Bots and Market State ---');

  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

  const btc = await prisma.asset.findUnique({ where: { symbol: 'BTC' } });
  const usdt = await prisma.asset.findUnique({ where: { symbol: 'USDT' } });
  const pair = await prisma.tradingPair.findUnique({ where: { symbol: 'BTC_USDT' } });

  if (!btc || !usdt || !pair) {
    throw new Error('Assets or BTC_USDT pair not found in database');
  }

  const hashedPassword = await bcrypt.hash('123456', 10);

  // 1. Create or update bot users
  const mmBot = await prisma.user.upsert({
    where: { email: 'mm-bot@haucex.com' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'mm-bot@haucex.com',
      passwordHash: hashedPassword,
      fullName: 'Market Maker Bot',
      role: UserRole.USER,
    },
  });

  const takerBot = await prisma.user.upsert({
    where: { email: 'taker-bot@haucex.com' },
    update: { passwordHash: hashedPassword },
    create: {
      email: 'taker-bot@haucex.com',
      passwordHash: hashedPassword,
      fullName: 'Taker Trading Bot',
      role: UserRole.USER,
    },
  });

  const alice = await prisma.user.findUnique({ where: { email: 'alice@haucex.com' } });
  const bob = await prisma.user.findUnique({ where: { email: 'bob@haucex.com' } });

  console.log(`Bot users ensured: mm-bot (${mmBot.id}), taker-bot (${takerBot.id})`);

  // 2. Clear old orders, trades, outbox events, processed events
  console.log('Cleaning up old orders, trades and outbox events...');
  await prisma.trade.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.outboxEvent.deleteMany({});
  await prisma.processedEvent.deleteMany({});

  // 3. Setup wallets with ample balances
  const targetWallets = [
    { user: mmBot, btc: '200', usdt: '10000000' },
    { user: takerBot, btc: '200', usdt: '10000000' },
    ...(alice ? [{ user: alice, btc: '50', usdt: '1000000' }] : []),
    ...(bob ? [{ user: bob, btc: '50', usdt: '1000000' }] : []),
  ];

  for (const item of targetWallets) {
    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: item.user.id, assetId: btc.id } },
      update: { availableBalance: new Decimal(item.btc), lockedBalance: new Decimal('0') },
      create: { userId: item.user.id, assetId: btc.id, availableBalance: new Decimal(item.btc), lockedBalance: new Decimal('0') },
    });

    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: item.user.id, assetId: usdt.id } },
      update: { availableBalance: new Decimal(item.usdt), lockedBalance: new Decimal('0') },
      create: { userId: item.user.id, assetId: usdt.id, availableBalance: new Decimal(item.usdt), lockedBalance: new Decimal('0') },
    });
  }
  console.log('Wallets funded successfully.');

  // 4. Reset sequences in DB
  const safeId = pair.id.replace(/-/g, '_');
  await prisma.$executeRawUnsafe(`
    CREATE SEQUENCE IF NOT EXISTS order_seq_${safeId} START 1;
    CREATE SEQUENCE IF NOT EXISTS cmd_seq_${safeId} START 1;
    ALTER SEQUENCE order_seq_${safeId} RESTART WITH 1;
    ALTER SEQUENCE cmd_seq_${safeId} RESTART WITH 1;
  `);

  await prisma.orderSequence.upsert({
    where: { tradingPairId: pair.id },
    update: { lastValue: 0 },
    create: { tradingPairId: pair.id, lastValue: 0 },
  });

  await prisma.engineCommandSequence.upsert({
    where: { tradingPairId: pair.id },
    update: { lastValue: 0 },
    create: { tradingPairId: pair.id, lastValue: 0 },
  });
  console.log(`Sequences reset for pair ${pair.symbol}`);

  // 5. Reset Redis streams and caches
  console.log('Flushing Redis streams and orderbook caches...');
  await redis.del(
    'stream:engine:commands',
    'stream:engine:events',
    'stream:market:events',
    'stream:dead-letter',
    `cache:orderbook:${pair.symbol}`,
    `cache:orderbook:${pair.id}`
  );

  const obKeys = await redis.keys('cache:orderbook:*');
  if (obKeys.length > 0) {
    await redis.del(...obKeys);
  }
  const seqKeys = await redis.keys('seq:*');
  if (seqKeys.length > 0) {
    await redis.del(...seqKeys);
  }

  // 6. Set trading pair status to RECOVERING so OpenMarketBootstrapService triggers OpenMarket
  await prisma.tradingPair.update({
    where: { id: pair.id },
    data: { status: TradingPairStatus.RECOVERING },
  });
  console.log(`Trading pair ${pair.symbol} status set to RECOVERING.`);

  await redis.quit();
  await prisma.$disconnect();
  await pool.end();

  console.log('--- Setup Complete! Ready to launch services ---');
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
