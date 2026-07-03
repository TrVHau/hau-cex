# Hau CEX — Internal Message Contract

## 1. Mục Đích

Tài liệu này định nghĩa message nội bộ cho MVP:

- Backend gửi command đến Matching Engine.
- Matching Engine gửi event về Backend.
- Backend phát domain event sau khi PostgreSQL commit.

Redis Streams chỉ là transport. PostgreSQL mới là nguồn dữ liệu tài chính chính.

---

## 2. Stream

```text
stream:engine:commands
stream:engine:events
stream:market:events
stream:blockchain:events
stream:dead-letter
```

Consumer group:

| Stream                     | Consumer Group                                   |
| -------------------------- | ------------------------------------------------ |
| `stream:engine:commands`   | `matching-engine-v1`                             |
| `stream:engine:events`     | `backend-engine-events-v1`                       |
| `stream:market:events`     | `market-websocket-fanout-v1`                     |
| `stream:blockchain:events` | `blockchain-deposit-v1` (khi triển khai Deposit) |

---

## 3. Message Envelope

Mọi message dùng envelope:

```json
{
  "messageId": "0197...",
  "messageType": "PlaceOrder",
  "version": 1,
  "correlationId": "0197...",
  "occurredAt": "2026-07-01T10:30:00.000Z",
  "partitionKey": "0197-trading-pair-id",
  "commandSequence": "1051",
  "payload": {}
}
```

Quy tắc:

- `messageId` bắt buộc UUIDv7.
- `correlationId` bắt buộc UUIDv7.
- `commandSequence` là optional decimal string.
- `commandSequence` chỉ nằm trong envelope, không lặp trong payload.
- `commandSequence` bắt buộc với Engine Command và Engine Event sinh ra từ Engine Command.
- `commandSequence` không dùng với Domain Event hoặc Blockchain Event.
- Engine message dùng `partitionKey = tradingPairId`.
- Retry cùng message phải giữ nguyên `messageId`.
- Redis Stream ID không được dùng làm business ID.

---

## 4. Decimal

Decimal truyền dưới dạng string.

Không dùng:

```text
number
float
scientific notation
```

Ví dụ hợp lệ:

```text
1.000000000000000000
```

---

## 5. Engine Commands

MVP command:

```text
PlaceOrder
CancelOrder
OpenMarket
SuspendMarket
```

---

## 6. `PlaceOrder` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "orderId": "0197...",
  "userId": "0197...",
  "side": "BUY",
  "type": "LIMIT",
  "price": "1.000000000000000000",
  "quantity": "100.000000000000000000",
  "orderSequence": "1201",
  "createdAt": "2026-07-01T10:30:00.000Z"
}
```

Kết quả:

```text
OrderRejected
OrderOpened
TradeCreated
OrderBookChanged
EngineFailed
```

---

## 7. `CancelOrder` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "orderId": "0197...",
  "userId": "0197...",
  "requestedBy": "USER",
  "requestedAt": "2026-07-01T10:31:00.000Z"
}
```

Kết quả:

```text
OrderCancelled
CancelOrderRejected
OrderBookChanged
EngineFailed
```

MVP chỉ hỗ trợ User cancel Order của chính mình. Admin cancel không thuộc MVP.

---

## 8. `OpenMarket` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "baseAssetId": "0197...",
  "quoteAssetId": "0197...",
  "pricePrecision": 18,
  "quantityPrecision": 18,
  "tickSize": "0.010000000000000000",
  "stepSize": "0.010000000000000000",
  "minQuantity": "1.000000000000000000",
  "minNotional": "10.000000000000000000",
  "openedAt": "2026-07-01T10:00:00.000Z"
}
```

Kết quả:

```text
MarketOpened
EngineFailed
```

Backend flow:

1. PostgreSQL vẫn giữ Trading Pair `SUSPENDED`.
2. Backend tạo Outbox `OpenMarket`.
3. Khi nhận `MarketOpened`, Backend chuyển Trading Pair trong PostgreSQL sang `READY`.

---

## 9. `SuspendMarket` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "reason": "MAINTENANCE",
  "suspendedAt": "2026-07-01T11:00:00.000Z"
}
```

Kết quả:

```text
MarketSuspended
EngineFailed
```

Backend flow:

1. Trong một transaction, Backend chuyển Trading Pair trong PostgreSQL sang `SUSPENDED`.
2. Backend tạo Outbox `SuspendMarket`.
3. Khi nhận `MarketSuspended`, Backend ghi nhận Engine đã suspend.
4. `PlaceOrder` bị chặn ngay khi DB đã `SUSPENDED`.

Khi market suspended:

- `PlaceOrder` → `OrderRejected(MARKET_SUSPENDED)`.
- `CancelOrder` → vẫn xử lý bình thường.
- Open Order hiện tại được giữ nguyên cho đến khi được khớp hoặc User chủ động hủy.

---

## 10. Engine Events

MVP Engine Event:

```text
OrderRejected
OrderOpened
TradeCreated
OrderCancelled
CancelOrderRejected
OrderBookChanged
MarketOpened
MarketSuspended
EngineFailed
```

---

## 11. `OrderRejected` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "orderId": "0197...",
  "reasonCode": "INVALID_FIXED_POINT_VALUE",
  "reason": "Price cannot be represented using market precision.",
  "rejectedAt": "2026-07-01T10:30:00.010Z"
}
```

`reasonCode`:

```text
MARKET_NOT_READY
MARKET_SUSPENDED
DUPLICATE_ORDER_CONFLICT
INVALID_ORDER
INVALID_FIXED_POINT_VALUE
INTERNAL_ENGINE_ERROR
```

Không dùng `COMMAND_SEQUENCE_GAP` làm rejection reason.

Backend consumer:

- Chỉ chuyển `PENDING -> REJECTED`.
- Mở khóa số dư đã lock.
- Tạo 2 Ledger Entry `ORDER_UNLOCK`: `LOCKED -amount`, `AVAILABLE +amount`.

---

## 12. `OrderOpened` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "orderId": "0197...",
  "remainingQuantity": "100.000000000000000000",
  "openedAt": "2026-07-01T10:30:00.010Z"
}
```

Backend consumer:

- Chuyển `PENDING → OPEN` nếu Order chưa có fill.
- Nếu Order đang `PARTIALLY_FILLED` (đã qua TradeCreated settlement trong cùng Event Batch), ACK mà không thay đổi trạng thái — Order đã có trong book với fills.
- Không thay đổi Wallet.
- Không ghi Ledger.

---

## 13. `TradeCreated` v1

Payload:

```json
{
  "tradeId": "0197...",
  "engineMatchId": "0197-pair:1051:0",
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "tradeSequence": "5001",
  "matchIndex": 0,
  "buyOrderId": "0197...",
  "sellOrderId": "0197...",
  "buyerUserId": "0197...",
  "sellerUserId": "0197...",
  "makerOrderId": "0197...",
  "takerOrderId": "0197...",
  "takerSide": "BUY",
  "executionPrice": "1.000000000000000000",
  "executedQuantity": "100.000000000000000000",
  "buyOrderRemainingQuantity": "0.000000000000000000",
  "sellOrderRemainingQuantity": "0.000000000000000000",
  "matchedAt": "2026-07-01T10:30:00.011Z"
}
```

Rules:

- `tradeId` dùng UUIDv7.
- `engineMatchId` là business idempotency key.
- Settlement chống trùng bằng `engineMatchId`.
- Engine không tính fee.
- Settlement Backend đọc Fee Rate từ Trading Pair và tự tính fee.
- Backend lấy `userId`, `tradingPairId` và `side` từ Order trong PostgreSQL.
- `buyerUserId` và `sellerUserId` từ Engine chỉ dùng để verify.
- Backend phải kiểm tra `currentRemainingQuantity - executedQuantity == remainingQuantity` tương ứng trong `TradeCreated`.
- Nếu dữ liệu không khớp: rollback, suspend Market và reconciliation.

Settlement consumer phải làm trong một transaction:

1. Check `processed_events`.
2. Check `engineMatchId`.
3. Lock Buy Order và Sell Order theo `id` tăng dần.
4. Lock Wallet buyer, seller và Treasury theo `id` tăng dần.
5. Insert Trade.
6. Update Order.
7. Update Wallet.
8. Create Ledger Entries.
9. Create Outbox domain events.
10. Insert `processed_events`.
11. Commit.

Nếu Order hiện tại là `CANCEL_PENDING`:

- `newRemainingQuantity > 0`: giữ `CANCEL_PENDING`.
- `newRemainingQuantity = 0`: chuyển `FILLED`.
- Không chuyển `CANCEL_PENDING` về `PARTIALLY_FILLED`.

---

## 14. `OrderCancelled` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "orderId": "0197...",
  "cancelledQuantity": "50.000000000000000000",
  "cancelledAt": "2026-07-01T10:31:00.010Z"
}
```

Backend consumer:

- Chỉ apply nếu PostgreSQL đang `CANCEL_PENDING`.
- Unlock remaining locked amount.
- Tạo 2 Ledger Entry `ORDER_UNLOCK`: `LOCKED -amount`, `AVAILABLE +amount`.
- Chuyển Order sang `CANCELLED`.

---

## 15. `CancelOrderRejected` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "orderId": "0197...",
  "reasonCode": "ORDER_NOT_FOUND",
  "reason": "Order is not active in engine order book.",
  "rejectedAt": "2026-07-01T10:31:00.010Z"
}
```

`reasonCode`:

```text
ORDER_NOT_FOUND
MARKET_NOT_READY
INTERNAL_ENGINE_ERROR
```

Backend consumer:

- Không mở khóa số dư chỉ vì nhận event này.
- `ORDER_NOT_FOUND` + DB Order `FILLED`: ACK idempotent.
- `ORDER_NOT_FOUND` + DB Order `CANCELLED`: ACK idempotent.
- `ORDER_NOT_FOUND` + DB Order `CANCEL_PENDING`: suspend Market và reconciliation.
- `MARKET_NOT_READY`: giữ Order `CANCEL_PENDING`, suspend Market và operator xử lý thủ công.

---

## 16. `OrderBookChanged` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "bookSequence": "9001",
  "bids": [["1.000000000000000000", "100.000000000000000000", 2]],
  "asks": [["1.100000000000000000", "50.000000000000000000", 1]],
  "changedAt": "2026-07-01T10:30:00.012Z"
}
```

Public Order Book không chứa user/order riêng tư.

---

## 17. Market Events

### `MarketOpened`

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "openedAt": "2026-07-01T10:00:00.000Z"
}
```

### `MarketSuspended`

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "reason": "MAINTENANCE",
  "suspendedAt": "2026-07-01T11:00:00.000Z"
}
```

---

## 18. `EngineFailed` v1

Payload:

```json
{
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "failureCode": "COMMAND_SEQUENCE_GAP",
  "failureMessage": "Expected commandSequence 1051 but received 1053.",
  "failedAt": "2026-07-01T10:30:00.000Z"
}
```

`failureCode`:

```text
COMMAND_SEQUENCE_GAP
EVENT_PUBLISH_FAILED
MARKET_CONFIG_INVALID
INTERNAL_ENGINE_ERROR
```

`COMMAND_SEQUENCE_GAP` rule:

- Không ACK command hiện tại.
- Không coi command hiện tại là poison message.
- Không mutate Order Book.
- Không phát `OrderRejected`.
- Không phát `CancelOrderRejected`.
- Block Pair Engine.
- Giữ Order ở `PENDING` hoặc `CANCEL_PENDING`.

Backend consumer khi nhận `EngineFailed`:

- Matching Engine chuyển Pair Engine runtime sang `FAILED`.
- Backend chuyển Trading Pair trong PostgreSQL sang `SUSPENDED`.
- Không cho phép Order mới cho đến khi reconciliation hoàn tất.
- `FAILED` là trạng thái kỹ thuật trong memory của Go Engine.
- `SUSPENDED` là trạng thái nghiệp vụ được lưu trong PostgreSQL.
- Core MVP yêu cầu operator reset hoặc reconciliation thủ công.
- `COMMAND_SEQUENCE_GAP`: điều tra và vá gap trước khi recovery.
- `EVENT_PUBLISH_FAILED`: không nhận command mới, operator kiểm tra Redis và Engine log.
- `MARKET_CONFIG_INVALID`: kiểm tra lại cấu hình `OpenMarket`.
- `INTERNAL_ENGINE_ERROR`: yêu cầu operator can thiệp.

---

## 19. Event Ordering và Publish Failure

Core MVP chạy một active consumer cho `stream:engine:events`.

Event được xử lý tuần tự theo Redis Stream order.
Không xử lý song song hai Engine Event của cùng Trading Pair.

Sau khi mutate Order Book, Pair Engine phải giữ Event Batch trong memory.

Nếu publish lỗi:

- Không ACK Command.
- Không xử lý Command tiếp theo.
- Retry đúng Event Batch cũ.
- Giữ nguyên `messageId` và `tradeId`.

Giới hạn MVP: process crash giữa mutation và publish chưa được tự động recovery.

---

## 20. Domain Events Sau Commit

Domain Event chỉ phát sau PostgreSQL commit.

```text
TradeSettled
OrderUpdated
BalanceUpdated
```

`DepositUpdated` phát sau commit khi triển khai Deposit.

### `TradeSettled`

Payload tối thiểu:

```json
{
  "tradeId": "0197...",
  "tradingPairId": "0197...",
  "market": "HAU_USDT",
  "executionPrice": "1.000000000000000000",
  "executedQuantity": "100.000000000000000000",
  "tradeSequence": "5001",
  "matchedAt": "2026-07-01T10:30:00.011Z",
  "settledAt": "2026-07-01T10:30:00.050Z"
}
```

### `OrderUpdated`

Payload tối thiểu:

```json
{
  "userId": "0197...",
  "orderId": "0197...",
  "status": "PARTIALLY_FILLED",
  "filledQuantity": "50.000000000000000000",
  "remainingQuantity": "50.000000000000000000",
  "remainingLockedAmount": "50.000000000000000000",
  "updatedAt": "2026-07-01T10:30:00.050Z"
}
```

### `BalanceUpdated`

Payload tối thiểu:

```json
{
  "userId": "0197...",
  "assetId": "0197...",
  "availableBalance": "1000.000000000000000000",
  "lockedBalance": "50.000000000000000000",
  "operationId": "0197...",
  "updatedAt": "2026-07-01T10:30:00.050Z"
}
```

`TradeCreated` từ Engine chưa được dùng làm public Recent Trade.

Chỉ `TradeSettled` mới được dùng cho:

- Recent Trades.
- Last Price.
- Public `trade.created`.

---

## 21. Idempotency

Mỗi consumer phải ghi:

```text
consumerName + messageId
```

Mỗi row `processed_events` phải lưu `payloadHash`.

Flow:

```text
messageId chưa tồn tại -> xử lý -> lưu payloadHash
messageId tồn tại + payloadHash giống -> ACK idempotent
messageId tồn tại + payloadHash khác -> dead-letter
```

Trade Settlement phải kiểm tra thêm:

```text
engineMatchId
```

Nếu `engineMatchId` đã tồn tại và payload nghiệp vụ khớp:

- Không tạo Trade mới.
- Không cập nhật Wallet lần hai.
- Không ghi Ledger lần hai.
- Ghi `processed_events` cho message hiện tại.
- ACK sau commit.

---

## 22. Retry và Dead Letter

Retryable:

- Redis publish lỗi tạm thời.
- PostgreSQL timeout.
- Lock timeout.

Non-retryable:

- Version không hỗ trợ.
- Payload schema invalid.
- Payload conflict.
- `engineMatchId` conflict.

Sau quá số lần retry:

```text
stream:dead-letter
```

Message ảnh hưởng tài chính không được silently skip.

---

## 23. Checklist

- [ ] `messageId` là UUIDv7.
- [ ] `correlationId` là UUIDv7.
- [ ] Decimal là string.
- [ ] Command Sequence gap không phát rejection.
- [ ] `OrderRejected.reasonCode` không có `COMMAND_SEQUENCE_GAP`.
- [ ] Payload không lặp `commandSequence`.
- [ ] `CancelOrderRejected.reasonCode` không có `MARKET_SUSPENDED`.
- [ ] `TradeCreated` có `engineMatchId`.
- [ ] `TradeCreated` không có Fee Amount.
- [ ] Settlement dedupe bằng `engineMatchId`.
- [ ] Consumer ACK sau commit.
- [ ] Domain event chỉ phát sau commit.
