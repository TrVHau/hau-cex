# Phase 7 — Trade Settlement & Market Data

> **Mục tiêu**: Hoàn thiện vòng đời lệnh (order lifecycle) và cung cấp market data real-time cho frontend.
>
> Đây là phase quan trọng nhất — toàn bộ flow end-to-end sẽ hoạt động sau phase này:
> `Đặt lệnh → Engine matching → Trade/Cancel event → Settlement → Wallet cập nhật → WebSocket push`

---

## Tổng quan trạng thái hiện tại

| Module                                                           | Trạng thái                  |
| ---------------------------------------------------------------- | --------------------------- |
| Smart Contracts                                                  | ✅ 44/44 tests pass         |
| Auth API                                                         | ✅ Done                     |
| Wallets API                                                      | ✅ Done                     |
| Orders API (place/cancel/query)                                  | ✅ Done                     |
| Go Matching Engine                                               | ✅ Builds clean, bugs fixed |
| Outbox Poller (publish commands → Redis)                         | ✅ Done                     |
| Engine Event Consumer (MarketOpened, OrderOpened, OrderRejected) | ✅ Done                     |
| **TradeCreated settlement**                                      | ❌ Stub — "Phase 7" comment |
| **OrderCancelled unlock**                                        | ❌ Stub                     |
| **CancelOrderRejected**                                          | ❌ Stub                     |
| **OrderFilled / PARTIALLY_FILLED status**                        | ❌ Missing                  |
| **WebSocket / Market data**                                      | ❌ Not started              |
| **Public market data API**                                       | ❌ Not started              |

---

## Phase 7A — Trade Settlement (Backend Critical Path)

### 7A-1: Implement `TradeCreated` handler

**File**: `src/modules/engine-events/engine-event-consumer.service.ts`

Khi nhận event `TradeCreated`, cần thực hiện trong 1 transaction:

```
1. Idempotency check (processedEvent) — đã có ✅
2. Tạo Trade record với engineMatchId (UNIQUE — idempotency tự nhiên)
3. Update Buy Order: filledQuantity += executedQuantity, remainingQuantity -= executedQuantity
   → status = FILLED nếu remainingQuantity == 0, else PARTIALLY_FILLED
4. Update Sell Order: tương tự
5. Debit buyer's locked QUOTE wallet (executedQuantity * executionPrice)
   + Credit buyer's BASE wallet (executedQuantity - buyerFee)
   + Credit treasury BASE wallet (buyerFee)
6. Debit seller's BASE wallet (executedQuantity) — từ available (seller đã không lock base)
   + Credit seller's QUOTE wallet (executedQuantity * executionPrice - sellerFee)
   + Credit treasury QUOTE wallet (sellerFee)
7. Tạo LedgerEntry cho mỗi debit/credit (TRADE_SETTLEMENT type)
```

**Lấy feeRate**: Fetch `tradingPair.makerFeeRate` / `takerFeeRate` từ DB.

- `takerSide` trong payload xác định ai là taker (fee cao hơn).
- Maker = resting order, Taker = incoming order.
- `buyerFee` tính bằng **Base** asset.
- `sellerFee` tính bằng **Quote** asset.

**engineMatchId format**: `{tradingPairId}:{commandSequence}:{matchIndex}` (unique key)

**Payload TradeCreated** (từ Go engine):

```ts
interface TradeCreatedPayload {
  tradeId: string; // UUID (informational)
  engineMatchId: string; // "{pairId}:{cmdSeq}:{matchIndex}" — DB unique key
  tradingPairId: string;
  market: string;
  tradeSequence: string;
  matchIndex: number;
  buyOrderId: string;
  sellOrderId: string;
  makerOrderId: string;
  takerOrderId: string;
  takerSide: "BUY" | "SELL";
  executionPrice: string;
  executedQuantity: string;
  buyOrderRemainingQuantity: string;
  sellOrderRemainingQuantity: string;
  matchedAt: string;
}
```

**Cần tạo**: `src/modules/engine-events/trade-settlement.service.ts`

- Tách logic settlement ra service riêng, inject vào `EngineEventConsumerService`
- Dùng `WalletBalanceService` đã có: `debitLocked`, `creditAvailable`, `debitAvailable`

---

### 7A-2: Implement `OrderCancelled` handler

Khi nhận `OrderCancelled`:

1. Update order status: `CANCEL_PENDING → CANCELLED`
2. Unlock remaining locked amount về available:
   - Nếu BUY: unlock `remainingLockedAmount` của QUOTE wallet
   - Nếu SELL: unlock `remainingLockedAmount` của BASE wallet
3. Update `order.remainingLockedAmount = 0`
4. Tạo LedgerEntry type `ORDER_UNLOCK`

**Payload**:

```ts
interface OrderCancelledPayload {
  orderId: string;
  cancelledQuantity: string;
  tradingPairId: string;
  market: string;
  cancelledAt: string;
}
```

---

### 7A-3: Implement `CancelOrderRejected` handler

Khi nhận `CancelOrderRejected`:

1. Update order status: `CANCEL_PENDING → OPEN` (hoặc `PARTIALLY_FILLED`)
   - Cần check `filledQuantity > 0` để quyết định trả về OPEN hay PARTIALLY_FILLED

---

### 7A-4: Tạo `TradeSettlementService`

**File**: `src/modules/engine-events/trade-settlement.service.ts`

```ts
@Injectable()
export class TradeSettlementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletBalance: WalletBalanceService,
  ) {}

  async settle(payload: TradeCreatedPayload, tx: PrismaTx): Promise<void> {
    // 1. Fetch trading pair for feeRate + assetIds
    // 2. Fetch buy and sell orders (FOR UPDATE để lock)
    // 3. Calculate fees
    // 4. Create Trade record (engineMatchId unique → idempotent)
    // 5. Update orders (filledQuantity, remainingQuantity, status)
    // 6. Move wallets
  }
}
```

---

### 7A-5: Tạo migration Prisma (settledAt nullable đã fix)

```bash
npx prisma migrate dev --name trade_settlement_nullable_settled_at
```

---

## Phase 7B — WebSocket Gateway (Real-time Market Data)

### 7B-1: Setup WebSocket module

**Install**: `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`

**File**: `src/modules/market/market.gateway.ts`

Dùng **Socket.IO** (dễ hơn raw WS, hỗ trợ rooms tốt).

```ts
@WebSocketGateway({ cors: true, namespace: "/market" })
export class MarketGateway implements OnGatewayConnection {
  // Client join room theo symbol: socket.join('orderbook:BTC-USDT')
  // Broadcast OrderBookChanged events
  // Broadcast TradeCreated events (recent trades)
}
```

**Rooms**:

- `orderbook:{symbol}` — nhận OrderBookChanged
- `trades:{symbol}` — nhận recent trades
- `ticker:{symbol}` — nhận 24h ticker updates

---

### 7B-2: Engine Events → WebSocket bridge

Khi `EngineEventConsumerService` xử lý xong:

- `OrderBookChanged` → broadcast `orderbook:{symbol}` room
- `TradeCreated` → broadcast `trades:{symbol}` room

Inject `MarketGateway` vào `EngineEventConsumerService`.

**Event format** cho client:

```ts
// orderbook update
{
  type: 'ORDERBOOK_UPDATE',
  symbol: 'BTC-USDT',
  bids: [['50000.000000000000000000', '1.5', '2'], ...],  // [price, qty, count]
  asks: [['50001.000000000000000000', '0.8', '1'], ...],
  sequence: '1051'
}

// trade
{
  type: 'TRADE',
  symbol: 'BTC-USDT',
  price: '50000.5',
  quantity: '0.1',
  takerSide: 'BUY',
  matchedAt: '2026-10-09T08:00:00Z'
}
```

---

### 7B-3: Public REST API — Market Data

**File**: `src/modules/market/market.controller.ts`

```
GET /market/orderbook/:symbol      — snapshot hiện tại (query từ DB/cache)
GET /market/trades/:symbol         — 50 giao dịch gần nhất
GET /market/ticker/:symbol         — 24h stats (open, high, low, close, volume)
GET /market/pairs                  — danh sách trading pairs + trạng thái
```

> **Lưu ý**: Orderbook snapshot không query từ Redis stream mà từ in-memory state của Go engine. Tuy nhiên vì backend không có state của engine, cần lưu orderbook snapshot vào DB/Redis sau mỗi `OrderBookChanged` event.

**Approach**: Khi nhận `OrderBookChanged`, lưu bids/asks vào Redis (`HSET market:orderbook:BTC-USDT bids [...] asks [...]`) với TTL. REST API đọc từ Redis.

---

## Phase 7C — Order Status & UX Improvements

### 7C-1: Order status corrections

Khi settlement xảy ra, Go engine đã emit:

- `OrderOpened` → backend set `OPEN`
- `TradeCreated` → backend cập nhật `PARTIALLY_FILLED` hoặc `FILLED`
- `OrderCancelled` → backend set `CANCELLED`

Cần đảm bảo:

- Nếu một lệnh được fill 100% ngay khi đặt (immediate fill), không có `OrderOpened` event — chỉ có `TradeCreated` với `buyOrderRemainingQuantity == 0`. Handler cần set order thẳng từ `PENDING → FILLED`.

---

### 7C-2: GET /orders/:id — thêm trades

**File**: `src/modules/orders/order-query.service.ts`

Thêm endpoint hoặc modify existing để trả về trades liên quan đến order:

```
GET /orders/:id/trades
```

---

## Phase 7D — Infrastructure & DevOps

### 7D-1: Docker Compose hoàn chỉnh

`docker-compose.yml` đã có `matching-engine` service + Dockerfile. Cần thêm:

```yaml
backend-api:
  build:
    context: ./apps/backend
    dockerfile: Dockerfile.api
  command: node dist/main-api.js
  ports: ["3000:3000"]
  depends_on: [postgres, redis]

backend-worker:
  build:
    context: ./apps/backend
    dockerfile: Dockerfile.worker
  command: node dist/main-worker.js
  depends_on: [postgres, redis]
```

Tạo `Dockerfile` cho backend (multi-stage build).

### 7D-2: Environment variables

Tạo `.env.example` với tất cả các biến cần thiết.

### 7D-3: `prisma migrate deploy` trong entrypoint

Đảm bảo migrations chạy tự động khi container khởi động.

---

## Thứ tự implement (theo độ ưu tiên)

```
Step 1.  Tạo Prisma migration (settledAt nullable)
Step 2.  Tạo TradeSettlementService (7A-4)
Step 3.  Implement TradeCreated handler (7A-1) dùng TradeSettlementService
Step 4.  Implement OrderCancelled handler (7A-2)
Step 5.  Implement CancelOrderRejected handler (7A-3)
Step 6.  tsc --noEmit + test thủ công flow end-to-end với Docker Compose
Step 7.  Setup WebSocket Gateway (7B-1)
Step 8.  Bridge engine events → WebSocket (7B-2)
Step 9.  Lưu orderbook snapshot vào Redis (7B-3 prep)
Step 10. Public REST API market data (7B-3)
Step 11. GET /orders/:id/trades (7C-2)
Step 12. Dockerfile backend (7D-1)
Step 13. docker-compose hoàn chỉnh (7D-1)
Step 14. .env.example (7D-2)
```

---

## Definition of Done

### Phase 7A — Settlement (Critical)

- [ ] `TradeCreated` event: tạo Trade record + cập nhật wallets + cập nhật orders
- [ ] `OrderCancelled` event: unlock remaining locked amount + set CANCELLED
- [ ] `CancelOrderRejected` event: revert order status về OPEN/PARTIALLY_FILLED
- [ ] Idempotency: replay event không tạo duplicate trades hoặc wallet mutations
- [ ] `tsc --noEmit` → 0 errors

### Phase 7B — WebSocket

- [ ] Client kết nối WebSocket, join room `orderbook:BTC-USDT`
- [ ] Sau mỗi trade, client nhận update real-time
- [ ] `GET /market/orderbook/BTC-USDT` trả về current snapshot
- [ ] `GET /market/trades/BTC-USDT` trả về 50 giao dịch gần nhất

### Phase 7C — Infrastructure

- [ ] `docker compose up` chạy được toàn bộ stack
- [ ] Flow end-to-end: deposit → place order → match → trade → wallet updated
