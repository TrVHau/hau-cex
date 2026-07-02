# Hau CEX — Internal Message Contract

## 1. Mục đích

Tài liệu này định nghĩa contract giao tiếp nội bộ giữa các thành phần của Hau CEX:

- NestJS Backend API.
- Outbox Worker.
- Go Matching Engine.
- Engine Event Dispatcher và các Consumer nghiệp vụ.
- Market Data Worker.
- Blockchain Listener và Blockchain Worker.
- WebSocket Gateway.

Tài liệu tập trung vào:

- Message envelope thống nhất.
- Redis Stream và Consumer Group.
- Payload của từng Command và Event.
- Ordering, sequence và partition.
- ACK, retry, pending message và DLQ.
- Idempotency và replay.
- Phân biệt Engine Event chưa settlement với Domain Event đã commit.

Public REST API và Socket.IO API đã được mô tả trong `08-api-design.md` và không được thay thế bởi tài liệu này.

---

## 2. Phạm vi MVP

MVP sử dụng Redis Streams làm kênh vận chuyển message nội bộ.

Các nhóm message chính:

```text
Backend → Matching Engine
Matching Engine → Backend Consumers
Backend committed events → Market Data / WebSocket
Backend → Blockchain Worker
Blockchain Worker / Listener → Backend / WebSocket
```

MVP không sử dụng:

- Kafka.
- Exactly-once delivery từ message broker.
- Distributed transaction giữa PostgreSQL, Redis và Matching Engine.
- Protobuf hoặc Avro Schema Registry.
- Multi-region event replication.

---

## 3. Nguyên tắc chung

### 3.1. PostgreSQL commit trước khi phát Domain Event

Nếu một nghiệp vụ vừa thay đổi PostgreSQL vừa cần phát message:

1. Dữ liệu nghiệp vụ và Outbox Event được ghi trong cùng transaction.
2. Transaction PostgreSQL commit.
3. Outbox Worker mới publish message lên Redis Streams.

Không phát `TradeSettled`, `BalanceUpdated`, `OrderUpdated`, `DepositUpdated` hoặc `WithdrawalUpdated` trước khi transaction tương ứng commit.

### 3.2. Redis là transport, không phải nguồn dữ liệu tài chính chính

Redis Streams không phải source of truth cho:

- Wallet.
- Ledger.
- Order record.
- Trade đã settlement.
- Deposit đã credit.
- Withdrawal đã hoàn thành.

Redis Stream ID chỉ là ID vận chuyển và không được sử dụng thay cho `messageId`.

### 3.3. Delivery là at-least-once

Producer hoặc Consumer có thể retry, vì vậy cùng một message có thể được nhận nhiều lần.

Mọi Consumer phải idempotent.

Không giả định Redis Streams bảo đảm exactly-once delivery.

### 3.4. Thứ tự được bảo đảm theo Trading Pair

Các Command làm thay đổi cùng một Order Book phải được xử lý tuần tự theo:

```text
partitionKey = tradingPairId
commandSequence tăng liên tục
```

Không yêu cầu thứ tự tuyệt đối giữa hai Trading Pair khác nhau.

### 3.5. Dữ liệu tài chính dùng string

Các trường sau phải truyền dưới dạng JSON string:

- Price.
- Quantity.
- Fee.
- Balance.
- Notional.
- Order Sequence.
- Command Sequence.
- Trade Sequence.
- Order Book Sequence.
- Block Number.
- Nonce.

Không dùng JSON number cho giá trị có thể mất precision trong JavaScript.

### 3.6. Event chưa settlement và Event đã commit là hai lớp khác nhau

`TradeCreated` do Matching Engine phát chỉ mô tả kết quả matching trong Engine.

`TradeSettled` do Backend phát chỉ xuất hiện sau khi:

- Trade được insert vào PostgreSQL.
- Order, Wallet và Ledger đã được cập nhật.
- Transaction settlement đã commit.

Chỉ `TradeSettled` được dùng để cập nhật:

- Recent Trades công khai.
- Internal Last Price.
- Hau Candlestick.
- Ticker nội bộ.
- Public `trade.created`.

---

## 4. Redis Streams và Consumer Group

### 4.1. Danh sách Stream

| Stream                     | Producer chính                                        | Consumer chính                                         | Mục đích                                   |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| `stream:engine:commands`   | Outbox Worker                                         | Go Matching Engine                                     | Command thay đổi trạng thái Engine         |
| `stream:engine:events`     | Go Matching Engine                                    | Backend Engine Event Dispatcher                        | Event runtime của Engine                   |
| `stream:market:events`     | Outbox Worker, Market Data Worker                     | Market Data Worker, WebSocket Gateway                  | Domain Event đã commit và projection event |
| `stream:blockchain:events` | Outbox Worker, Blockchain Listener, Blockchain Worker | Blockchain Worker, Backend Consumer, WebSocket Gateway | Nghiệp vụ Deposit/Withdrawal               |
| `stream:dead-letter`       | Các Consumer/Worker                                   | Công cụ vận hành                                       | Message lỗi cần điều tra                   |

### 4.2. Consumer Group đề xuất

| Stream                     | Consumer Group                   | Message được xử lý                                                                                                                                                                                                                                                             | Ghi chú                                                                                           |
| -------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `stream:engine:commands`   | `matching-engine-v1`             | `PlaceOrder`, `CancelOrder`, `OpenMarket`, `SuspendMarket`, `CreateSnapshot`, `QueryOrderState`                                                                                                                                                                                | MVP chỉ có một active consumer trong group và một active Pair Engine writer cho mỗi Trading Pair  |
| `stream:engine:events`     | `backend-engine-events-v1`       | `OrderAccepted`, `OrderRejected`, `OrderOpened`, `OrderPartiallyFilled`, `OrderFilled`, `OrderCancelled`, `CancelOrderRejected`, `TradeCreated`, `OrderBookChanged`, `SnapshotCreated`, `OrderStateReported`, `MarketOpened`, `MarketSuspended`, `EngineReady`, `EngineFailed` | Dispatcher route theo `messageType`                                                               |
| `stream:market:events`     | `market-data-projection-v1`      | `TradeSettled`                                                                                                                                                                                                                                                                 | Message type đã biết nhưng ngoài trách nhiệm group phải ACK với `result = IGNORED`, không đưa DLQ |
| `stream:market:events`     | `market-websocket-fanout-v1`     | `TradeSettled`, `OrderUpdated`, `BalanceUpdated`                                                                                                                                                                                                                               | Message type đã biết nhưng ngoài trách nhiệm group phải ACK với `result = IGNORED`, không đưa DLQ |
| `stream:blockchain:events` | `blockchain-worker-v1`           | `WithdrawalApproved`                                                                                                                                                                                                                                                           | Message type đã biết nhưng ngoài trách nhiệm group phải ACK với `result = IGNORED`, không đưa DLQ |
| `stream:blockchain:events` | `blockchain-websocket-fanout-v1` | `DepositUpdated`, `WithdrawalUpdated`                                                                                                                                                                                                                                          | Message type đã biết nhưng ngoài trách nhiệm group phải ACK với `result = IGNORED`, không đưa DLQ |

Một Consumer Group nhận mỗi Redis entry đúng một lần trong phạm vi group, nhưng message vẫn có thể được giao lại khi Consumer lỗi hoặc ACK thất bại.

Message type đã biết nhưng không thuộc trách nhiệm của Consumer Group phải được ACK với `result = IGNORED` và không đưa vào DLQ. Chỉ message thuộc trách nhiệm group nhưng có version hoặc schema không hỗ trợ mới đi vào retry/DLQ theo policy.

### 4.3. Tên Consumer

Tên Consumer nên chứa instance ID:

```text
matching-engine-<instanceId>
backend-engine-events-<instanceId>
market-data-<instanceId>
blockchain-worker-<instanceId>
```

Không sử dụng hostname cố định làm business identifier.

---

## 5. Cấu trúc Redis Stream Entry

Mỗi Redis Stream entry sử dụng các field string sau:

```text
messageId
messageType
version
correlationId
occurredAt
partitionKey
commandSequence
payload
```

Trong đó:

- `payload` là JSON string.
- `partitionKey` và `commandSequence` có thể là chuỗi rỗng với message không yêu cầu ordering theo Trading Pair.
- Tất cả field Redis được đọc dưới dạng string trước khi decode.

Ví dụ:

```text
XADD stream:engine:commands *
  messageId       0197...
  messageType     PlaceOrder
  version         1
  correlationId   0197...
  occurredAt      2026-07-01T10:30:00.000Z
  partitionKey    0197-pair-id
  commandSequence 1051
  payload         {"orderId":"0197...","commandSequence":"1051"}
```

### 5.1. Redis Stream ID

Redis tạo ID dạng:

```text
1782892200000-0
```

ID này chỉ dùng cho:

- `XREADGROUP`.
- `XACK`.
- `XPENDING`.
- `XAUTOCLAIM`.
- Điều tra transport.

Không dùng Redis Stream ID để:

- Chống settlement trùng.
- Xác định Order Sequence.
- Xác định Trade Sequence.
- Làm Correlation ID.

---

## 6. Message Envelope

Envelope logic sau được áp dụng cho mọi Command và Event:

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

### 6.1. Định nghĩa field

| Field             | Kiểu                | Bắt buộc | Mô tả                                    |
| ----------------- | ------------------- | -------: | ---------------------------------------- |
| `messageId`       | UUID string         |       Có | ID duy nhất của message, bắt buộc UUIDv7 |
| `messageType`     | string              |       Có | Tên Command hoặc Event                   |
| `version`         | integer             |       Có | Version schema, bắt đầu từ `1`           |
| `correlationId`   | UUID string         |       Có | Theo dõi toàn bộ luồng nghiệp vụ         |
| `occurredAt`      | ISO 8601 UTC        |       Có | Thời điểm message được tạo               |
| `partitionKey`    | string/null         | Tùy loại | Với Engine message, bằng `tradingPairId` |
| `commandSequence` | decimal string/null | Tùy loại | Thứ tự Command của Trading Pair          |
| `payload`         | object              |       Có | Dữ liệu nghiệp vụ                        |

Với Command, `commandId` trong Business Rules chính là `messageId` của Message Envelope. Internal contract không truyền thêm field `commandId` độc lập.

### 6.2. Quy tắc `messageId`

- Producer tạo `messageId` trước khi publish.
- Outbox message sử dụng trực tiếp `outbox_events.message_id`.
- Matching Engine tạo `messageId` mới cho từng Event.
- Retry publish cùng một message phải giữ nguyên `messageId`.
- Replay Engine có thể tạo Event với `messageId` mới nếu không có durable event journal; các khóa nghiệp vụ như `tradeId` và `engineMatchId` vẫn phải ổn định.

### 6.3. Quy tắc `correlationId`

Một request tạo Order dùng cùng `correlationId` xuyên suốt:

```text
POST /orders
→ Outbox PlaceOrder
→ Engine Events
→ Trade Settlement
→ TradeSettled / OrderUpdated / BalanceUpdated
→ WebSocket
```

Nếu request không có `X-Correlation-Id`, Backend tự tạo UUIDv7.

### 6.4. Quy tắc `version`

- Version bắt đầu từ `1`.
- Thêm field optional không làm thay đổi ý nghĩa có thể giữ nguyên version.
- Thêm field required, đổi enum hoặc đổi semantics phải tăng version.
- Consumer không hỗ trợ version phải từ chối message và áp dụng retry/DLQ theo policy.
- Không silently parse payload version mới bằng schema cũ.

### 6.5. Payload hash

Consumer có thể lưu SHA-256 của payload đã canonicalize vào `processed_events.payload_hash`.

Canonicalization phải dùng một biểu diễn JSON deterministic giữa Go và TypeScript, khuyến nghị theo RFC 8785 JSON Canonicalization Scheme hoặc serializer tương đương với các quy tắc sau:

- Key được sắp xếp canonical.
- Không có whitespace thừa.
- Decimal string được giữ nguyên dưới dạng string.
- Giá trị string và thứ tự byte của UTF-8 phải ổn định.

Mục tiêu:

- Phát hiện cùng `messageId` nhưng payload khác.
- Hỗ trợ điều tra replay hoặc producer lỗi.

`checksum` của snapshot và `payload_hash` của message phải dùng cùng canonicalization rule.

Nếu cùng `consumerName + messageId` nhưng hash khác, đây là lỗi nghiêm trọng và không được xem là duplicate hợp lệ.

---

## 7. Quy ước dữ liệu trong payload

### 7.1. Tên field

Internal JSON sử dụng `camelCase` để thống nhất giữa TypeScript và Go:

```text
tradingPairId
commandSequence
remainingQuantity
engineMatchId
```

### 7.2. UUID

UUID truyền dưới dạng string chuẩn.

`messageId` và `correlationId` dùng UUIDv7.

Entity nghiệp vụ mới mặc định dùng UUIDv7.

Ngoại lệ:

- `tradeId` dùng UUIDv5 deterministic.
- `engineMatchId` là string ổn định theo công thức `tradingPairId + ":" + commandSequence + ":" + matchIndex`.
- `tradeId = UUIDv5(HAU_CEX_TRADE_NAMESPACE, engineMatchId)`.

Go và TypeScript phải dùng cùng `HAU_CEX_TRADE_NAMESPACE` cố định và cùng thuật toán UUIDv5 chuẩn.
Tài liệu Matching Engine Design phải định nghĩa giá trị UUID cụ thể của namespace này trước khi implement.

### 7.3. Decimal

Decimal phải:

- Là string.
- Không dùng scientific notation.
- Không có dấu `+`.
- Không có khoảng trắng.
- Được normalize trước khi producer tạo payload.

Ví dụ:

```text
"2000.150000000000000000"
"0.500000000000000000"
```

### 7.4. Enum

Enum sử dụng uppercase string:

```text
BUY
SELL
LIMIT
ACTIVE
SUSPENDED
```

### 7.5. EVM identifier

Các giá trị sau phải lowercase:

- Contract address.
- Sender address.
- Destination address.
- Transaction hash.
- Block hash.

---

## 8. Các loại Sequence

Không dùng lẫn các sequence sau:

| Sequence            | Owner              | Phạm vi              | Mục đích                            |
| ------------------- | ------------------ | -------------------- | ----------------------------------- |
| Order Sequence      | Backend PostgreSQL | Trading Pair         | Price-Time Priority                 |
| Command Sequence    | Backend PostgreSQL | Trading Pair         | Thứ tự mọi Engine Command           |
| Trade Sequence      | Matching Engine    | Trading Pair         | Thứ tự Trade được tạo               |
| Order Book Sequence | Matching Engine    | Trading Pair runtime | Đồng bộ snapshot/delta cho frontend |

### 8.1. Command Sequence

Engine duy trì:

```text
lastProcessedCommandSequence
expectedCommandSequence = lastProcessedCommandSequence + 1
```

Khi nhận Command:

- `commandSequence == expected`: xử lý.
- `commandSequence < expected`: duplicate hoặc replay cũ; không mutate Engine lần nữa.
- `commandSequence > expected`: phát hiện gap.
  - Không phát `OrderRejected`.
  - Không phát `CancelOrderRejected`.
  - Không mutate Order Book.
  - Không thay đổi trạng thái Order trong PostgreSQL.
  - Phát `EngineFailed` với `failureCode = COMMAND_SEQUENCE_GAP`.
  - Dừng Pair Engine.
  - Giữ Order ở `PENDING` hoặc `CANCEL_PENDING`.
  - Chỉ tiếp tục sau khi command bị thiếu được recovery hoặc replay thành công.

### 8.2. Order Sequence

Chỉ `PlaceOrder` có `orderSequence`.

Engine không tự cấp hoặc thay đổi Order Sequence.

### 8.3. Trade Sequence

Mỗi match tăng Trade Sequence đúng một lần.

Nếu một incoming Order khớp ba resting Order, Engine tạo ba `TradeCreated` với ba Trade Sequence liên tiếp.

Backend Settlement Consumer phải xử lý `TradeCreated` theo `tradeSequence` tăng liên tục trong từng Trading Pair. Không được settlement `tradeSequence = N + 1` trước khi `N` đã commit hoặc được xác định là duplicate hợp lệ.

### 8.4. Order Book Sequence

Mỗi `OrderBookChanged` tăng `bookSequence`.

`bookSequence` có thể được lưu trong snapshot payload để tiếp tục sau restart.

Nếu client phát hiện gap, client phải tải lại REST Order Book snapshot.

---

# 9. Backend → Matching Engine Commands

## 9.1. `PlaceOrder` v1

### Mục đích

Đưa một Limit Order đã được Backend validate và khóa số dư vào Matching Engine.

### Stream

```text
stream:engine:commands
```

### Payload

```json
{
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "userId": "0197...",
  "orderSequence": "880",
  "side": "BUY",
  "type": "LIMIT",
  "price": "2000.000000000000000000",
  "originalQuantity": "0.500000000000000000",
  "createdAt": "2026-07-01T10:30:00.000Z"
}
```

### Validation tại Engine

Engine phải kiểm tra tối thiểu:

- `commandSequence` hợp lệ và đúng thứ tự.
- Market đã được mở và Engine ở trạng thái `READY`.
- `orderId` chưa tồn tại trong Order Book hoặc dedupe state.
- `orderSequence > 0`.
- `price > 0`.
- `originalQuantity > 0`.
- `type = LIMIT`.
- `side` là `BUY` hoặc `SELL`.
- Price và Quantity chuyển được sang fixed-point theo Market config.

Engine không kiểm tra Wallet hoặc quyền User.

### Kết quả

Engine có thể phát:

```text
OrderAccepted
OrderRejected
TradeCreated (0..n)
OrderOpened (0..1)
OrderPartiallyFilled / OrderFilled (runtime verification)
OrderBookChanged (0..1 cho batch thay đổi của command)
```

---

## 9.2. `CancelOrder` v1

### Mục đích

Yêu cầu Engine loại phần Remaining Quantity của Order khỏi Order Book.

### Payload

```json
{
  "commandSequence": "1052",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "requestedBy": "USER",
  "requestedById": "0197...",
  "requestedAt": "2026-07-01T10:31:00.000Z"
}
```

`requestedBy`:

```text
USER
```

Trong MVP, `CancelOrder` chỉ dùng cho User cancel thông thường.
Giá trị `ADMIN` được reserved/future và chỉ được bật sau khi có nghiệp vụ riêng với `reason`, quyền phù hợp và Audit Log.

### Kết quả

Engine phát một trong:

```text
OrderCancelled
CancelOrderRejected
```

Nếu Order đã match một phần trước khi Cancel Command đến lượt xử lý, chỉ Remaining Quantity tại thời điểm xử lý bị hủy.

---

## 9.3. `OpenMarket` v1

### Mục đích

Khởi tạo hoặc mở Pair Engine với cấu hình đã được Backend phê duyệt.

### Payload

```json
{
  "commandSequence": "1050",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "baseAsset": {
    "id": "0197...",
    "symbol": "ETH",
    "decimals": 18
  },
  "quoteAsset": {
    "id": "0197...",
    "symbol": "USDT",
    "decimals": 18
  },
  "pricePrecision": 2,
  "quantityPrecision": 4,
  "tickSize": "0.010000000000000000",
  "stepSize": "0.000100000000000000",
  "minimumQuantity": "0.001000000000000000",
  "minimumNotional": "10.000000000000000000",
  "makerFeeRate": "0.0010000000",
  "takerFeeRate": "0.0015000000"
}
```

### Quy tắc

- Engine chỉ chuyển Pair Engine sang `READY` sau khi cấu hình hợp lệ và recovery hoàn tất.
- MVP không hot-update Tick Size, Step Size, Precision hoặc Fee Rate khi market đang `ACTIVE`.
- Muốn thay đổi cấu hình matching-critical: suspend market, bảo đảm trạng thái an toàn, cập nhật cấu hình rồi mở lại bằng `OpenMarket` mới.

### Kết quả

```text
MarketOpened
EngineFailed
```

---

## 9.4. `SuspendMarket` v1

### Payload

```json
{
  "commandSequence": "1053",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "reasonCode": "RECONCILIATION_REQUIRED",
  "reason": "Settlement is behind engine state.",
  "requestedAt": "2026-07-01T10:32:00.000Z"
}
```

### Quy tắc

Sau khi xử lý:

- Engine không xử lý `PlaceOrder` mới cho Trading Pair.
- Engine không xử lý `CancelOrder` từ User.
- Open Order hiện tại vẫn được giữ trong MVP.
- Admin Cancel Order là future scope, chưa được xử lý trong MVP.
- Khi bổ sung phải có API riêng, `reason`, authorization và Audit Log.

### Kết quả

```text
MarketSuspended
EngineFailed
```

---

## 9.5. `CreateSnapshot` v1

### Payload

```json
{
  "commandSequence": "1054",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "reason": "PERIODIC",
  "requestedAt": "2026-07-01T10:35:00.000Z"
}
```

`reason` đề xuất:

```text
PERIODIC
BEFORE_DEPLOY
BEFORE_MAINTENANCE
MANUAL
```

Snapshot phải được tạo sau khi Engine xử lý xong toàn bộ command trước đó và tại ranh giới giữa hai command.

### Kết quả

```text
SnapshotCreated
EngineFailed
```

---

## 9.6. `QueryOrderState` v1

### Mục đích

Hỏi trạng thái hiện tại của một Order trong Engine khi Backend cần reconciliation cho Order `PENDING` quá lâu hoặc cần xác minh phản hồi muộn.

### Payload

```json
{
  "commandSequence": "1055",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "requestedAt": "2026-07-01T10:36:00.000Z"
}
```

### Kết quả

```text
OrderStateReported
EngineFailed
```

---

# 10. Matching Engine → Backend Events

## 10.1. `OrderAccepted` v1

### Ý nghĩa

Engine đã nhận và chấp nhận `PlaceOrder` để thực hiện matching.

Event này không có nghĩa Order chắc chắn đã nằm trong Order Book.

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "orderSequence": "880",
  "acceptedAt": "2026-07-01T10:30:00.010Z"
}
```

Backend có thể dùng event này cho tracing và xác nhận Engine đã tiếp nhận, nhưng không được tự cập nhật Wallet.

---

## 10.2. `OrderRejected` v1

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "reasonCode": "INVALID_FIXED_POINT_VALUE",
  "reason": "Price cannot be represented using market precision.",
  "rejectedAt": "2026-07-01T10:30:00.011Z"
}
```

### `reasonCode` đề xuất

```text
MARKET_NOT_READY
MARKET_SUSPENDED
DUPLICATE_ORDER_CONFLICT
INVALID_ORDER
INVALID_FIXED_POINT_VALUE
INTERNAL_ENGINE_ERROR
```

### Backend Consumer

Trong một transaction:

- Kiểm tra `processed_events`.
- Chỉ cho phép `PENDING → REJECTED`.
- Lock Order và Wallet.
- Nếu Order không còn `PENDING`, không cập nhật trạng thái và phải reconciliation.
- Mở khóa toàn bộ `remaining_locked_amount`.
- Tạo Ledger Entry.
- Tạo committed Outbox Event.
- Ghi Processed Event.
- Commit rồi ACK.

---

## 10.3. `OrderOpened` v1

### Ý nghĩa

Sau matching, Order còn Remaining Quantity và đã được thêm vào Order Book.

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "orderSequence": "880",
  "remainingQuantity": "0.250000000000000000",
  "openedAt": "2026-07-01T10:30:00.015Z"
}
```

### Backend Consumer

- Nếu Order vẫn `PENDING`, có thể chuyển sang `OPEN`.
- Nếu Order đang `PARTIALLY_FILLED`, không được downgrade về `OPEN`.
- Nếu Order đang `CANCEL_PENDING` hoặc đã kết thúc, không cập nhật và phải reconciliation.
- Chỉ cho phép `PENDING → OPEN`.
- Không thay đổi Wallet hoặc Ledger.

---

## 10.4. `OrderPartiallyFilled` v1

### Ý nghĩa

Event runtime dùng cho kiểm tra và reconciliation.

Order và Wallet bền vững vẫn được cập nhật bởi `TradeCreated` settlement.

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "filledQuantity": "0.250000000000000000",
  "remainingQuantity": "0.250000000000000000",
  "updatedAt": "2026-07-01T10:30:00.014Z"
}
```

Backend không được settlement hoặc ghi Ledger chỉ dựa trên event này.

---

## 10.5. `OrderFilled` v1

### Ý nghĩa

Event runtime cho biết Engine không còn Remaining Quantity của Order.

Trạng thái `FILLED` trong PostgreSQL được xác lập bởi Trade Settlement Consumer.

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "filledQuantity": "0.500000000000000000",
  "remainingQuantity": "0",
  "filledAt": "2026-07-01T10:30:00.014Z"
}
```

---

## 10.6. `OrderCancelled` v1

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1052",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "cancelledQuantity": "0.250000000000000000",
  "finalFilledQuantity": "0.250000000000000000",
  "engineActiveQuantity": "0",
  "cancelledAt": "2026-07-01T10:31:00.010Z"
}
```

### Backend Consumer

Trong một transaction:

- Kiểm tra Processed Event.
- Lock Order.
- Lock Wallet.
- Mở khóa `remaining_locked_amount` trong PostgreSQL.
- Đặt `remaining_locked_amount = 0`.
- Chỉ chuyển Order sang `CANCELLED` khi PostgreSQL đang `CANCEL_PENDING`.
- Tạo Ledger Entry và committed Outbox Event.
- Ghi Processed Event.
- Commit rồi ACK.

Consumer phải verify `cancelledQuantity` phù hợp với trạng thái Order bền vững sau các Trade đã settlement trước đó.

`orders.remaining_quantity` vẫn giữ phần chưa khớp tại thời điểm hủy, tức bằng `cancelledQuantity` trong event. Chỉ `remaining_locked_amount` về `0` và `status` chuyển sang `CANCELLED`.

---

## 10.7. `CancelOrderRejected` v1

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1052",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "reasonCode": "ORDER_ALREADY_FILLED",
  "reason": "Order no longer has remaining quantity.",
  "engineOrderStatus": "FILLED",
  "rejectedAt": "2026-07-01T10:31:00.010Z"
}
```

### `reasonCode` đề xuất

```text
ORDER_NOT_FOUND
ORDER_ALREADY_FILLED
ORDER_ALREADY_CANCELLED
MARKET_NOT_READY
MARKET_SUSPENDED
INTERNAL_ENGINE_ERROR
```

### Backend Consumer

- Không mở khóa số dư chỉ vì nhận event này.
- `ORDER_ALREADY_FILLED`: chờ các `TradeCreated` trước đó được settlement; Order cuối cùng phải trở thành `FILLED`.
- `ORDER_ALREADY_CANCELLED`: xử lý idempotent nếu PostgreSQL đã `CANCELLED`; nếu chưa, yêu cầu reconciliation.
- `ORDER_NOT_FOUND`: suspend Trading Pair và reconciliation.
- `MARKET_SUSPENDED`:
  - Không mở khóa số dư.
  - Giữ Order ở trạng thái `CANCEL_PENDING`.
  - Không tự chuyển Order về `OPEN` hoặc `PARTIALLY_FILLED`.
  - Backend tạo `QueryOrderState` hoặc đưa Trading Pair vào reconciliation.
- Không chuyển Order từ `CANCEL_PENDING` về `OPEN` nếu chưa xác minh trạng thái Engine và PostgreSQL.

---

## 10.8. `TradeCreated` v1

### Ý nghĩa

Một cặp Buy Order và Sell Order đã match trong Matching Engine.

Mỗi match phát đúng một `TradeCreated`.

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "matchIndex": 0,
  "tradeId": "0197...",
  "engineMatchId": "0197-pair:1051:0",
  "tradeSequence": "1201",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "buyOrderId": "0197...",
  "sellOrderId": "0197...",
  "buyerId": "0197...",
  "sellerId": "0197...",
  "makerOrderId": "0197...",
  "takerOrderId": "0197...",
  "takerSide": "BUY",
  "executionPrice": "2000.000000000000000000",
  "executedQuantity": "0.500000000000000000",
  "buyerFeeRate": "0.0015000000",
  "sellerFeeRate": "0.0010000000",
  "buyerFeeAssetId": "0197-base-asset-id",
  "sellerFeeAssetId": "0197-quote-asset-id",
  "buyerFeeAmount": "0.000750000000000000",
  "sellerFeeAmount": "1.000000000000000000",
  "buyOrderRemainingQuantity": "0",
  "sellOrderRemainingQuantity": "0",
  "matchedAt": "2026-07-01T10:30:00.013Z"
}
```

### Quy tắc `engineMatchId`

`engineMatchId` phải deterministic cho cùng một match khi replay.

Công thức logic đề xuất:

```text
engineMatchId = tradingPairId + ":" + commandSequence + ":" + matchIndex
tradeId = UUIDv5(HAU_CEX_TRADE_NAMESPACE, engineMatchId)
```

`engineMatchId` là string nghiệp vụ ổn định. `tradeId` là UUID deterministic sinh từ `engineMatchId`.

Producer không được dùng UUIDv7/random cho `tradeId`, vì replay cùng một command phải tái tạo đúng cùng `tradeId`.

### Quy tắc phí

- Engine tính fee theo Market config đang có tại thời điểm match.
- Buyer trả phí bằng Base Asset.
- Seller trả phí bằng Quote Asset.
- Buyer Fee được credit vào Treasury Wallet của Base Asset.
- Seller Fee được credit vào Treasury Wallet của Quote Asset.
- Fee dùng `ROUND_DOWN` theo decimals của Asset thu phí.
- Settlement Consumer phải tự tính lại và verify `buyerFeeAmount` và `sellerFeeAmount`.
- Payload mismatch phải được xem là lỗi reconciliation, không được tự chọn một giá trị bất kỳ.

### Backend Settlement Consumer

Trong một transaction:

1. Kiểm tra `(consumerName, messageId)`.
2. Kiểm tra `engineMatchId`.
3. Nếu `engineMatchId` đã tồn tại và payload khớp, ghi Processed Event cho message hiện tại rồi ACK sau commit.
4. Nếu `engineMatchId` đã tồn tại nhưng payload khác, dừng và cảnh báo.
5. Lock Buy Order và Sell Order theo thứ tự ID.
6. Lock Wallet buyer, seller và Treasury theo thứ tự `assetId`, sau đó `userId`.
7. Recalculate quantity, quote amount, fee và price refund.
8. Insert Trade.
9. Update Order, Wallet buyer/seller/Treasury và Ledger.
   - Nếu trạng thái Order hiện tại là `CANCEL_PENDING` và `newRemainingQuantity > 0`, giữ nguyên `CANCEL_PENDING`.
   - Nếu trạng thái Order hiện tại là `CANCEL_PENDING` và `newRemainingQuantity = 0`, chuyển sang `FILLED`.
   - Không chuyển `CANCEL_PENDING` về `PARTIALLY_FILLED`.
10. Ghi Processed Event.
11. Tạo Outbox `TradeSettled`, `OrderUpdated`, `BalanceUpdated`.
12. Commit rồi ACK.

`TradeCreated` không được phát trực tiếp tới frontend.

---

## 10.9. `OrderBookChanged` v1

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1051",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "bookSequence": "8452",
  "previousBookSequence": "8451",
  "bids": [
    {
      "price": "2000.00",
      "totalQuantity": "4.0000",
      "orderCount": 3
    },
    {
      "price": "1999.00",
      "totalQuantity": "0",
      "orderCount": 0
    }
  ],
  "asks": [
    {
      "price": "2001.00",
      "totalQuantity": "2.2500",
      "orderCount": 1
    }
  ],
  "changedAt": "2026-07-01T10:30:00.016Z"
}
```

### Delta semantics

Mỗi phần tử có dạng:

```json
{
  "price": "2000.00",
  "totalQuantity": "4.0000",
  "orderCount": 3
}
```

- `totalQuantity > 0`: thay thế toàn bộ quantity của price level.
- `totalQuantity = 0`: xóa price level.
- `orderCount` là số Order đang nằm ở price level đó.
- Không cộng dồn delta vào quantity hiện tại.

### Quy tắc

- Event phản ánh Order Book runtime của Hau CEX.
- Có thể được chuyển thành public `orderbook.update`.
- Không chứa User ID hoặc Order ID.
- Nếu sequence gap, WebSocket Gateway hoặc frontend phải resync bằng snapshot.

---

## 10.10. `SnapshotCreated` v1

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1054",
  "snapshotId": "0197...",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "lastCommandSequence": "1054",
  "lastOrderSequence": "880",
  "lastTradeSequence": "1201",
  "snapshotVersion": 1,
  "orderCount": 25,
  "checksum": "lowercase-sha256-or-configured-checksum",
  "snapshotPayload": {
    "engineState": "READY",
    "bookSequence": "8452",
    "marketConfig": {
      "pricePrecision": 2,
      "quantityPrecision": 4,
      "tickSize": "0.010000000000000000",
      "stepSize": "0.000100000000000000",
      "makerFeeRate": "0.0010000000",
      "takerFeeRate": "0.0015000000"
    },
    "bids": [
      {
        "price": "2000.000000000000000000",
        "orders": [
          {
            "orderId": "0197...",
            "userId": "0197...",
            "orderSequence": "870",
            "originalQuantity": "1.000000000000000000",
            "filledQuantity": "0.250000000000000000",
            "remainingQuantity": "0.750000000000000000"
          }
        ]
      }
    ],
    "asks": []
  },
  "createdAt": "2026-07-01T10:35:00.020Z"
}
```

### Snapshot Consumer

- Verify schema version.
- Verify Trading Pair và sequence.
- Recalculate checksum.
- Verify `orderCount`.
- Insert `engine_snapshots` và `processed_events` trong cùng transaction.
- Không mutate Order, Wallet, Ledger hoặc Trade.
- Chỉ ACK sau commit.

`checksum` phải được tính trên `snapshotPayload` đã canonicalize bằng cùng rule với `payload_hash` ở mục 6.5.

---

## 10.11. `MarketOpened` v1

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1050",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "engineState": "READY",
  "openedAt": "2026-07-01T09:00:00.000Z"
}
```

Backend chỉ chuyển Trading Pair sang trạng thái sẵn sàng nhận Order khi cả trạng thái quản trị và Engine readiness đều hợp lệ.

---

## 10.12. `MarketSuspended` v1

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1053",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "reasonCode": "RECONCILIATION_REQUIRED",
  "suspendedAt": "2026-07-01T10:32:00.010Z"
}
```

---

## 10.13. `EngineReady` v1

```json
{
  "engineInstanceId": "engine-01",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "lastCommandSequence": "1054",
  "lastOrderSequence": "880",
  "lastTradeSequence": "1201",
  "bookSequence": "8452",
  "readyAt": "2026-07-01T09:00:00.000Z"
}
```

`EngineReady` nên được phát theo từng Trading Pair sau recovery.

---

## 10.14. `EngineFailed` v1

```json
{
  "engineInstanceId": "engine-01",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "failureCode": "COMMAND_SEQUENCE_GAP",
  "failureMessage": "Expected command sequence 1052 but received 1053.",
  "lastCommandSequence": "1051",
  "failedAt": "2026-07-01T10:32:00.000Z"
}
```

### `failureCode` đề xuất

```text
COMMAND_SEQUENCE_GAP
SNAPSHOT_INVALID
RECOVERY_FAILED
EVENT_PUBLISH_FAILED
MARKET_CONFIG_INVALID
INTERNAL_ENGINE_ERROR
```

Khi lỗi ảnh hưởng tính đúng đắn của Order Book, Trading Pair phải bị chặn nhận Order mới và yêu cầu reconciliation.

---

## 10.15. `OrderStateReported` v1

### Payload

```json
{
  "sourceCommandId": "0197...",
  "commandSequence": "1055",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "orderId": "0197...",
  "found": true,
  "engineStatus": "OPEN",
  "filledQuantity": "0",
  "remainingQuantity": "0.500000000000000000",
  "lastProcessedCommandSequence": "1055",
  "reportedAt": "2026-07-01T10:36:00.010Z"
}
```

Backend dùng event này cho pending-timeout reconciliation. Nếu `found = false` hoặc sequence lệch, Trading Pair phải được đưa vào reconciliation.

---

# 11. Backend Committed Domain Events

Các Event trong mục này chỉ được tạo bằng Outbox sau khi PostgreSQL commit.

## 11.1. `TradeSettled` v1

### Stream

```text
stream:market:events
```

### Payload

```json
{
  "tradeId": "0197...",
  "engineMatchId": "0197-pair:1051:0",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "price": "2000.000000000000000000",
  "quantity": "0.500000000000000000",
  "quoteAmount": "1000.000000000000000000",
  "takerSide": "BUY",
  "tradeSequence": "1201",
  "matchedAt": "2026-07-01T10:30:00.013Z",
  "settledAt": "2026-07-01T10:30:00.050Z"
}
```

Consumer:

- Market Data Worker.
- Public WebSocket fan-out sau khi projection cần thiết sẵn sàng.

---

## 11.2. `OrderUpdated` v1

```json
{
  "userId": "0197...",
  "orderId": "0197...",
  "tradingPairId": "0197...",
  "market": "ETH_USDT",
  "status": "PARTIALLY_FILLED",
  "filledQuantity": "0.250000000000000000",
  "remainingQuantity": "0.250000000000000000",
  "remainingLockedAmount": "500.000000000000000000",
  "updatedAt": "2026-07-01T10:30:00.050Z"
}
```

Event chỉ được phát tới private room của `userId`.

---

## 11.3. `BalanceUpdated` v1

```json
{
  "userId": "0197...",
  "walletId": "0197...",
  "assetId": "0197...",
  "asset": "USDT",
  "availableBalance": "900.000000000000000000",
  "lockedBalance": "500.000000000000000000",
  "totalBalance": "1400.000000000000000000",
  "reason": "TRADE_SETTLEMENT",
  "referenceType": "TRADE",
  "referenceId": "0197...",
  "updatedAt": "2026-07-01T10:30:00.050Z"
}
```

---

## 11.4. `DepositUpdated` v1

```json
{
  "userId": "0197...",
  "depositId": "0197...",
  "assetId": "0197...",
  "asset": "USDT",
  "status": "CREDITED",
  "amount": "100.000000000000000000",
  "confirmations": 3,
  "requiredConfirmations": 3,
  "txHash": "0x...",
  "updatedAt": "2026-07-01T10:02:00.000Z"
}
```

---

## 11.5. `WithdrawalApproved` v1

### Stream

```text
stream:blockchain:events
```

### Payload

```json
{
  "withdrawalId": "0197...",
  "userId": "0197...",
  "assetId": "0197...",
  "asset": "USDT",
  "chainId": "11155111",
  "tokenAddress": "0x...",
  "vaultAddress": "0x...",
  "destinationAddress": "0x...",
  "withdrawalAmount": "100.000000000000000000",
  "feeAmount": "1.000000000000000000",
  "receivedAmount": "99.000000000000000000",
  "approvedBy": "0197...",
  "approvedAt": "2026-07-01T10:40:00.000Z"
}
```

Blockchain Worker phải lock Withdrawal và kiểm tra lại trạng thái `APPROVED` cùng `txHash == null` trước khi broadcast.

---

## 11.6. `WithdrawalUpdated` v1

```json
{
  "userId": "0197...",
  "withdrawalId": "0197...",
  "assetId": "0197...",
  "asset": "USDT",
  "status": "BROADCASTED",
  "txHash": "0x...",
  "confirmations": 0,
  "updatedAt": "2026-07-01T10:41:00.000Z"
}
```

---

# 12. Engine Event Dispatch

`stream:engine:events` sử dụng một logical Consumer Group:

```text
backend-engine-events-v1
```

Dispatcher route theo `messageType`:

| Message Type           | Logical Handler               |
| ---------------------- | ----------------------------- |
| `OrderAccepted`        | Order Event Handler           |
| `OrderRejected`        | Order Rejection Handler       |
| `OrderOpened`          | Order Event Handler           |
| `OrderPartiallyFilled` | Reconciliation Handler        |
| `OrderFilled`          | Reconciliation Handler        |
| `OrderCancelled`       | Order Cancellation Handler    |
| `CancelOrderRejected`  | Order/Reconciliation Handler  |
| `TradeCreated`         | Trade Settlement Handler      |
| `OrderBookChanged`     | Order Book Projection Handler |
| `SnapshotCreated`      | Snapshot Handler              |
| `OrderStateReported`   | Order/Reconciliation Handler  |
| `MarketOpened`         | Engine State Handler          |
| `MarketSuspended`      | Engine State Handler          |
| `EngineReady`          | Engine State Handler          |
| `EngineFailed`         | Alert/Reconciliation Handler  |

### 12.1. Ordering phía Backend

Nếu chạy nhiều dispatcher instance, không được xử lý đồng thời hai Engine Event làm thay đổi cùng một Trading Pair theo cách phá vỡ sequence.

MVP sử dụng một trong hai cách:

```text
Cách A — Một Engine Event Dispatcher instance
```

hoặc:

```text
Cách B — Dispatcher route vào per-pair FIFO queue,
mỗi Trading Pair chỉ có một worker logic tại một thời điểm
```

Trade Settlement phải kiểm tra `tradeSequence` liên tục theo Trading Pair. Không được settlement `tradeSequence = N + 1` trước khi `N` đã commit hoặc được xác định là duplicate hợp lệ.

### 12.2. Không chia cùng một Event cho nhiều handler độc lập trước settlement

`TradeCreated` chỉ được Trade Settlement Handler xử lý tài chính.

Sau commit, Handler phát các committed Domain Event mới cho Market Data và WebSocket.

Không để Market Data Worker đọc trực tiếp `TradeCreated` từ Engine.

---

# 13. ACK Policy

## 13.1. Matching Engine ACK Command

Engine chỉ `XACK` Command sau khi:

1. Command đã được validate theo sequence.
2. Engine đã hoàn tất toàn bộ mutation in-memory của command.
3. Toàn bộ Engine Event kết quả đã được publish thành công vào `stream:engine:events`.

Nếu publish Event thất bại:

- Không ACK Command.
- Pair Engine ngừng xử lý command tiếp theo.
- Retry publish cùng Event với cùng `messageId` trong cùng process.
- Nếu process restart, recovery replay command từ nguồn bền vững.

## 13.2. Backend ACK Engine Event

Backend chỉ `XACK` sau khi:

- Transaction nghiệp vụ đã commit; hoặc
- Message được xác định là duplicate hợp lệ và Processed Event đã được ghi/đã tồn tại; hoặc
- Projection không cần transaction đã cập nhật thành công.

## 13.3. Outbox publish

Outbox Worker chỉ chuyển row sang `PUBLISHED` sau khi Redis `XADD` thành công.

Retry publish phải giữ nguyên `messageId` và payload.

---

# 14. Idempotency

## 14.1. Engine Command

Engine chống xử lý trùng bằng:

```text
messageId
commandSequence
```

Quy tắc:

- Cùng `messageId` và payload giống nhau: duplicate hợp lệ.
- Cùng `messageId` nhưng payload khác: lỗi nghiêm trọng.
- `commandSequence < expected`: không mutate Engine lần nữa.
- `commandSequence > expected`: sequence gap, không phát rejection event, phát `EngineFailed(COMMAND_SEQUENCE_GAP)` và dừng Pair Engine.

Engine chỉ ACK duplicate command nếu kết quả trước đó đã được publish an toàn hoặc command được xác định đã nằm trong snapshot/recovery state hợp lệ.

## 14.2. Backend Consumer

Khóa chung:

```text
consumerName + messageId
```

Lưu trong:

```text
processed_events
```

Processed Event phải được ghi cùng transaction với nghiệp vụ.

## 14.3. Trade Settlement

Ngoài `messageId`, Trade Settlement phải dùng:

```text
engineMatchId
```

Lý do: Engine replay có thể tạo `TradeCreated.messageId` mới nhưng cùng một match phải giữ cùng `engineMatchId`.

## 14.4. Deposit

Khóa chống trùng:

```text
chainId + txHash + logIndex
```

## 14.5. Withdrawal broadcast

Blockchain Worker phải chống gửi trùng bằng:

```text
withdrawalId
chainId + senderAddress + nonce
txHash nếu đã có
```

---

# 15. Retry và Pending Entry List

## 15.1. Retryable error

Ví dụ:

```text
PostgreSQL unavailable
Redis timeout
Row lock timeout
RPC temporarily unavailable
Dependency not ready
```

Xử lý:

- Không ACK.
- Ghi structured log.
- Retry với exponential backoff.
- Giữ `correlationId`, `messageId` và payload cũ.

## 15.2. Non-retryable hoặc poison message

Ví dụ:

```text
Unsupported message version
Payload schema invalid
Payload hash conflict
engineMatchId conflict
Snapshot checksum mismatch
```

Xử lý:

- Copy message và failure metadata sang DLQ.
- Block partition hoặc suspend Trading Pair nếu ảnh hưởng Engine/financial ordering.
- Không tự bỏ qua message để xử lý message phía sau cùng partition.
- Tạo alert và yêu cầu vận hành/reconciliation.

## 15.3. Ordered Command Sequence Gap

Điều kiện:

```text
commandSequence > expectedCommandSequence
```

Command hiện tại không được xem là poison message vì payload có thể hoàn toàn hợp lệ; Engine chỉ chưa nhận được command đứng trước.

Xử lý:

- Không ACK command hiện tại.
- Không mutate Order Book.
- Không phát `OrderRejected`.
- Không phát `CancelOrderRejected`.
- Phát `EngineFailed` với `failureCode = COMMAND_SEQUENCE_GAP`.
- Dừng Pair Engine và block Trading Pair.
- Không xử lý command phía sau của cùng Trading Pair.
- Recovery Coordinator tìm và replay command bị thiếu.
- Sau khi sequence liên tục trở lại, Engine xử lý lại command đang pending.
- Có thể copy một bản chẩn đoán sang DLQ, nhưng không được ACK hoặc bỏ original message.

## 15.4. Claim message bị treo

Worker có thể dùng:

```text
XPENDING
XAUTOCLAIM
```

`minIdleTime`, retry count và backoff phải cấu hình theo từng Consumer.

Giá trị khởi đầu đề xuất cho MVP:

```text
minIdleTime: 30–60 giây
maxDeliveryCount: 5
```

Đây là cấu hình vận hành, không phải business constant.

---

# 16. Dead-letter Message

Message được ghi vào:

```text
stream:dead-letter
```

Payload DLQ:

```json
{
  "failedMessageId": "0197...",
  "originalStream": "stream:engine:events",
  "originalEntryId": "1782892200000-0",
  "failedConsumerGroup": "backend-engine-events-v1",
  "failedConsumer": "backend-engine-events-api-01",
  "failureCode": "ENGINE_MATCH_PAYLOAD_CONFLICT",
  "failureMessage": "Existing trade differs from replayed TradeCreated payload.",
  "deliveryCount": 5,
  "failedAt": "2026-07-01T10:45:00.000Z",
  "originalMessage": {
    "messageId": "0197...",
    "messageType": "TradeCreated",
    "version": 1,
    "correlationId": "0197...",
    "occurredAt": "2026-07-01T10:30:00.013Z",
    "partitionKey": "0197-pair-id",
    "commandSequence": "1051",
    "payload": {}
  }
}
```

### 16.1. Ordered message không được skip

Với Engine Command hoặc Engine Event ảnh hưởng tài chính:

- DLQ không có nghĩa message được bỏ qua.
- Trading Pair liên quan phải bị block/suspend.
- Message phía sau cùng partition không được xử lý cho đến khi lỗi được giải quyết.
- Retry thủ công phải có Audit Log.

### 16.2. Projection có thể tái tạo

Với projection như Ticker/Candlestick:

- Có thể đưa message lỗi vào DLQ.
- Có thể rebuild projection từ Trade đã settlement trong PostgreSQL.
- Không được sửa Wallet hoặc Ledger để chữa lỗi projection.

---

# 17. Replay và Recovery

## 17.1. Nguồn replay

Nguồn replay Engine bền vững là:

```text
engine_snapshots
outbox_events có partitionKey + commandSequence
```

Redis Streams chỉ là transport.

## 17.2. Recovery Coordinator

Matching Engine không truy cập trực tiếp PostgreSQL.

Backend Recovery Coordinator:

1. Đọc snapshot mới nhất của Trading Pair.
2. Verify snapshot metadata và checksum.
3. Đọc Engine Command Log có `commandSequence > lastCommandSequence`.
4. Gửi snapshot state và các Command gốc cho Engine qua internal recovery interface.
5. Giữ nguyên `messageId`, `commandSequence`, `orderSequence` và payload của Command replay.
6. Chờ Engine replay xong.
7. Nhận `EngineReady`.
8. Mới cho phép publish/consume live Command tiếp theo.

Transport cụ thể của recovery interface được mô tả trong `10-matching-engine-design.md`; payload snapshot và command phải tuân thủ contract của tài liệu này.

## 17.3. Command Log gap

Nếu Command Log thiếu sequence:

- Recovery dừng.
- Pair Engine không chuyển `READY`.
- Trading Pair bị suspend.
- Không tự bỏ qua sequence thiếu.

## 17.4. Event replay

Nếu Engine replay cùng command:

- Order Book cuối phải deterministic.
- `tradeId` và `engineMatchId` của từng match phải giữ nguyên.
- `tradeSequence` phải khôi phục từ snapshot và tạo lại đúng thứ tự.
- Event `messageId` có thể mới nếu chưa có durable Engine Event Journal.
- Backend Settlement Consumer dựa vào `engineMatchId` để ngăn settlement trùng.

---

# 18. Message Validation

Mỗi Producer phải validate trước khi publish.

Mỗi Consumer phải validate lại trước khi xử lý.

Validation tối thiểu:

```text
messageId đúng UUID
messageType được hỗ trợ
version được hỗ trợ
correlationId đúng UUID
occurredAt đúng ISO 8601 UTC
payload đúng schema
partitionKey khớp tradingPairId khi có
commandSequence root khớp payload.commandSequence khi có
Decimal và BIGINT ở dạng string
Enum hợp lệ
```

Message sai schema không được truyền sâu vào nghiệp vụ tài chính.

---

# 19. Observability

Log của Producer/Consumer nên chứa:

```text
service
consumerGroup
consumerName
stream
redisEntryId
messageId
messageType
version
correlationId
partitionKey
commandSequence
tradingPairId
orderId
tradeId
engineMatchId
deliveryCount
durationMs
result
errorCode
```

Metrics đề xuất:

```text
stream_publish_total
stream_publish_failure_total
stream_consume_total
stream_consume_failure_total
stream_pending_messages
stream_delivery_count
engine_command_sequence_gap_total
engine_event_lag_ms
trade_settlement_success_total
trade_settlement_failure_total
dlq_messages_total
```

Không log:

- Password.
- Access Token.
- Refresh Token.
- Private Key.
- Full sensitive payload của authentication.

---

# 20. Contract Testing

TypeScript và Go phải có shared test vectors cho từng message version.

Mỗi contract cần kiểm thử:

1. Payload hợp lệ decode được ở cả TypeScript và Go.
2. Decimal không mất precision.
3. BIGINT không bị parse thành JavaScript number.
4. Enum không hỗ trợ bị reject.
5. Thiếu required field bị reject.
6. Extra optional field không phá consumer cùng version.
7. Version không hỗ trợ đi vào error policy.
8. Payload hash giống nhau giữa producer và consumer nếu bật hash.
9. Retry giữ nguyên `messageId`.
10. Replay giữ nguyên `tradeId` và `engineMatchId`.
11. UUIDv5 `tradeId` sinh từ cùng `HAU_CEX_TRADE_NAMESPACE` và `engineMatchId` giống nhau ở Go và TypeScript.

Test quan trọng:

```text
PlaceOrder bị publish hai lần
CancelOrder đến sau khi Order đã Filled
Command Sequence bị thiếu
TradeCreated cùng engineMatchId và payload giống nhau
TradeCreated cùng engineMatchId nhưng payload khác nhau
QueryOrderState tạo OrderStateReported với lastProcessedCommandSequence đúng
Snapshot checksum sai
Consumer crash sau DB commit nhưng trước XACK
Engine crash sau mutation nhưng trước ACK command
```

---

# 21. Message Catalog tổng hợp

## Backend → Matching Engine

```text
PlaceOrder v1
CancelOrder v1
OpenMarket v1
SuspendMarket v1
CreateSnapshot v1
QueryOrderState v1
```

## Matching Engine → Backend

```text
OrderAccepted v1
OrderRejected v1
OrderOpened v1
OrderPartiallyFilled v1
OrderFilled v1
OrderCancelled v1
CancelOrderRejected v1
TradeCreated v1
OrderBookChanged v1
SnapshotCreated v1
MarketOpened v1
MarketSuspended v1
EngineReady v1
EngineFailed v1
OrderStateReported v1
```

## Backend committed events

```text
TradeSettled v1
OrderUpdated v1
BalanceUpdated v1
DepositUpdated v1
WithdrawalApproved v1
WithdrawalUpdated v1
```

---

# 22. Internal Message ADR

## MSG-ADR-001 — Redis Streams cho MVP

Redis Streams được chọn vì đã có Redis trong kiến trúc, hỗ trợ Consumer Group, Pending Entry List và phù hợp quy mô demo.

## MSG-ADR-002 — At-least-once + Idempotent Consumer

Hệ thống không dựa vào exactly-once delivery. Tính đúng đắn được bảo đảm bằng transaction, unique constraint, Processed Event và deterministic business key.

## MSG-ADR-003 — Ordered Engine Command theo Trading Pair

Mọi Engine Command có `partitionKey = tradingPairId` và `commandSequence` tăng liên tục.

## MSG-ADR-004 — TradeCreated không phải public Trade

`TradeCreated` chỉ là Engine Event. Chỉ `TradeSettled` sau PostgreSQL commit mới được dùng cho Market Data và WebSocket công khai.

## MSG-ADR-005 — engineMatchId chống settlement trùng khi replay

`messageId` có thể thay đổi khi Engine replay không có durable event journal. `tradeId` và `engineMatchId` của cùng một logical match không được thay đổi. `engineMatchId` phải deterministic và là business idempotency key bổ sung.

## MSG-ADR-006 — Redis Stream ID không phải Business ID

Redis Stream ID chỉ phục vụ transport và pending message management.

## MSG-ADR-007 — Recovery Coordinator đọc PostgreSQL thay cho Engine

Matching Engine không truy cập SQL trực tiếp. Backend Recovery Coordinator cung cấp snapshot và Command Log cho Engine.

---

# 23. Tiêu chí hoàn thành

Internal Message Contract được xem là hoàn thành khi:

1. TypeScript và Go dùng cùng field name, enum và version.
2. `PlaceOrder` và `CancelOrder` được xử lý đúng thứ tự theo Trading Pair.
3. Engine không xử lý một Command hai lần.
4. Backend không settlement một match hai lần.
5. Consumer chỉ ACK sau commit hoặc duplicate hợp lệ.
6. Message lỗi có retry, DLQ và partition blocking phù hợp.
7. Trade chưa settlement không xuất hiện trong public Market Data.
8. Snapshot và replay giữ đúng Command, Order và Trade Sequence.
9. Contract test chạy được ở cả Backend và Matching Engine.
10. Recovery không yêu cầu Matching Engine truy cập trực tiếp PostgreSQL.
