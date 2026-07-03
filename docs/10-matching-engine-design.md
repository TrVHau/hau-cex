# Hau CEX — Matching Engine Design

## 1. Mục Đích

Tài liệu này mô tả phần Go Matching Engine cần làm trong MVP.

Nguồn chuẩn:

- Business semantics: `05-business-rules.md`.
- Database ownership: `07-database-design.md`.
- Internal message contract: `09-internal-message-contract.md`.

File này không tự đổi business rule hoặc message schema.

---

## 2. Phạm Vi

Matching Engine chịu trách nhiệm:

- Nhận command từ Redis Streams.
- Quản lý Order Book in-memory cho từng Trading Pair.
- Xử lý `PlaceOrder`.
- Xử lý `CancelOrder`.
- Xử lý `OpenMarket`.
- Xử lý `SuspendMarket`.
- Khớp Limit Buy và Limit Sell.
- Áp dụng Price-Time Priority.
- Sinh Engine Event.
- Publish Event Batch trước khi ACK command.
- Duy trì Command Sequence, Trade Sequence và Order Book Sequence.

Matching Engine không chịu trách nhiệm:

- Authentication.
- Authorization.
- Kiểm tra User bị khóa.
- Kiểm tra hoặc khóa Wallet.
- Ghi PostgreSQL.
- Settlement Trade.
- Tính Maker Fee hoặc Taker Fee.
- Cập nhật Wallet hoặc Ledger.
- Gửi WebSocket trực tiếp.

---

## 3. Nguyên Tắc Bắt Buộc

### 3.1. Một writer cho mỗi Trading Pair

Mỗi Trading Pair có một Pair Engine và một goroutine duy nhất được mutate Order Book.

```text
Trading Pair
→ Pair Engine
→ Command Channel
→ Order Book writer
```

Không goroutine nào khác được sửa trực tiếp:

- Bid side.
- Ask side.
- Price level.
- Active order map.
- Sequence state.

### 3.2. Command Sequence

Command của cùng Trading Pair phải xử lý theo thứ tự:

```text
expectedCommandSequence = lastProcessedCommandSequence + 1
```

Quy tắc:

- `commandSequence == expected`: xử lý.
- `commandSequence < expected`: duplicate, không mutate lại.
- `commandSequence > expected`: sequence gap, dừng Pair Engine.

Sequence gap:

- Không ACK command hiện tại.
- Không mutate Order Book.
- Không phát `OrderRejected`.
- Không phát `CancelOrderRejected`.
- Phát `EngineFailed(COMMAND_SEQUENCE_GAP)`.
- Giữ command pending để xử lý lại sau khi khôi phục gap.

### 3.3. Không dùng float

Không dùng:

```text
float32
float64
```

cho:

- Price.
- Quantity.
- Notional.

MVP dùng fixed-point integer scale `18`.

### 3.4. Price-Time Priority

Buy side:

- Giá cao hơn ưu tiên trước.
- Cùng giá thì Order Sequence nhỏ hơn ưu tiên trước.

Sell side:

- Giá thấp hơn ưu tiên trước.
- Cùng giá thì Order Sequence nhỏ hơn ưu tiên trước.

Execution Price luôn là giá của resting order.

---

## 4. Source Layout

```text
matching-engine/
├── cmd/engine
├── internal/fixed
├── internal/message
├── internal/pair
├── internal/orderbook
├── internal/matching
├── internal/publisher
├── internal/transport/redisstream
├── internal/observability
├── test
├── go.mod
└── Dockerfile
```

Package rule:

- `fixed`: xử lý fixed-point.
- `message`: DTO command/event.
- `orderbook`: cấu trúc book thuần memory.
- `matching`: thuật toán khớp.
- `pair`: command handler và sequence state.
- `publisher`: publish event batch.
- `transport/redisstream`: Redis Streams consumer/ack.
- `observability`: log, metric, health.

---

## 5. Data Structure

### 5.1. Order

```go
type Order struct {
    OrderID        string
    UserID         string
    TradingPairID  string
    Side           Side
    Price          fixed.Decimal
    OriginalQty    fixed.Decimal
    RemainingQty   fixed.Decimal
    OrderSequence  uint64
}
```

### 5.2. Price Level

```go
type PriceLevel struct {
    Price         fixed.Decimal
    Orders        *list.List
    TotalQuantity fixed.Decimal
}
```

Mỗi Price Level giữ FIFO queue.

### 5.3. Side Book

Buy side dùng max-heap.

Sell side dùng min-heap.

Mỗi side có:

```text
price heap
price -> price level map
```

### 5.4. Order Book

```text
bids
asks
activeOrders: orderId -> order pointer
```

`activeOrders` dùng để cancel O(1).

---

## 6. Pair Engine State

Trạng thái Pair Engine:

```text
RECOVERING
READY
SUSPENDED
FAILED
```

Ý nghĩa:

- `RECOVERING`: đang rebuild book.
- `READY`: nhận `PlaceOrder` và `CancelOrder`.
- `SUSPENDED`: từ chối `PlaceOrder`, vẫn nhận `CancelOrder`.
- `FAILED`: lỗi nghiêm trọng, cần vận hành/reconciliation.

MVP chỉ chạy một Matching Engine instance trong Docker Compose.

Hành vi theo trạng thái:

| State | PlaceOrder | CancelOrder |
| ----- | ---------- | ----------- |
| `READY` | Cho phép | Cho phép |
| `SUSPENDED` | Từ chối | Cho phép |
| `RECOVERING` | Từ chối | Từ chối |
| `FAILED` | Từ chối | Từ chối |

---

## 7. Command

### 7.1. `OpenMarket`

Mở Trading Pair nếu config hợp lệ.

Kết quả:

```text
MarketOpened
EngineFailed
```

### 7.2. `SuspendMarket`

Tạm dừng Trading Pair.

Kết quả:

```text
MarketSuspended
EngineFailed
```

### 7.3. `PlaceOrder`

Điều kiện xử lý:

- Pair đang `READY`.
- Command Sequence đúng.
- Payload hợp lệ.
- Fixed-point parse được.
- Price/Quantity hợp lệ theo tick/step/min.

Kết quả có thể phát:

```text
OrderRejected
OrderOpened
TradeCreated
OrderBookChanged
EngineFailed
```

### 7.4. `CancelOrder`

Điều kiện xử lý:

- Pair đang `READY` hoặc `SUSPENDED`.
- Command Sequence đúng.
- Order đang active trong Order Book.

Kết quả có thể phát:

```text
OrderCancelled
CancelOrderRejected
OrderBookChanged
EngineFailed
```

---

## 8. Event Ordering

Engine phải publish Event Batch trước khi ACK command.

Pair Engine giữ batch đang publish:

```go
type InFlightBatch struct {
    CommandSequence uint64
    Events          []MessageEnvelope
    Published       bool
}
```

Quy trình:

```text
mutate book
→ create event batch
→ store in-flight batch
→ publish
→ update lastProcessedCommandSequence
→ clear in-flight
→ ACK
```

Với `PlaceOrder` có match:

```text
TradeCreated...
OrderOpened nếu incoming còn remaining
OrderBookChanged nếu book thay đổi
```

Với `PlaceOrder` full fill (remaining = 0):

```text
TradeCreated... (buyOrderRemainingQuantity hoặc sellOrderRemainingQuantity = 0)
OrderBookChanged nếu book thay đổi
```

Không phát `OrderOpened` khi Order đã full fill — order không vào book.
Backend biết Order là `FILLED` từ `remainingQuantity = 0` trong `TradeCreated`.

Với `PlaceOrder` không match và còn remaining:

```text
OrderOpened
OrderBookChanged
```

Với `CancelOrder` thành công:

```text
OrderCancelled
OrderBookChanged
```

Không phát event runtime fill để cập nhật tài chính. Backend cập nhật trạng thái fill bằng `TradeCreated` settlement.

---

## 9. ID và Sequence

### 9.1. Command Sequence

Do Backend cấp theo Trading Pair.

Engine chỉ verify và cập nhật `lastProcessedCommandSequence`.

### 9.2. Order Sequence

Do Backend cấp khi tạo Order.

Engine dùng để FIFO trong cùng Price Level.

### 9.3. Trade Sequence

Do Engine cấp tăng dần trong mỗi Trading Pair:

```text
lastTradeSequence + 1
```

### 9.4. Order Book Sequence

Tăng khi aggregate Order Book thay đổi.

### 9.5. engineMatchId

Mỗi match có khóa nghiệp vụ ổn định:

```text
engineMatchId = tradingPairId + ":" + commandSequence + ":" + matchIndex
```

Trong đó:

- `matchIndex` bắt đầu từ `0` cho mỗi `PlaceOrder`.
- Tăng một lần cho mỗi resting order được match.

Backend Settlement dùng `engineMatchId` để chống settlement trùng.

### 9.6. tradeId

`tradeId` dùng UUIDv7.

`tradeId` không phải khóa chống replay nghiệp vụ. Khóa đó là `engineMatchId`.

### 9.7. Fee

Engine không tính Fee Rate hoặc Fee Amount.

Engine chỉ tạo dữ liệu match:

```text
executionPrice
executedQuantity
makerOrderId
takerOrderId
```

Backend Settlement đọc Fee Rate từ Trading Pair và tự tính phí.

---

## 10. PlaceOrder Flow

Pseudo-flow:

```text
validate command
validate fixed-point values
incoming = new order
matchIndex = 0

while incoming.remainingQty > 0 and best opposite price crosses:
    resting = best opposite order
    executedQty = min(incoming.remainingQty, resting.remainingQty)
    executionPrice = resting.price

    update incoming.remainingQty
    update resting.remainingQty
    update price level aggregate

    tradeSequence += 1
    engineMatchId = pairId + ":" + commandSequence + ":" + matchIndex
    tradeId = UUIDv7
    makerOrderId = resting.orderId
    takerOrderId = incoming.orderId

    emit TradeCreated
    matchIndex += 1

    if resting.remainingQty == 0:
        remove resting from book

if incoming.remainingQty > 0:
    add incoming to book
    emit OrderOpened

if book changed:
    bookSequence += 1
    emit OrderBookChanged

publish event batch
ACK command
```

---

## 11. CancelOrder Flow

Pseudo-flow:

```text
validate command

if pair is RECOVERING or FAILED:
    emit CancelOrderRejected(MARKET_NOT_READY)
    publish
    ACK

if order not in activeOrders:
    emit CancelOrderRejected(ORDER_NOT_FOUND)
    publish
    ACK

remove order from price level
remove order from activeOrders
bookSequence += 1

emit OrderCancelled
emit OrderBookChanged
publish event batch
ACK command
```

Engine không mở khóa số dư. Backend xử lý unlock sau khi consume `OrderCancelled`.

---

## 12. Order Book Update

`OrderBookChanged` chứa aggregate theo Price Level:

```text
price
totalQuantity
orderCount
bookSequence
```

Public Order Book không chứa:

- Order ID riêng tư.
- User ID.
- Thông tin tài khoản.

---

## 13. Future Work — Engine Recovery

Core MVP không bắt buộc tự động recovery Order Book sau khi Engine restart.

Trong môi trường demo, Engine restart có thể yêu cầu reset môi trường
hoặc chạy lại seed data.

Khôi phục từ Open Order trong PostgreSQL là chức năng mở rộng.

Khi triển khai future recovery:

1. Pair vào `RECOVERING`.
2. Backend đọc Order `OPEN` và `PARTIALLY_FILLED` từ PostgreSQL.
3. Backend gửi danh sách order hiện hành cho Engine.
4. Engine sort theo:
   - Side.
   - Price.
   - Order Sequence.
5. Engine rebuild Order Book.
6. Pair chuyển `READY`.

Giới hạn Core MVP: process crash giữa mutation và publish chưa được tự động recovery.

---

## 14. Redis Streams

Consumer group:

```text
stream:engine:commands
matching-engine-v1
```

Event stream:

```text
stream:engine:events
```

ACK rule:

- Chỉ ACK command sau khi toàn bộ Event Batch đã publish thành công.
- Nếu publish lỗi, không ACK và không xử lý command tiếp theo.
- Retry đúng Event Batch cũ trong `InFlightBatch`.
- Retry giữ nguyên `messageId` và `tradeId`.
- Nếu command bị redeliver, không mutate lại nếu commandSequence đã xử lý.

---

## 15. Error Handling

Engine phát `EngineFailed` khi lỗi ảnh hưởng tính đúng đắn của Pair:

```text
COMMAND_SEQUENCE_GAP
EVENT_PUBLISH_FAILED
MARKET_CONFIG_INVALID
INTERNAL_ENGINE_ERROR
```

Khi Pair `FAILED`:

- Không xử lý command mới.
- Không tự sửa Order Book.
- Chờ Backend/operator reconciliation.

---

## 16. Metrics Tối Thiểu

```text
engine_command_processed_total
engine_command_failed_total
engine_event_publish_failed_total
engine_sequence_gap_total
engine_trade_created_total
engine_orderbook_changed_total
engine_pair_status
```

---

## 17. Test Tối Thiểu

Matching:

- Buy không cross Sell.
- Full fill.
- Partial fill incoming.
- Partial fill resting.
- Một incoming match nhiều resting order.
- FIFO cùng price.
- Giá tốt hơn ưu tiên.
- Cancel open order.
- Cancel partially filled order.
- Duplicate command không match lại.
- Sequence gap không phát rejection.

Fixed-point:

- Không dùng float.
- Parse decimal hợp lệ.
- Từ chối decimal sai precision.
- Tick size đúng.
- Step size đúng.
- Notional tính đúng.

Integration:

- Publish event trước ACK.
- Redelivery không mutate lần hai.
- `engineMatchId` unique cho mỗi match.
- `OrderBookChanged` aggregate đúng.

---

## 18. Checklist Implementation

- [ ] Một goroutine mutate một Pair.
- [ ] Command Sequence guard đúng.
- [ ] Fixed-point không dùng float.
- [ ] Bid max-heap.
- [ ] Ask min-heap.
- [ ] FIFO cùng Price Level.
- [ ] Active order map hỗ trợ cancel.
- [ ] PlaceOrder có partial/full fill.
- [ ] CancelOrder remove đúng remaining order.
- [ ] `TradeCreated` có `engineMatchId`.
- [ ] `tradeId` là UUIDv7.
- [ ] Event Batch publish trước ACK.
- [ ] Duplicate command không mutate lại.
- [ ] Sequence gap phát `EngineFailed(COMMAND_SEQUENCE_GAP)`.
- [ ] Unit test matching đủ các case chính.
