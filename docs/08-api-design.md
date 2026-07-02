# Hau CEX — API Design

## 1. Mục đích

Tài liệu này mô tả thiết kế API cho Hau CEX, bao gồm:

- REST API cho Guest, User và Admin.
- Socket.IO API cho dữ liệu realtime công khai và riêng tư.
- Quy ước request, response, pagination và error.
- Authentication, authorization và session.
- Idempotency cho các thao tác tài chính quan trọng.
- API cho Market Data, Wallet, Order, Trade, Deposit và Withdrawal.
- API quản trị User, Asset, Trading Pair và Withdrawal.

API được thiết kế dựa trên phạm vi MVP:

- Spot Trading.
- Limit Buy và Limit Sell.
- Wallet nội bộ gồm Available Balance và Locked Balance.
- Trade chỉ được công bố sau settlement thành công.
- Deposit và Withdrawal ERC-20 trên EVM testnet.
- Chart có hai nguồn `BINANCE` và `HAU`.

---

## 2. Nguyên tắc thiết kế

### 2.1. REST cho request/response, WebSocket cho realtime

REST API được sử dụng cho:

- Authentication.
- Truy vấn dữ liệu ban đầu.
- Tạo và hủy Order.
- Tạo Withdrawal.
- Truy vấn lịch sử.
- Chức năng Admin.

Socket.IO được sử dụng cho:

- Order Book realtime.
- Recent Trades đã settlement.
- Ticker và Candlestick realtime.
- Cập nhật Order riêng tư.
- Cập nhật Balance, Deposit và Withdrawal riêng tư.

Frontend phải luôn tải snapshot ban đầu bằng REST trước khi áp dụng các delta realtime từ WebSocket.

Với Order Book, luồng chuẩn là:

1. Kết nối WebSocket và subscribe market.
2. Buffer các Order Book delta tạm thời ở client.
3. Gọi REST để lấy Order Book snapshot.
4. Bỏ các delta có `sequence <= snapshot.sequence`.
5. Áp dụng các delta còn lại theo `previousSequence`.
6. Nếu phát hiện gap, xóa buffer và tải lại snapshot.

Nếu server hỗ trợ, có thể gửi snapshot ngay sau khi subscribe để đơn giản hóa đồng bộ ban đầu.

### 2.2. API không thực hiện Matching

`POST /orders` chỉ:

1. Validate request.
2. Lock Wallet.
3. Khóa số dư.
4. Tạo Order `PENDING`.
5. Tạo Outbox `PlaceOrder`.
6. Commit transaction.

API không:

- Tự đưa Order vào Order Book.
- Tự xác định Maker/Taker.
- Tự khớp Order.
- Trả Trade chưa settlement.

### 2.3. Dữ liệu tài chính không dùng JSON number

Các trường sau phải được truyền dưới dạng JSON string:

- Price.
- Quantity.
- Balance.
- Fee.
- Notional.
- Sequence kiểu `BIGINT`.
- Block Number và Nonce nếu có nguy cơ vượt giới hạn an toàn của JavaScript.

Ví dụ đúng:

```json
{
  "price": "2000.150000000000000000",
  "quantity": "1.250000000000000000",
  "sequence": "12345"
}
```

Không dùng:

```json
{
  "price": 2000.15,
  "quantity": 1.25
}
```

### 2.4. Trade công khai phải đã settlement

Các API sau chỉ trả Trade đã settlement và đã tồn tại trong PostgreSQL:

- Recent Trades.
- User Trade History.
- Internal Last Price.
- Hau CEX Candlestick.
- `trade.created` qua WebSocket.

`TradeCreated` trực tiếp từ Matching Engine không phải public API event.

### 2.5. Binance chỉ là Reference Market Data

Tham số `source=BINANCE` chỉ có ý nghĩa với:

- Candlestick.
- Reference Ticker hoặc Reference Price nếu endpoint hỗ trợ.

Không ảnh hưởng:

- Order Book.
- Recent Trades Hau CEX.
- Order destination.
- Execution Price.
- Settlement.
- Wallet và Ledger.

### 2.6. Public API và Internal Message Contract là hai lớp khác nhau

Public REST/WebSocket API không expose trực tiếp:

- Redis Stream key.
- Outbox payload nội bộ.
- Engine command payload nội bộ.
- `processed_events`.
- Snapshot payload nội bộ.

Các contract nội bộ giữa Backend và Matching Engine được thiết kế ở tài liệu riêng.

---

## 3. Base URL và version

Base path:

```text
/api/v1
```

Ví dụ:

```text
POST /api/v1/auth/login
GET  /api/v1/markets/ETH_USDT/order-book
POST /api/v1/orders
```

WebSocket sử dụng Socket.IO:

```text
/socket.io
```

Namespace đề xuất:

```text
/market
/private
```

Breaking change phải tạo API version mới, ví dụ `/api/v2`.

---

## 4. Actor và quyền truy cập

| Actor | Quyền chính                                                                                                |
| ----- | ---------------------------------------------------------------------------------------------------------- |
| Guest | Xem Asset, Market, Order Book, Recent Trades, Ticker và Candlestick.                                       |
| User  | Toàn bộ quyền Guest; quản lý profile, session, Wallet, Order, Trade, Deposit và Withdrawal của chính mình. |
| Admin | Quản lý User, Asset, Trading Pair, Withdrawal và Audit Log.                                                |

Quy tắc:

- User chỉ đọc dữ liệu riêng tư của chính mình.
- User không được truyền `userId` để truy cập dữ liệu người khác.
- Backend lấy User hiện tại từ Access Token.
- Admin endpoint sử dụng guard role `ADMIN`.
- User có trạng thái `LOCKED` hoặc `DISABLED` không được thực hiện private mutation, trừ `POST /api/v1/auth/logout` và `DELETE /api/v1/auth/sessions/:sessionId`.

---

## 5. Authentication

### 5.1. Access Token

Access Token là JWT thời gian sống ngắn.

Claims tối thiểu:

```json
{
  "sub": "user-uuid",
  "role": "USER",
  "sessionId": "session-uuid",
  "jti": "token-uuid",
  "iat": 1782864000,
  "exp": 1782864900
}
```

Không đặt trong JWT:

- Balance.
- Password hash.
- Refresh Token.
- Trading permission có thể thay đổi thường xuyên.

Private REST request gửi:

```http
Authorization: Bearer <access-token>
```

### 5.2. Refresh Token

Khuyến nghị lưu Refresh Token trong cookie:

```text
HttpOnly
Secure
SameSite=Lax
Path=/api/v1/auth
```

Database chỉ lưu hash của Refresh Token trong `sessions.refresh_token_hash`.

Access Token được trả trong response body. Refresh Token không được trả trong JSON nếu triển khai bằng HttpOnly cookie.

### 5.3. Thu hồi session

Session bị thu hồi khi:

- User logout.
- Admin khóa hoặc disable User.
- User đổi mật khẩu theo chính sách bảo mật.
- User chủ động revoke session.
- Refresh Token hết hạn hoặc bị phát hiện reuse.

---

## 6. Header chung

### Request Header

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer <access-token>
X-Correlation-Id: <uuid-v7>
Idempotency-Key: <client-generated-key>
```

Ý nghĩa:

| Header             |                       Bắt buộc | Mô tả                                                    |
| ------------------ | -----------------------------: | -------------------------------------------------------- |
| `Content-Type`     |               Có với body JSON | Luôn là `application/json`.                              |
| `Authorization`    |             Có với private API | Access Token.                                            |
| `X-Correlation-Id` |                          Không | Client có thể truyền để trace; server tự sinh nếu thiếu. |
| `Idempotency-Key`  | Có với tạo Order và Withdrawal | Chống tạo trùng khi retry.                               |

### Response Header

```http
X-Request-Id: <uuid-v7>
X-Correlation-Id: <uuid-v7>
```

Có thể thêm:

```http
RateLimit-Limit: 60
RateLimit-Remaining: 42
RateLimit-Reset: 30
```

---

## 7. Quy ước dữ liệu

### 7.1. Tên trường

Public JSON sử dụng `camelCase`:

```text
tradingPairId
availableBalance
createdAt
```

Database sử dụng `snake_case` nhưng không expose trực tiếp.

### 7.2. UUID

UUID được trả dưới dạng string chuẩn:

```text
0197...
```

Business entity mặc định dùng UUIDv7.

Ngoại lệ:

- `tradeId` dùng UUIDv5 deterministic từ `engineMatchId`.

Public API không cần expose `engineMatchId`, nhưng API client không được giả định mọi ID nghiệp vụ đều là UUIDv7 và không được suy luận thứ tự nghiệp vụ chỉ dựa vào UUID.

### 7.3. Date Time

Dùng ISO 8601 UTC:

```text
2026-07-01T10:30:00.123Z
```

### 7.4. Enum

Public API dùng uppercase string:

```text
BUY
SELL
PENDING
PARTIALLY_FILLED
BINANCE
HAU
```

### 7.5. Decimal string

API phải:

- Không nhận scientific notation.
- Không nhận dấu `+`.
- Không nhận số âm cho Price, Quantity hoặc Amount.
- Chuẩn hóa về decimal string.
- Validate scale theo Asset hoặc Trading Pair.

Ví dụ hợp lệ:

```text
0.001
2000
2000.15
```

Ví dụ không hợp lệ:

```text
1e-3
+10
NaN
Infinity
```

---

## 8. Response format

### 8.1. Thành công — một resource

```json
{
  "data": {
    "id": "0197..."
  },
  "requestId": "0197..."
}
```

### 8.2. Thành công — collection

```json
{
  "data": [],
  "meta": {
    "nextCursor": null,
    "limit": 20
  },
  "requestId": "0197..."
}
```

### 8.3. Không có body

Có thể sử dụng:

```text
204 No Content
```

cho thao tác logout hoặc revoke session thành công.

---

## 9. Error format

```json
{
  "error": {
    "code": "ORDER_INSUFFICIENT_BALANCE",
    "message": "Available balance is insufficient.",
    "details": {
      "asset": "USDT",
      "required": "100.000000000000000000",
      "available": "50.000000000000000000"
    }
  },
  "requestId": "0197...",
  "timestamp": "2026-07-01T10:30:00.123Z"
}
```

### 9.1. HTTP status

| Status | Sử dụng                                             |
| -----: | --------------------------------------------------- |
|  `200` | Đọc hoặc action thành công.                         |
|  `201` | Tạo resource thành công.                            |
|  `202` | Yêu cầu bất đồng bộ đã được chấp nhận.              |
|  `204` | Thành công, không có body.                          |
|  `400` | Request sai cấu trúc hoặc query không hợp lệ.       |
|  `401` | Chưa xác thực hoặc token không hợp lệ.              |
|  `403` | Không có quyền hoặc tài khoản bị khóa.              |
|  `404` | Resource không tồn tại hoặc không thuộc User.       |
|  `409` | Xung đột trạng thái hoặc idempotency key.           |
|  `422` | Request hợp lệ về JSON nhưng vi phạm business rule. |
|  `429` | Vượt rate limit.                                    |
|  `503` | Engine, blockchain hoặc dependency chưa sẵn sàng.   |

### 9.2. Error code chung

```text
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
RESOURCE_NOT_FOUND
RESOURCE_CONFLICT
IDEMPOTENCY_KEY_REUSED
RATE_LIMITED
SERVICE_UNAVAILABLE
INTERNAL_ERROR
```

Không trả stack trace, SQL error hoặc internal service detail cho client.

---

## 10. Pagination và sorting

### 10.1. Cursor pagination

Các history API sử dụng cursor pagination:

```text
?limit=20&cursor=<opaque-cursor>
```

Response:

```json
{
  "data": [],
  "meta": {
    "limit": 20,
    "nextCursor": "opaque-string"
  }
}
```

Quy tắc:

- `limit` mặc định `20`.
- `limit` tối đa `100`.
- Cursor là opaque; client không tự parse.
- Sorting phải ổn định bằng ít nhất hai trường, ví dụ `createdAt DESC, id DESC`.
- Trade History có thể dùng `sequence DESC`.

### 10.2. Candlestick pagination

Candlestick sử dụng time range:

```text
?interval=1m&startTime=...&endTime=...&limit=500
```

Giới hạn đề xuất:

```text
limit <= 1000
```

---

# 11. Authentication API

## 11.1. Đăng ký

```http
POST /api/v1/auth/register
```

Access: Guest.

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password",
  "fullName": "Nguyen Van A"
}
```

Response `201 Created`:

```json
{
  "data": {
    "user": {
      "id": "0197...",
      "email": "user@example.com",
      "fullName": "Nguyen Van A",
      "role": "USER",
      "status": "ACTIVE",
      "createdAt": "2026-07-01T10:00:00.000Z"
    },
    "accessToken": "jwt",
    "expiresIn": 900
  },
  "requestId": "0197..."
}
```

Errors:

```text
AUTH_EMAIL_ALREADY_EXISTS
AUTH_PASSWORD_TOO_WEAK
VALIDATION_ERROR
```

## 11.2. Đăng nhập

```http
POST /api/v1/auth/login
```

Request:

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

Response `200 OK`:

```json
{
  "data": {
    "user": {
      "id": "0197...",
      "email": "user@example.com",
      "role": "USER",
      "status": "ACTIVE"
    },
    "accessToken": "jwt",
    "expiresIn": 900
  },
  "requestId": "0197..."
}
```

Server đồng thời set Refresh Token cookie.

Backend phải từ chối đăng nhập đối với tài khoản role `SYSTEM`.

Errors:

```text
AUTH_INVALID_CREDENTIALS
AUTH_ACCOUNT_LOCKED
AUTH_ACCOUNT_DISABLED
AUTH_SYSTEM_ACCOUNT_NOT_LOGINABLE
```

Không phân biệt “email không tồn tại” và “mật khẩu sai” trong public message.

## 11.3. Refresh Access Token

```http
POST /api/v1/auth/refresh
```

Refresh Token lấy từ HttpOnly cookie.

Response:

```json
{
  "data": {
    "accessToken": "new-jwt",
    "expiresIn": 900
  },
  "requestId": "0197..."
}
```

Nên áp dụng Refresh Token rotation.

Errors:

```text
AUTH_REFRESH_TOKEN_MISSING
AUTH_REFRESH_TOKEN_INVALID
AUTH_SESSION_REVOKED
AUTH_ACCOUNT_LOCKED
```

Nếu Refresh Token dùng cookie, endpoint refresh và logout phải kiểm tra Origin/Referer hoặc CSRF token theo kiến trúc triển khai.

## 11.4. Logout

```http
POST /api/v1/auth/logout
```

Access: User/Admin.

Server revoke session hiện tại và xóa cookie.

Response:

```text
204 No Content
```

## 11.5. Quên mật khẩu

```http
POST /api/v1/auth/forgot-password
```

Request:

```json
{
  "email": "user@example.com"
}
```

Luôn trả response chung để tránh dò email:

```json
{
  "data": {
    "accepted": true
  },
  "requestId": "0197..."
}
```

## 11.6. Đặt lại mật khẩu

```http
POST /api/v1/auth/reset-password
```

Request:

```json
{
  "token": "plain-reset-token-from-email",
  "newPassword": "new-strong-password"
}
```

Errors:

```text
AUTH_RESET_TOKEN_INVALID
AUTH_RESET_TOKEN_EXPIRED
AUTH_RESET_TOKEN_USED
AUTH_PASSWORD_TOO_WEAK
```

## 11.7. Đổi mật khẩu

```http
POST /api/v1/auth/change-password
```

Access: User/Admin.

Request:

```json
{
  "currentPassword": "old-password",
  "newPassword": "new-password"
}
```

Theo chính sách, server có thể revoke toàn bộ session khác.

## 11.8. Danh sách session

```http
GET /api/v1/auth/sessions
```

Access: User/Admin.

Response không trả Refresh Token hash.

## 11.9. Revoke session

```http
DELETE /api/v1/auth/sessions/:sessionId
```

User chỉ revoke session của chính mình.

---

# 12. User API

## 12.1. Xem profile

```http
GET /api/v1/me
```

Response:

```json
{
  "data": {
    "id": "0197...",
    "email": "user@example.com",
    "fullName": "Nguyen Van A",
    "avatarUrl": null,
    "role": "USER",
    "status": "ACTIVE",
    "lastLoginAt": "2026-07-01T09:00:00.000Z",
    "createdAt": "2026-06-01T09:00:00.000Z"
  },
  "requestId": "0197..."
}
```

## 12.2. Cập nhật profile

```http
PATCH /api/v1/me
```

Request:

```json
{
  "fullName": "Nguyen Thanh Trung",
  "avatarUrl": "https://example.com/avatar.png"
}
```

Không cho phép cập nhật:

```text
role
status
email nếu chưa có quy trình đổi email riêng
balance
```

## 12.3. Lịch sử đăng nhập

```http
GET /api/v1/me/login-history?limit=20&cursor=...
```

---

# 13. Public Asset API

## 13.1. Danh sách Asset

```http
GET /api/v1/assets
```

Guest chỉ thấy Asset `ACTIVE`. Backend không cho client dùng query để đọc Asset `INACTIVE`.

Response item:

```json
{
  "id": "0197...",
  "symbol": "USDT",
  "name": "Mock USDT",
  "imageUrl": null,
  "decimals": 18,
  "status": "ACTIVE",
  "depositEnabled": true,
  "withdrawalEnabled": true,
  "tradingEnabled": true
}
```

## 13.2. Chi tiết Asset

```http
GET /api/v1/assets/:symbol
```

---

# 14. Public Market API

## 14.1. Danh sách Market

```http
GET /api/v1/markets
```

Query:

```text
status=ACTIVE
```

Response item:

```json
{
  "id": "0197...",
  "symbol": "ETH_USDT",
  "displaySymbol": "ETH/USDT",
  "baseAsset": {
    "symbol": "ETH"
  },
  "quoteAsset": {
    "symbol": "USDT"
  },
  "pricePrecision": 2,
  "quantityPrecision": 4,
  "tickSize": "0.010000000000000000",
  "stepSize": "0.000100000000000000",
  "minimumQuantity": "0.001000000000000000",
  "minimumNotional": "10.000000000000000000",
  "makerFeeRate": "0.0010000000",
  "takerFeeRate": "0.0015000000",
  "status": "ACTIVE",
  "availableChartSources": ["HAU", "BINANCE"],
  "defaultChartSource": "BINANCE"
}
```

Nếu không có Binance mapping:

```json
{
  "availableChartSources": ["HAU"],
  "defaultChartSource": "HAU"
}
```

## 14.2. Chi tiết Market

```http
GET /api/v1/markets/:symbol
```

## 14.3. Order Book snapshot

```http
GET /api/v1/markets/:symbol/order-book?depth=20
```

Quy tắc:

- Luôn là Order Book của Hau CEX.
- Không có tham số `source`.
- Chỉ trả Price Level đã aggregate.
- Không trả User ID hoặc Order ID.
- `depth` mặc định `20`, tối đa `100`.
- Snapshot này dùng cùng với luồng subscribe/buffer ở WebSocket để tránh mất delta khi đồng bộ ban đầu.

Response:

```json
{
  "data": {
    "market": "ETH_USDT",
    "sequence": "8451",
    "bids": [
      {
        "price": "2000.00",
        "totalQuantity": "3.5000",
        "orderCount": 2
      }
    ],
    "asks": [
      {
        "price": "2001.00",
        "totalQuantity": "2.2500",
        "orderCount": 1
      }
    ],
    "generatedAt": "2026-07-01T10:30:00.000Z"
  },
  "requestId": "0197..."
}
```

`sequence` là Order Book event sequence/runtime version dùng để phát hiện gap, không phải Order Sequence hoặc Trade Sequence.

Errors:

```text
MARKET_NOT_FOUND
MARKET_ENGINE_NOT_READY
```

## 14.4. Recent Trades

```http
GET /api/v1/markets/:symbol/trades?limit=50&beforeSequence=...
```

Quy tắc:

- Chỉ trả Trade đã settlement.
- Không có tham số `source`.
- Sắp xếp `sequence DESC`.

Response item:

```json
{
  "id": "0197...",
  "market": "ETH_USDT",
  "price": "2000.000000000000000000",
  "quantity": "0.500000000000000000",
  "quoteAmount": "1000.000000000000000000",
  "takerSide": "BUY",
  "sequence": "1201",
  "matchedAt": "2026-07-01T10:30:00.000Z",
  "settledAt": "2026-07-01T10:30:00.050Z"
}
```

Không expose Buyer, Seller hoặc Order ID trên public endpoint.

## 14.5. Ticker

```http
GET /api/v1/markets/:symbol/ticker?source=HAU
```

`source`:

```text
HAU
BINANCE
```

Nếu client không truyền `source`, backend dùng `BINANCE` khi khả dụng, nếu không thì dùng `HAU`.

Response:

```json
{
  "data": {
    "market": "ETH_USDT",
    "source": "HAU",
    "sourceLabel": "Hau CEX Market",
    "lastPrice": "2000.000000000000000000",
    "open24h": "1950.000000000000000000",
    "high24h": "2050.000000000000000000",
    "low24h": "1900.000000000000000000",
    "priceChange24h": "50.000000000000000000",
    "priceChangePercent24h": "2.56410256",
    "baseVolume24h": "100.000000000000000000",
    "quoteVolume24h": "200000.000000000000000000",
    "bestBid": "1999.000000000000000000",
    "bestAsk": "2001.000000000000000000",
    "sourceUpdatedAt": "2026-07-01T10:30:00.000Z"
  },
  "requestId": "0197..."
}
```

Với `BINANCE`, `bestBid` và `bestAsk` chỉ là reference nếu được cung cấp, không được dùng cho Hau Order Book.

Errors:

```text
CHART_SOURCE_UNAVAILABLE
REFERENCE_DATA_UNAVAILABLE
```

## 14.6. Candlestick

```http
GET /api/v1/markets/:symbol/candles
```

Query:

```text
source=BINANCE|HAU
interval=1m|5m|15m|1h|4h|1d
startTime=<ISO-8601>
endTime=<ISO-8601>
limit=500
```

`source` mặc định:

- `BINANCE` nếu Market có Binance mapping và reference data đang bật.
- Ngược lại `HAU`.

Response:

```json
{
  "data": {
    "market": "ETH_USDT",
    "source": "BINANCE",
    "sourceLabel": "Binance Reference",
    "interval": "1m",
    "candles": [
      {
        "openTime": "2026-07-01T10:00:00.000Z",
        "closeTime": "2026-07-01T10:01:00.000Z",
        "open": "2000.00",
        "high": "2005.00",
        "low": "1998.00",
        "close": "2001.00",
        "volume": "125.50",
        "quoteVolume": "251125.50",
        "tradeCount": "350",
        "isFinal": true
      }
    ]
  },
  "requestId": "0197..."
}
```

Frontend phải hiển thị `sourceLabel`.

---

# 15. Wallet API

Tất cả endpoint trong mục này yêu cầu User/Admin đã đăng nhập.

## 15.1. Danh sách Wallet

```http
GET /api/v1/wallets
```

Response item:

```json
{
  "id": "0197...",
  "asset": {
    "id": "0197...",
    "symbol": "USDT",
    "name": "Mock USDT",
    "decimals": 18
  },
  "availableBalance": "1000.000000000000000000",
  "lockedBalance": "100.000000000000000000",
  "totalBalance": "1100.000000000000000000",
  "updatedAt": "2026-07-01T10:30:00.000Z"
}
```

## 15.2. Chi tiết Wallet

```http
GET /api/v1/wallets/:assetSymbol
```

## 15.3. Ledger History

```http
GET /api/v1/wallets/:assetSymbol/ledger
```

Query:

```text
balanceType=AVAILABLE|LOCKED
entryType=ORDER_LOCK|TRADE_SPEND|...
referenceType=ORDER|TRADE|DEPOSIT|WITHDRAWAL
limit=20
cursor=...
```

Response item:

```json
{
  "id": "0197...",
  "asset": "USDT",
  "balanceType": "AVAILABLE",
  "entryType": "ORDER_LOCK",
  "amount": "-100.000000000000000000",
  "balanceBefore": "1000.000000000000000000",
  "balanceAfter": "900.000000000000000000",
  "referenceType": "ORDER",
  "referenceId": "0197...",
  "operationId": "0197...",
  "createdAt": "2026-07-01T10:30:00.000Z"
}
```

Không expose `metadata` nội bộ nếu chứa thông tin kỹ thuật không cần thiết.

---

# 16. Order API

## 16.1. Tạo Limit Order

```http
POST /api/v1/orders
Idempotency-Key: <required>
```

Access: User.

Request:

```json
{
  "market": "ETH_USDT",
  "side": "BUY",
  "type": "LIMIT",
  "price": "2000.00",
  "quantity": "0.5000"
}
```

Backend phải validate:

- User `ACTIVE`.
- Market `ACTIVE`.
- Matching Engine sẵn sàng.
- Base và Quote Asset `ACTIVE` và cho phép Trading.
- Price là decimal string hợp lệ.
- Quantity là decimal string hợp lệ.
- Price đúng Tick Size.
- Quantity đúng Step Size.
- Đạt Minimum Quantity.
- Đạt Minimum Notional.
- Available Balance đủ.

Response `201 Created`:

```json
{
  "data": {
    "id": "0197...",
    "market": "ETH_USDT",
    "side": "BUY",
    "type": "LIMIT",
    "price": "2000.000000000000000000",
    "originalQuantity": "0.500000000000000000",
    "filledQuantity": "0.000000000000000000",
    "remainingQuantity": "0.500000000000000000",
    "initialLockedAmount": "1000.000000000000000000",
    "remainingLockedAmount": "1000.000000000000000000",
    "lockedAsset": "USDT",
    "status": "PENDING",
    "sequence": "1050",
    "createdAt": "2026-07-01T10:30:00.000Z"
  },
  "requestId": "0197..."
}
```

Resource đã được tạo đồng bộ trong PostgreSQL, còn Engine xử lý bất đồng bộ.

Errors:

```text
MARKET_NOT_ACTIVE
MARKET_ENGINE_NOT_READY
ASSET_NOT_ACTIVE
ORDER_INVALID_PRICE
ORDER_INVALID_QUANTITY
ORDER_INVALID_TICK_SIZE
ORDER_INVALID_STEP_SIZE
ORDER_MIN_QUANTITY_NOT_MET
ORDER_MIN_NOTIONAL_NOT_MET
ORDER_INSUFFICIENT_BALANCE
IDEMPOTENCY_KEY_REUSED
```

### Idempotency

Khóa:

```text
userId + Idempotency-Key
```

Quy tắc:

- Cùng key và cùng payload: trả lại Order đã tạo, status `200 OK`, kèm header `Idempotency-Replayed: true`.
- Cùng key nhưng payload khác: `409 IDEMPOTENCY_KEY_REUSED`.
- Client nên tạo key bằng UUIDv7.

## 16.2. Danh sách Order của User

```http
GET /api/v1/orders
```

Query:

```text
market=ETH_USDT
status=PENDING|OPEN|PARTIALLY_FILLED|FILLED|CANCEL_PENDING|CANCELLED|REJECTED
side=BUY|SELL
from=<ISO time>
to=<ISO time>
limit=20
cursor=...
```

Mặc định sắp xếp:

```text
createdAt DESC, id DESC
```

## 16.3. Open Orders

```http
GET /api/v1/orders/open?market=ETH_USDT
```

Trả Order có trạng thái:

```text
OPEN
PARTIALLY_FILLED
```

Các trạng thái đang xử lý `PENDING` và `CANCEL_PENDING` phải lấy qua `GET /api/v1/orders?status=PENDING` hoặc `GET /api/v1/orders?status=CANCEL_PENDING`.

## 16.4. Chi tiết Order

```http
GET /api/v1/orders/:orderId
```

User chỉ xem Order của chính mình. Resource không thuộc User cũng trả `404` để tránh lộ thông tin.

Response có thể kèm fills:

```json
{
  "data": {
    "order": {},
    "fills": []
  },
  "requestId": "0197..."
}
```

## 16.5. Hủy Order

```http
POST /api/v1/orders/:orderId/cancel
```

Access: User.

Không dùng `DELETE` vì:

- Order không bị xóa.
- Hủy là state transition bất đồng bộ.

Response `202 Accepted` cho request đầu tiên:

```json
{
  "data": {
    "id": "0197...",
    "status": "CANCEL_PENDING",
    "cancelRequestedAt": "2026-07-01T10:31:00.000Z"
  },
  "requestId": "0197..."
}
```

Tính idempotent theo trạng thái:

- Nếu `OPEN` hoặc `PARTIALLY_FILLED` và Market đang `ACTIVE`, chuyển sang `CANCEL_PENDING` và tạo command `CancelOrder`.
- Nếu đã `CANCEL_PENDING`, trả `200 OK` với trạng thái hiện tại, không tạo thêm command.
- Nếu đã `CANCELLED`, trả `200 OK` với Order hiện tại.
- Nếu `PENDING`, `FILLED` hoặc `REJECTED`, trả `409 ORDER_NOT_CANCELLABLE`.
- Nếu Market đang `SUSPENDED`, trả `409 MARKET_SUSPENDED`.

Errors:

```text
ORDER_NOT_FOUND
ORDER_NOT_CANCELLABLE
MARKET_SUSPENDED
MARKET_ENGINE_NOT_READY
```

---

# 17. User Trade API

## 17.1. Trade History

```http
GET /api/v1/trades
```

Query:

```text
market=ETH_USDT
side=BUY|SELL
limit=20
cursor=...
```

Chỉ trả Trade mà User là Buyer hoặc Seller.

Response item:

```json
{
  "id": "0197...",
  "market": "ETH_USDT",
  "side": "BUY",
  "orderId": "0197...",
  "role": "TAKER",
  "price": "2000.000000000000000000",
  "quantity": "0.500000000000000000",
  "quoteAmount": "1000.000000000000000000",
  "feeAsset": "ETH",
  "feeAmount": "0.000750000000000000",
  "sequence": "1201",
  "matchedAt": "2026-07-01T10:30:00.000Z",
  "settledAt": "2026-07-01T10:30:00.050Z"
}
```

Không cần expose `engineMessageId` hoặc `engineMatchId` cho frontend thông thường.

## 17.2. Chi tiết Trade

```http
GET /api/v1/trades/:tradeId
```

User chỉ xem được nếu tham gia Trade. Admin có endpoint riêng.

---

# 18. Deposit API

Deposit được tạo từ event blockchain, không tạo trực tiếp bằng REST.

## 18.1. Lấy cấu hình Deposit

```http
GET /api/v1/deposits/config?asset=USDT
```

Access: User.

Response:

```json
{
  "data": {
    "asset": "USDT",
    "chainId": "11155111",
    "chainName": "Sepolia",
    "tokenAddress": "0x...",
    "vaultAddress": "0x...",
    "decimals": 18,
    "depositEnabled": true,
    "requiredConfirmations": 3,
    "method": "deposit",
    "notice": "Only send the configured ERC-20 token on the configured test network."
  },
  "requestId": "0197..."
}
```

Frontend dùng viem để gọi Exchange Vault.

Errors:

```text
DEPOSIT_DISABLED
ASSET_NOT_FOUND
CHAIN_NOT_SUPPORTED
```

## 18.2. Danh sách Deposit

```http
GET /api/v1/deposits
```

Query:

```text
asset=USDT
status=DETECTED|CONFIRMING|CREDITED|FAILED
limit=20
cursor=...
```

## 18.3. Chi tiết Deposit

```http
GET /api/v1/deposits/:depositId
```

Response:

```json
{
  "data": {
    "id": "0197...",
    "asset": "USDT",
    "chainId": "11155111",
    "txHash": "0x...",
    "logIndex": 0,
    "blockNumber": "123456",
    "fromAddress": "0x...",
    "vaultAddress": "0x...",
    "amount": "100.000000000000000000",
    "confirmations": 3,
    "requiredConfirmations": 3,
    "status": "CREDITED",
    "detectedAt": "2026-07-01T10:00:00.000Z",
    "creditedAt": "2026-07-01T10:02:00.000Z"
  },
  "requestId": "0197..."
}
```

---

# 19. Withdrawal API

## 19.1. Tạo Withdrawal

```http
POST /api/v1/withdrawals
Idempotency-Key: <required>
```

Request:

```json
{
  "asset": "USDT",
  "destinationAddress": "0x0123456789abcdef0123456789abcdef01234567",
  "withdrawalAmount": "100.000000000000000000"
}
```

`withdrawalAmount` là số lượng user yêu cầu rút.

Backend tính:

```text
feeAmount = configured withdrawal fee
receivedAmount = withdrawalAmount - feeAmount
```

Response `201 Created`:

```json
{
  "data": {
    "id": "0197...",
    "asset": "USDT",
    "chainId": "11155111",
    "destinationAddress": "0x...",
    "withdrawalAmount": "100.000000000000000000",
    "feeAmount": "1.000000000000000000",
    "receivedAmount": "99.000000000000000000",
    "status": "PENDING",
    "createdAt": "2026-07-01T10:30:00.000Z"
  },
  "requestId": "0197..."
}
```

Validation:

- User `ACTIVE`.
- Asset `ACTIVE` và `withdrawalEnabled = true`.
- Address đúng EVM và được normalize lowercase.
- Withdrawal amount đạt Minimum Withdrawal.
- `receivedAmount > 0`.
- Available Balance đủ `withdrawalAmount`.

Errors:

```text
WITHDRAWAL_DISABLED
WITHDRAWAL_INVALID_ADDRESS
WITHDRAWAL_MINIMUM_NOT_MET
WITHDRAWAL_FEE_EXCEEDS_AMOUNT
WITHDRAWAL_INSUFFICIENT_BALANCE
IDEMPOTENCY_KEY_REUSED
```

## 19.2. Danh sách Withdrawal

```http
GET /api/v1/withdrawals
```

Query:

```text
asset=USDT
status=PENDING|REVIEWING|APPROVED|PROCESSING|BROADCASTED|COMPLETED|REJECTED|FAILED|CANCELLED
limit=20
cursor=...
```

## 19.3. Chi tiết Withdrawal

```http
GET /api/v1/withdrawals/:withdrawalId
```

## 19.4. User hủy Withdrawal

```http
POST /api/v1/withdrawals/:withdrawalId/cancel
```

Chỉ cho phép khi:

- Withdrawal thuộc User.
- Trạng thái `PENDING` hoặc `REVIEWING` theo chính sách.
- Chưa có `senderAddress`, `nonce` và `txHash`.

Response:

- Request đầu tiên thành công: `200 OK`, `status = CANCELLED`.
- Đã `CANCELLED`: `200 OK`, trả resource hiện tại.
- Đang `PROCESSING` trở đi: `409 WITHDRAWAL_NOT_CANCELLABLE`.

Errors:

```text
WITHDRAWAL_NOT_FOUND
WITHDRAWAL_NOT_CANCELLABLE
```

---

# 20. Admin User API

Tất cả endpoint trong mục này yêu cầu role `ADMIN`.

Mutation nghiệp vụ và Audit Log phải commit trong cùng transaction. Nếu ghi Audit Log thất bại thì rollback mutation.

Admin User API thông thường không được khóa, disable hoặc chỉnh sửa tài khoản role `SYSTEM` như Treasury Account.
Treasury Account chỉ phục vụ hạch toán nội bộ và không xuất hiện như User giao dịch thông thường.

## 20.1. Danh sách User

```http
GET /api/v1/admin/users
```

Query:

```text
search=<email-or-name>
status=ACTIVE|LOCKED|DISABLED
role=USER|ADMIN
includeSystem=false
limit=20
cursor=...
```

Mặc định `includeSystem=false`, tức không trả tài khoản role `SYSTEM`.

## 20.2. Chi tiết User

```http
GET /api/v1/admin/users/:userId
```

Có thể trả:

- Profile.
- Wallet summary.
- Open Order count.
- Recent Order activity.
- Recent Trade activity.
- Recent Withdrawal.
- Recent login history.

Không trả password hash hoặc token hash.

## 20.3. Xem hoạt động của User

Admin detail và dashboard có thể hiển thị Order History, Trade History, Deposit và Withdrawal gần đây của User.

## 20.4. Khóa User

```http
POST /api/v1/admin/users/:userId/lock
```

Request:

```json
{
  "reason": "Suspicious activity"
}
```

Tác động:

- `targetUserId` phải khác `currentAdminId`.
- `targetUser.role` không được là `SYSTEM`.
- Chuyển User sang `LOCKED`.
- Revoke toàn bộ session.
- Không tự hủy Open Order trong MVP.
- Tạo Audit Log.

## 20.5. Mở khóa User

```http
POST /api/v1/admin/users/:userId/unlock
```

Request phải có `reason`.

## 20.6. Disable User

```http
POST /api/v1/admin/users/:userId/disable
```

Điều kiện:

- `targetUserId` phải khác `currentAdminId`.
- `targetUser.role` không được là `SYSTEM`.

Không xóa dữ liệu tài chính.

---

# 21. Admin Asset API

## 21.1. Tạo Asset

```http
POST /api/v1/admin/assets
```

Request:

```json
{
  "symbol": "HAU",
  "name": "Hau Token",
  "imageUrl": null,
  "chainId": "11155111",
  "contractAddress": "0x...",
  "decimals": 18,
  "requiredConfirmations": 3,
  "minimumWithdrawal": "10.000000000000000000",
  "withdrawalFee": "1.000000000000000000"
}
```

Asset mới mặc định:

```text
status = INACTIVE
depositEnabled = false
withdrawalEnabled = false
tradingEnabled = false
```

## 21.2. Danh sách Asset

```http
GET /api/v1/admin/assets
```

## 21.3. Chi tiết Asset

```http
GET /api/v1/admin/assets/:assetId
```

## 21.4. Cập nhật Asset

```http
PATCH /api/v1/admin/assets/:assetId
```

Có thể cập nhật:

- Name.
- Image URL.
- Required Confirmations.
- Minimum Withdrawal.
- Withdrawal Fee.
- Các enable flag theo rule.

Không cho đổi `decimals`, `symbol`, `chainId` hoặc `contractAddress` sau khi đã có dữ liệu nghiệp vụ.

## 21.5. Activate Asset

```http
POST /api/v1/admin/assets/:assetId/activate
```

## 21.6. Deactivate Asset

```http
POST /api/v1/admin/assets/:assetId/deactivate
```

Khi `INACTIVE`, tất cả enable flag phải là `false`.

---

# 22. Admin Trading Pair API

## 22.1. Tạo Trading Pair

```http
POST /api/v1/admin/markets
```

Request:

```json
{
  "baseAssetId": "0197...",
  "quoteAssetId": "0197...",
  "pricePrecision": 2,
  "quantityPrecision": 4,
  "tickSize": "0.01",
  "stepSize": "0.0001",
  "minimumQuantity": "0.001",
  "minimumNotional": "10",
  "makerFeeRate": "0.001",
  "takerFeeRate": "0.0015",
  "binanceSymbol": "ETHUSDT",
  "referenceDataEnabled": true
}
```

Market mới mặc định `INACTIVE`.

## 22.2. Danh sách Market

```http
GET /api/v1/admin/markets
```

## 22.3. Chi tiết Market

```http
GET /api/v1/admin/markets/:marketId
```

## 22.4. Cập nhật Trading Pair

```http
PATCH /api/v1/admin/markets/:marketId
```

Khi Market đang `ACTIVE`, không được cập nhật các cấu hình ảnh hưởng matching:

- `pricePrecision`
- `quantityPrecision`
- `tickSize`
- `stepSize`
- `minimumQuantity`
- `minimumNotional`
- `makerFeeRate`
- `takerFeeRate`

Muốn cập nhật các cấu hình trên:

1. Suspend Market.
2. Bảo đảm trạng thái Engine, Order Book và Open Order an toàn.
3. Cập nhật cấu hình.
4. Gửi `OpenMarket` với cấu hình mới.

## 22.5. Mở Market

```http
POST /api/v1/admin/markets/:marketId/open
```

Điều kiện:

- Base và Quote Asset `ACTIVE`.
- Cả hai Asset `tradingEnabled = true`.
- Cấu hình Market hợp lệ.

Luồng xử lý:

1. Backend validate Asset và Market config.
2. Backend tạo Outbox `OpenMarket`.
3. API trả `202 Accepted`.
4. Matching Engine configure hoặc recover Pair Engine.
5. Engine phát `MarketOpened`.
6. Backend chuyển Trading Pair sang `ACTIVE`.

Điều kiện Engine sẵn sàng được kiểm tra trước thời điểm chuyển trạng thái sang `ACTIVE`, không phải trước thời điểm gửi command `OpenMarket`.

## 22.6. Suspend Market

```http
POST /api/v1/admin/markets/:marketId/suspend
```

Request:

```json
{
  "reason": "Engine reconciliation required"
}
```

MVP giữ nguyên Open Order khi suspend.

## 22.7. Close Market

```http
POST /api/v1/admin/markets/:marketId/close
```

Không thuộc MVP hiện tại. 05 là chuẩn nghiệp vụ cho phiên bản này và chỉ quy định trạng thái `CLOSED`, chưa định nghĩa flow internal `CloseMarket`/`MarketClosed`. Nếu triển khai về sau, cần bổ sung contract nội bộ và policy xử lý Open Order rõ ràng trước khi kích hoạt endpoint này.

---

# 23. Admin Withdrawal API

## 23.1. Danh sách Withdrawal

```http
GET /api/v1/admin/withdrawals
```

Query:

```text
userId=...
asset=USDT
status=PENDING|REVIEWING|APPROVED|PROCESSING|BROADCASTED|COMPLETED|REJECTED|FAILED|CANCELLED
limit=20
cursor=...
```

## 23.2. Chi tiết Withdrawal

```http
GET /api/v1/admin/withdrawals/:withdrawalId
```

## 23.3. Đưa vào Review

```http
POST /api/v1/admin/withdrawals/:withdrawalId/review
```

State:

```text
PENDING → REVIEWING
```

## 23.4. Approve Withdrawal

```http
POST /api/v1/admin/withdrawals/:withdrawalId/approve
```

Request:

```json
{
  "reason": "Verified for demo"
}
```

State:

```text
PENDING|REVIEWING → APPROVED
```

Trong cùng transaction:

- Lock Withdrawal.
- Validate state.
- Ghi approver và time.
- Tạo Outbox `WithdrawalApproved`.
- Tạo Audit Log.

Response `202 Accepted` vì Blockchain Worker xử lý bất đồng bộ.

## 23.5. Reject Withdrawal

```http
POST /api/v1/admin/withdrawals/:withdrawalId/reject
```

Request:

```json
{
  "reason": "Invalid destination"
}
```

Trong cùng transaction:

- Lock Withdrawal.
- Validate chưa broadcast.
- Lock Wallet.
- Hoàn Locked về Available.
- Tạo Ledger Entries.
- Chuyển `REJECTED`.
- Tạo Outbox và Audit Log.

---

# 24. Admin Audit API

## 24.1. Danh sách Audit Log

```http
GET /api/v1/admin/audit-logs
```

Query:

```text
adminId=...
action=...
targetType=USER|ASSET|TRADING_PAIR|WITHDRAWAL
targetId=...
from=...
to=...
limit=20
cursor=...
```

Audit Log chỉ đọc, không có public update/delete API.

---

# 25. WebSocket API

## 25.1. Kết nối public namespace

```text
/market
```

Không yêu cầu token.

Client subscribe:

```js
socket.emit(
  "market.subscribe",
  {
    market: "ETH_USDT",
    channels: ["orderBook", "trades", "ticker", "candles"],
    candleSource: "BINANCE",
    candleInterval: "1m",
  },
  (ack) => {
    console.log(ack);
  },
);
```

Server acknowledgement được trả qua callback ack.

Client unsubscribe:

```text
market.unsubscribe
```

### Public server events

```text
orderbook.update
trade.created
ticker.update
candlestick.update
```

Server phát các event này bằng `socket.emit("orderbook.update", payload)` và các tên tương tự, không bọc thêm object có field `event`.

## 25.2. Order Book event

```json
{
  "eventId": "0197...",
  "eventType": "orderbook.update",
  "version": 1,
  "occurredAt": "2026-07-01T10:30:00.000Z",
  "data": {
    "market": "ETH_USDT",
    "sequence": "8452",
    "previousSequence": "8451",
    "bids": [
      {
        "price": "2000.00",
        "totalQuantity": "4.0000",
        "orderCount": 3
      }
    ],
    "asks": [
      {
        "price": "1999.00",
        "totalQuantity": "0",
        "orderCount": 0
      }
    ]
  }
}
```

Mỗi phần tử Order Book delta dùng cùng cấu trúc Price Level với REST snapshot:

- `totalQuantity > 0`: thay thế toàn bộ quantity tại price level đó.
- `totalQuantity = 0`: xóa price level khỏi Order Book.
- `orderCount` là số Order còn nằm ở price level đó.
- `totalQuantity` không phải lượng cộng hoặc trừ vào giá trị hiện tại.

Nếu `previousSequence` không khớp sequence cuối client đã áp dụng, client phải bỏ local book và gọi lại REST Order Book snapshot.

## 25.3. Public Trade event

```json
{
  "eventId": "0197...",
  "eventType": "trade.created",
  "version": 1,
  "occurredAt": "2026-07-01T10:30:00.050Z",
  "data": {
    "market": "ETH_USDT",
    "tradeId": "0197...",
    "price": "2000.00",
    "quantity": "0.5000",
    "takerSide": "BUY",
    "tradeSequence": "1201",
    "settledAt": "2026-07-01T10:30:00.050Z"
  }
}
```

Event này chỉ được phát sau settlement commit.

## 25.4. Candle event

```json
{
  "eventId": "0197...",
  "eventType": "candlestick.update",
  "version": 1,
  "occurredAt": "2026-07-01T10:30:30.000Z",
  "data": {
    "market": "ETH_USDT",
    "source": "BINANCE",
    "sourceLabel": "Binance Reference",
    "interval": "1m",
    "candle": {
      "openTime": "2026-07-01T10:30:00.000Z",
      "closeTime": "2026-07-01T10:31:00.000Z",
      "open": "2000.00",
      "high": "2005.00",
      "low": "1999.00",
      "close": "2002.00",
      "volume": "10.00",
      "isFinal": false
    }
  }
}
```

## 25.5. Private namespace

```text
/private
```

Socket handshake:

```js
io("/private", {
  auth: {
    token: accessToken,
  },
});
```

Nếu Access Token hết hạn:

1. Server phát `auth.expired` hoặc disconnect với mã xác định.
2. Client refresh qua REST.
3. Client reconnect với Access Token mới.

### Private server events

```text
order.updated
balance.updated
deposit.updated
withdrawal.updated
session.revoked
```

## 25.6. `order.updated`

```json
{
  "eventId": "0197...",
  "eventType": "order.updated",
  "version": 1,
  "occurredAt": "2026-07-01T10:30:00.050Z",
  "correlationId": "0197...",
  "data": {
    "orderId": "0197...",
    "market": "ETH_USDT",
    "status": "PARTIALLY_FILLED",
    "filledQuantity": "0.2500",
    "remainingQuantity": "0.2500",
    "remainingLockedAmount": "500.00",
    "updatedAt": "2026-07-01T10:30:00.050Z"
  }
}
```

## 25.7. `balance.updated`

```json
{
  "eventId": "0197...",
  "eventType": "balance.updated",
  "version": 1,
  "occurredAt": "2026-07-01T10:30:00.050Z",
  "data": {
    "asset": "USDT",
    "availableBalance": "900.00",
    "lockedBalance": "500.00",
    "totalBalance": "1400.00",
    "reason": "TRADE_SETTLEMENT"
  }
}
```

Private event chỉ được phát sau database transaction commit.

## 25.8. Reconnect và resync

WebSocket không phải nguồn dữ liệu bền vững.

Sau reconnect, client phải:

- Gọi lại Order Book snapshot.
- Gọi lại Open Orders.
- Gọi lại Wallets.
- Gọi lại các history endpoint nếu cần.

Với Order Book, client phải giữ sequence cuối cùng đã áp dụng; nếu phát hiện gap hoặc subscribe race, xóa buffer và tải lại snapshot rồi áp dụng delta mới.

Không giả định mọi event trong thời gian disconnect đều được replay tới browser.

---

# 26. Idempotency

## 26.1. Endpoint bắt buộc

```text
POST /orders
POST /withdrawals
```

Bắt buộc header:

```http
Idempotency-Key: <string>
```

Đề xuất client dùng UUIDv7.

## 26.2. Phạm vi key

```text
User + Endpoint/Operation + Idempotency-Key
```

Database hiện lưu:

```text
orders: userId + idempotencyKey
withdrawals: userId + idempotencyKey
```

## 26.3. Payload hash

Backend nên tính payload hash sau khi normalize.

Cùng key:

- Payload hash giống nhau: trả resource cũ. Request đầu tiên trả `201 Created`; replay cùng payload trả `200 OK` kèm header `Idempotency-Replayed: true`.
- Payload hash khác nhau: trả `409 IDEMPOTENCY_KEY_REUSED`.

Nếu chưa lưu payload hash thành cột, có thể lưu trong metadata hoặc bảng idempotency riêng khi triển khai.

## 26.4. State command

Các endpoint sau idempotent theo resource state và row lock:

```text
POST /orders/:id/cancel
POST /withdrawals/:id/cancel
POST /admin/withdrawals/:id/approve
POST /admin/withdrawals/:id/reject
POST /admin/users/:id/lock
POST /admin/users/:id/unlock
```

Không tạo thêm Outbox command nếu state đã phản ánh action đang chờ hoặc đã hoàn tất.

---

# 27. Rate Limit

Rate limit phải cấu hình theo môi trường.

Giá trị MVP đề xuất:

| Nhóm                |             Giới hạn tham khảo |
| ------------------- | -----------------------------: |
| Login               |    5 request/phút/IP và email. |
| Refresh Token       | 10 request/phút/IP và session. |
| Forgot Password     |       3 request/15 phút/email. |
| Public Market API   |           120 request/phút/IP. |
| Create Order        |          20 request/giây/User. |
| Cancel Order        |          20 request/giây/User. |
| Create Withdrawal   |           5 request/phút/User. |
| Admin mutation      |         30 request/phút/Admin. |
| WebSocket subscribe |     30 action/phút/connection. |

Vượt giới hạn:

```text
429 RATE_LIMITED
```

Rate limit không thay thế database transaction, row lock hoặc idempotency.

---

# 28. Validation và bảo mật

## 28.1. Backend validate lại toàn bộ

Frontend validation chỉ phục vụ UX.

Backend phải validate:

- DTO schema.
- Decimal format.
- Enum.
- Ownership.
- Role.
- User status.
- Asset/Market status.
- Business Rule.
- Balance trong transaction.

## 28.2. Không nhận field nhạy cảm từ client

Client không được truyền hoặc backend phải bỏ qua:

```text
userId của resource riêng tư
role
status hệ thống
feeAmount do client tự tính
receivedAmount do client tự tính
sequence
lockedAmount
buyerId
sellerId
makerOrderId
takerOrderId
txHash của Withdrawal
```

## 28.3. CORS

Production chỉ allow origin của frontend chính thức.

Nếu dùng Refresh Token cookie:

```text
credentials = true
origin không được là *
```

## 28.4. Log

Không ghi vào log:

- Password.
- Access Token.
- Refresh Token.
- Password Reset Token.
- Private Key.
- Full sensitive request body.

Log nên có:

```text
requestId
correlationId
userId nếu đã xác thực
route
statusCode
duration
errorCode
```

---

# 29. Error code theo domain

## 29.1. Auth

```text
AUTH_EMAIL_ALREADY_EXISTS
AUTH_INVALID_CREDENTIALS
AUTH_ACCOUNT_LOCKED
AUTH_ACCOUNT_DISABLED
AUTH_TOKEN_INVALID
AUTH_TOKEN_EXPIRED
AUTH_REFRESH_TOKEN_INVALID
AUTH_REFRESH_TOKEN_MISSING
AUTH_SESSION_REVOKED
AUTH_PASSWORD_TOO_WEAK
AUTH_RESET_TOKEN_INVALID
AUTH_RESET_TOKEN_EXPIRED
AUTH_RESET_TOKEN_USED
AUTH_SYSTEM_ACCOUNT_NOT_LOGINABLE
```

## 29.2. Market

```text
MARKET_NOT_FOUND
MARKET_NOT_ACTIVE
MARKET_ENGINE_NOT_READY
MARKET_SUSPENDED
MARKET_CONFIGURATION_INVALID
CHART_SOURCE_UNAVAILABLE
REFERENCE_DATA_UNAVAILABLE
```

## 29.3. Asset

```text
ASSET_NOT_FOUND
ASSET_NOT_ACTIVE
```

## 29.4. Wallet

```text
WALLET_NOT_FOUND
WALLET_INSUFFICIENT_AVAILABLE_BALANCE
WALLET_CONCURRENT_UPDATE
```

## 29.5. Order

```text
ORDER_NOT_FOUND
ORDER_INVALID_PRICE
ORDER_INVALID_QUANTITY
ORDER_INVALID_TICK_SIZE
ORDER_INVALID_STEP_SIZE
ORDER_MIN_QUANTITY_NOT_MET
ORDER_MIN_NOTIONAL_NOT_MET
ORDER_INSUFFICIENT_BALANCE
ORDER_NOT_CANCELLABLE
```

## 29.6. Deposit

```text
DEPOSIT_NOT_FOUND
DEPOSIT_DISABLED
DEPOSIT_NOT_CONFIRMED
DEPOSIT_ALREADY_CREDITED
CHAIN_NOT_SUPPORTED
```

## 29.7. Withdrawal

```text
WITHDRAWAL_NOT_FOUND
WITHDRAWAL_DISABLED
WITHDRAWAL_INVALID_ADDRESS
WITHDRAWAL_MINIMUM_NOT_MET
WITHDRAWAL_FEE_EXCEEDS_AMOUNT
WITHDRAWAL_INSUFFICIENT_BALANCE
WITHDRAWAL_NOT_CANCELLABLE
WITHDRAWAL_INVALID_STATE
```

## 29.8. Admin

```text
ADMIN_REASON_REQUIRED
ADMIN_INVALID_STATE_TRANSITION
ADMIN_CANNOT_MODIFY_SELF
AUDIT_LOG_WRITE_FAILED
```

---

# 30. Endpoint tổng hợp

## Public

```text
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/forgot-password
POST   /auth/reset-password

GET    /assets
GET    /assets/:symbol
GET    /markets
GET    /markets/:symbol
GET    /markets/:symbol/order-book
GET    /markets/:symbol/trades
GET    /markets/:symbol/ticker
GET    /markets/:symbol/candles
```

## User

```text
POST   /auth/logout
POST   /auth/change-password
GET    /auth/sessions
DELETE /auth/sessions/:sessionId

GET    /me
PATCH  /me
GET    /me/login-history

GET    /wallets
GET    /wallets/:assetSymbol
GET    /wallets/:assetSymbol/ledger

POST   /orders
GET    /orders
GET    /orders/open?market=ETH_USDT
GET    /orders/:orderId
POST   /orders/:orderId/cancel

GET    /trades
GET    /trades/:tradeId

GET    /deposits/config?asset=USDT
GET    /deposits
GET    /deposits/:depositId

POST   /withdrawals
GET    /withdrawals
GET    /withdrawals/:withdrawalId
POST   /withdrawals/:withdrawalId/cancel
```

## Admin

```text
GET    /admin/users
GET    /admin/users/:userId
POST   /admin/users/:userId/lock
POST   /admin/users/:userId/unlock
POST   /admin/users/:userId/disable

GET    /admin/assets
GET    /admin/assets/:assetId
POST   /admin/assets
PATCH  /admin/assets/:assetId
POST   /admin/assets/:assetId/activate
POST   /admin/assets/:assetId/deactivate

GET    /admin/markets
GET    /admin/markets/:marketId
POST   /admin/markets
PATCH  /admin/markets/:marketId
POST   /admin/markets/:marketId/open
POST   /admin/markets/:marketId/suspend

GET    /admin/withdrawals
GET    /admin/withdrawals/:withdrawalId
POST   /admin/withdrawals/:withdrawalId/review
POST   /admin/withdrawals/:withdrawalId/approve
POST   /admin/withdrawals/:withdrawalId/reject

GET    /admin/audit-logs
```

---

# 31. API ADR

## API-ADR-001 — REST + Socket.IO

REST dùng cho command/query có request-response rõ ràng. Socket.IO dùng cho realtime projection sau commit.

## API-ADR-002 — Decimal và BIGINT trả dạng string

Tránh mất precision trong JavaScript và bảo đảm nhất quán với PostgreSQL `NUMERIC`/`BIGINT`.

## API-ADR-003 — Tạo Order trả `201` với trạng thái `PENDING`

Order đã được tạo và số dư đã bị khóa trong PostgreSQL, dù Matching Engine chưa xử lý.

## API-ADR-004 — Cancel dùng action endpoint

Sử dụng:

```text
POST /orders/:id/cancel
```

vì Order không bị xóa và hủy là state transition bất đồng bộ.

## API-ADR-005 — Order Book và Recent Trades không có Chart Source

Order Book và Recent Trades luôn thuộc Hau CEX. Chỉ Candlestick/Ticker Reference có `source`.

## API-ADR-006 — Private event chỉ phát sau commit

Không phát `order.updated`, `balance.updated`, `deposit.updated`, `withdrawal.updated` trước khi transaction nghiệp vụ commit.

## API-ADR-007 — WebSocket không phải source of truth

Client phải resync bằng REST sau reconnect hoặc khi phát hiện sequence gap. Với Order Book, client phải buffer delta quanh giai đoạn subscribe/snapshot.

## API-ADR-008 — Refresh Token dùng HttpOnly cookie

Giảm nguy cơ token bị đọc bởi JavaScript khi xảy ra XSS. Access Token vẫn dùng Bearer header.

## API-ADR-009 — Refresh Cookie cần chống CSRF

Refresh và logout bằng cookie phải kiểm tra Origin/Referer hoặc CSRF token tùy kiến trúc triển khai.

---

# 32. Tiêu chí hoàn thành API Design

API Design được xem là hoàn thành khi:

1. Guest xem được Market, Order Book, Recent Trades, Ticker và Candlestick.
2. User đăng ký, đăng nhập, refresh và logout được.
3. User quản lý được Wallet, Order, Trade, Deposit và Withdrawal của chính mình.
4. Order, Withdrawal và Idempotency hoạt động đúng theo session và state machine.
5. Admin quản lý được User, Asset, Trading Pair, Withdrawal và Audit Log.
6. WebSocket public và private đều tuân thủ rule settlement, commit và resync.
7. Error response và dữ liệu nhạy cảm được chuẩn hóa đúng như các mục trước.
