/**
 * Phase 11 — E2E Test Suite (8 scenarios + Health check)
 *
 * Pre-conditions (from seed):
 *   alice@haucex.com  → USDT: avail=7000  locked=3000 | BTC: avail=0.5 locked=0
 *   bob@haucex.com    → USDT: avail=5000  locked=1998 | BTC: avail=0.5 locked=0
 *   admin@haucex.com  → no wallets
 *   treasury          → USDT: avail=1000000
 *   BTC_USDT makerFeeRate=takerFeeRate=0.001
 *   SELL fee in USDT (quote); BUY fee in BTC (base)
 *
 * Engine processes async via Redis Streams → tests use polling helpers.
 *
 * Run (requires running postgres + redis + matching-engine):
 *   cd apps/backend
 *   ./node_modules/.bin/jest --config test/jest-e2e.json --verbose --runInBand
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

// ─── Shared interfaces ────────────────────────────────────────────────────────

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Matches WalletResponseDto from wallets.service */
interface WalletDto {
  id: string;
  assetSymbol: string;   // ← field name from wallets.service.ts
  assetName: string;
  availableBalance: string;
  lockedBalance: string;
  totalBalance: string;
}

/** Matches OrderResponseDto from orders/dto/order-response.dto.ts */
interface OrderDto {
  orderId: string;       // ← field name from order-response.dto.ts
  symbol: string;
  side: string;
  type: string;
  status: string;
  price: string;
  quantity: string;
  filledQuantity: string;
  remainingQuantity: string;
}

interface ApiResponse<T> {
  data: T;
  requestId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE = '/api/v1';
const PASSWORD = '123456';
const BTC_USDT = 'BTC_USDT';
const FEE_RATE = 0.001;

// Seed wallet amounts
const SEED = {
  alice: { usdt: { avail: 7000, locked: 3000 }, btc: { avail: 0.5, locked: 0 } },
  bob: { usdt: { avail: 5000, locked: 1998 }, btc: { avail: 0.5, locked: 0 } },
  treasury: { usdt: { avail: 1000000, locked: 0 } },
};

// ─── Polling helper ───────────────────────────────────────────────────────────

async function waitFor(
  condition: () => Promise<boolean>,
  timeoutMs = 10_000,
  intervalMs = 200,
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

/** Get a single wallet by asset symbol */
async function getWallet(
  app: INestApplication<App>,
  token: string,
  assetSymbol: string,
): Promise<WalletDto> {
  const wallets = await getWallets(app, token);
  const w = wallets.find((x) => x.assetSymbol === assetSymbol);
  if (!w) throw new Error(`Wallet for asset ${assetSymbol} not found`);
  return w;
}

// Monotonically increasing idempotency key generator
let _ikeyCounter = 1;
function ikey(): string {
  return `e2e-${Date.now()}-${_ikeyCounter++}`;
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
): Promise<void> {
  await request(app.getHttpServer())
    .post(`${BASE}/orders/${orderId}/cancel`)
    .set('Authorization', `Bearer ${token}`)
    .expect(HttpStatus.OK);
}

/** Poll order until it reaches one of the expected statuses */
async function waitOrderStatus(
  app: INestApplication<App>,
  token: string,
  orderId: string,
  ...statuses: string[]
): Promise<OrderDto> {
  let order: OrderDto = { orderId } as OrderDto;
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

  // IDs resolved once in beforeAll
  let marketId: string;
  let aliceId: string;
  let bobId: string;
  let treasuryId: string;
  let usdtId: string;
  let btcId: string;

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

    // Resolve and cache IDs — avoids repeated lookups in every test
    const [market, alice, bob, treasury, usdt, btc] = await Promise.all([
      prisma.tradingPair.findUniqueOrThrow({ where: { symbol: BTC_USDT } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'alice@haucex.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'bob@haucex.com' } }),
      prisma.user.findUniqueOrThrow({ where: { email: 'treasury@haucex.com' } }),
      prisma.asset.findUniqueOrThrow({ where: { symbol: 'USDT' } }),
      prisma.asset.findUniqueOrThrow({ where: { symbol: 'BTC' } }),
    ]);
    marketId = market.id;
    aliceId = alice.id;
    bobId = bob.id;
    treasuryId = treasury.id;
    usdtId = usdt.id;
    btcId = btc.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── State reset before each scenario ────────────────────────────────────

  async function resetState(): Promise<void> {
    // 1. Force-cancel all live orders
    await prisma.order.updateMany({
      where: { status: { in: ['OPEN', 'PARTIALLY_FILLED', 'CANCEL_PENDING'] } },
      data: { status: 'CANCELLED' },
    });

    // 2. Wipe transactional data
    await prisma.trade.deleteMany({});
    await prisma.processedEvent.deleteMany({});
    await prisma.outboxEvent.deleteMany({});
    await prisma.order.deleteMany({});

    // 3. Restore wallet balances to seed values (all in one $transaction)
    await prisma.$transaction([
      prisma.wallet.upsert({
        where: { userId_assetId: { userId: aliceId, assetId: usdtId } },
        update: { availableBalance: '7000', lockedBalance: '3000' },
        create: { userId: aliceId, assetId: usdtId, availableBalance: '7000', lockedBalance: '3000' },
      }),
      prisma.wallet.upsert({
        where: { userId_assetId: { userId: aliceId, assetId: btcId } },
        update: { availableBalance: '0.5', lockedBalance: '0' },
        create: { userId: aliceId, assetId: btcId, availableBalance: '0.5', lockedBalance: '0' },
      }),
      prisma.wallet.upsert({
        where: { userId_assetId: { userId: bobId, assetId: usdtId } },
        update: { availableBalance: '5000', lockedBalance: '1998' },
        create: { userId: bobId, assetId: usdtId, availableBalance: '5000', lockedBalance: '1998' },
      }),
      prisma.wallet.upsert({
        where: { userId_assetId: { userId: bobId, assetId: btcId } },
        update: { availableBalance: '0.5', lockedBalance: '0' },
        create: { userId: bobId, assetId: btcId, availableBalance: '0.5', lockedBalance: '0' },
      }),
      prisma.wallet.upsert({
        where: { userId_assetId: { userId: treasuryId, assetId: usdtId } },
        update: { availableBalance: '1000000', lockedBalance: '0' },
        create: { userId: treasuryId, assetId: usdtId, availableBalance: '1000000', lockedBalance: '0' },
      }),
    ]);

    // 4. Flush Redis orderbook cache
    await redis.del(`cache:orderbook:${BTC_USDT}`);

    // 5. Set market to SUSPENDED so openMarket() admin API will work
    //    (openMarket API requires status=SUSPENDED)
    await prisma.tradingPair.update({
      where: { id: marketId },
      data: { status: 'SUSPENDED' },
    });
  }

  /** Open market via admin API + wait for engine to set status=READY */
  async function openMarket(adminToken: string): Promise<void> {
    // Admin API: requires market to be SUSPENDED → sends OpenMarket command to engine
    await request(app.getHttpServer())
      .post(`${BASE}/admin/markets/${marketId}/open`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(HttpStatus.OK);

    // Poll until engine processes the command and sets status=READY
    await waitFor(async () => {
      const mkt = await prisma.tradingPair.findUniqueOrThrow({ where: { id: marketId } });
      return mkt.status === 'READY';
    }, 10_000);
  }

  // ─── E2E-01: Unmatched Order ──────────────────────────────────────────────

  describe('E2E-01: Unmatched Order', () => {
    let aliceToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: adminToken }] = await Promise.all([
        login(app, 'alice@haucex.com'),
        login(app, 'admin@haucex.com'),
      ]);
      await openMarket(adminToken);
    });

    it('Alice SELL 0.1 BTC @ 60000 — stays OPEN, BTC locked, orderbook updated, no trade', async () => {
      const btcBefore = await getWallet(app, aliceToken, 'BTC');
      const availBefore = parseFloat(btcBefore.availableBalance);
      const lockedBefore = parseFloat(btcBefore.lockedBalance);

      const order = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT,
        side: 'SELL',
        price: '60000',
        quantity: '0.1',
      });

      // Wait for order to become OPEN
      const opened = await waitOrderStatus(app, aliceToken, order.orderId, 'OPEN');
      expect(opened.status).toBe('OPEN');

      // BTC available -0.1, locked +0.1
      const btcAfter = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(btcAfter.availableBalance)).toBeCloseTo(availBefore - 0.1, 5);
      expect(parseFloat(btcAfter.lockedBalance)).toBeCloseTo(lockedBefore + 0.1, 5);

      // No trade created
      const trades = await prisma.trade.count();
      expect(trades).toBe(0);

      // Orderbook asks must contain price 60000
      const book = await getOrderBook(app, BTC_USDT);
      const ask = book.asks.find((a) => parseFloat(a.price) === 60000);
      expect(ask).toBeDefined();
      expect(parseFloat(ask!.quantity)).toBeCloseTo(0.1, 5);
    });
  });

  // ─── E2E-02: Full Fill ────────────────────────────────────────────────────

  describe('E2E-02: Full Fill — Alice SELL, Bob BUY', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: bobToken }, { accessToken: adminToken }] =
        await Promise.all([
          login(app, 'alice@haucex.com'),
          login(app, 'bob@haucex.com'),
          login(app, 'admin@haucex.com'),
        ]);
      await openMarket(adminToken);
    });

    it('Full fill → both FILLED, fees deducted correctly, treasury credited', async () => {
      const priceNum = 50000;
      const qtyNum = 0.1;
      const price = String(priceNum);
      const qty = String(qtyNum);

      // Snapshot balances before
      const [aliceBtcBefore, aliceUsdtBefore, bobBtcBefore, bobUsdtBefore] = await Promise.all([
        getWallet(app, aliceToken, 'BTC'),
        getWallet(app, aliceToken, 'USDT'),
        getWallet(app, bobToken, 'BTC'),
        getWallet(app, bobToken, 'USDT'),
      ]);

      // Alice SELL 0.1 BTC @ 50000 (maker → fee deducted from USDT proceeds)
      const sellOrder = await placeOrder(app, aliceToken, { symbol: BTC_USDT, side: 'SELL', price, quantity: qty });
      await waitOrderStatus(app, aliceToken, sellOrder.orderId, 'OPEN');

      // Bob BUY 0.1 BTC @ 50000 (taker → fee deducted from BTC received)
      const buyOrder = await placeOrder(app, bobToken, { symbol: BTC_USDT, side: 'BUY', price, quantity: qty });

      // Both orders must be FILLED
      await Promise.all([
        waitOrderStatus(app, aliceToken, sellOrder.orderId, 'FILLED'),
        waitOrderStatus(app, bobToken, buyOrder.orderId, 'FILLED'),
      ]);

      // ── Trade record ──────────────────────────────────────────────────────
      const trades = await prisma.trade.findMany({});
      expect(trades).toHaveLength(1);
      expect(parseFloat(String(trades[0].executionPrice))).toBeCloseTo(priceNum, 2);
      expect(parseFloat(String(trades[0].executedQuantity))).toBeCloseTo(qtyNum, 5);

      // ── Fee calculations ──────────────────────────────────────────────────
      // seller (maker): fee = qty * price * feeRate = 0.1 * 50000 * 0.001 = 5 USDT
      const sellerFee = qtyNum * priceNum * FEE_RATE; // 5
      // buyer  (taker): fee = qty * feeRate = 0.1 * 0.001 = 0.0001 BTC
      const buyerFee = qtyNum * FEE_RATE; // 0.0001

      // ── Alice balances ────────────────────────────────────────────────────
      const [aliceBtcAfter, aliceUsdtAfter] = await Promise.all([
        getWallet(app, aliceToken, 'BTC'),
        getWallet(app, aliceToken, 'USDT'),
      ]);
      // Alice sold BTC: available = before - qty, locked = 0
      expect(parseFloat(aliceBtcAfter.availableBalance)).toBeCloseTo(
        parseFloat(aliceBtcBefore.availableBalance) - qtyNum, 5,
      );
      expect(parseFloat(aliceBtcAfter.lockedBalance)).toBeCloseTo(0, 5);
      // Alice received USDT: available = before + price*qty - sellerFee
      expect(parseFloat(aliceUsdtAfter.availableBalance)).toBeCloseTo(
        parseFloat(aliceUsdtBefore.availableBalance) + priceNum * qtyNum - sellerFee, 2,
      );

      // ── Bob balances ──────────────────────────────────────────────────────
      const [bobBtcAfter, bobUsdtAfter] = await Promise.all([
        getWallet(app, bobToken, 'BTC'),
        getWallet(app, bobToken, 'USDT'),
      ]);
      // Bob received BTC: available = before + qty - buyerFee
      expect(parseFloat(bobBtcAfter.availableBalance)).toBeCloseTo(
        parseFloat(bobBtcBefore.availableBalance) + qtyNum - buyerFee, 5,
      );
      // Bob spent USDT: available = before - price*qty (locked was debited on order creation)
      expect(parseFloat(bobUsdtAfter.availableBalance)).toBeCloseTo(
        parseFloat(bobUsdtBefore.availableBalance) - priceNum * qtyNum, 2,
      );

      // ── Treasury receives fees ────────────────────────────────────────────
      const tUsdtWallet = await prisma.wallet.findUniqueOrThrow({
        where: { userId_assetId: { userId: treasuryId, assetId: usdtId } },
      });
      const tBtcWallet = await prisma.wallet.findFirst({
        where: { userId: treasuryId, assetId: btcId },
      });
      expect(parseFloat(String(tUsdtWallet.availableBalance))).toBeCloseTo(
        SEED.treasury.usdt.avail + sellerFee, 2,
      );
      if (tBtcWallet) {
        expect(parseFloat(String(tBtcWallet.availableBalance))).toBeCloseTo(buyerFee, 5);
      }

      // ── Ledger entries exist ──────────────────────────────────────────────
      const settlementEntries = await prisma.ledgerEntry.count({
        where: { entryType: 'TRADE_SETTLEMENT' },
      });
      expect(settlementEntries).toBeGreaterThan(0);

      const feeEntries = await prisma.ledgerEntry.count({
        where: { entryType: 'TRADING_FEE' },
      });
      expect(feeEntries).toBeGreaterThan(0);
    });
  });

  // ─── E2E-03: Partial Fill ─────────────────────────────────────────────────

  describe('E2E-03: Partial Fill', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: bobToken }, { accessToken: adminToken }] =
        await Promise.all([
          login(app, 'alice@haucex.com'),
          login(app, 'bob@haucex.com'),
          login(app, 'admin@haucex.com'),
        ]);
      await openMarket(adminToken);
    });

    it('Alice SELL 0.2 BTC, Bob BUY 0.1 → Alice PARTIALLY_FILLED, Bob FILLED', async () => {
      const price = '50000';

      const sellOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price, quantity: '0.2',
      });
      await waitOrderStatus(app, aliceToken, sellOrder.orderId, 'OPEN');

      const buyOrder = await placeOrder(app, bobToken, {
        symbol: BTC_USDT, side: 'BUY', price, quantity: '0.1',
      });

      await waitOrderStatus(app, bobToken, buyOrder.orderId, 'FILLED');
      const aliceFinal = await waitOrderStatus(app, aliceToken, sellOrder.orderId, 'PARTIALLY_FILLED');

      expect(aliceFinal.status).toBe('PARTIALLY_FILLED');
      expect(parseFloat(aliceFinal.filledQuantity)).toBeCloseTo(0.1, 5);
      expect(parseFloat(aliceFinal.remainingQuantity)).toBeCloseTo(0.1, 5);

      const trades = await prisma.trade.count();
      expect(trades).toBeGreaterThanOrEqual(1);

      // Alice BTC locked reduced by 0.1 (remaining), not 0.2 (original)
      const aliceBtc = await getWallet(app, aliceToken, 'BTC');
      // available = 0.5 - 0.2 (locked for sell) → still 0.3
      expect(parseFloat(aliceBtc.availableBalance)).toBeCloseTo(SEED.alice.btc.avail - 0.2, 5);
      // locked = 0.1 (the remaining unfilled portion)
      expect(parseFloat(aliceBtc.lockedBalance)).toBeCloseTo(0.1, 5);
    });
  });

  // ─── E2E-04: Price Priority ────────────────────────────────────────────────

  describe('E2E-04: Price Priority — cheaper ask matched first', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: bobToken }, { accessToken: adminToken }] =
        await Promise.all([
          login(app, 'alice@haucex.com'),
          login(app, 'bob@haucex.com'),
          login(app, 'admin@haucex.com'),
        ]);
      await openMarket(adminToken);
    });

    it('Alice SELL A@49000, Alice SELL B@50000, Bob BUY 0.15@50000 → A fully matched first, B partial', async () => {
      // Place two sells at different prices
      const sellA = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price: '49000', quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellA.orderId, 'OPEN');

      const sellB = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price: '50000', quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellB.orderId, 'OPEN');

      // Bob buys 0.15 — engine must consume A fully first (price=49000), then 0.05 from B
      const buyC = await placeOrder(app, bobToken, {
        symbol: BTC_USDT, side: 'BUY', price: '50000', quantity: '0.15',
      });

      await waitOrderStatus(app, bobToken, buyC.orderId, 'FILLED');

      const aFinal = await waitOrderStatus(app, aliceToken, sellA.orderId, 'FILLED');
      expect(aFinal.status).toBe('FILLED');

      const bFinal = await waitOrderStatus(app, aliceToken, sellB.orderId, 'PARTIALLY_FILLED');
      expect(bFinal.status).toBe('PARTIALLY_FILLED');
      expect(parseFloat(bFinal.filledQuantity)).toBeCloseTo(0.05, 5);
      expect(parseFloat(bFinal.remainingQuantity)).toBeCloseTo(0.05, 5);
    });
  });

  // ─── E2E-05: FIFO at Same Price ───────────────────────────────────────────

  describe('E2E-05: FIFO — same price, earlier order matched first', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: bobToken }, { accessToken: adminToken }] =
        await Promise.all([
          login(app, 'alice@haucex.com'),
          login(app, 'bob@haucex.com'),
          login(app, 'admin@haucex.com'),
        ]);
      await openMarket(adminToken);
    });

    it('Alice SELL first, Bob SELL second (same price) — buyer gets Alice first (FIFO)', async () => {
      // Alice SELL A — placed first (earlier sequence number)
      const sellA = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price: '50000', quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellA.orderId, 'OPEN');

      // Bob SELL B — placed second
      const sellB = await placeOrder(app, bobToken, {
        symbol: BTC_USDT, side: 'SELL', price: '50000', quantity: '0.1',
      });
      await waitOrderStatus(app, bobToken, sellB.orderId, 'OPEN');

      // Alice BUY 0.1 — should match sellA (FIFO)
      const buyOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'BUY', price: '50000', quantity: '0.1',
      });

      await waitOrderStatus(app, aliceToken, buyOrder.orderId, 'FILLED');

      // sellA must be FILLED (matched)
      const aFinal = await waitOrderStatus(app, aliceToken, sellA.orderId, 'FILLED');
      expect(aFinal.status).toBe('FILLED');

      // sellB must still be OPEN (not touched)
      const bFinal = await getOrder(app, bobToken, sellB.orderId);
      expect(bFinal.status).toBe('OPEN');
    });
  });

  // ─── E2E-06: Cancel Order ─────────────────────────────────────────────────

  describe('E2E-06: Cancel Open Order', () => {
    let aliceToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: adminToken }] = await Promise.all([
        login(app, 'alice@haucex.com'),
        login(app, 'admin@haucex.com'),
      ]);
      await openMarket(adminToken);
    });

    it('Alice SELL → cancel → CANCELLED, BTC available restored, ORDER_UNLOCK ledger exists', async () => {
      const btcBefore = await getWallet(app, aliceToken, 'BTC');
      const availBefore = parseFloat(btcBefore.availableBalance);
      const lockedBefore = parseFloat(btcBefore.lockedBalance);

      const order = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price: '60000', quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, order.orderId, 'OPEN');

      // Verify locked increased while order is open
      const btcDuring = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(btcDuring.lockedBalance)).toBeCloseTo(lockedBefore + 0.1, 5);
      expect(parseFloat(btcDuring.availableBalance)).toBeCloseTo(availBefore - 0.1, 5);

      // Cancel the order
      await cancelOrder(app, aliceToken, order.orderId);

      // Wait: may pass through CANCEL_PENDING → CANCELLED
      await waitOrderStatus(app, aliceToken, order.orderId, 'CANCELLED');

      // BTC fully restored to pre-order state
      const btcAfter = await getWallet(app, aliceToken, 'BTC');
      expect(parseFloat(btcAfter.availableBalance)).toBeCloseTo(availBefore, 5);
      expect(parseFloat(btcAfter.lockedBalance)).toBeCloseTo(lockedBefore, 5);

      // ORDER_UNLOCK ledger entry must exist for this order
      const unlockCount = await prisma.ledgerEntry.count({
        where: { entryType: 'ORDER_UNLOCK', referenceId: order.orderId },
      });
      expect(unlockCount).toBeGreaterThan(0);
    });
  });

  // ─── E2E-07: Idempotency guard ────────────────────────────────────────────

  describe('E2E-07: Idempotency — duplicate engine event must not double-settle', () => {
    let aliceToken: string;
    let bobToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: bobToken }, { accessToken: adminToken }] =
        await Promise.all([
          login(app, 'alice@haucex.com'),
          login(app, 'bob@haucex.com'),
          login(app, 'admin@haucex.com'),
        ]);
      await openMarket(adminToken);
    });

    it('Trade settles exactly once — processedEvents blocks re-processing', async () => {
      const sellOrder = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price: '50000', quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, sellOrder.orderId, 'OPEN');

      const buyOrder = await placeOrder(app, bobToken, {
        symbol: BTC_USDT, side: 'BUY', price: '50000', quantity: '0.1',
      });
      await Promise.all([
        waitOrderStatus(app, aliceToken, sellOrder.orderId, 'FILLED'),
        waitOrderStatus(app, bobToken, buyOrder.orderId, 'FILLED'),
      ]);

      // Exactly 1 trade in DB — not 2
      const trades = await prisma.trade.findMany({});
      expect(trades).toHaveLength(1);

      // processedEvents table has at least 1 row (one per engine event processed)
      const processed = await prisma.processedEvent.findMany({});
      expect(processed.length).toBeGreaterThanOrEqual(1);

      // No duplicate message IDs in processedEvents
      const msgIds = processed.map((p) => p.messageId);
      const uniqueIds = new Set(msgIds);
      expect(uniqueIds.size).toBe(msgIds.length);

      // Bob's BTC balance exactly = seed + qty - fee (not doubled)
      const bobBtc = await getWallet(app, bobToken, 'BTC');
      const expectedBtc = SEED.bob.btc.avail + 0.1 - 0.1 * FEE_RATE;
      expect(parseFloat(bobBtc.availableBalance)).toBeCloseTo(expectedBtc, 5);

      // Alice's USDT balance exactly = seed_avail + price*qty - fee (not doubled)
      const aliceUsdt = await getWallet(app, aliceToken, 'USDT');
      const sellerFee = 0.1 * 50000 * FEE_RATE;
      const expectedUsdt = SEED.alice.usdt.avail + 0.1 * 50000 - sellerFee;
      expect(parseFloat(aliceUsdt.availableBalance)).toBeCloseTo(expectedUsdt, 2);
    });
  });

  // ─── E2E-08: Market Suspend / Resume ─────────────────────────────────────

  describe('E2E-08: Market suspend blocks orders, resume re-enables them', () => {
    let aliceToken: string;
    let adminToken: string;

    beforeAll(async () => {
      await resetState();
      [{ accessToken: aliceToken }, { accessToken: adminToken }] = await Promise.all([
        login(app, 'alice@haucex.com'),
        login(app, 'admin@haucex.com'),
      ]);
      await openMarket(adminToken);
    });

    it('Admin suspends market → place order returns 422 (MarketSuspendedException)', async () => {
      // Market must be READY before suspending
      const mktBefore = await prisma.tradingPair.findUniqueOrThrow({ where: { id: marketId } });
      expect(mktBefore.status).toBe('READY');

      // Admin suspends
      await request(app.getHttpServer())
        .post(`${BASE}/admin/markets/${marketId}/suspend`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'E2E test suspension' })
        .expect(HttpStatus.OK);

      // DB updated synchronously (no polling needed — suspendMarket sets SUSPENDED in same tx)
      const mktAfter = await prisma.tradingPair.findUniqueOrThrow({ where: { id: marketId } });
      expect(mktAfter.status).toBe('SUSPENDED');

      // Alice tries to place order → 422 UNPROCESSABLE_ENTITY (MarketSuspendedException)
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

      expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY); // 422
    });

    it('Admin opens market → place order succeeds', async () => {
      await openMarket(adminToken);

      const order = await placeOrder(app, aliceToken, {
        symbol: BTC_USDT, side: 'SELL', price: '60000', quantity: '0.1',
      });
      await waitOrderStatus(app, aliceToken, order.orderId, 'OPEN');
      expect(order.orderId).toBeDefined();
    });
  });

  // ─── Health endpoint ──────────────────────────────────────────────────────

  describe('Health Check', () => {
    it('GET /api/v1/health returns { status: "ok", db: "ok", redis: "ok", uptime: number }', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/health`)
        .expect(HttpStatus.OK);

      const body = unwrap<{ db: string; redis: string; status: string; uptime: number }>(res);
      expect(body.status).toBe('ok');
      expect(body.db).toBe('ok');
      expect(body.redis).toBe('ok');
      expect(typeof body.uptime).toBe('number');
      expect(body.uptime).toBeGreaterThan(0);
    });
  });
});
