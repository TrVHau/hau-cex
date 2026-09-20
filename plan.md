# Phase 6 — Engine Messaging (Chi Tiết)

## Mục tiêu

Kết nối Backend ↔ Go Matching Engine qua Redis Streams. Khi xong Phase 6:

```
DB TradingPair SUSPENDED
→ Outbox OpenMarket → Redis stream:engine:commands
→ Go Engine consume → publish MarketOpened → stream:engine:events
→ Backend Worker consume → DB TradingPair = READY

POST /orders (PENDING + Outbox PlaceOrder)
→ Outbox → Redis stream:engine:commands
→ Go Engine consume → publish OrderOpened
→ Backend Worker consume → DB Order = OPEN
```

---

## Phần A — Backend Worker: RedisModule

### File: `src/core/redis/redis.module.ts`

```typescript
@Global()
@Module({
  providers: [
    {
      provide: "REDIS_CLIENT",
      useFactory: () => new Redis(process.env.REDIS_URL),
    },
  ],
  exports: ["REDIS_CLIENT"],
})
export class RedisModule {}
```

- Dùng `ioredis` (cài: `pnpm add ioredis --filter backend`)
- `@Global()` — inject được từ bất kỳ module nào
- Đọc `REDIS_URL` từ env (`.env.example`: `REDIS_URL=redis://localhost:6379`)

---

## Phần B — Backend Worker: OpenMarketBootstrapService

### File: `src/modules/engine/open-market-bootstrap.service.ts`

**Khi worker start**, scan tất cả TradingPair status ≠ READY → tạo Outbox `OpenMarket` nếu chưa có.

```typescript
@Injectable()
export class OpenMarketBootstrapService implements OnApplicationBootstrap {
  async onApplicationBootstrap() {
    // SELECT * FROM trading_pairs WHERE status != 'READY'
    const pairs = await this.prisma.tradingPair.findMany({
      where: { status: { not: TradingPairStatus.READY } },
    });

    for (const pair of pairs) {
      // Check xem đã có Outbox OpenMarket chưa (idempotent)
      const existing = await this.prisma.outboxEvent.findFirst({
        where: {
          messageType: "OpenMarket",
          payload: { path: ["tradingPairId"], equals: pair.id },
          status: { not: OutboxStatus.FAILED },
        },
      });
      if (existing) continue;

      await this.prisma.outboxEvent.create({
        data: {
          messageId: uuidv7(),
          version: 1,
          correlationId: uuidv7(),
          streamName: "stream:engine:commands",
          messageType: "OpenMarket",
          partitionKey: pair.id,
          commandSequence: await nextCommandSequence(tx, pair.id),
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
    }
  }
}
```

---

## Phần C — Backend Worker: OutboxPollerService

### File: `src/modules/outbox/outbox-poller.service.ts`

**Nhiệm vụ:** Poll `outbox_events` (status=PENDING) → publish lên Redis Stream.

```typescript
@Injectable()
export class OutboxPollerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private running = true;

  async onApplicationBootstrap() {
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
      await sleep(100); // 100ms interval
    }
  }

  private async processBatch() {
    await this.prisma.$transaction(async (tx) => {
      // SELECT FOR UPDATE SKIP LOCKED — safe với multi-worker
      const rows = await tx.$queryRaw<OutboxRow[]>`
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
          // XADD stream:engine:commands * field value ...
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
            UPDATE outbox_events
            SET status = 'PUBLISHED', published_at = NOW()
            WHERE id = ${row.id}::uuid
          `;
        } catch (err) {
          // Retry với exponential backoff
          const nextRetry = computeNextRetry(row.retry_count);
          await tx.$executeRaw`
            UPDATE outbox_events
            SET retry_count = retry_count + 1,
                last_error = ${String(err)},
                next_retry_at = ${nextRetry},
                status = CASE WHEN retry_count >= 5 THEN 'FAILED' ELSE status END
            WHERE id = ${row.id}::uuid
          `;
        }
      }
    });
  }
}
```

**Retry policy:**
| retry_count | next_retry_at |
|------------|--------------|
| 0 | +1s |
| 1 | +2s |
| 2 | +4s |
| 3 | +8s |
| 4 | +16s |
| ≥5 | status = FAILED |

---

## Phần D — Backend Worker: EngineEventConsumerService

### File: `src/modules/engine-events/engine-event-consumer.service.ts`

**Consumer group:** `backend-engine-events-v1`
**Stream:** `stream:engine:events`

```typescript
@Injectable()
export class EngineEventConsumerService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private running = true;
  private readonly CONSUMER_NAME = "backend-worker-1";
  private readonly GROUP = "backend-engine-events-v1";
  private readonly STREAM = "stream:engine:events";

  async onApplicationBootstrap() {
    await this.ensureConsumerGroup();
    void this.consumeLoop();
  }

  private async ensureConsumerGroup() {
    try {
      await this.redis.xgroup(
        "CREATE",
        this.STREAM,
        this.GROUP,
        "$",
        "MKSTREAM",
      );
    } catch (err: any) {
      if (!err.message.includes("BUSYGROUP")) throw err;
      // group đã tồn tại → OK
    }
  }

  private async consumeLoop() {
    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          "GROUP",
          this.GROUP,
          this.CONSUMER_NAME,
          "COUNT",
          "10",
          "BLOCK",
          "200",
          "STREAMS",
          this.STREAM,
          ">",
        );
        if (!results) continue;

        for (const [, messages] of results) {
          for (const [streamId, fields] of messages) {
            await this.handleMessage(streamId, parseFields(fields));
          }
        }
      } catch (err) {
        this.logger.error("Consumer loop error", err);
        await sleep(1000);
      }
    }
  }

  private async handleMessage(streamId: string, msg: EngineMessage) {
    const payload = JSON.parse(msg.payload);
    const payloadHash = sha256(msg.payload);

    await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency check
      const inserted = await tx.$executeRaw`
        INSERT INTO processed_events (id, consumer_name, message_id, message_type, payload_hash, result, processed_at)
        VALUES (${uuidv7()}::uuid, ${"backend-engine-events-v1"}, ${msg.messageId}::uuid,
                ${msg.messageType}, ${payloadHash}, 'OK', NOW())
        ON CONFLICT (consumer_name, message_id) DO NOTHING
      `;

      if (inserted === 0) {
        // Đã xử lý — kiểm tra payloadHash conflict
        const existing = await tx.processedEvent.findFirst({
          where: {
            consumerName: "backend-engine-events-v1",
            messageId: msg.messageId,
          },
        });
        if (existing?.payloadHash !== payloadHash) {
          // Payload khác → dead-letter
          await this.deadLetter(msg);
        }
        // Same payload → skip idempotent
        return;
      }

      // 2. Dispatch handler
      switch (msg.messageType) {
        case "MarketOpened":
          await this.onMarketOpened(tx, payload);
          break;
        case "OrderOpened":
          await this.onOrderOpened(tx, payload);
          break;
        case "OrderRejected":
          await this.onOrderRejected(tx, payload);
          break;
        case "OrderCancelled":
          await this.onOrderCancelled(tx, payload);
          break;
        case "CancelOrderRejected":
          await this.onCancelOrderRejected(tx, payload);
          break;
        case "TradeCreated": // Phase 7
        case "OrderBookChanged": // Phase 9
        case "EngineFailed":
          await this.onEngineFailed(tx, payload);
          break;
        default:
          this.logger.warn(`Unknown event type: ${msg.messageType}`);
      }
    }); // commit

    // 3. ACK SAU commit
    await this.redis.xack(this.STREAM, this.GROUP, streamId);
  }
}
```

### Handlers (Phase 6 scope)

**`onMarketOpened`:**

```typescript
async onMarketOpened(tx, payload) {
  await tx.tradingPair.update({
    where: { id: payload.tradingPairId },
    data: { status: TradingPairStatus.READY },
  });
  this.logger.log(`Market READY: ${payload.market}`);
}
```

**`onOrderOpened`:**

```typescript
async onOrderOpened(tx, payload) {
  // Chỉ chuyển PENDING → OPEN
  // Nếu đang PARTIALLY_FILLED (đã settlement trước đó): skip
  await tx.order.updateMany({
    where: { id: payload.orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.OPEN },
  });
}
```

**`onOrderRejected`:** _(Phase 6 — chỉ update status, unlock balance Phase 7)_

```typescript
async onOrderRejected(tx, payload) {
  await tx.order.updateMany({
    where: { id: payload.orderId, status: OrderStatus.PENDING },
    data: { status: OrderStatus.REJECTED },
  });
  // TODO Phase 7: unlock wallet balance
}
```

**`onEngineFailed`:**

```typescript
async onEngineFailed(tx, payload) {
  // COMMAND_SEQUENCE_GAP → SUSPEND trading pair
  if (payload.failureCode === 'COMMAND_SEQUENCE_GAP') {
    await tx.tradingPair.update({
      where: { id: payload.tradingPairId },
      data: { status: TradingPairStatus.SUSPENDED },
    });
    this.logger.error(`Engine sequence gap: ${payload.market} — SUSPENDED`);
  }
}
```

---

## Phần E — Wire WorkerModule

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

## Phần F — Go Matching Engine

### F1. Cấu trúc thư mục

```
services/matching-engine/
├── cmd/engine/
│   └── main.go              ← entrypoint
├── internal/
│   ├── fixed/
│   │   ├── decimal.go       ← fixed-point arithmetic (scale=18)
│   │   └── decimal_test.go
│   ├── message/
│   │   ├── command.go       ← PlaceOrder, CancelOrder, OpenMarket DTOs
│   │   └── event.go         ← TradeCreated, OrderOpened, ... DTOs
│   ├── orderbook/
│   │   ├── order.go         ← Order struct
│   │   ├── price_level.go   ← PriceLevel (FIFO queue)
│   │   ├── side_book.go     ← SideBook (heap + map)
│   │   └── order_book.go    ← OrderBook = bids + asks + activeOrders
│   ├── matching/
│   │   └── matcher.go       ← PlaceOrder / CancelOrder algorithm
│   ├── pair/
│   │   ├── engine.go        ← PairEngine: state + sequence + command dispatch
│   │   └── state.go         ← State machine RECOVERING/READY/SUSPENDED/FAILED
│   ├── publisher/
│   │   └── redis_publisher.go ← XADD stream:engine:events
│   └── transport/
│       └── redis_consumer.go  ← XREADGROUP + XACK stream:engine:commands
├── go.mod
├── go.sum
├── Makefile
└── Dockerfile
```

---

### F2. `internal/fixed/decimal.go`

```go
package fixed

import (
    "fmt"
    "math/big"
    "strings"
)

const Scale = 18
var scaleInt = new(big.Int).Exp(big.NewInt(10), big.NewInt(Scale), nil)

// Decimal là fixed-point integer: value = raw / 10^18
type Decimal struct {
    raw *big.Int
}

func Zero() Decimal  { return Decimal{raw: big.NewInt(0)} }

// Parse từ string "1.500000000000000000"
func Parse(s string) (Decimal, error) {
    parts := strings.SplitN(s, ".", 2)
    intPart := new(big.Int)
    if _, ok := intPart.SetString(parts[0], 10); !ok {
        return Zero(), fmt.Errorf("invalid decimal: %s", s)
    }

    raw := new(big.Int).Mul(intPart, scaleInt)
    if len(parts) == 2 {
        frac := parts[1]
        if len(frac) > Scale {
            frac = frac[:Scale]
        } else {
            frac = frac + strings.Repeat("0", Scale-len(frac))
        }
        fracInt := new(big.Int)
        if _, ok := fracInt.SetString(frac, 10); !ok {
            return Zero(), fmt.Errorf("invalid decimal fraction: %s", s)
        }
        raw.Add(raw, fracInt)
    }
    return Decimal{raw: raw}, nil
}

func (d Decimal) Add(other Decimal) Decimal {
    return Decimal{raw: new(big.Int).Add(d.raw, other.raw)}
}
func (d Decimal) Sub(other Decimal) Decimal {
    return Decimal{raw: new(big.Int).Sub(d.raw, other.raw)}
}
func (d Decimal) Cmp(other Decimal) int {
    return d.raw.Cmp(other.raw)
}
func (d Decimal) IsZero() bool {
    return d.raw.Sign() == 0
}
func (d Decimal) String() string {
    // Convert back to "integer.fraction" string với 18 decimal places
    abs := new(big.Int).Abs(d.raw)
    intPart := new(big.Int).Div(abs, scaleInt)
    fracPart := new(big.Int).Mod(abs, scaleInt)
    sign := ""
    if d.raw.Sign() < 0 { sign = "-" }
    return fmt.Sprintf("%s%s.%018d", sign, intPart.String(), fracPart)
}
// Min lấy giá trị nhỏ hơn
func Min(a, b Decimal) Decimal {
    if a.Cmp(b) <= 0 { return a }
    return b
}
```

---

### F3. `internal/orderbook/` structs

**`order.go`:**

```go
type Side string
const (
    SideBuy  Side = "BUY"
    SideSell Side = "SELL"
)

type Order struct {
    OrderID       string
    UserID        string
    TradingPairID string
    Side          Side
    Price         fixed.Decimal
    OriginalQty   fixed.Decimal
    RemainingQty  fixed.Decimal
    OrderSeq      uint64
}
```

**`price_level.go`:**

```go
import "container/list"

type PriceLevel struct {
    Price         fixed.Decimal
    TotalQuantity fixed.Decimal
    orders        *list.List          // FIFO queue of *Order
    orderMap      map[string]*list.Element // orderId → element (O(1) cancel)
}

func (pl *PriceLevel) Enqueue(o *Order) { /* push back */ }
func (pl *PriceLevel) Front() *Order    { /* peek front */ }
func (pl *PriceLevel) Dequeue() *Order  { /* pop front */ }
func (pl *PriceLevel) Remove(orderID string) bool { /* remove by id */ }
func (pl *PriceLevel) IsEmpty() bool { return pl.orders.Len() == 0 }
```

**`side_book.go`:**

```go
// Bid: max-heap (giá cao ưu tiên)
// Ask: min-heap (giá thấp ưu tiên)
type SideBook struct {
    side   Side
    heap   PriceHeap               // heap.Interface
    levels map[string]*PriceLevel  // price.String() → PriceLevel
}

func (sb *SideBook) BestPrice() (fixed.Decimal, bool)
func (sb *SideBook) GetOrCreateLevel(price fixed.Decimal) *PriceLevel
func (sb *SideBook) RemoveLevelIfEmpty(price fixed.Decimal)
func (sb *SideBook) AddOrder(o *Order)
func (sb *SideBook) RemoveOrder(orderID string, price fixed.Decimal) bool
```

**`order_book.go`:**

```go
type OrderBook struct {
    Bids         SideBook
    Asks         SideBook
    activeOrders map[string]*Order // orderId → *Order (O(1) lookup cho cancel)
}

func NewOrderBook() *OrderBook
func (ob *OrderBook) AddOrder(o *Order)
func (ob *OrderBook) RemoveOrder(orderID string) (*Order, bool)
func (ob *OrderBook) BestBid() (fixed.Decimal, bool)
func (ob *OrderBook) BestAsk() (fixed.Decimal, bool)
```

---

### F4. `internal/matching/matcher.go` — Matching Algorithm

```go
type MatchResult struct {
    Trades       []TradeResult
    IncomingFull bool // incoming đã fill hết
}

type TradeResult struct {
    MatchIndex     int
    RestingOrderID string
    IncomingOrderID string
    ExecutionPrice  fixed.Decimal // = resting price
    ExecutedQty     fixed.Decimal
    RestingFull     bool // resting đã fill hết
}

func Match(book *OrderBook, incoming *Order, cmdSeq uint64) MatchResult {
    var trades []TradeResult
    matchIndex := 0

    for !incoming.RemainingQty.IsZero() {
        // Lấy best opposite
        var bestPrice fixed.Decimal
        var hasBest bool
        if incoming.Side == SideBuy {
            bestPrice, hasBest = book.Asks.BestPrice()
        } else {
            bestPrice, hasBest = book.Bids.BestPrice()
        }

        if !hasBest { break }

        // Price cross check
        if incoming.Side == SideBuy && incoming.Price.Cmp(bestPrice) < 0 { break }
        if incoming.Side == SideSell && incoming.Price.Cmp(bestPrice) > 0 { break }

        // Lấy resting order (FIFO front)
        var level *PriceLevel
        if incoming.Side == SideBuy {
            level = book.Asks.levels[bestPrice.String()]
        } else {
            level = book.Bids.levels[bestPrice.String()]
        }
        resting := level.Front()

        executedQty := fixed.Min(incoming.RemainingQty, resting.RemainingQty)
        executionPrice := resting.Price // maker price

        // Update quantities
        incoming.RemainingQty = incoming.RemainingQty.Sub(executedQty)
        resting.RemainingQty = resting.RemainingQty.Sub(executedQty)
        level.TotalQuantity = level.TotalQuantity.Sub(executedQty)

        restingFull := resting.RemainingQty.IsZero()
        if restingFull {
            level.Dequeue()
            book.activeOrders[resting.OrderID] = nil
            delete(book.activeOrders, resting.OrderID)
            if level.IsEmpty() {
                if incoming.Side == SideBuy {
                    book.Asks.RemoveLevelIfEmpty(bestPrice)
                } else {
                    book.Bids.RemoveLevelIfEmpty(bestPrice)
                }
            }
        }

        trades = append(trades, TradeResult{
            MatchIndex:      matchIndex,
            RestingOrderID:  resting.OrderID,
            IncomingOrderID: incoming.OrderID,
            ExecutionPrice:  executionPrice,
            ExecutedQty:     executedQty,
            RestingFull:     restingFull,
        })
        matchIndex++
    }

    // Nếu còn remaining → add vào book
    if !incoming.RemainingQty.IsZero() {
        book.AddOrder(incoming)
    }

    return MatchResult{
        Trades:       trades,
        IncomingFull: incoming.RemainingQty.IsZero(),
    }
}
```

---

### F5. `internal/pair/engine.go` — PairEngine

```go
type PairEngine struct {
    PairID                   string
    Market                   string
    State                    EngineState
    Book                     *OrderBook
    LastProcessedCmdSeq      uint64
    LastTradeSequence        uint64
    LastBookSequence         uint64
    InFlight                 *InFlightBatch
}

type InFlightBatch struct {
    CommandSequence uint64
    Events          []message.EventEnvelope
}

func (e *PairEngine) HandleOpenMarket(cmd OpenMarketCommand, cmdSeq uint64) []message.EventEnvelope
func (e *PairEngine) HandlePlaceOrder(cmd PlaceOrderCommand, cmdSeq uint64) []message.EventEnvelope
func (e *PairEngine) HandleCancelOrder(cmd CancelOrderCommand, cmdSeq uint64) []message.EventEnvelope

// Sequence validation
func (e *PairEngine) validateSeq(cmdSeq uint64) error {
    expected := e.LastProcessedCmdSeq + 1
    if cmdSeq < expected {
        return ErrDuplicateCommand // đã xử lý, skip
    }
    if cmdSeq > expected {
        return ErrSequenceGap // block Pair
    }
    return nil
}
```

**HandlePlaceOrder chi tiết:**

```go
func (e *PairEngine) HandlePlaceOrder(cmd PlaceOrderCommand, cmdSeq uint64) []message.EventEnvelope {
    if err := e.validateSeq(cmdSeq); err == ErrDuplicateCommand {
        return nil // không mutate, không emit
    } else if err == ErrSequenceGap {
        e.State = StateFailed
        return []EventEnvelope{buildEngineFailed(e, cmdSeq, "COMMAND_SEQUENCE_GAP", ...)}
    }

    if e.State != StateReady {
        return []EventEnvelope{buildOrderRejected(cmd.OrderID, "MARKET_NOT_READY")}
    }

    incoming := &Order{...} // parse từ cmd
    result := matching.Match(e.Book, incoming, cmdSeq)

    var events []EventEnvelope
    tradeSeq := e.LastTradeSequence

    // Build TradeCreated events
    for _, trade := range result.Trades {
        tradeSeq++
        engineMatchId := fmt.Sprintf("%s:%d:%d", e.PairID, cmdSeq, trade.MatchIndex)
        events = append(events, buildTradeCreated(trade, tradeSeq, engineMatchId, cmdSeq, ...))
    }

    // OrderOpened — CHỈ khi incoming chưa full fill
    if !result.IncomingFull {
        events = append(events, buildOrderOpened(cmd.OrderID, incoming.RemainingQty))
    }

    // OrderBookChanged — luôn emit sau PlaceOrder
    e.LastBookSequence++
    events = append(events, buildOrderBookChanged(e))

    e.LastTradeSequence = tradeSeq
    e.LastProcessedCmdSeq = cmdSeq
    return events
}
```

---

### F6. `internal/transport/redis_consumer.go`

```go
func (c *Consumer) Run(ctx context.Context) error {
    // Đảm bảo consumer group tồn tại
    c.redis.XGroupCreateMkStream(ctx, "stream:engine:commands", "matching-engine-v1", "$")

    for {
        select {
        case <-ctx.Done():
            return nil
        default:
        }

        results, err := c.redis.XReadGroup(ctx, &redis.XReadGroupArgs{
            Group:    "matching-engine-v1",
            Consumer: "engine-1",
            Streams:  []string{"stream:engine:commands", ">"},
            Count:    10,
            Block:    200 * time.Millisecond,
        }).Result()

        if err == redis.Nil { continue } // no messages
        if err != nil { /* log, sleep, retry */ continue }

        for _, stream := range results {
            for _, msg := range stream.Messages {
                c.handleCommand(ctx, msg)
            }
        }
    }
}

func (c *Consumer) handleCommand(ctx context.Context, msg redis.XMessage) {
    envelope := parseEnvelope(msg.Values)

    // Tìm hoặc tạo PairEngine cho tradingPairId
    engine := c.getOrCreateEngine(envelope.PartitionKey)

    // Dispatch
    var events []EventEnvelope
    switch envelope.MessageType {
    case "OpenMarket":  events = engine.HandleOpenMarket(...)
    case "PlaceOrder":  events = engine.HandlePlaceOrder(...)
    case "CancelOrder": events = engine.HandleCancelOrder(...)
    }

    if len(events) == 0 { // duplicate command
        c.redis.XAck(ctx, "stream:engine:commands", "matching-engine-v1", msg.ID)
        return
    }

    // Store InFlightBatch
    engine.InFlight = &InFlightBatch{Events: events}

    // Publish event batch → PHẢI thành công trước khi ACK
    if err := c.publisher.PublishBatch(ctx, events); err != nil {
        // KHÔNG ACK — retry tự động khi redeliver
        return
    }

    // ACK SAU publish thành công
    c.redis.XAck(ctx, "stream:engine:commands", "matching-engine-v1", msg.ID)
    engine.InFlight = nil
}
```

**`internal/publisher/redis_publisher.go`:**

```go
func (p *Publisher) PublishBatch(ctx context.Context, events []EventEnvelope) error {
    pipe := p.redis.Pipeline()
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

### F7. `cmd/engine/main.go`

```go
func main() {
    redisClient := redis.NewClient(&redis.Options{Addr: os.Getenv("REDIS_URL")})
    publisher := publisher.New(redisClient)
    consumer := transport.NewConsumer(redisClient, publisher)

    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    log.Println("Matching Engine started")
    if err := consumer.Run(ctx); err != nil {
        log.Fatal(err)
    }
    log.Println("Matching Engine stopped")
}
```

---

## Phần G — Docker Compose

```yaml
# Thêm vào docker-compose.yml
matching-engine:
  build:
    context: ./services/matching-engine
    dockerfile: Dockerfile
  environment:
    REDIS_URL: redis:6379
  depends_on:
    - redis
  restart: unless-stopped
```

**`Dockerfile` (Go multi-stage):**

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

## Thứ tự implement

```
A. Backend Worker
   1. pnpm add ioredis --filter backend
   2. core/redis/redis.module.ts
   3. modules/outbox/outbox-poller.service.ts
   4. modules/engine/open-market-bootstrap.service.ts
   5. modules/engine-events/engine-event-consumer.service.ts
      (handlers: MarketOpened, OrderOpened, OrderRejected, EngineFailed)
   6. Wire WorkerModule

B. Go Matching Engine
   7.  go mod init github.com/haucex/matching-engine
   8.  internal/fixed/decimal.go + test
   9.  internal/orderbook/ (Order, PriceLevel, SideBook, OrderBook) + test
   10. internal/matching/matcher.go + test
       (full fill, partial fill, FIFO, no match)
   11. internal/message/ (command + event DTOs)
   12. internal/pair/engine.go (PlaceOrder, CancelOrder, OpenMarket, sequence)
   13. internal/publisher/redis_publisher.go
   14. internal/transport/redis_consumer.go
   15. cmd/engine/main.go

C. Infrastructure
   16. Thêm matching-engine vào docker-compose.yml
   17. .env: REDIS_URL

D. Integration test
   18. docker compose up
   19. Chạy seed (pnpm db:seed)
   20. Start Backend Worker
   21. Verify TradingPair → READY (qua MarketOpened)
   22. POST /orders → verify Order → OPEN (qua OrderOpened)
```

---

## Definition of Done

- [ ] `docker compose up` — PostgreSQL + Redis + Backend API + Backend Worker + Go Engine đều start
- [ ] Bootstrap: TradingPair SUSPENDED → Outbox OpenMarket tự tạo khi Worker start
- [ ] Outbox poller đẩy `OpenMarket` lên `stream:engine:commands`
- [ ] Go Engine consume `OpenMarket` → publish `MarketOpened` lên `stream:engine:events`
- [ ] Backend Worker consume `MarketOpened` → `TradingPair.status = READY`
- [ ] `POST /orders` → Order `PENDING` + Outbox `PlaceOrder` (đã xong Phase 5)
- [ ] Outbox poller đẩy `PlaceOrder` lên Redis
- [ ] Go Engine consume `PlaceOrder` → publish `OrderOpened` (no match case)
- [ ] Backend Worker consume `OrderOpened` → `Order.status = OPEN`
- [ ] Duplicate `messageId` → skip, không xử lý lại
- [ ] `COMMAND_SEQUENCE_GAP` → TradingPair SUSPENDED + log
- [ ] Redis down → poller retry, không crash
- [ ] Go unit test pass: Full Fill, Partial Fill, FIFO Priority, No Match, Cancel
- [ ] TypeScript build clean

---

## Notes

> `TradeCreated` consumer (settlement) → **Phase 7**. Phase 6 chỉ log/skip TradeCreated.

> `OrderBookChanged` consumer (realtime) → **Phase 9**. Phase 6 chỉ log/skip.

> Go Engine là **stateless qua restart** — sau restart, pending list của Redis consumer group sẽ tự redeliver các command chưa ACK.
