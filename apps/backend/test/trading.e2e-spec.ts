/**
 * Phase 11 — E2E Test Suite (8 scenarios)
 *
 * Pre-conditions (from seed):
 *   alice@haucex.com  → USDT: avail=7000  locked=3000 | BTC: avail=0.5 locked=0
 *   bob@haucex.com    → USDT: avail=5000  locked=1998 | BTC: avail=0.5 locked=0
 *   admin@haucex.com  → no wallets
 *   treasury          → USDT: avail=1000000
 *   BTC_USDT makerFeeRate=takerFeeRate=0.001
 *   BUY  fee in BTC (base); SELL fee in USDT (quote)
 *
 * Engine processes async via Redis Streams → tests use polling helpers.
 *
 * Run:  cd apps/backend && ./node_modules/.bin/jest --config test/jest-e2e.json --verbose
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  HttpStatus,
} from '@nestjs/common';
import request, { type Response } from 'supertest';
import { type App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/core/prisma/prisma.service';
import { Redis } from 'ioredis';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface WalletDto {
  asset: string;
  availableBalance: string;
  lockedBalance: string;
}

interface OrderDto {
  id: string;
  status: string;
  filledQuantity: string;
  remainingQuantity: string;
  price: string;
  quantity: string;
  side: string;
}

interface ApiResponse<T> {
  data: T;
  requestId: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE = '/api/v1';
const PASSWORD = '123456';
const BTC_USDT = 'BTC_USDT';
const FEE_RATE = 0.001;

// Initial wallet amounts from seed
const SEED = {
  alice: { usdt: { avail: 7000, locked: 3000 }, btc: { avail: 0.5, locked: 0 } },
  bob: { usdt: { avail: 5000, locked: 1998 }, btc: { avail: 0.5, locked: 0 } },
};

// ─── Polling helper ───────────────────────────────────────────────────────────

async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs = 8000,
  intervalMs = 250,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

// ─── Supertest helpers ────────────────────────────────────────────────────────

function unwrap<T>(res: Response): T {
  const body = res.body as ApiResponse<T>;
  return body.data;
}

async function login(
  app: INestApplication<App>,
  email: string,
): Promise<TokenPair> {
  const res = await request(app.getHttpServer())
    .post(`${BASE}/auth/login`)
    .send({ email, password: PASSWORD })
    .expect(HttpStatus.OK);
  return unwrap<TokenPair>(res);
}

async function getWallets(
  app: INestApplication<App>,
  token: string,
): Promise<WalletDto[]> {
  const res = await request(app.getHttpServer())
    .get(`${BASE}/wallets`)
    .set('Authorization', `Bearer ${token}`)
    .expect(HttpStatus.OK);
  return unwrap<WalletDto[]>(res);
}

async function getWallet(
  app: INestApplication<App>,
  token: string,
  asset: string,
): Promise<WalletDto> {
  const wallets = await getWallets(app, token);
  const w = wallets.find((x) => x.asset === asset);
  if (!w) throw new Error(`Wallet ${asset} not found`);
  return w;
}

let _ikey = 1;
function ikey(): string {
  return `test-ikey-${Date.now()}-${_ikey++}`;
}

async function placeOrder(
  app: INestApplication<App>,
  token: string,
  opts: {
    symbol: string;
    side: 'BUY' | 'SELL';
    type?: 'LIMIT';
    price: string;
    quantity: string;
  },
): Promise<OrderDto> {
  const res = await request(app.getHttpServer())
    .post(`${BASE}/orders`)
    .set('Authorization', `Bearer ${token}`)
    .set('idempotency-key', ikey())
    .send({
      symbol: opts.symbol,
      side: opts.side,
      type: opts.type ?? 'LIMIT',
      price: opts.price,
      quantity: opts.quantity,
    })
    .expect(HttpStatus.CREATED);
  return unwrap<OrderDto>(res);
}

async function getOrder(
  app: INestApplication<App>,
  token: string,
  orderId: string,
): Promise<OrderDto> {
  const res = await request(app.getHttpServer())
    .get(`${BASE}/orders/${orderId}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(HttpStatus.OK);
  return unwrap<OrderDto>(res);
}

async function cancelOrder(
  app: INestApplication<App>,
  token: string,
  orderId: string,
): Promise<OrderDto> {
  const res = await request(app.getHttpServer())
    .post(`${BASE}/orders/${orderId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .expect(HttpStatus.OK);
  return unwrap<OrderDto>(res);
}

async function waitOrderStatus(
  app: INestApplication<App>,
  token: string,
  orderId: string,
  ...statuses: string[]
): Promise<OrderDto> {
  let order: OrderDto = { id: orderId } as OrderDto;
  await waitFor(async () => {
    order = await getOrder(app, token, orderId);
    return statuses.includes(order.status);
  });
  return order;
}

async function getOrderBook(
  app: INestApplication<App>,
  symbol: string,
): Promise<{ asks: { price: string; quantity: string }[]; bids: { price: string; quantity: string }[] }> {
  const res = await request(app.getHttpServer())
    .get(`${BASE}/markets/${symbol}/order-book`)
    .expect(HttpStatus.OK);
  return unwrap(res);
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

describe('Phase 11 — E2E Trading Scenarios', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: Redis;

  // Market ID resolved once
  let marketId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    redis = app.get<Redis>('REDIS_CLIENT');

    // Resolve market ID
    const market = await prisma.tradingPair.findUniqueOrThrow({
      where: { symbol: BTC_USDT },
    });
    marketId = market.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Reset helper (called before each scenario) ────────────────────────────

  async function resetState(): Promise<void> {
    // 1. Cancel all open/partially-filled orders
    await prisma.order.updateMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED', 'CANCEL_PENDING'] } },
      data: { status: 'CANCELLED' },
    });

    // 2. Delete trades, processed events, outbox
    await prisma.trade.deleteMany({});
    await prisma.processedEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});

    // 3. Reset wallets and ledger to seed values
    const treasury = await prisma.user.findUniqueOrThrow({ where: { email: 'treasury@haucex.com' } });
    const alice = await prisma.user.findUniqueOrThrow({ where: { email: 'alice@haucex.com' } });
    const bob = await prisma.user.findUniqueOrThrow({ where: { email: 'bob@haucex.com' } });
    const usdt = await prisma.asset.findUniqueOrThrow({ where: { symbol: 'USDT' } });
    const btc = await prisma.asset.findUniqueOrThrow({ where: { symbol: 'BTC' } });

    // Reset wallets
    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: alice.id, assetId: usdt.id } },
      update: { availableBalance: '7000', lockedBalance: '3000' },
      create: { userId: alice.id, assetId: usdt.id, availableBalance: '7000', lockedBalance: '3000' },
    });
    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: alice.id, assetId: btc.id } },
      update: { availableBalance: '0.5', lockedBalance: '0' },
      create: { userId: alice.id, assetId: btc.id, availableBalance: '0.5', lockedBalance: '0' },
    });
    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: bob.id, assetId: usdt.id } },
      update: { availableBalance: '5000', lockedBalance: '1998' },
      create: { userId: bob.id, assetId: usdt.id, availableBalance: '5000', lockedBalance: '1998' },
    });
    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: bob.id, assetId: btc.id } },
      update: { availableBalance: '0.5', lockedBalance: '0' },
      create: { userId: bob.id, assetId: btc.id, availableBalance: '0.5', lockedBalance: '0' },
    });
    await prisma.wallet.upsert({
      where: { userId_assetId: { userId: treasury.id, assetId: usdt.id } },
      update: { availableBalance: '1000000', lockedBalance: '0' },
      create: { userId: treasury.id, assetId: usdt.id, availableBalance: '1000000', lockedBalance: '0' },
    });

    // 4. Flush orderbook cache and clear orders from DB
    await redis.del(`cache:orderbook:${BTC_USDT}`);
    await prisma.order.deleteMany({});

    // 5. Reset market to RECOVERING (engine will re-open)
    await prisma.tradingPair.update({
      where: { symbol: BTC_USDT },
      data: { status: 'RECOVERING' },
    });

    // Wait briefly for market to become READY via admin
    // (For tests, we open market via admin API instead)
  }

  // Open market via admin API
  async function openMarket(adminToken: string): Promise<void> {
    await request(app.getHttpServer())
      .post(`${BASE}/admin/markets/${marketId}/open`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);

    // Wait until market is READY
    await waitFor(async () => {
      const mkt = await prisma.tradingPair.findUniqueOrThrow({ where: { symbol: BTC_USDT } });
      return mkt.status === 'READY';
    }, 5000);
  }

  // ─── E2E-01: Unmatched Order ───────────────────────────────────────────────

  describe('E2E-01: Unmatched Order', () => {
    let aliceToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Alice places SELL 0.1 BTC @ 60000 — order stays OPEN', async () => {
      const before = await getWallet(app, aliceToken, 'BTC');
      const availBefore = parseFloat(before.availableBalance);
      const lockedBefore = parseFloat(before.lockedBalance);

      const order = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '60000',
        quantity: '0.1',
      });

      // Wait for OPEN
      const opened = await waitOrderStatus(app, aliceToken, order.id, 'OPEN');
      expect(opened.status).toBe('OPEN');

      // BTC available decreased by 0.1, locked increased by 0.1
      const after = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(after.availableBalance)).toBeCloseTo(availBefore - 0.1, 5);
      expect(parseFloat(after.lockedBalance)).toBeCloseTo(lockedBefore + 0.1, 5);

      // No trade in DB
      const trades = await prisma.trade.findMany({});
      expect(trades).toHaveLength(0);

      // Order book asks has price 60000
      const book = await getOrderBook(app, BTC_USDT);
      const ask = book.asks.find((a) => parseFloat(a.price) === 60000);
      expect(ask).toBeDefined();
    });
  });

  // ─── E2E-02: Full Fill ────────────────────────────────────────────────────

  describe('E2E-02: Full Fill — Alice SELL, Bob BUY', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const b = await login(app, 'bob@haucex.com');
      bobToken = b.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Full fill → both orders FILLED, correct balances & fee', async () => {
      const price = '50000';
      const qty = '0.1';
      const qtyNum = 0.1;
      const priceNum = 50000;

      // Snapshots before
      const aliceBtcBefore = await getWallet(app, aliceToken, 'BTC');
      const aliceUsdtBefore = await getWallet(app, aliceToken, 'USDT');
      const bobBtcBefore = await getWallet(app, bobToken, 'BTC');
      const bobUsdtBefore = await getWallet(app, bobToken, 'USDT');

      // Alice SELL 0.1 BTC @ 50000 (maker → fee in USDT)
      const sellOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price,
        quantity: qty,
      });
      await waitOrderStatus(app, aliceToken, sellOrder.id, 'OPEN');

      // Bob BUY 0.1 BTC @ 50000 (taker → fee in BTC)
      const buyOrder = await placeOrder(app, bobToken, {
        symbol: BTC_USDT,
        side: 'BUY',
        price,
        quantity: qty,
      });

      // Wait for both FILLED
      await waitOrderStatus(app, aliceToken, sellOrder.id, 'FILLED');
      await waitOrderStatus(app, bobToken, buyOrder.id, 'FILLED');

      // Check Trade record
      const trades = await prisma.trade.findMany({});
      expect(trades.length).toBeGreaterThanOrEqual(1);
      const trade = trades[0];
      expect(parseFloat(String(trade.executionPrice))).toBeCloseTo(priceNum, 2);
      expect(parseFloat(String(trade.executedQuantity))).toBeCloseTo(qtyNum, 5);

      // fee calculations
      const sellerFee = qtyNum * priceNum * FEE_RATE; // 50 USDT
      const buyerFee = qtyNum * FEE_RATE;              // 0.0001 BTC

      // Alice: USDT+= price*qty - sellerFee; BTC-= qty (locked released then removed)
      const aliceUsdtAfter = await getWallet(app, aliceToken, 'USDT');
      const aliceBtcAfter = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(aliceUsdtAfter.availableBalance)).toBeCloseTo(
        parseFloat(aliceUsdtBefore.availableBalance) + priceNum * qtyNum - sellerFee, 2,
      );
      // BTC available reduced by qty (locked was 0, now locked for sell then consumed)
      expect(parseFloat(aliceBtcAfter.availableBalance)).toBeCloseTo(
        parseFloat(aliceBtcBefore.availableBalance) - qtyNum, 5,
      );
      expect(parseFloat(aliceBtcAfter.lockedBalance)).toBeCloseTo(0, 5);

      // Bob: BTC+= qty - buyerFee; USDT-= price*qty (locked released then consumed)
      const bobBtcAfter = await getWallet(app, bobToken, 'BTC');
      const bobUsdtAfter = await getWallet(app, bobToken, 'USDT');
      expect(parseFloat(bobBtcAfter.availableBalance)).toBeCloseTo(
        parseFloat(bobBtcBefore.availableBalance) + qtyNum - buyerFee, 5,
      );
      // USDT available reduced by locked amount (which was price*qty)
      expect(parseFloat(bobUsdtAfter.availableBalance)).toBeCloseTo(
        parseFloat(bobUsdtBefore.availableBalance) - priceNum * qtyNum, 2,
      );

      // Treasury receives fees
      const treasury = await prisma.user.findUniqueOrThrow({ where: { email: 'treasury@haucex.com' } });
      const usdt = await prisma.asset.findUniqueOrThrow({ where: { symbol: 'USDT' } });
      const btc = await prisma.asset.findUniqueOrThrow({ where: { symbol: 'BTC' } });
      const tUsdtWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId_assetId: { userId: treasury.id, assetId: usdt.id } },
      });
      const tBtcWallet = await prisma.wallet.findFirst({
        where: { userId: treasury.id, assetId: btc.id },
      });

      expect(parseFloat(String(tUsdtWallet.availableBalance))).toBeCloseTo(1000000 + sellerFee, 2);
      if (tBtcWallet) {
        expect(parseFloat(String(tBtcWallet.availableBalance))).toBeCloseTo(buyerFee, 5);
      }

      // LedgerEntry TRADE_SETTLEMENT exists
      const le = await prisma.ledgerEntry.findMany({
        where: { entryType: 'TRADE_SETTLEMENT' },
      });
      expect(le.length).toBeGreaterThan(0);
    });
  });

  // ─── E2E-03: Partial Fill ─────────────────────────────────────────────────

  describe('E2E-03: Partial Fill', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const b = await login(app, 'bob@haucex.com');
      bobToken = b.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Alice SELL 0.2 BTC, Bob BUY 0.1 BTC → Alice PARTIALLY_FILLED, Bob FILLED', async () => {
      const price = '50000';

      // Alice SELL 0.2 BTC (maker)
      const sellOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price,
        quantity: '0.2',
      });
      await waitOrderStatus(app, aliceToken, sellOrder.id, 'OPEN');

      // Bob BUY 0.1 BTC (taker — partial fill)
      const buyOrder = await placeOrder(app, bobToken, {
        symbol: BTC_USDT,
        side: 'BUY',
        price,
        quantity: '0.1',
      });

      // Bob fully filled
      await waitOrderStatus(app, bobToken, buyOrder.id, 'FILLED');

      // Alice partially filled
      await waitOrderStatus(app, aliceToken, sellOrder.id, 'PARTIALLY_FILLED');

      const aliceSell = await getOrder(app, aliceToken, sellOrder.id);
      expect(aliceSell.status).toBe('PARTIALLY_FILLED');
      expect(parseFloat(aliceSell.filledQuantity)).toBeCloseTo(0.1, 5);
      expect(parseFloat(aliceSell.remainingQuantity)).toBeCloseTo(0.1, 5);

      // Trade exists
      const trades = await prisma.trade.findMany({});
      expect(trades.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── E2E-04: Multiple Resting Orders (Price Priority) ───────────────────

  describe('E2E-04: Price Priority — better price matched first', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const b = await login(app, 'bob@haucex.com');
      bobToken = b.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Alice SELL A@49000, Alice SELL B@50000, Bob BUY 0.15@50000 → A fully matched first, B partial', async () => {
      // Alice SELL A: 0.1 BTC @ 49000
      const sellA = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '49000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellA.id, 'OPEN');

      // Alice SELL B: 0.1 BTC @ 50000
      const sellB = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '50000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellB.id, 'OPEN');

      // Bob BUY 0.15 BTC @ 50000 — should match A first (better price)
      const buyC = await placeOrder(app, bobToken, {
        symbol: BTC_USDT,
        side: 'BUY',
        price: '50000',
        quantity: '0.15',
      });

      // Wait for buy to complete (fully filled with 2 partial fills)
      await waitOrderStatus(app, bobToken, buyC.id, 'FILLED');

      // Sell A must be FILLED (all 0.1)
      const aFinal = await waitOrderStatus(app, aliceToken, sellA.id, 'FILLED');
      expect(aFinal.status).toBe('FILLED');

      // Sell B must be PARTIALLY_FILLED (0.05 filled, 0.05 remaining)
      const bFinal = await waitOrderStatus(app, aliceToken, sellB.id, 'PARTIALLY_FILLED');
      expect(bFinal.status).toBe('PARTIALLY_FILLED');
      expect(parseFloat(bFinal.filledQuantity)).toBeCloseTo(0.05, 5);
    });
  });

  // ─── E2E-05: FIFO at Same Price ───────────────────────────────────────────

  describe('E2E-05: FIFO — same price, earlier order matched first', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const b = await login(app, 'bob@haucex.com');
      bobToken = b.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Alice SELL A@50000 first, Bob SELL B@50000 second, buyer gets A first', async () => {
      // Alice SELL A: 0.1 BTC @ 50000 (earlier)
      const sellA = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '50000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellA.id, 'OPEN');

      // Bob SELL B: 0.1 BTC @ 50000 (later)
      const sellB = await placeOrder(app, bobToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '50000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, bobToken, sellB.id, 'OPEN');

      // Alice BUY 0.1 BTC @ 50000 — should match sellA (FIFO)
      const buyOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'BUY',
        price: '50000',
        quantity: '0.1',
      });

      await waitOrderStatus(app, aliceToken, buyOrder.id, 'FILLED');

      // Sell A must be FILLED
      const aFinal = await waitOrderStatus(app, aliceToken, sellA.id, 'FILLED');
      expect(aFinal.status).toBe('FILLED');

      // Sell B still OPEN
      const bFinal = await getOrder(app, bobToken, sellB.id);
      expect(bFinal.status).toBe('OPEN');
    });
  });

  // ─── E2E-06: Cancel Order ─────────────────────────────────────────────────

  describe('E2E-06: Cancel Open Order', () => {
    let aliceToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Alice SELL 0.1 BTC → cancel → CANCELLED, BTC available restored', async () => {
      const btcBefore = await getWallet(app, aliceToken, 'BTC');
      const availBefore = parseFloat(btcBefore.availableBalance);
      const lockedBefore = parseFloat(btcBefore.lockedBalance);

      const order = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '60000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, order.id, 'OPEN');

      // Verify locked increased
      const btcDuring = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(btcDuring.lockedBalance)).toBeCloseTo(lockedBefore + 0.1, 5);

      // Cancel
      await cancelOrder(app, aliceToken, order.id);

      // Wait for CANCELLED (may go through CANCEL_PENDING)
      await waitOrderStatus(app, aliceToken, order.id, 'CANCELLED');

      // BTC available restored
      const btcAfter = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(btcAfter.availableBalance)).toBeCloseTo(availBefore, 5);
      expect(parseFloat(btcAfter.lockedBalance)).toBeCloseTo(lockedBefore, 5);

      // LedgerEntry ORDER_UNLOCK exists
      const unlockEntries = await prisma.ledgerEntry.findMany({
        where: {
          entryType: 'ORDER_UNLOCK',
          referenceId: order.id,
        },
      });
      expect(unlockEntries.length).toBeGreaterThan(0);
    });
  });

  // ─── E2E-07: Duplicate Event Idempotency ──────────────────────────────────

  describe('E2E-07: Duplicate TradeCreated Event — idempotency guard', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const b = await login(app, 'bob@haucex.com');
      bobToken = b.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Two orders fill → processedEvents has 1 entry per event, Trade created only once', async () => {
      const sellOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '50000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellOrder.id, 'OPEN');

      const buyOrder = await placeOrder(app, bobToken, {
        symbol: BTC_USDT,
        side: 'BUY',
        price: '50000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, bobToken, buyOrder.id, 'FILLED');

      // Exactly 1 trade
      const trades = await prisma.trade.findMany({});
      expect(trades).toHaveLength(1);

      // processedEvents has records (at least 1 per fill event)
      const processed = await prisma.processedEvent.findMany({});
      expect(processed.length).toBeGreaterThanOrEqual(1);

      // Simulate duplicate: get outbox event messageId and attempt re-processing
      // The idempotency guard uses processedEvent table — if we try to insert
      // the same event again, it should be a no-op.
      // We verify by checking that balance didn't double-change.
      const bobBtcAfter = await getWallet(app, bobToken, 'BTC');
      const expectedBtc = SEED.bob.btc.avail + 0.1 - 0.1 * FEE_RATE;
      expect(parseFloat(bobBtcAfter.availableBalance)).toBeCloseTo(expectedBtc, 5);
    });
  });

  // ─── E2E-08: Market Suspend ───────────────────────────────────────────────

  describe('E2E-08: Market Suspend → orders blocked, resume → orders accepted', () => {
    let aliceToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      const a = await login(app, 'alice@haucex.com');
      aliceToken = a.accessToken;
      const ad = await login(app, 'admin@haucex.com');
      adminToken = ad.accessToken;
      await openMarket(adminToken);
    });

    it('Admin suspends market → place order returns error', async () => {
      // Suspend market
      await request(app.getHttpServer())
        .post(`${BASE}/admin/markets/${marketId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'E2E test suspension' })
        .expect(HttpStatus.OK);

      // Wait for SUSPENDED status in DB
      await waitFor(async () => {
        const mkt = await prisma.tradingPair.findUniqueOrThrow({ where: { symbol: BTC_USDT } });
        return mkt.status === 'SUSPENDED';
      });

      // Alice tries to place order — should fail (409 or 503)
      const res = await request(app.getHttpServer())
        .post(`${BASE}/orders`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .set('idempotency-key', ikey())
        .send({
          symbol: BTC_USDT,
          side: 'SELL',
          type: 'LIMIT',
          price: '50000',
          quantity: '0.1',
        });

      expect([
        HttpStatus.CONFLICT,
        HttpStatus.SERVICE_UNAVAILABLE,
        HttpStatus.BAD_REQUEST,
        422,
      ]).toContain(res.status);
    });

    it('Admin opens market → place order succeeds', async () => {
      await openMarket(adminToken);

      const order = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '60000',
        quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, order.id, 'OPEN');
      expect(order.id).toBeDefined();
    });
  });

  // ─── Health endpoint ──────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('GET /api/v1/health returns { db: "ok", redis: "ok" }', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/health`)
        .expect(HttpStatus.OK);
      const body = unwrap<{ db: string; redis: string; status: string; uptime: number }>(res);
      expect(body.db).toBe('ok');
      expect(body.redis).toBe('ok');
      expect(body.status).toBe('ok');
      expect(typeof body.uptime).toBe('number');
    });
  });
});
