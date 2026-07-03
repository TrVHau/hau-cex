# Hau CEX — System Architecture

## 1. Mục Đích

Tài liệu này mô tả kiến trúc MVP của Hau CEX.

MVP tập trung vào:

- Spot Limit Order.
- Go Matching Engine.
- Wallet và Ledger nội bộ.
- Atomic Trade Settlement.
- Redis Streams + Outbox.
- Realtime update.
- Docker Compose.

---

## 2. Thành Phần

```text
Frontend
Backend API
Backend Worker
Go Matching Engine
PostgreSQL
Redis
WebSocket Gateway
```

### Frontend

- React + TypeScript.
- Gọi REST API.
- Subscribe Socket.IO.
- Hiển thị market, order book, recent trades, wallet và order.
- Nếu triển khai chart Optional, lấy candlestick từ API nội bộ Hau CEX.

### Backend API

- NestJS.
- Authentication.
- User/Admin API.
- Asset và Trading Pair API.
- Wallet, Ledger, Order và Trade API.
- Validate Order.
- Lock Wallet khi tạo Order.
- Ghi Outbox command.

### Backend Worker

- Publish Outbox message lên Redis Streams.
- Consume Engine Event.
- Trade Settlement.
- Lưu latest Order Book snapshot vào Redis khi nhận `OrderBookChanged`.
- Publish domain event sau commit.

### Go Matching Engine

- Consume Engine Command từ Redis Streams.
- Quản lý Order Book in-memory.
- Khớp Limit Order theo Price-Time Priority.
- Publish Engine Event.

### PostgreSQL

Nguồn dữ liệu bền vững cho:

- User.
- Session.
- Asset.
- Trading Pair.
- Wallet.
- Ledger.
- Order.
- Trade.
- Outbox.
- Processed Event.

### Redis

Dùng cho:

- Redis Streams.
- Consumer Group.
- Cache nhẹ.
- Rate limit.
- WebSocket fan-out.
- Dead-letter stream.

Redis không phải nguồn dữ liệu tài chính chính.

---

## 3. Luồng Chính

### 3.1. Place Order

```text
User
→ Backend API
→ PostgreSQL transaction
   - lock Wallet
   - kiểm tra balance
   - tạo Order PENDING
   - chuyển available sang locked
   - tạo Ledger LOCK
   - tạo Outbox PlaceOrder
→ Outbox Worker
→ Redis Streams
→ Matching Engine
```

### 3.2. Matching

```text
Matching Engine
→ xử lý PlaceOrder theo Command Sequence
→ match Price-Time Priority
→ publish TradeCreated / OrderOpened / OrderBookChanged
→ ACK command sau khi publish event thành công
```

### 3.3. Trade Settlement

```text
Backend Worker consume TradeCreated
→ PostgreSQL transaction
   - chống trùng bằng processed_events
   - chống trùng Trade bằng engineMatchId
   - tạo Trade
   - cập nhật hai Order
   - cập nhật Wallet buyer/seller/Treasury
   - tạo Ledger Entries
   - tạo Outbox TradeSettled, OrderUpdated, BalanceUpdated
→ commit
→ ACK event
```

### 3.4. Cancel Order

```text
User
→ Backend API
→ Order OPEN/PARTIALLY_FILLED thành CANCEL_PENDING
→ Outbox CancelOrder
→ Matching Engine remove remaining order
→ OrderCancelled
→ Backend unlock remaining amount
→ Order CANCELLED
```

### 3.5. Order Book Snapshot và Realtime

```text
Matching Engine
→ OrderBookChanged
→ Backend Worker
→ lưu latest snapshot vào Redis
→ phát orderbook.update
```

Redis key:

```text
cache:orderbook:{tradingPairId}
```

REST API `GET /markets/:symbol/order-book` đọc latest snapshot từ Redis.
`bestBid` và `bestAsk` cũng lấy từ snapshot này.

Recent Trades và Last Price vẫn lấy từ PostgreSQL Trade đã settlement.

## 4. Redis Streams

Streams:

```text
stream:engine:commands
stream:engine:events
stream:market:events
stream:dead-letter
```

Engine commands:

```text
PlaceOrder
CancelOrder
OpenMarket
SuspendMarket
```

Engine events:

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

Domain events:

```text
TradeSettled
OrderUpdated
BalanceUpdated
```

---

## 5. Ownership

| Dữ liệu             | Owner           |
| ------------------- | --------------- |
| Wallet              | Backend         |
| Ledger              | Backend         |
| Order bền vững      | Backend         |
| Order Book runtime  | Matching Engine |
| Trade settlement    | Backend         |
| Command Sequence    | Backend         |
| Trade Sequence      | Matching Engine |
| Order Book Sequence | Matching Engine |

Matching Engine không được ghi PostgreSQL.

Backend không được sửa trực tiếp Order Book runtime.

---

## 6. Consistency Rules

- PostgreSQL transaction là ranh giới commit tài chính.
- Consumer chỉ ACK sau commit.
- Mọi thay đổi Wallet phải có Ledger Entry.
- Trade chỉ public sau settlement commit.
- WebSocket chỉ phát domain event đã commit.
- Redis Stream ID không phải business ID.
- `messageId` dùng cho idempotency message.
- `engineMatchId` dùng cho idempotency Trade settlement.

---

## 7. Realtime

Public events:

```text
orderbook.update
trade.created
```

Private events:

```text
order.updated
balance.updated
```

Private event chỉ gửi vào room của đúng `userId`.

---

## 8. Future Work — Engine Recovery

Core MVP không bắt buộc tự động recovery Order Book sau khi Engine restart.

Trong môi trường demo, Engine restart có thể yêu cầu reset môi trường
hoặc chạy lại seed data.

Khôi phục từ Open Order trong PostgreSQL là chức năng mở rộng.

Không giữ recovery là chức năng bắt buộc khi chưa có API/message để thực hiện.

---

## 9. Optional — Blockchain Listener và Deposit

Blockchain Listener chỉ chạy khi triển khai Optional Deposit token test.

Nếu triển khai Deposit:

```text
User gửi token test vào ExchangeVault
→ Blockchain Listener đọc Deposit event
→ chờ đủ confirmation
→ PostgreSQL transaction
   - chống trùng chainId + txHash + logIndex
   - credit Wallet
   - tạo Ledger Entry
   - tạo Outbox DepositUpdated, BalanceUpdated
→ commit
```

---

## 10. Công Nghệ

| Thành phần               | Công nghệ               |
| ------------------------ | ----------------------- |
| Frontend                 | React, TypeScript, Vite |
| Backend                  | NestJS, TypeScript      |
| Matching Engine          | Go                      |
| Database                 | PostgreSQL              |
| ORM                      | Prisma                  |
| Messaging                | Redis Streams           |
| Realtime                 | Socket.IO               |
| Blockchain test optional | Solidity, Hardhat, viem |
| Local infra              | Docker Compose          |

---

## 11. Tiêu Chí Kiến Trúc

MVP đạt yêu cầu khi:

1. User đặt Order và balance bị khóa đúng.
2. Matching Engine khớp đúng Price-Time Priority.
3. Trade Settlement cập nhật Trade, Order, Wallet và Ledger atomic.
4. Duplicate event không settlement hai lần.
5. Cancel Order unlock đúng remaining amount.
6. WebSocket chỉ phát dữ liệu sau commit.
7. Toàn bộ hệ thống chạy được bằng Docker Compose.
