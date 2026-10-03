# Next Steps Plan — Full Audit (2026-09-27)

## Tổng quan hiện trạng

| Sub-project                        | Build | Runtime | Notes                                |
| ---------------------------------- | ----- | ------- | ------------------------------------ |
| Backend API (Auth, Wallet, Orders) | ✅    | ✅      | Fully functional                     |
| Backend Worker                     | ❌    | ❌      | Won't compile; no logic              |
| Go Matching Engine                 | ❌    | ❌      | Builds but does nothing              |
| Smart Contracts                    | ✅    | ✅      | Tests pass                           |
| Docker Compose                     | ✅    | ⚠️      | Postgres+Redis only; no app services |

---

## 🔴 Critical Blockers (8) — App cannot function

### B1 — `price_heap.go`: `Swap()` value receiver → heap broken

**File:** `services/matching-engine/internal/orderbook/price_heap.go`

`Swap` is defined on a value receiver. The `container/heap` package requires a pointer receiver to mutate the slice. The heap **never maintains its invariant** — `BestPrice()` returns wrong values, matching produces incorrect trades.

**Fix:**

```go
// WRONG
func (h PriceHeap) Swap(i, j int) { h.levels[i], h.levels[j] = h.levels[j], h.levels[i] }

// CORRECT
func (h *PriceHeap) Swap(i, j int) { h.levels[i], h.levels[j] = h.levels[j], h.levels[i] }
```

---

### B2 — `transport/redis_customer.go`: `Run()` returns immediately; `dispatch()` is empty

**File:** `services/matching-engine/internal/transport/redis_customer.go`

`Run()` is a stub returning `nil`. Engine starts and exits immediately — zero messages processed.

**Must implement:**

1. `XGROUP CREATE stream:engine:commands matching-engine-v1 $ MKSTREAM` (idempotent)
2. `XREADGROUP GROUP matching-engine-v1 engine-1 COUNT 10 BLOCK 200ms STREAMS stream:engine:commands >`
3. Parse message fields → unmarshal `commandSeq`, `messageType`, `payload`
4. `dispatch()`: route by messageType → `HandleOpenMarket` / `HandlePlaceOrder` / `HandleCancelOrder`
5. `PublishBatch()` events → `XACK` only after successful publish
6. Get-or-create `PairEngine` by `partitionKey` (tradingPairId)

---

### B3 — `pair/events.go`: ALL 8 builder functions return `EventEnvelope{}`

**File:** `services/matching-engine/internal/pair/events.go`

Every single event builder returns an empty struct. Events published to Redis have no `messageId`, no `messageType`, empty payload. Backend worker receives garbage.

**Each builder must set:**

- `MessageID`: `uuid.New().String()`
- `MessageType`: e.g., `"MarketOpened"`, `"OrderOpened"`, `"TradeCreated"`, etc.
- `Version`: `1`
- `CorrelationID`: `uuid.New().String()`
- `OccurredAt`: `time.Now().UTC()`
- `PartitionKey`: `e.PairID`
- `CommandSequence`: `strconv.FormatUint(cmdSeq, 10)` (where applicable)
- `Payload`: event-specific struct (see below)

**Payload structs needed (add to `message/` package):**

```go
type MarketOpenedPayload struct {
    TradingPairID string    `json:"tradingPairId"`
    Market        string    `json:"market"`
    OpenedAt      time.Time `json:"openedAt"`
}
type OrderOpenedPayload struct {
    TradingPairID     string `json:"tradingPairId"`
    Market            string `json:"market"`
    OrderID           string `json:"orderId"`
    RemainingQuantity string `json:"remainingQuantity"`
    OpenedAt          time.Time `json:"openedAt"`
}
type TradeCreatedPayload struct {
    TradeID                    string    `json:"tradeId"`
    EngineMatchID              string    `json:"engineMatchId"`
    TradingPairID              string    `json:"tradingPairId"`
    Market                     string    `json:"market"`
    TradeSequence              string    `json:"tradeSequence"`
    MatchIndex                 int       `json:"matchIndex"`
    BuyOrderID                 string    `json:"buyOrderId"`
    SellOrderID                string    `json:"sellOrderId"`
    MakerOrderID               string    `json:"makerOrderId"`
    TakerOrderID               string    `json:"takerOrderId"`
    TakerSide                  string    `json:"takerSide"`
    ExecutionPrice             string    `json:"executionPrice"`
    ExecutedQuantity           string    `json:"executedQuantity"`
    BuyOrderRemainingQuantity  string    `json:"buyOrderRemainingQuantity"`
    SellOrderRemainingQuantity string    `json:"sellOrderRemainingQuantity"`
    MatchedAt                  time.Time `json:"matchedAt"`
}
type OrderCancelledPayload struct {
    TradingPairID     string    `json:"tradingPairId"`
    Market            string    `json:"market"`
    OrderID           string    `json:"orderId"`
    CancelledQuantity string    `json:"cancelledQuantity"`
    CancelledAt       time.Time `json:"cancelledAt"`
}
type EnginFailedPayload struct {
    TradingPairID  string    `json:"tradingPairId"`
    Market         string    `json:"market"`
    FailureCode    string    `json:"failureCode"`
    FailureMessage string    `json:"failureMessage"`
    FailedAt       time.Time `json:"failedAt"`
}
type OrderBookChangedPayload struct {
    TradingPairID string          `json:"tradingPairId"`
    Market        string          `json:"market"`
    BookSequence  string          `json:"bookSequence"`
    Bids          [][3]string     `json:"bids"` // [price, totalQty, count]
    Asks          [][3]string     `json:"asks"`
    ChangedAt     time.Time       `json:"changedAt"`
}
type OrderRejectedPayload struct {
    TradingPairID string    `json:"tradingPairId"`
    Market        string    `json:"market"`
    OrderID       string    `json:"orderId"`
    ReasonCode    string    `json:"reasonCode"`
    Reason        string    `json:"reason"`
    RejectedAt    time.Time `json:"rejectedAt"`
}
type CancelOrderRejectedPayload struct {
    TradingPairID string    `json:"tradingPairId"`
    Market        string    `json:"market"`
    OrderID       string    `json:"orderId"`
    ReasonCode    string    `json:"reasonCode"`
    Reason        string    `json:"reason"`
    RejectedAt    time.Time `json:"rejectedAt"`
}
```

---

### B4 — `outbox-poller.service.ts`: đã compile và wiring vào worker

**File:** `apps/backend/src/modules/outbox/outbox-poller.service.ts`

Đã hoàn thành:

- Inject `PrismaService` và Redis qua token `REDIS_CLIENT`.
- Định nghĩa `OutboxRow` và sửa toàn bộ syntax/type của query.
- `onApplicationBootstrap()` gọi `pollLoop()`, vòng lặp gọi `processBatch()`.
- Retry dùng `NOW() + (${delaySeconds} * INTERVAL '1 second')` thay vì nhét tham số vào string literal.
- `WorkerModule` import `RedisModule` và đăng ký `OutboxPollerService`.

Cheap check: `pnpm --filter @hau-cex/backend run build:worker` không còn lỗi ở B4; hiện chỉ còn 3 lỗi thuộc B5. Chưa có test runtime cho publish/retry/idempotency.

Implementation đã áp dụng:

```typescript
@Injectable()
export class OutboxPollerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private running = false;

  async onApplicationBootstrap() {
    this.running = true;
    void this.pollLoop();
  }
  async onApplicationShutdown() {
    this.running = false;
  }

  private async pollLoop() {
    while (this.running) {
      try {
        await this.processBatch();
      } catch (err) {
        this.logger.error("poll error", err);
      }
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private async processBatch() {
    await this.prisma.$transaction(async (tx) => {
      const rows: OutboxRow[] = await tx.$queryRaw`
        SELECT id, message_id, stream_name, partition_key,
               command_sequence, message_type, payload, retry_count
        FROM outbox_events
        WHERE status = 'PENDING'
          AND (next_retry_at IS NULL OR next_retry_at <= NOW())
        ORDER BY command_sequence ASC NULLS LAST, created_at ASC
        LIMIT 50
        FOR UPDATE SKIP LOCKED
      `;

      for (const row of rows) {
        try {
          await this.redis.xadd(
            row.stream_name,
            "*",
            "messageId",
            row.message_id,
            "messageType",
            row.message_type,
            "partitionKey",
            row.partition_key ?? "",
            "commandSeq",
            row.command_sequence?.toString() ?? "",
            "payload",
            JSON.stringify(row.payload),
          );
          await tx.$executeRaw`
            UPDATE outbox_events SET status = 'PUBLISHED', published_at = NOW()
            WHERE id = ${row.id}::uuid
          `;
        } catch (err) {
          const delay = [1, 2, 4, 8, 16][row.retry_count] ?? 30;
          await tx.$executeRaw`
            UPDATE outbox_events
            SET retry_count = retry_count + 1,
                last_error  = ${String(err)},
                next_retry_at = NOW() + INTERVAL '${delay} seconds',
                status = CASE WHEN retry_count + 1 >= 5 THEN 'FAILED'::outbox_status ELSE status END
            WHERE id = ${row.id}::uuid
          `;
        }
      }
    });
  }
}
```

---

### B5 — `open-market.bootstrap.service.ts`: syntax error + empty body

**File:** `apps/backend/src/modules/engine/open-market.bootstrap.service.ts`

`async;k` is invalid TypeScript — won't compile. Build worker hiện báo 3 lỗi ở file này: class không implement được `onApplicationBootstrap`, cùng với hai member ngầm định `async` và `k`. Entire class body missing.

Must implement `onApplicationBootstrap()` to:

1. Find all `TradingPair` where `status != READY`
2. For each pair, check if an `OPEN_MARKET` outbox event already exists (idempotency)
3. If not, call `nextCommandSequence(prisma, pair.id)` and create the outbox record

---

### B6 — `schema.prisma`: Prisma 7 đã chuyển URL sang config

**File:** `apps/backend/prisma/schema.prisma`

`datasource db` block is missing `url = env("DATABASE_URL")`. `prisma migrate` and `prisma generate` will fail without it.

`prisma.config.ts` hiện đã khai báo `datasource.url = env('DATABASE_URL')`. Trong Prisma 7, `url` bị comment trong `schema.prisma` là đúng theo migration mới, nên B6 không còn là blocker hiện tại và không cần áp dụng fix cũ.

Không áp dụng đoạn fix cũ:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

### B7 — `message/command.go`: `OpenMarketCommand` fields unexported

**File:** `services/matching-engine/internal/message/command.go`

`tradingPairID`, `market`, `tickSize` are unexported. JSON deserialization from Redis will silently set them to zero values.

Also: typo `RequestdBy` → should be `RequestedBy`.

**Fix:** Export all fields and add `json:` struct tags:

```go
type OpenMarketCommand struct {
    TradingPairID  string        `json:"tradingPairId"`
    Market         string        `json:"market"`
    TickSize       fixed.Decimal `json:"tickSize"`
    MinQuantity    fixed.Decimal `json:"minQuantity"`
    MinNotional    fixed.Decimal `json:"minNotional"`
}
type CancelOrderCommand struct {
    TradingPairID string `json:"tradingPairId"`
    Market        string `json:"market"`
    OrderID       string `json:"orderId"`
    UserID        string `json:"userId"`
    RequestedBy   string `json:"requestedBy"`
}
```

Also: all command structs need `json:` tags on all fields.

---

### B8 — `main.go`: `REDIS_URL` used as `Addr` (URL vs host:port)

**File:** `services/matching-engine/cmd/engine/main.go`

`go-redis` `Addr` expects `host:port`, not a `redis://...` URL. If env var is `redis://localhost:6379`, the client silently fails to connect.

**Fix — option A** (parse URL):

```go
opt, err := redis.ParseURL(os.Getenv("REDIS_URL"))
if err != nil { log.Fatal(err) }
redisClient := redis.NewClient(opt)
```

**Fix — option B** (use separate `REDIS_ADDR` env var):

```go
redisClient := redis.NewClient(&redis.Options{Addr: os.Getenv("REDIS_ADDR")})
```

---

## 🟠 High — Logic bugs

### H1 — `orders.service.ts`: messageType case mismatch

`placeOrder` writes `messageType: 'PlaceOrder'` but Go engine constant is `"PLACE_ORDER"`. Same for `CancelOrder` / `"CANCEL_ORDER"`.

**Fix:** Standardize to camelCase `"PlaceOrder"`, `"CancelOrder"`, `"OpenMarket"` — update both Go constants in `command.go` AND the transport dispatch switch.

> The spec (`09-internal-message-contract.md`) uses PascalCase: `PlaceOrder`, `CancelOrder`, `OpenMarket`. **NestJS is correct. Go constants must change.**

```go
// command.go — fix constants
const (
    CommandOpenMarket    CommandType = "OpenMarket"
    CommandPlaceOrder    CommandType = "PlaceOrder"
    CommandCancelOrder   CommandType = "CancelOrder"
)
```

### H2 — `fixed/decimal.go`: nil pointer panic on zero-value `Decimal{}`

Any `Decimal{}` without `Zero()` has `raw = nil`. Calling `.IsZero()`, `.Add()`, `.Cmp()`, `.String()` will panic.

**Fix:** Add nil guard in all methods:

```go
func (d Decimal) IsZero() bool {
    return d.raw == nil || d.raw.Sign() == 0
}
func (d Decimal) Add(other Decimal) Decimal {
    a := d.raw; if a == nil { a = big.NewInt(0) }
    b := other.raw; if b == nil { b = big.NewInt(0) }
    return Decimal{raw: new(big.Int).Add(a, b)}
}
// etc.
```

Also add `Mul` for fee/notional calculation (needed in Phase 7):

```go
func (d Decimal) Mul(other Decimal) Decimal {
    r := new(big.Int).Mul(d.raw, other.raw)
    r.Div(r, scaleInt) // scale down by 10^18
    return Decimal{raw: r}
}
```

### H3 — `pair/engine.go`: `InFlightBatch` defined but never used

`InFlight *InFlightBatch` field exists for retry-on-crash semantics, but the transport layer never reads it. Either implement or remove.

For MVP: implement in `dispatch()` — store events in `InFlight` before publishing, clear after XACK.

---

## 🟡 Medium — Refactoring / Quality

### M1 — `worker.module.ts`: must wire providers

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    PrismaModule,
    RedisModule, // ← ADD
  ],
  providers: [
    OpenMarketBootstrapService, // ← ADD
    OutboxPollerService, // ← ADD
    EngineEventConsumerService, // ← ADD (new file, see below)
  ],
})
export class WorkerModule {}
```

### M2 — `EngineEventConsumerService` doesn't exist yet

Must create: `src/modules/engine-events/engine-event-consumer.service.ts`

Responsibilities:

- `XREADGROUP GROUP backend-engine-events-v1 backend-1 STREAMS stream:engine:events >`
- Per message: check `processed_events` idempotency → dispatch by `messageType`:
  - `MarketOpened` → `UPDATE trading_pairs SET status='READY'`
  - `OrderOpened` → `UPDATE orders SET status='OPEN' WHERE status='PENDING'`
  - `OrderRejected` → `UPDATE orders SET status='REJECTED' WHERE status='PENDING'`
  - `EngineFailed` → `UPDATE trading_pairs SET status='SUSPENDED'`
  - `TradeCreated` / `OrderCancelled` / `OrderBookChanged` → **log + skip** (Phase 7/9)
- `XACK` after commit

### M3 — `matching/matcher.go`: unused `cmdSeq` parameter

```go
// Remove unused param — engine.go passes it but matcher doesn't need it
func Match(book *orderbook.OrderBook, incoming *orderbook.Order) MatchResult {
```

### M4 — `side_book.go` + `price_heap.go`: inconsistent API

- `GetLevels(price string)` vs `GetOrCreateLevel(price fixed.Decimal)` — standardize to `fixed.Decimal`
- `side` field in `SideBook` is stored but never read — remove or use

### M5 — `publisher.go`: silent `json.Marshal` error

```go
// Before
payload, _ := json.Marshal(event.Payload)

// After
payload, err := json.Marshal(event.Payload)
if err != nil {
    return fmt.Errorf("marshal payload for %s: %w", event.MessageType, err)
}
```

### M6 — Add `Dockerfile` for Go engine + add to `docker-compose.yml`

```dockerfile
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o engine ./cmd/engine

FROM alpine:3.20
WORKDIR /app
COPY --from=builder /app/engine .
CMD ["./engine"]
```

```yaml
# docker-compose.yml
matching-engine:
  build:
    context: ./services/matching-engine
    dockerfile: Dockerfile
  environment:
    REDIS_URL: redis://redis:6379
  depends_on:
    redis:
      condition: service_healthy
  restart: unless-stopped
```

---

## Prioritized Implementation Order

```
=== PHASE 6 COMPLETION ===

Step 1  [5 min]   Fix schema.prisma: add url = env("DATABASE_URL") to datasource
Step 2  [5 min]   Fix price_heap.go: Swap() value receiver → pointer receiver (B1)
Step 3  [15 min]  Fix message/command.go: export fields, add json tags, fix typo, fix constants (B7+H1)
Step 4  [30 min]  Fix fixed/decimal.go: nil guards, add Mul, MustParse (H2)
Step 5  [2 hrs]   Implement pair/events.go: all 8 builders with real payloads (B3)
Step 6  [2 hrs]   Implement transport/redis_customer.go: Run() + dispatch() (B2)
Step 7  [30 min]  Fix cmd/engine/main.go: redis.ParseURL, health ping (B8)
Step 8  [verify]  go build ./... → must pass, go test ./... → must pass

Step 9  [30 min]  Fix open-market.bootstrap.service.ts: full implementation (B5)
Step 10 [2 hrs]   Implement outbox-poller.service.ts: full polling loop (B4)
Step 11 [2 hrs]   Create engine-event-consumer.service.ts (M2)
Step 12 [15 min]  Wire worker.module.ts (M1)
Step 13 [verify]  tsc --noEmit → must pass, nest build → must pass

Step 14 [15 min]  Add Dockerfile + matching-engine to docker-compose.yml (M6)
Step 15 [30 min]  Integration test: docker compose up → seed → verify MarketOpened→READY, PlaceOrder→OPEN

=== PHASE 7 (AFTER PHASE 6 DONE) ===

Step 16  TradeCreated consumer: settlement transaction
         - Lock orders by id ASC
         - Lock wallets (buyer, seller, treasury) by id ASC
         - Compute quoteAmount = executionPrice × executedQuantity
         - Compute fees (buyer: base asset, seller: quote asset)
         - INSERT trade (engineMatchId as dedup key)
         - UPDATE orders (filledQuantity, remainingQuantity, remainingLockedAmount, status)
         - UPDATE wallets (available/locked)
         - INSERT ledger_entries (TRADE_SETTLEMENT + TRADING_FEE per side)
         - INSERT outbox_events (TradeSettled, OrderUpdated, BalanceUpdated)
         - INSERT processed_events
         - Commit → XACK

Step 17  OrderRejected consumer: unlock wallet balance
         - UPDATE orders SET status='REJECTED'
         - moveLockedToAvailable (amount = remainingLockedAmount)
         - INSERT ledger_entries ORDER_UNLOCK
         - Commit → XACK

Step 18  OrderCancelled consumer: unlock remaining locked
         - UPDATE orders SET status='CANCELLED'
         - moveLockedToAvailable (amount = remainingLockedAmount)
         - INSERT ledger_entries ORDER_UNLOCK
         - Commit → XACK

Step 19  fixed.Decimal.Mul() needed for: quoteAmount, fee calculations

Step 20  wallet-balance.service.ts: add settleTrade() method
         (atomic: debitLocked seller quote, creditAvailable buyer base, fee splits)
```

---

## Go Unit Tests Needed

```
internal/fixed/decimal_test.go
  - Parse valid string
  - Parse with fewer than 18 decimals
  - Add, Sub, Cmp
  - Mul (scale correctness)
  - Zero-value nil safety
  - String() round-trip

internal/orderbook/price_heap_test.go
  - heap.Init + Push + Pop maintains max/min invariant (was broken by B1)
  - Swap correctness after fix

internal/matching/matcher_test.go
  - No match: OrderOpened only
  - Full fill: TradeCreated only, no OrderOpened
  - Partial fill: TradeCreated + OrderOpened with correct remaining
  - FIFO: same price, earlier orderSeq fills first
  - Price priority: better price fills first
  - Multi-match: one incoming fills multiple resting
  - Cancel: RemoveOrder works correctly
```

---

## Definition of Done — Phase 6

- [ ] `go build ./...` passes with 0 errors
- [ ] `go test ./...` passes (matcher + decimal + heap)
- [ ] `tsc --noEmit` passes with 0 errors
- [ ] `docker compose up` starts Postgres + Redis + Go Engine
- [ ] Seed runs: `pnpm db:seed` creates sequences + trading pairs
- [ ] Worker starts: `OpenMarketBootstrapService` creates Outbox `OpenMarket`
- [ ] Outbox poller pushes `OpenMarket` to Redis stream
- [ ] Go engine consumes → publishes `MarketOpened`
- [ ] Backend worker consumes `MarketOpened` → `TradingPair.status = READY`
- [ ] `POST /orders` → Order `PENDING` + Outbox `PlaceOrder`
- [ ] Outbox poller pushes `PlaceOrder` → Engine publishes `OrderOpened`
- [ ] Backend worker → `Order.status = OPEN`
- [ ] Duplicate `messageId` → idempotent skip
