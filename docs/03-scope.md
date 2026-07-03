# Hau CEX — MVP Scope

## 1. Nguyên Tắc Scope

MVP được chia thành ba tầng:

- **CORE MVP** — bắt buộc hoàn thành.
- **OPTIONAL** — chỉ làm sau khi Core MVP chạy ổn.
- **OUT OF SCOPE** — không triển khai trong MVP.

Điều kiện hoàn thành MVP chỉ dựa trên Core MVP, không phụ thuộc Deposit hoặc Candlestick.

MVP chỉ dùng token test, không xử lý tài sản có giá trị thật.

---

## 2. CORE MVP — Bắt Buộc Hoàn Thành

Core MVP tập trung vào luồng trading cốt lõi:

- Register, Login, Refresh, Logout, `GET /me`.
- Admin lock/unlock User.
- Asset và Trading Pair được seed sẵn.
- Wallet Available/Locked.
- Ledger append-only.
- Limit Buy/Sell.
- Cancel Order.
- Go Matching Engine.
- Price-Time Priority.
- Partial Fill và Full Fill.
- Atomic Trade Settlement.
- Maker/Taker Fee và Treasury Wallet.
- PostgreSQL Outbox.
- Redis Streams.
- Idempotent Consumer.
- Order Book realtime.
- Settled Trade realtime.
- Order và Balance realtime.
- Docker Compose.
- Test cho các luồng cốt lõi.

---

## 3. OPTIONAL — Sau Khi Core MVP Chạy Ổn

Các phần sau không phải điều kiện hoàn thành Core MVP:

- Deposit token test.
- Hau CEX internal Candlestick/Chart từ Trade đã settlement.
- Ticker 24h.
- Admin bật/tắt Asset và Market bằng UI.
- Engine recovery từ Open Order.
- Admin UI hoàn chỉnh.

---

## 4. OUT OF SCOPE — Không Triển Khai

MVP không làm:

- Withdrawal.
- External market data/chart.
- Market Order.
- Stop Order.
- Full Engine Snapshot/Replay.
- Multi-engine/high availability.
- KYC.
- Multi-chain.
- Kafka.
- Kubernetes.

---

## 5. Actor

| Actor | Quyền chính |
| ----- | ----------- |
| Guest | Xem market, order book, recent trades và chart nội bộ nếu có Optional Candlestick. |
| User | Quản lý tài khoản, wallet, order và trade của chính mình. |
| Admin | Khóa/mở khóa User và vận hành Market cơ bản. |

---

## 6. Authentication

Core MVP hỗ trợ:

- Register.
- Login.
- Refresh Token.
- Logout.
- `GET /me`.
- `PATCH /me` với `fullName`.
- Role `USER`, `ADMIN`, `SYSTEM`.
- Lock/Unlock User bởi Admin.

---

## 7. Wallet và Ledger

Wallet gồm:

```text
availableBalance
lockedBalance
```

Hệ thống phải hỗ trợ:

- Khóa số dư khi đặt Order.
- Mở khóa khi Order bị hủy hoặc bị từ chối.
- Cập nhật số dư khi Trade settlement.
- Ghi Ledger Entry cho mọi thay đổi số dư.
- Row-level lock bằng `SELECT ... FOR UPDATE`.
- Không dùng float cho dữ liệu tài chính.

Ledger là dữ liệu bất biến, không update/delete qua nghiệp vụ thường.

---

## 8. Asset và Trading Pair

Core MVP seed sẵn Asset và Trading Pair.

Asset tối thiểu:

- ETH test.
- USDT test.
- HAU token.

Trading Pair dự kiến:

```text
ETH_USDT
HAU_USDT
```

Admin API cơ bản có thể Open/Suspend Market nếu cần vận hành demo.

---

## 9. Order

Core MVP chỉ hỗ trợ:

```text
Limit Order
```

User có thể:

- Đặt Limit Buy.
- Đặt Limit Sell.
- Hủy Order của mình.
- Xem Active Orders.
- Xem Order History.
- Xem Trade History.

Khi đặt Buy Order:

```text
lockedQuoteAmount = price * quantity
```

Khi đặt Sell Order:

```text
lockedBaseAmount = quantity
```

Không được hủy Order ở trạng thái:

```text
PENDING
FILLED
CANCELLED
REJECTED
```

---

## 10. Matching Engine

Matching Engine viết bằng Go.

Core MVP giữ:

- Một goroutine xử lý mỗi Trading Pair.
- Limit Buy và Limit Sell.
- Price-Time Priority.
- Bid max-heap.
- Ask min-heap.
- FIFO tại cùng Price Level.
- Partial Fill.
- Full Fill.
- Cancel Order.
- Fixed-point thay cho `float64`.
- Redis Streams command/event.

Matching Engine không:

- Kiểm tra Wallet.
- Ghi PostgreSQL trực tiếp.
- Settlement Trade.
- Tính maker/taker fee.
- Phát WebSocket trực tiếp.

---

## 11. Trade Settlement

Khi Engine khớp lệnh, Engine phát `TradeCreated`.

`TradeCreated` chưa phải Trade công khai cho đến khi Backend settlement commit.

Trade Settlement phải nằm trong một PostgreSQL transaction:

1. Tạo Trade.
2. Cập nhật Buy Order.
3. Cập nhật Sell Order.
4. Cập nhật Wallet buyer.
5. Cập nhật Wallet seller.
6. Cập nhật Treasury Wallet.
7. Tạo Ledger Entries.
8. Tạo Outbox Event.
9. Commit.

Phải xử lý đúng trường hợp Buy Order khớp ở giá thấp hơn Limit Price và hoàn phần quote chênh lệch.

Phí giao dịch:

- Buyer fee thu bằng Base Asset.
- Seller fee thu bằng Quote Asset.
- Fee được credit vào Treasury Wallet.
- Backend Settlement đọc Fee Rate từ Trading Pair và tự tính phí.

---

## 12. Redis Streams và Outbox

Luồng chính:

```text
NestJS API
→ PostgreSQL Outbox
→ Redis Streams
→ Go Matching Engine
→ Engine Event
→ NestJS Settlement
```

Yêu cầu:

- At-least-once delivery.
- Consumer chỉ ACK sau commit.
- `processed_events` chống xử lý trùng.
- `engineMatchId` unique để chống settlement trùng.
- Retry lỗi tối đa theo cấu hình rồi đưa vào `stream:dead-letter`.

---

## 13. Market Data và Realtime

Core MVP cung cấp:

- Order Book từ Matching Engine.
- Recent Trades từ Trade đã settlement.
- Last Price từ Trade đã settlement.
- Best Bid và Best Ask.

Realtime Core bắt buộc:

- `orderbook.update`
- `trade.created`
- `order.updated`
- `balance.updated`

Nếu triển khai Deposit: `deposit.updated`

Candlestick/Chart là chức năng Optional.
Nếu triển khai, dữ liệu phải được tổng hợp từ Trade đã settlement của Hau CEX.
Frontend không dùng API/WebSocket hoặc nguồn market data bên ngoài.
Hau CEX không bắt buộc tổng hợp Candlestick trong Core MVP.

---

## 14. Deposit Token Test

Deposit triển khai sau khi Core Trading Flow hoàn thành.

Nếu triển khai Deposit token test trên EVM testnet:

1. User gửi token vào `ExchangeVault`.
2. Smart contract phát Deposit event.
3. Blockchain Listener phát hiện event.
4. Backend chờ đủ confirmation.
5. Credit Wallet.
6. Tạo Ledger Entry.

Chống trùng bằng:

```text
chainId + txHash + logIndex
```

---

## 15. Admin

Admin MVP hỗ trợ:

- Xem danh sách User.
- Lock/Unlock User.
- Xem Trading Pair.
- Open/Suspend Market nếu cần cho demo.

Admin không hủy Order của User trong MVP.

---

## 16. Hoàn Thành MVP

MVP hoàn thành khi:

1. Hai User đăng nhập được.
2. User A đặt Sell Order.
3. User B đặt Buy Order.
4. Matching Engine khớp đúng Price-Time Priority.
5. Settlement cập nhật Trade, Order, Wallet và Ledger atomic.
6. Duplicate Event không settlement lần hai.
7. Cancel mở khóa đúng remaining amount.
8. Order Book, Trade, Order và Balance cập nhật realtime.
9. Hệ thống chạy bằng Docker Compose.
