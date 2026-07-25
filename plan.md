# Phase 5 — Order API & Outbox (Revised)

> **3 vấn đề đã sửa so với v1:**
>
> 1. Sequence bottleneck → PostgreSQL SEQUENCE `nextval()` thay vì UPDATE table
> 2. Race condition cancel → `SELECT FOR UPDATE` trước khi check status
> 3. Fee model clarification — buyer fee từ Base, không cần include fee vào lock
> 4. Idempotency trade-off ghi nhận

---

## 1. Mục Tiêu

Backend tạo Order, lock balance và ghi Outbox trong một PostgreSQL transaction atomic.
Order nằm ở `PENDING` đến khi Phase 6 (Engine Messaging) hoàn thiện.

---

## 2. Scope

**Thuộc Phase này:** `POST /orders`, `GET /orders/active`, `GET /orders`, `GET /orders/:orderId`, `POST /orders/:orderId/cancel`

**Không thuộc Phase này:** Engine nhận Outbox (P6), Settlement (P7), Unlock khi cancel (P8)

---

## 3. Cấu Trúc Thư Mục

```
src/modules/orders/
├── orders.module.ts
├── orders.controller.ts
├── orders.service.ts           # PlaceOrder + CancelOrder transactions
├── order-query.service.ts      # Read-only queries
├── dto/
│   ├── create-order.dto.ts
│   ├── order-response.dto.ts
│   ├── order-list-query.dto.ts
│   └── active-order-query.dto.ts
└── types/
    └── order-outbox.types.ts

src/common/helpers/
├── idempotency.helper.ts       # SHA-256 payload hash
└── sequence.helper.ts          # nextval() wrapper
```

---

## 4. Validation Rules

```
price > 0
quantity > 0
price % tickSize == 0
quantity % stepSize == 0
quantity >= minQuantity
price * quantity >= minNotional
type == 'LIMIT'   (MVP only)
```

**Bắt buộc dùng `Prisma.Decimal` — không dùng JS `number` cho bất kỳ phép toán tài chính nào.**

---

## 5. Lock Amount — Fee Model (Clarification)

Theo docs/05 §16: **Buyer fee thu bằng Base Asset, Seller fee thu bằng Quote Asset.**

Fee KHÔNG lấy từ asset bị lock — lấy từ asset được nhận tại Settlement.

```
BUY  → lock Quote (USDT):  lockedAmount = price * quantity
SELL → lock Base (BTC):    lockedAmount = quantity
```

Không cần cộng fee vào `lockedAmount`.

> **Lưu ý Settlement (Phase 7):** Buyer không trừ `executionPrice * qty` mà trừ `limitPrice * qty` từ locked.
> Phần chênh lệch `quoteRefund = (limitPrice - executionPrice) * qty` được hoàn về `available`.

---

## 6. Idempotency

**Header:** `Idempotency-Key: <UUID>` (client sinh, unique per request)

**Payload hash** — canonicalize: `symbol|side|type|price.toFixed(18)|quantity.toFixed(18)`, hash SHA-256:

```typescript
// src/common/helpers/idempotency.helper.ts
import { createHash } from "node:crypto";
import { Prisma } from "../../generated/prisma";

export function hashOrderPayload(
  symbol: string,
  side: string,
  type: string,
  price: Prisma.Decimal,
  quantity: Prisma.Decimal,
): string {
  const raw = `${symbol}|${side}|${type}|${price.toFixed(18)}|${quantity.toFixed(18)}`;
  return createHash("sha256").update(raw).digest("hex");
}
```

**Logic check:**

```
findUnique(userId, idempotencyKey)
  → null                → tạo mới
  → exists + hash khớp  → return existing order (200, idempotent)
  → exists + hash khác  → IdempotencyConflictException (409)
```

> **Trade-off MVP:** `idempotencyKey` lưu trong DB (đã có trong schema). Technical debt — production nên dùng Redis TTL 1h.

---

## 7. [FIX #1] Sequence — PostgreSQL SEQUENCE Objects

### Vấn đề của UPDATE table

```sql
UPDATE order_sequences SET last_value = last_value + 1
WHERE trading_pair_id = $1 RETURNING last_value
```

Row-level lock trong suốt duration của main transaction (~10-50ms) → 1000 concurrent requests serialize → timeout/deadlock.

### Giải pháp: `nextval()`

PostgreSQL SEQUENCE dùng **internal lightweight mutex**, không phải row lock, **không rollback** khi transaction abort.

**Tạo sequences khi tạo TradingPair** (thêm vào `seed.ts` và Admin API Phase 10):

```typescript
const safeId = pair.id.replace(/-/g, "_"); // UUID chỉ có [0-9a-f-] → safe
await prisma.$executeRawUnsafe(`
  CREATE SEQUENCE IF NOT EXISTS "order_seq_${safeId}" START 1;
  CREATE SEQUENCE IF NOT EXISTS "cmd_seq_${safeId}" START 1;
`);
```

**sequence.helper.ts:**

```typescript
// src/common/helpers/sequence.helper.ts
import { Prisma } from "../../generated/prisma";

export async function nextOrderSequence(
  tx: PrismaTx,
  tradingPairId: string,
): Promise<bigint> {
  const seqName = `order_seq_${tradingPairId.replace(/-/g, "_")}`;
  const rows = await tx.$queryRaw<[{ nextval: bigint }]>(
    Prisma.sql`SELECT nextval(${seqName}::regclass) AS nextval`,
  );
  return rows[0].nextval;
}

export async function nextCommandSequence(
  tx: PrismaTx,
  tradingPairId: string,
): Promise<bigint> {
  const seqName = `cmd_seq_${tradingPairId.replace(/-/g, "_")}`;
  const rows = await tx.$queryRaw<[{ nextval: bigint }]>(
    Prisma.sql`SELECT nextval(${seqName}::regclass) AS nextval`,
  );
  return rows[0].nextval;
}
```

Notes:

- `Prisma.sql` parameterizes `seqName` → `$1` → safe, không SQL injection
- `::regclass`: PostgreSQL resolve sequence name → OID, error nếu không tồn tại → fail fast
- Sequence gap khi tx rollback → chấp nhận được (sequences không cần liên tục)
- Bảng `order_sequences`, `engine_command_sequences` giữ nguyên trong schema nhưng không dùng nữa ở Phase 5+

---

## 8. PlaceOrder Transaction (9 bước)

```typescript
async placeOrder(userId: string, idempotencyKey: string, dto: CreateOrderDto) {
  const orderId = uuidv7()  // ← Generate TRƯỚC transaction, dùng làm operationId

  return this.prisma.$transaction(async (tx) => {
    // 1. Idempotency check
    const existing = await tx.order.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    })
    if (existing) {
      const hash = hashOrderPayload(dto.symbol, dto.side, dto.type,
        new Prisma.Decimal(dto.price), new Prisma.Decimal(dto.quantity))
      if (existing.idempotencyPayloadHash === hash)
        return { orderId: existing.id, status: existing.status }
      throw new IdempotencyConflictException()
    }

    // 2. Validate TradingPair
    const pair = await tx.tradingPair.findUnique({ where: { symbol: dto.symbol } })
    if (!pair) throw new MarketNotFoundException()
    if (pair.status === TradingPairStatus.SUSPENDED) throw new MarketSuspendedException()
    if (pair.status !== TradingPairStatus.READY) throw new MarketNotReadyException()

    // 3. Validate tick / step / min
    const price    = new Prisma.Decimal(dto.price)
    const quantity = new Prisma.Decimal(dto.quantity)
    if (price.lte(0))                               throw new ValidationException('price > 0')
    if (quantity.lte(0))                            throw new ValidationException('quantity > 0')
    if (!price.mod(pair.tickSize).isZero())         throw new ValidationException('invalid tickSize')
    if (!quantity.mod(pair.stepSize).isZero())      throw new ValidationException('invalid stepSize')
    if (quantity.lt(pair.minQuantity))              throw new ValidationException('quantity < minQuantity')
    if (price.mul(quantity).lt(pair.minNotional))   throw new ValidationException('notional < minNotional')

    // 4. Lock amount
    const isBuy         = dto.side === OrderSide.BUY
    const lockedAssetId = isBuy ? pair.quoteAssetId : pair.baseAssetId
    const lockedAmount  = isBuy ? price.mul(quantity) : quantity

    // 5. Wallet lock + 2 LedgerEntry ORDER_LOCK
    const wallet = await this.walletsService.findWalletByAssetId(userId, lockedAssetId)
    await this.walletBalanceService.moveAvailableToLocked(tx, {
      walletId: wallet.id, amount: lockedAmount,
      operationId: orderId, referenceType: 'ORDER', referenceId: orderId,
    })

    // 6. orderSequence — non-blocking nextval()
    const orderSeq = await nextOrderSequence(tx, pair.id)

    // 7. Order PENDING
    const order = await tx.order.create({ data: {
      id: orderId, userId, tradingPairId: pair.id,
      side: dto.side, status: OrderStatus.PENDING,
      price, quantity,
      filledQuantity:        new Prisma.Decimal(0),
      remainingQuantity:     quantity,
      lockedAssetId, lockedAmount, remainingLockedAmount: lockedAmount,
      orderSequence: orderSeq, idempotencyKey,
      idempotencyPayloadHash: hashOrderPayload(dto.symbol, dto.side, dto.type, price, quantity),
    }})

    // 8. commandSequence — non-blocking nextval()
    const cmdSeq = await nextCommandSequence(tx, pair.id)

    // 9. Outbox PlaceOrder
    await tx.outboxEvent.create({ data: {
      messageId: uuidv7(), version: 1, correlationId: uuidv7(),
      streamName: 'stream:engine:commands', messageType: 'PlaceOrder',
      partitionKey: pair.id, commandSequence: cmdSeq, occurredAt: new Date(),
      payload: {
        tradingPairId: pair.id, market: pair.symbol,
        orderId: order.id, userId, side: dto.side, type: 'LIMIT',
        price: price.toFixed(18), quantity: quantity.toFixed(18),
        orderSequence: orderSeq.toString(), createdAt: order.createdAt.toISOString(),
      },
    }})

    return { orderId: order.id, status: order.status }
  }, { timeout: 10_000 })
}
```

---

## 9. [FIX #2] CancelOrder — SELECT FOR UPDATE

### Vấn đề race condition

```
T=0ms  Cancel API:    reads order → status=OPEN
T=1ms  Settlement:    fills order → status=FILLED, balance debited
T=2ms  Cancel API:    writes status=CANCEL_PENDING → ghi đè lên FILLED
Kết quả: order báo "đang hủy" nhưng tiền đã bị trừ
```

### Fix: FOR UPDATE lock trước khi check status

```typescript
async cancelOrder(userId: string, orderId: string) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Lock row — ngăn Settlement race
    const rows = await tx.$queryRaw<
      { id: string; user_id: string; status: string; trading_pair_id: string }[]
    >`SELECT id, user_id, status, trading_pair_id
      FROM orders WHERE id = ${orderId}::uuid
      FOR UPDATE`

    const order = rows[0]
    if (!order || order.user_id !== userId) throw new OrderNotFoundException()

    // 2. Validate status SAU KHI đã lock
    const cancellable = [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED]
    if (!cancellable.includes(order.status as OrderStatus))
      throw new OrderNotCancellableException()

    // 3. Update sang CANCEL_PENDING
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCEL_PENDING },
    })

    // 4. commandSequence
    const cmdSeq = await nextCommandSequence(tx, order.trading_pair_id)

    // 5. Outbox CancelOrder
    await tx.outboxEvent.create({ data: {
      messageId: uuidv7(), version: 1, correlationId: uuidv7(),
      streamName: 'stream:engine:commands', messageType: 'CancelOrder',
      partitionKey: order.trading_pair_id, commandSequence: cmdSeq, occurredAt: new Date(),
      payload: {
        tradingPairId: order.trading_pair_id, orderId, userId,
        requestedBy: 'USER', requestedAt: new Date().toISOString(),
      },
    }})

    return { orderId, status: updated.status }
  })
}
```

> Khi Cancel giữ `FOR UPDATE` lock → Settlement phải chờ.
> Khi Settlement giữ lock → Cancel phải chờ.
> Không có race window.

---

## 10. OrderQueryService

```typescript
// getActiveOrders
findMany({
  where: {
    userId,
    status: { in: [PENDING, OPEN, PARTIALLY_FILLED, CANCEL_PENDING] },
    ...(symbol && { tradingPair: { symbol } }),
  },
  orderBy: { createdAt: "desc" },
});

// getOrderHistory — cursor (createdAt DESC, id DESC), dùng lại encodeCursor/decodeCursor
// getOrderById — throw 404 nếu order.userId !== userId
```

---

## 11. Controller — Thứ Tự Route Quan Trọng

```typescript
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  @Post()
  placeOrder(@Headers('idempotency-key') key: string, ...) {
    if (!key?.trim()) throw new BadRequestException({ error: { code: 'VALIDATION_ERROR', message: 'Idempotency-Key required' } })
    return this.ordersService.placeOrder(...)
  }

  @Get('active')      // ← PHẢI trước @Get(':orderId')
  getActiveOrders(...) {}

  @Get()
  getOrderHistory(...) {}

  @Get(':orderId')    // ← PHẢI sau @Get('active')
  getOrderById(...) {}

  @Post(':orderId/cancel')
  @HttpCode(HttpStatus.OK)
  cancelOrder(...) {}
}
```

---

## 12. Exceptions Cần Tạo (7 files)

```
src/common/exceptions/
├── market-not-found.exception.ts        # 404
├── market-not-ready.exception.ts        # 422 MARKET_NOT_READY
├── market-suspended.exception.ts        # 422 MARKET_SUSPENDED
├── idempotency-conflict.exception.ts    # 409 IDEMPOTENCY_CONFLICT
├── order-not-found.exception.ts         # 404 ORDER_NOT_FOUND
├── order-not-cancellable.exception.ts   # 422 ORDER_NOT_CANCELLABLE
└── validation.exception.ts             # 422 VALIDATION_ERROR
```

Format: `{ error: { code: '...', message: '...' } }`

---

## 13. Definition of Done

### Core

- [ ] PlaceOrder: Order PENDING + 2 LedgerEntry ORDER_LOCK + Outbox
- [ ] Sequences dùng `nextval()`, không UPDATE table
- [ ] Idempotency: same key+payload → 200; same key+diff payload → 409
- [ ] Cancel: `FOR UPDATE` trước check status
- [ ] Cancel: PENDING/FILLED/CANCELLED/REJECTED → 422
- [ ] Cancel order của user khác → 404
- [ ] Market không READY → 422; Balance không đủ → 422
- [ ] Thiếu Idempotency-Key → 400
- [ ] Transaction rollback toàn bộ khi bất kỳ bước fail

### Query

- [ ] GET /orders/active: đúng 4 statuses, chỉ của user hiện tại
- [ ] Route `active` match trước `:orderId`
- [ ] Cursor pagination ổn định

### Build

- [ ] TypeScript clean, ESLint pass
- [ ] PostgreSQL sequences tồn tại trước khi PlaceOrder

---

## 14. Thứ Tự Implement

```
1.  7 Exceptions
2.  helpers/idempotency.helper.ts
3.  helpers/sequence.helper.ts         ← nextval()
4.  seed.ts: thêm CREATE SEQUENCE
5.  DTOs (4 files)
6.  OrderQueryService
7.  OrdersService.placeOrder
8.  OrdersService.cancelOrder
9.  OrdersController
10. OrdersModule + AppModule
11. Test manual
```
