# Hau CEX — API Design

## 1. Mục Đích

Tài liệu này mô tả REST API và WebSocket API cho MVP.

MVP API chỉ bao gồm:

- Auth cơ bản.
- Profile.
- Market public data.
- Wallet và Ledger.
- Order.
- Trade.
- Admin cơ bản.

---

## 2. Quy Ước Chung

Base URL:

```text
/api/v1
```

Response thành công:

```json
{
  "data": {},
  "requestId": "0197..."
}
```

Response lỗi:

```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order not found."
  },
  "requestId": "0197..."
}
```

Decimal và BigInt trả dưới dạng string.

UUID dùng string chuẩn.

Business entity ID dùng UUIDv7.

---

## 3. Authentication

### Register

```http
POST /api/v1/auth/register
```

```json
{
  "email": "user@example.com",
  "password": "secret",
  "fullName": "Nguyen Van A"
}
```

### Login

```http
POST /api/v1/auth/login
```

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:

```json
{
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "user": {
      "id": "0197...",
      "email": "user@example.com",
      "role": "USER"
    }
  },
  "requestId": "0197..."
}
```

### Refresh

```http
POST /api/v1/auth/refresh
```

### Logout

```http
POST /api/v1/auth/logout
```

---

## 4. Profile

### Get Me

```http
GET /api/v1/me
```

### Update Me

```http
PATCH /api/v1/me
```

```json
{
  "fullName": "Nguyen Van A"
}
```

User không được tự đổi:

- Role.
- Status.
- Balance.

---

## 5. Market Public API

### List Assets

```http
GET /api/v1/assets
```

### List Markets

```http
GET /api/v1/markets
```

### Market Detail

```http
GET /api/v1/markets/:symbol
```

Core MVP có thể trả `lastPrice`, `bestBid` và `bestAsk`.

`bestBid` và `bestAsk` lấy từ latest Order Book snapshot trong Redis.
`lastPrice` lấy từ Trade đã settlement trong PostgreSQL.

### Order Book

```http
GET /api/v1/markets/:symbol/order-book?depth=50
```

Backend đọc latest snapshot từ Redis:

```text
cache:orderbook:{tradingPairId}
```

Response:

```json
{
  "data": {
    "symbol": "HAU_USDT",
    "bookSequence": "1200",
    "bids": [["1.000000000000000000", "100.000000000000000000"]],
    "asks": [["1.100000000000000000", "50.000000000000000000"]]
  },
  "requestId": "0197..."
}
```

### Recent Trades

```http
GET /api/v1/markets/:symbol/trades?limit=50
```

Chỉ trả Trade đã settlement.

Recent Trades đọc từ PostgreSQL Trade đã settlement.

### Chart (Candlestick)

Hau CEX không bắt buộc cung cấp Candlestick API trong Core MVP.

Candlestick/Chart là chức năng Optional.
Nếu triển khai, API phải tổng hợp dữ liệu từ Trade đã settlement của Hau CEX.
Frontend không gọi API/WebSocket hoặc nguồn market data bên ngoài.

---

## 6. Wallet và Ledger

### Wallets

```http
GET /api/v1/wallets
```

### Ledger

```http
GET /api/v1/ledger?asset=USDT&limit=50&cursor=...
```

---

## 7. Orders

### Create Order

```http
POST /api/v1/orders
Idempotency-Key: <required>
```

```json
{
  "symbol": "HAU_USDT",
  "side": "BUY",
  "type": "LIMIT",
  "price": "1.000000000000000000",
  "quantity": "100.000000000000000000"
}
```

Response:

```json
{
  "data": {
    "orderId": "0197...",
    "status": "PENDING"
  },
  "requestId": "0197..."
}
```

### Active Orders

```http
GET /api/v1/orders/active?symbol=HAU_USDT
```

Trả các trạng thái:

```text
PENDING
OPEN
PARTIALLY_FILLED
CANCEL_PENDING
```

### Order History

```http
GET /api/v1/orders?symbol=HAU_USDT&limit=50&cursor=...
```

### Order Detail

```http
GET /api/v1/orders/:orderId
```

### Cancel Order

```http
POST /api/v1/orders/:orderId/cancel
```

Response:

```json
{
  "data": {
    "orderId": "0197...",
    "status": "CANCEL_PENDING"
  },
  "requestId": "0197..."
}
```

Rule:

- User chỉ cancel Order của mình.
- `PENDING`, `FILLED`, `CANCELLED`, `REJECTED` không được cancel.
- Request hợp lệ chuyển Order sang `CANCEL_PENDING`.
- Thực tế cancel diễn ra bất đồng bộ qua Matching Engine.

---

## 8. Trades

### My Trades

```http
GET /api/v1/trades?symbol=HAU_USDT&limit=50&cursor=...
```

### Trade Detail

```http
GET /api/v1/trades/:tradeId
```

---

## 9. Admin

Admin API yêu cầu role `ADMIN`.

### Users

```http
GET /api/v1/admin/users
POST /api/v1/admin/users/:userId/lock
POST /api/v1/admin/users/:userId/unlock
```

### Assets

```http
GET /api/v1/admin/assets
POST /api/v1/admin/assets/:assetId/activate
POST /api/v1/admin/assets/:assetId/deactivate
```

### Markets

```http
GET /api/v1/admin/markets
POST /api/v1/admin/markets/:marketId/open
POST /api/v1/admin/markets/:marketId/suspend
```

Admin không cancel Order của User trong MVP.

---

## 10. Optional API

Optional API không phải tiêu chí bắt buộc để hoàn thành Core MVP.

### Ticker 24h

```http
GET /api/v1/markets/:symbol/ticker
```

Ticker 24h có thể gồm:

```json
{
  "data": {
    "lastPrice": "1.050000000000000000",
    "bestBid": "1.000000000000000000",
    "bestAsk": "1.100000000000000000",
    "baseVolume24h": "1000.000000000000000000"
  },
  "requestId": "0197..."
}
```

### Deposit Config

```http
GET /api/v1/deposits/config?asset=USDT
```

### Create Deposit Intent

```http
POST /api/v1/deposits/intents
```

```json
{
  "asset": "USDT",
  "depositorAddress": "0x1234..."
}
```

Response:

```json
{
  "data": {
    "depositId": "0197...",
    "asset": "USDT",
    "chainId": "31337",
    "tokenAddress": "0xToken...",
    "vaultAddress": "0xVault...",
    "accountReference": "0x8fa3...",
    "expiresAt": "2026-07-01T11:00:00.000Z"
  },
  "requestId": "0197..."
}
```

### My Deposits

```http
GET /api/v1/deposits?asset=USDT&limit=50&cursor=...
```

### Deposit Detail

```http
GET /api/v1/deposits/:depositId
```

Deposit credit chỉ xảy ra sau đủ confirmation.

---

## 11. WebSocket

Socket.IO namespace:

```text
/ws
```

Client subscribe public market:

```text
market.subscribe
```

Payload:

```json
{
  "symbol": "HAU_USDT"
}
```

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

Private event chỉ gửi cho đúng `userId`.

---

## 12. Idempotency

Các request bắt buộc `Idempotency-Key`:

```text
POST /orders
```

Rule:

- Cùng User + cùng key + cùng payload: trả lại resource cũ.
- Cùng User + cùng key + payload khác: trả lỗi `IDEMPOTENCY_CONFLICT`.

Backend so sánh payload bằng SHA-256 từ payload đã canonicalize:

```text
symbol|side|type|price|quantity
```

Ví dụ:

```text
SHA-256("HAU_USDT|BUY|LIMIT|1.000000000000000000|100.000000000000000000")
```

---

## 13. Error Code Chính

```text
AUTH_REQUIRED
AUTH_FORBIDDEN
AUTH_ACCOUNT_LOCKED
VALIDATION_ERROR
ASSET_INACTIVE
MARKET_NOT_READY
MARKET_SUSPENDED
INSUFFICIENT_BALANCE
ORDER_NOT_FOUND
ORDER_NOT_CANCELLABLE
IDEMPOTENCY_CONFLICT
INTERNAL_ERROR
```

---

## 14. Rate Limit Gợi Ý

| Nhóm                | Giới hạn                  |
| ------------------- | ------------------------- |
| Login               | 5 request/phút/IP + email |
| Refresh             | 10 request/phút/session   |
| Public Market API   | 120 request/phút/IP       |
| Create Order        | 20 request/giây/User      |
| Cancel Order        | 20 request/giây/User      |
| Admin mutation      | 30 request/phút/Admin     |
| WebSocket subscribe | 30 action/phút/connection |

---

## 15. Tiêu Chí Hoàn Thành API

API hoàn thành khi:

1. Guest xem được market, order book và recent trades.
2. User register/login/refresh/logout được.
3. User xem wallet và ledger được.
4. User đặt và hủy Limit Order được.
5. User xem order history và trade history được.
6. Admin lock/unlock user, bật/tắt asset, open/suspend market được.
7. WebSocket chỉ phát event sau transaction commit.
