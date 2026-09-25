# Next Steps Plan — Phase 6 Completion & Phase 7 Preparation

## Current State Audit

### ✅ Done & Buildable

| Component                                     | Status                  |
| --------------------------------------------- | ----------------------- |
| Backend API (Auth, Wallet, Ledger, Order API) | ✅ Builds clean         |
| Prisma Schema (all models)                    | ✅ Complete             |
| Seed (sequences, trading pairs, wallets)      | ✅ Complete             |
| `RedisModule` (NestJS)                        | ✅ Done                 |
| `OrderBook` data structures (Go)              | ✅ Done                 |
| `Matcher` algorithm (Go)                      | ✅ Done (logic correct) |
| `fixed.Decimal` (Go)                          | ✅ Done                 |
| Docker Compose (Postgres + Redis)             | ✅ Done                 |

### ❌ Broken / Incomplete — Must Fix Before Anything Else

#### Go Engine (`services/matching-engine`)

| File                           | Issue                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `cmd/engine/main.go`           | `redis` and `consumer` packages imported but undefined — **compile error**                                                                  |
| `internal/pair/engine.go`      | `HandleOpenMarket` body empty, `HandlePlaceOrder` has syntax error (`buil` incomplete), `HandleCancelOrder` has no body — **compile error** |
| `internal/message/envelope.go` | Only `EventEnvelope` defined — missing `MessageEnvelope` (used by `pair/engine.go`)                                                         |
| Missing packages               | `internal/publisher/`, `internal/transport/` don't exist yet                                                                                |
| `go.mod`                       | `go 1.26.4` invalid (Go 1.26 doesn't exist) — should be `1.23`                                                                              |

#### Backend Worker (NestJS)

| File                                              | Issue                                                                                              |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `modules/engine/open-market.bootstrap.service.ts` | Body is `async;k` — **compile error**, completely broken                                           |
| `modules/outbox/outbox-poller.service.ts`         | **Empty file** — nothing implemented                                                               |
| `worker.module.ts`                                | Still bare skeleton — `RedisModule`, `OutboxPollerService`, `OpenMarketBootstrapService` NOT wired |
| `modules/engine-events/`                          | **Directory doesn't exist** — `EngineEventConsumerService` not created                             |

---

## Step-by-Step Plan

---

### STEP 1 — Fix Go `go.mod` and `message` package

**`go.mod`** — fix Go version:

```
go 1.23
```

Then add Redis dependency:

```bash
go get github.com/redis/go-redis/v9
go get github.com/google/uuid
```

**`internal/message/envelope.go`** — add `MessageEnvelope` alias (engine.go references it):

```go
// MessageEnvelope = EventEnvelope (rename for clarity or alias)
type MessageEnvelope = EventEnvelope
```

---

### STEP 2 — Complete `internal/pair/engine.go`

Three handlers need full implementation:

**`HandleOpenMarket`:**

```go
func (e *PairEngine) HandleOpenMarket(cmd message.OpenMarketCommand, cmdSeq uint64) []message.EventEnvelope {
    if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
        return nil
    } else if err == ErrSequenceGap {
        e.State = StateFailed
        return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP")}
    }
    e.State = StateReady
    e.LastProcessedCmdSeq = cmdSeq
    return []message.EventEnvelope{buildMarketOpened(e)}
}
```

**`HandlePlaceOrder`** (fix syntax error + complete):

```go
func (e *PairEngine) HandlePlaceOrder(cmd message.PlaceOrderCommand, cmdSeq uint64) []message.EventEnvelope {
    if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
        return nil
    } else if err == ErrSequenceGap {
        e.State = StateFailed
        return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP")}
    }
    if e.State != StateReady {
        return []message.EventEnvelope{buildOrderRejected(cmd, "MARKET_NOT_READY")}
    }

    incoming := &orderbook.Order{
        OrderID: cmd.OrderID, UserID: cmd.UserID,
        Side: cmd.Side, Price: cmd.Price,
        OriginalQuantity: cmd.Quantity, RemainingQuantity: cmd.Quantity,
        OrderSeq: cmd.OrderSeq,
    }

    result := matching.Match(e.Book, incoming, cmdSeq)
    var events []message.EventEnvelope

    for _, trade := range result.Trades {
        e.LastTradeSequence++
        engineMatchId := fmt.Sprintf("%s:%d:%d", e.PairID, cmdSeq, trade.MatchIndex)
        events = append(events, buildTradeCreated(e, trade, engineMatchId, cmdSeq))
    }

    if !result.IncomingFull {
        events = append(events, buildOrderOpened(e, cmd, incoming.RemainingQuantity))
    }

    e.LastBookSequence++
    events = append(events, buildOrderBookChanged(e))
    e.LastProcessedCmdSeq = cmdSeq
    return events
}
```

**`HandleCancelOrder`:**

```go
func (e *PairEngine) HandleCancelOrder(cmd message.CancelOrderCommand, cmdSeq uint64) []message.EventEnvelope {
    if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
        return nil
    } else if err == ErrSequenceGap {
        e.State = StateFailed
        return []message.EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP")}
    }
    if e.State != StateReady {
        return []message.EventEnvelope{buildCancelOrderRejected(cmd, "MARKET_NOT_READY")}
    }

    order, ok := e.Book.ActiveOrders[cmd.OrderID]
    if !ok {
        return []message.EventEnvelope{buildCancelOrderRejected(cmd, "ORDER_NOT_FOUND")}
    }

    e.Book.RemoveOrder(cmd.OrderID)
    e.LastBookSequence++
    e.LastProcessedCmdSeq = cmdSeq

    return []message.EventEnvelope{
        buildOrderCancelled(e, cmd, order.RemainingQuantity),
        buildOrderBookChanged(e),
    }
}
```

Also need event builder functions in `pair/events.go`:

- `buildMarketOpened`, `buildEngineFailed`, `buildOrderRejected`
- `buildTradeCreated`, `buildOrderOpened`, `buildOrderBookChanged`
- `buildOrderCancelled`, `buildCancelOrderRejected`

---

### STEP 3 — Create `internal/publisher/redis_publisher.go`

```go
package publisher

import (
    "context"
    "encoding/json"
    "github.com/redis/go-redis/v9"
    "github.com/TrVHau/.../message"
)

type Publisher struct { client *redis.Client }

func New(client *redis.Client) *Publisher { return &Publisher{client: client} }

func (p *Publisher) PublishBatch(ctx context.Context, events []message.EventEnvelope) error {
    pipe := p.client.Pipeline()
    for _, ev := range events {
        payload, _ := json.Marshal(ev.Payload)
        pipe.XAdd(ctx, &redis.XAddArgs{
            Stream: "stream:engine:events",
            Values: map[string]any{
                "messageId":    ev.MessageID,
                "messageType":  ev.MessageType,
                "partitionKey": ev.PartitionKey,
                "commandSeq":   ev.CommandSequence,
                "payload":      string(payload),
            },
        })
    }
    _, err := pipe.Exec(ctx)
    return err
}
```

---

### STEP 4 — Create `internal/transport/redis_consumer.go`

```go
package transport

type Consumer struct {
    redis     *redis.Client
    publisher *publisher.Publisher
    engines   map[string]*pair.PairEngine // pairId → engine
}

func (c *Consumer) Run(ctx context.Context) error {
    // 1. XGROUP CREATE stream:engine:commands matching-engine-v1 $ MKSTREAM
    // 2. XREADGROUP loop → parse envelope → dispatch to PairEngine
    // 3. Publish events → XACK
}

func (c *Consumer) dispatch(ctx context.Context, msg redis.XMessage) {
    // Parse partitionKey as pairId
    // Get or create PairEngine for pairId
    // Parse messageType → route to HandleOpenMarket / HandlePlaceOrder / HandleCancelOrder
    // Publish event batch
    // XACK
}
```

---

### STEP 5 — Complete `cmd/engine/main.go`

```go
func main() {
    redisClient := redis.NewClient(&redis.Options{Addr: os.Getenv("REDIS_URL")})
    pub := publisher.New(redisClient)
    consumer := transport.New(redisClient, pub)

    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    log.Println("Matching Engine started")
    if err := consumer.Run(ctx); err != nil {
        log.Fatal(err)
    }
}
```

**Verify:** `go build ./...` must pass with 0 errors.

---

### STEP 6 — Fix `open-market.bootstrap.service.ts`

Current file body is `async;k` — completely broken. Rewrite:

```typescript
@Injectable()
export class OpenMarketBootstrapService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    @Inject("REDIS_CLIENT") private readonly redis: Redis,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const pairs = await this.prisma.tradingPair.findMany({
      where: { status: { not: TradingPairStatus.READY } },
    });

    for (const pair of pairs) {
      const existing = await this.prisma.outboxEvent.findFirst({
        where: {
          messageType: "OpenMarket",
          partitionKey: pair.id,
          status: { in: [OutboxStatus.PENDING, OutboxStatus.PUBLISHED] },
        },
      });
      if (existing) continue;

      const cmdSeq = await nextCommandSequence(this.prisma as any, pair.id);
      await this.prisma.outboxEvent.create({
        data: {
          messageId: uuidv7(),
          version: 1,
          correlationId: uuidv7(),
          streamName: "stream:engine:commands",
          messageType: "OpenMarket",
          partitionKey: pair.id,
          commandSequence: cmdSeq,
          occurredAt: new Date(),
          payload: {
            tradingPairId: pair.id,
            market: pair.symbol,
            baseAssetId: pair.baseAssetId,
            quoteAssetId: pair.quoteAssetId,
            pricePrecision: 18,
            quantityPrecision: 18,
            tickSize: pair.tickSize.toFixed(18),
            stepSize: pair.stepSize.toFixed(18),
            minQuantity: pair.minQuantity.toFixed(18),
            minNotional: pair.minNotional.toFixed(18),
            openedAt: new Date().toISOString(),
          },
        },
      });
      this.logger.log(`Created OpenMarket outbox for pair: ${pair.symbol}`);
    }
  }
}
```

---

### STEP 7 — Implement `outbox-poller.service.ts`

Core logic (currently empty file):

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
        this.logger.error("Outbox poll error", err);
      }
      await sleep(100);
    }
  }

  private async processBatch() {
    // SELECT FOR UPDATE SKIP LOCKED (PENDING, nextRetryAt <= NOW)
    // For each row: XADD to streamName → mark PUBLISHED
    // On error: increment retryCount, set nextRetryAt, mark FAILED if retries >= 5
  }
}
```

---

### STEP 8 — Create `modules/engine-events/engine-event-consumer.service.ts`

```typescript
// XREADGROUP GROUP backend-engine-events-v1 backend-1
// STREAMS stream:engine:events >
// Per message:
//   1. INSERT processed_events ON CONFLICT DO NOTHING
//   2. If 0 rows: check payloadHash → dead-letter if mismatch
//   3. Switch messageType:
//      MarketOpened  → UPDATE trading_pairs SET status='READY'
//      OrderOpened   → UPDATE orders SET status='OPEN' WHERE status='PENDING'
//      OrderRejected → UPDATE orders SET status='REJECTED' WHERE status='PENDING'
//      EngineFailed  → UPDATE trading_pairs SET status='SUSPENDED'
//      TradeCreated / OrderCancelled / OrderBookChanged → log + skip (Phase 7/9)
//   4. XACK after commit
```

---

### STEP 9 — Wire `worker.module.ts`

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: "../../.env" }),
    PrismaModule,
    RedisModule,
  ],
  providers: [
    OpenMarketBootstrapService,
    OutboxPollerService,
    EngineEventConsumerService,
  ],
})
export class WorkerModule {}
```

---

### STEP 10 — Add Go Engine to `docker-compose.yml`

```yaml
matching-engine:
  build:
    context: ./services/matching-engine
    dockerfile: Dockerfile
  environment:
    REDIS_URL: redis:6379
  depends_on:
    redis:
      condition: service_healthy
  restart: unless-stopped
```

Create `services/matching-engine/Dockerfile`:

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

---

### STEP 11 — Go Unit Tests (matching correctness)

`internal/matching/matcher_test.go`:

- [ ] No match → OrderOpened only
- [ ] Full fill → TradeCreated, no OrderOpened
- [ ] Partial fill → TradeCreated + OrderOpened with correct remaining
- [ ] FIFO priority — same price, earlier OrderSeq fills first
- [ ] Price priority — better price fills first
- [ ] Cancel existing order → removed from book

---

### STEP 12 — Integration Test (manual)

```bash
# 1. docker compose up
# 2. pnpm db:seed
# 3. pnpm worker:dev (or nest start worker)
# → Verify: trading_pairs.status = READY (after MarketOpened)
# 4. POST /orders (place BUY)
# → Verify: Order status = PENDING → OPEN (after OrderOpened)
# 5. POST /orders (place matching SELL)
# → Engine should emit TradeCreated (logged, not settled yet)
# 6. POST /orders/:id/cancel
# → Verify: Order status = CANCEL_PENDING → CANCELLED
```

---

## Priority Order (What to Do First)

```
1. Fix go.mod (go 1.23, add redis/go-redis)          [5 min]
2. Add MessageEnvelope alias in envelope.go            [2 min]
3. Complete pair/engine.go (3 handlers + event builders) [2–3 hrs]
4. Create internal/publisher/ and internal/transport/  [2–3 hrs]
5. Fix main.go                                         [30 min]
6. go build ./... → must pass                          [verify]
7. Fix open-market.bootstrap.service.ts                [30 min]
8. Implement outbox-poller.service.ts                  [1–2 hrs]
9. Create engine-event-consumer.service.ts             [1–2 hrs]
10. Wire worker.module.ts                              [10 min]
11. tsc --noEmit → must pass                           [verify]
12. Add matching-engine to docker-compose.yml          [15 min]
13. Go unit tests                                      [1–2 hrs]
14. Integration test                                   [30 min]
```

---

## Phase 7 Preview (After Phase 6 Done)

Phase 7 = Trade Settlement. The `TradeCreated` consumer (currently skipped) will:

1. Lock Buy + Sell order rows (by id ASC to avoid deadlock)
2. Lock Buyer + Seller + Treasury wallets (by id ASC)
3. Calculate: `quoteAmount = executionPrice × executedQuantity`
4. Calculate fees (buyer pays in Base, seller pays in Quote)
5. Price improvement refund for maker
6. `INSERT INTO trades`
7. `UPDATE orders` (filledQuantity, remainingQuantity, remainingLockedAmount, status)
8. `UPDATE wallets` (available/locked balances)
9. `INSERT INTO ledger_entries` (TRADE_SETTLEMENT + TRADING_FEE per side)
10. `INSERT INTO outbox_events` (TradeSettled, OrderUpdated, BalanceUpdated domain events)
11. `INSERT INTO processed_events`
12. Commit → XACK

**Idempotency key:** `engineMatchId` (unique constraint on `trades` table)
