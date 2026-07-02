# Hau CEX — Database Design

## 1. Mục đích

Tài liệu này mô tả thiết kế cơ sở dữ liệu PostgreSQL cho Hau CEX.

Thiết kế tập trung vào các mục tiêu:

- Bảo đảm tính đúng đắn của Wallet và Ledger.
- Hỗ trợ Spot Trading bằng Limit Order.
- Lưu Order và Trade sau settlement.
- Hỗ trợ Go Matching Engine khôi phục Order Book.
- Chống xử lý trùng cho Command, Event, Deposit và Withdrawal.
- Hỗ trợ Outbox Pattern.
- Tách dữ liệu thị trường nội bộ Hau CEX khỏi dữ liệu tham chiếu Binance.
- Phục vụ REST API, WebSocket, Worker và chức năng Admin.

---

## 2. Nguyên tắc thiết kế

### 2.1. PostgreSQL là nguồn dữ liệu bền vững chính

PostgreSQL lưu dữ liệu nghiệp vụ chính theo danh sách bảng ở mục 4. Redis chỉ là cache/message transport, không phải nguồn dữ liệu tài chính chính.

### 2.2. Không sử dụng số thực

Không sử dụng:

```text
FLOAT
DOUBLE PRECISION
REAL
JavaScript number
Go float64
```

cho:

- Balance.
- Price.
- Quantity.
- Fee.
- Notional.

PostgreSQL sử dụng:

```text
NUMERIC(38, 18)
```

Với lựa chọn này, MVP chỉ hỗ trợ giá trị normalized có scale tối đa 18.

Các cấu hình liên quan phải thỏa:

```text
asset.decimals <= 18
trading_pairs.price_precision <= 18
trading_pairs.quantity_precision <= 18
```

Nếu cần hỗ trợ Asset có decimals lớn hơn 18, hệ thống phải chuyển sang lưu raw integer/fixed-point theo Asset thay vì ép vào `NUMERIC(38,18)`.

Matching Engine chuyển Price và Quantity sang fixed-point integer trước khi xử lý.

### 2.3. Mọi thời gian sử dụng UTC

Các cột thời gian sử dụng:

```text
TIMESTAMPTZ
```

Frontend chịu trách nhiệm chuyển sang múi giờ hiển thị.

### 2.4. ID sử dụng UUIDv7 và deterministic ID

Các entity nghiệp vụ mặc định sử dụng UUIDv7.

Trong PostgreSQL, kiểu cột vẫn là:

```text
UUID
```

Quy ước:

- Application service tạo UUIDv7 trước khi insert.
- Message ID và Correlation ID sử dụng UUIDv7.
- Nếu môi trường PostgreSQL hỗ trợ `uuidv7()` hoặc extension tương đương, migration có thể đặt `DEFAULT uuidv7()`.
- Không dùng `gen_random_uuid()` làm default cho business entity mới vì đó là UUIDv4.
- Các cột FK dùng cùng giá trị UUIDv7 của entity được tham chiếu.

Ngoại lệ:

- `trades.id` / `tradeId` không dùng UUIDv7.
- `tradeId` được tạo deterministic từ `engineMatchId` để Engine replay cùng một match sau restart vẫn sinh đúng cùng một Trade ID.
- Công thức:

```text
engineMatchId = tradingPairId + ":" + commandSequence + ":" + matchIndex
tradeId = UUIDv5(HAU_CEX_TRADE_NAMESPACE, engineMatchId)
```

`HAU_CEX_TRADE_NAMESPACE` là namespace UUID cố định dùng chung giữa Go và TypeScript, không được thay đổi giữa các môi trường.
Tài liệu Matching Engine Design phải định nghĩa giá trị UUID cụ thể của namespace này trước khi implement.

Các trường cần thứ tự tuyệt đối sử dụng `BIGINT`, ví dụ:

- Order Sequence.
- Trade Sequence.
- Block Number.
- Transaction Nonce.

### 2.5. Không xóa dữ liệu tài chính

Không xóa vật lý:

- Wallet.
- Ledger Entry.
- Order.
- Trade.
- Deposit.
- Withdrawal.
- Audit Log.

User, Asset và Trading Pair được vô hiệu hóa bằng trạng thái.

### 2.6. Giao dịch đã khớp chỉ được lưu sau settlement

Matching Engine phát `TradeCreated`.

Bảng `trades` chỉ được ghi trong transaction settlement thành công.

`TradeCreated` chưa settlement không được dùng để:

- Tạo Recent Trades.
- Cập nhật Internal Last Price.
- Cập nhật Hau Candlestick.
- Cập nhật Wallet hoặc Ledger.

---

## 3. PostgreSQL Extension

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Sử dụng:

- `citext` để so sánh email không phân biệt chữ hoa và chữ thường.
- `pgcrypto` cho nhu cầu random/token hash nếu cần, không dùng để sinh ID entity chính.

Nếu muốn sinh UUIDv7 trực tiếp trong PostgreSQL, dùng hàm built-in hoặc extension được hạ tầng hỗ trợ và chuẩn hóa tên hàm trong migration.

---

## 4. Danh sách bảng

### 4.1. Authentication và User

```text
users
sessions
password_reset_tokens
login_histories
```

### 4.2. Asset và Market

```text
assets
trading_pairs
```

### 4.3. Wallet và Trading

```text
wallets
ledger_entries
order_sequences
engine_command_sequences
orders
trades
```

### 4.4. Blockchain

```text
deposits
withdrawals
```

### 4.5. Market Data

```text
candlesticks
market_tickers
```

### 4.6. Hạ tầng nghiệp vụ

```text
outbox_events
processed_events
engine_snapshots
audit_logs
```

---

## 5. Enum

```text
user_role:
- USER
- ADMIN
- SYSTEM

user_status:
- ACTIVE
- LOCKED
- DISABLED

asset_status:
- ACTIVE
- INACTIVE

trading_pair_status:
- INACTIVE
- ACTIVE
- SUSPENDED
- CLOSED

order_side:
- BUY
- SELL

order_type:
- LIMIT

order_status:
- PENDING
- OPEN
- PARTIALLY_FILLED
- FILLED
- CANCEL_PENDING
- CANCELLED
- REJECTED

balance_type:
- AVAILABLE
- LOCKED

ledger_entry_type:
- ORDER_LOCK
- ORDER_UNLOCK
- ORDER_REJECT_REFUND
- TRADE_SPEND
- TRADE_RECEIVE
- TRADE_PRICE_REFUND
- TRADING_FEE
- DEPOSIT
- WITHDRAWAL_LOCK
- WITHDRAWAL_COMPLETED
- WITHDRAWAL_REFUND
- ADMIN_ADJUSTMENT

reference_type:
- ORDER
- TRADE
- DEPOSIT
- WITHDRAWAL
- ADMIN_ADJUSTMENT

deposit_status:
- DETECTED
- CONFIRMING
- CREDITED
- FAILED

withdrawal_status:
- PENDING
- REVIEWING
- APPROVED
- PROCESSING
- BROADCASTED
- COMPLETED
- REJECTED
- FAILED
- CANCELLED

chart_source:
- HAU
- BINANCE

candle_interval:
- 1m
- 5m
- 15m
- 1h
- 4h
- 1d

outbox_status:
- PENDING
- PUBLISHED
- FAILED
```

Trong Prisma, các giá trị như `1m` không phù hợp làm enum identifier. Có thể dùng:

```text
ONE_MINUTE
FIVE_MINUTES
FIFTEEN_MINUTES
ONE_HOUR
FOUR_HOURS
ONE_DAY
```

và map sang giá trị hiển thị.

---

# 6. Thiết kế chi tiết bảng

## 6.1. `users`

Lưu thông tin tài khoản User và Admin.

| Cột             | Kiểu          | Ràng buộc                  | Mô tả                  |
| --------------- | ------------- | -------------------------- | ---------------------- |
| `id`            | UUID          | PK                         | ID tài khoản           |
| `email`         | CITEXT        | NOT NULL, UNIQUE           | Email đăng nhập        |
| `password_hash` | TEXT          | NOT NULL                   | Mật khẩu đã hash       |
| `full_name`     | VARCHAR(150)  | NULL                       | Họ tên                 |
| `avatar_url`    | TEXT          | NULL                       | Ảnh đại diện           |
| `role`          | `user_role`   | NOT NULL, DEFAULT `USER`   | Phân quyền             |
| `status`        | `user_status` | NOT NULL, DEFAULT `ACTIVE` | Trạng thái             |
| `locked_at`     | TIMESTAMPTZ   | NULL                       | Thời điểm khóa         |
| `locked_reason` | TEXT          | NULL                       | Lý do khóa             |
| `last_login_at` | TIMESTAMPTZ   | NULL                       | Lần đăng nhập gần nhất |
| `created_at`    | TIMESTAMPTZ   | NOT NULL                   | Thời điểm tạo          |
| `updated_at`    | TIMESTAMPTZ   | NOT NULL                   | Thời điểm cập nhật     |

### Constraint

```text
email phải duy nhất, không phân biệt hoa thường
role không được User tự thay đổi
status chỉ được thay đổi qua nghiệp vụ hợp lệ
```

### Treasury Account

Treasury Account là tài khoản nội bộ thuộc role `SYSTEM`.

- Không xuất hiện như User giao dịch thông thường.
- Không được đăng nhập.
- Không được tạo session.
- Không được khóa hoặc chỉnh sửa qua Admin User API thông thường.
- Được dùng để sở hữu Treasury Wallet phục vụ ghi nhận phí và đối soát Ledger.
- Wallet của Treasury Account chỉ được Settlement Service cập nhật trong transaction nghiệp vụ hợp lệ.

### Index

```sql
CREATE INDEX idx_users_status_created_at ON users (status, created_at DESC);
```

Unique constraint trên `email` đã tạo unique index vật lý, không định nghĩa thêm `CREATE UNIQUE INDEX` trùng.

## 6.2. `sessions`

Lưu Refresh Token theo session.

| Cột                  | Kiểu        | Ràng buộc               |
| -------------------- | ----------- | ----------------------- |
| `id`                 | UUID        | PK                      |
| `user_id`            | UUID        | FK → users.id, NOT NULL |
| `refresh_token_hash` | TEXT        | NOT NULL, UNIQUE        |
| `ip_address`         | INET        | NULL                    |
| `user_agent`         | TEXT        | NULL                    |
| `expires_at`         | TIMESTAMPTZ | NOT NULL                |
| `last_used_at`       | TIMESTAMPTZ | NULL                    |
| `revoked_at`         | TIMESTAMPTZ | NULL                    |
| `revoke_reason`      | TEXT        | NULL                    |
| `created_at`         | TIMESTAMPTZ | NOT NULL                |

### Index

```sql
CREATE INDEX idx_sessions_user_active
ON sessions (user_id, expires_at)
WHERE revoked_at IS NULL;
```

### Quy tắc

- Không lưu Refresh Token dạng plain text.
- Khi User bị khóa, revoke toàn bộ session.
- Session hết hạn có thể được dọn theo scheduled job.

---

## 6.3. `password_reset_tokens`

Phục vụ chức năng quên mật khẩu.

| Cột            | Kiểu        | Ràng buộc               |
| -------------- | ----------- | ----------------------- |
| `id`           | UUID        | PK                      |
| `user_id`      | UUID        | FK → users.id, NOT NULL |
| `token_hash`   | TEXT        | NOT NULL, UNIQUE        |
| `requested_ip` | INET        | NULL                    |
| `expires_at`   | TIMESTAMPTZ | NOT NULL                |
| `used_at`      | TIMESTAMPTZ | NULL                    |
| `created_at`   | TIMESTAMPTZ | NOT NULL                |

### Quy tắc

- Chỉ lưu hash của token.
- Token chỉ sử dụng một lần.
- Sau khi đổi mật khẩu thành công, revoke các session hiện tại nếu chính sách yêu cầu.

---

## 6.4. `login_histories`

Lưu lịch sử đăng nhập cơ bản.

| Cột               | Kiểu        | Ràng buộc           |
| ----------------- | ----------- | ------------------- |
| `id`              | UUID        | PK                  |
| `user_id`         | UUID        | FK → users.id, NULL |
| `attempted_email` | CITEXT      | NOT NULL            |
| `success`         | BOOLEAN     | NOT NULL            |
| `ip_address`      | INET        | NULL                |
| `user_agent`      | TEXT        | NULL                |
| `failure_reason`  | TEXT        | NULL                |
| `created_at`      | TIMESTAMPTZ | NOT NULL            |

`user_id` có thể NULL khi email không tồn tại.

### Index

```sql
CREATE INDEX idx_login_histories_user_created
ON login_histories (user_id, created_at DESC);

CREATE INDEX idx_login_histories_email_created
ON login_histories (attempted_email, created_at DESC);
```

---

## 6.5. `assets`

Lưu token được Hau CEX hỗ trợ.

| Cột                      | Kiểu           | Ràng buộc                    |
| ------------------------ | -------------- | ---------------------------- |
| `id`                     | UUID           | PK                           |
| `symbol`                 | VARCHAR(20)    | NOT NULL, UNIQUE             |
| `name`                   | VARCHAR(100)   | NOT NULL                     |
| `image_url`              | TEXT           | NULL                         |
| `chain_id`               | BIGINT         | NOT NULL                     |
| `contract_address`       | VARCHAR(42)    | NOT NULL                     |
| `decimals`               | SMALLINT       | NOT NULL                     |
| `status`                 | `asset_status` | NOT NULL, DEFAULT `INACTIVE` |
| `deposit_enabled`        | BOOLEAN        | NOT NULL, DEFAULT false      |
| `withdrawal_enabled`     | BOOLEAN        | NOT NULL, DEFAULT false      |
| `trading_enabled`        | BOOLEAN        | NOT NULL, DEFAULT false      |
| `required_confirmations` | INTEGER        | NOT NULL, DEFAULT 3          |
| `minimum_withdrawal`     | NUMERIC(38,18) | NOT NULL, DEFAULT 0          |
| `withdrawal_fee`         | NUMERIC(38,18) | NOT NULL, DEFAULT 0          |
| `created_at`             | TIMESTAMPTZ    | NOT NULL                     |
| `updated_at`             | TIMESTAMPTZ    | NOT NULL                     |

### Constraint

```sql
CHECK (symbol = UPPER(symbol));
CHECK (chain_id > 0);
CHECK (contract_address ~ '^0x[0-9a-f]{40}$');
CHECK (decimals >= 0 AND decimals <= 18);
CHECK (required_confirmations >= 0);
CHECK (minimum_withdrawal >= 0);
CHECK (withdrawal_fee >= 0);
CHECK (
    status = 'ACTIVE'
    OR (
        deposit_enabled = false
        AND withdrawal_enabled = false
        AND trading_enabled = false
    )
);
UNIQUE (chain_id, contract_address);
```

### Quy tắc

- Chuẩn hóa `contract_address` về chữ thường trước khi lưu.
- Không đổi `decimals` sau khi đã phát sinh dữ liệu tài chính.
- Không xóa Asset đã được sử dụng.
- `status = INACTIVE` là trạng thái lifecycle để ngừng sử dụng Asset mới.
- Asset mới mặc định `INACTIVE`; Admin/seed script phải bật `ACTIVE` và từng flag nghiệp vụ một cách chủ động.
- Ba flag `deposit_enabled`, `withdrawal_enabled`, `trading_enabled` vẫn điều khiển độc lập từng nghiệp vụ.
- Asset `INACTIVE` không được bật Deposit, Withdrawal hoặc Trading cho nghiệp vụ mới.
- MVP chỉ hỗ trợ ERC-20, không hỗ trợ native coin deposit.
- MVP dùng `NUMERIC(38,18)`, do đó chỉ hỗ trợ Asset có `decimals <= 18`.

---

## 6.6. `trading_pairs`

Lưu cấu hình market.

| Cột                      | Kiểu                  | Ràng buộc                    |
| ------------------------ | --------------------- | ---------------------------- |
| `id`                     | UUID                  | PK                           |
| `symbol`                 | VARCHAR(50)           | NOT NULL, UNIQUE             |
| `base_asset_id`          | UUID                  | FK → assets.id, NOT NULL     |
| `quote_asset_id`         | UUID                  | FK → assets.id, NOT NULL     |
| `price_precision`        | SMALLINT              | NOT NULL                     |
| `quantity_precision`     | SMALLINT              | NOT NULL                     |
| `tick_size`              | NUMERIC(38,18)        | NOT NULL                     |
| `step_size`              | NUMERIC(38,18)        | NOT NULL                     |
| `minimum_quantity`       | NUMERIC(38,18)        | NOT NULL                     |
| `minimum_notional`       | NUMERIC(38,18)        | NOT NULL                     |
| `maker_fee_rate`         | NUMERIC(12,10)        | NOT NULL                     |
| `taker_fee_rate`         | NUMERIC(12,10)        | NOT NULL                     |
| `status`                 | `trading_pair_status` | NOT NULL, DEFAULT `INACTIVE` |
| `binance_symbol`         | VARCHAR(30)           | NULL                         |
| `reference_data_enabled` | BOOLEAN               | NOT NULL, DEFAULT false      |
| `created_at`             | TIMESTAMPTZ           | NOT NULL                     |
| `updated_at`             | TIMESTAMPTZ           | NOT NULL                     |

### Constraint

```sql
CHECK (base_asset_id <> quote_asset_id);
CHECK (price_precision >= 0 AND price_precision <= 18);
CHECK (quantity_precision >= 0 AND quantity_precision <= 18);
CHECK (tick_size > 0);
CHECK (step_size > 0);
CHECK (minimum_quantity > 0);
CHECK (minimum_notional > 0);
CHECK (maker_fee_rate >= 0 AND maker_fee_rate < 1);
CHECK (taker_fee_rate >= 0 AND taker_fee_rate < 1);
CHECK (binance_symbol IS NULL OR binance_symbol = UPPER(binance_symbol));
CHECK (
    reference_data_enabled = false
    OR binance_symbol IS NOT NULL
);
UNIQUE (base_asset_id, quote_asset_id);
```

### Quy tắc

- `symbol` trong code dùng dạng `ETH_USDT`.
- `binance_symbol` dùng để map sang nguồn tham chiếu, ví dụ `ETHUSDT`.
- Binance chỉ dùng cho chart/reference.
- `reference_data_enabled` mặc định `false`; Admin chỉ bật sau khi đã cấu hình `binance_symbol`.
- Chỉ `ACTIVE` mới nhận Order mới.

---

## 6.7. `wallets`

Lưu số dư nội bộ của User theo Asset.

| Cột                 | Kiểu           | Ràng buộc                |
| ------------------- | -------------- | ------------------------ |
| `id`                | UUID           | PK                       |
| `user_id`           | UUID           | FK → users.id, NOT NULL  |
| `asset_id`          | UUID           | FK → assets.id, NOT NULL |
| `available_balance` | NUMERIC(38,18) | NOT NULL, DEFAULT 0      |
| `locked_balance`    | NUMERIC(38,18) | NOT NULL, DEFAULT 0      |
| `version`           | BIGINT         | NOT NULL, DEFAULT 0      |
| `created_at`        | TIMESTAMPTZ    | NOT NULL                 |
| `updated_at`        | TIMESTAMPTZ    | NOT NULL                 |

### Constraint

```sql
UNIQUE (user_id, asset_id);
UNIQUE (id, user_id, asset_id);
CHECK (available_balance >= 0);
CHECK (locked_balance >= 0);
CHECK (version >= 0);
```

`UNIQUE (id, user_id, asset_id)` phục vụ composite foreign key từ Ledger Entry, bảo đảm Ledger không tham chiếu một `wallet_id` nhưng ghi sai `user_id` hoặc `asset_id`.

### Không lưu `total_balance`

Tính khi truy vấn:

```text
total_balance = available_balance + locked_balance
```

### Cập nhật Wallet

Phải sử dụng transaction và row-level lock:

```sql
SELECT *
FROM wallets
WHERE user_id = $1
  AND asset_id = $2
FOR UPDATE;
```

### Index

Unique constraint `UNIQUE (user_id, asset_id)` đã tạo unique index vật lý và phục vụ lookup theo `user_id`, không định nghĩa thêm index trùng.

### Cột `version`

Dùng cho:

- Optimistic locking khi cần.
- Phát hiện thay đổi.
- Reconciliation.

Row-level lock vẫn là cơ chế chính trong nghiệp vụ tài chính.

### Treasury Wallet

Mỗi Asset có thể có một Treasury Wallet thuộc Treasury Account role `SYSTEM`.

Treasury Wallet dùng để nhận phí giao dịch:

- Buyer Fee được credit vào Treasury Wallet của Base Asset.
- Seller Fee được credit vào Treasury Wallet của Quote Asset.
- Mỗi credit phí vào Treasury Wallet phải có Ledger Entry `TRADING_FEE` dương với `reference_type = TRADE`.
- Treasury Wallet được lock và cập nhật trong cùng settlement transaction với buyer, seller và Trade.

---

## 6.8. `ledger_entries`

Ledger là bảng bất biến ghi toàn bộ biến động số dư.

| Cột               | Kiểu                | Ràng buộc                 |
| ----------------- | ------------------- | ------------------------- |
| `id`              | UUID                | PK                        |
| `wallet_id`       | UUID                | FK → wallets.id, NOT NULL |
| `user_id`         | UUID                | FK → users.id, NOT NULL   |
| `asset_id`        | UUID                | FK → assets.id, NOT NULL  |
| `balance_type`    | `balance_type`      | NOT NULL                  |
| `entry_type`      | `ledger_entry_type` | NOT NULL                  |
| `amount`          | NUMERIC(38,18)      | NOT NULL                  |
| `balance_before`  | NUMERIC(38,18)      | NOT NULL                  |
| `balance_after`   | NUMERIC(38,18)      | NOT NULL                  |
| `reference_type`  | `reference_type`    | NOT NULL                  |
| `reference_id`    | UUID                | NOT NULL                  |
| `operation_id`    | UUID                | NOT NULL                  |
| `message_id`      | UUID                | NULL                      |
| `idempotency_key` | TEXT                | NOT NULL, UNIQUE          |
| `metadata`        | JSONB               | NOT NULL, DEFAULT `{}`    |
| `created_at`      | TIMESTAMPTZ         | NOT NULL                  |

### Constraint

```sql
CHECK (amount <> 0);
CHECK (balance_before >= 0);
CHECK (balance_after >= 0);
CHECK (balance_after = balance_before + amount);

FOREIGN KEY (wallet_id, user_id, asset_id)
REFERENCES wallets (id, user_id, asset_id);
```

### Ý nghĩa trường

- `operation_id`: gom các Ledger Entry thuộc cùng nghiệp vụ.
- `reference_id`: Order, Trade, Deposit hoặc Withdrawal liên quan.
- `idempotency_key`: chống ghi trùng một bút toán.
- `message_id`: Command/Event message gây ra thay đổi nếu có.
- Composite FK `(wallet_id, user_id, asset_id)` ngăn Ledger Entry bị lệch Wallet/User/Asset.

### Index

```sql
CREATE INDEX idx_ledger_wallet_created
ON ledger_entries (wallet_id, created_at DESC);

CREATE INDEX idx_ledger_user_asset_created
ON ledger_entries (user_id, asset_id, created_at DESC);

CREATE INDEX idx_ledger_reference
ON ledger_entries (reference_type, reference_id);

CREATE INDEX idx_ledger_operation
ON ledger_entries (operation_id);
```

### Chính sách

- Không UPDATE.
- Không DELETE.
- Sửa sai bằng bút toán bù trừ.
- Database role của ứng dụng không nên có quyền DELETE trên bảng này.

---

## 6.9. `orders`

Lưu Order bền vững trong PostgreSQL.

| Cột                       | Kiểu           | Ràng buộc                       |
| ------------------------- | -------------- | ------------------------------- |
| `id`                      | UUID           | PK                              |
| `user_id`                 | UUID           | FK → users.id, NOT NULL         |
| `trading_pair_id`         | UUID           | FK → trading_pairs.id, NOT NULL |
| `idempotency_key`         | TEXT           | NOT NULL                        |
| `side`                    | `order_side`   | NOT NULL                        |
| `type`                    | `order_type`   | NOT NULL, DEFAULT `LIMIT`       |
| `price`                   | NUMERIC(38,18) | NOT NULL                        |
| `original_quantity`       | NUMERIC(38,18) | NOT NULL                        |
| `filled_quantity`         | NUMERIC(38,18) | NOT NULL, DEFAULT 0             |
| `remaining_quantity`      | NUMERIC(38,18) | NOT NULL                        |
| `locked_asset_id`         | UUID           | FK → assets.id, NOT NULL        |
| `initial_locked_amount`   | NUMERIC(38,18) | NOT NULL                        |
| `remaining_locked_amount` | NUMERIC(38,18) | NOT NULL                        |
| `status`                  | `order_status` | NOT NULL, DEFAULT `PENDING`     |
| `sequence`                | BIGINT         | NOT NULL                        |
| `rejection_reason`        | TEXT           | NULL                            |
| `cancel_requested_at`     | TIMESTAMPTZ    | NULL                            |
| `opened_at`               | TIMESTAMPTZ    | NULL                            |
| `closed_at`               | TIMESTAMPTZ    | NULL                            |
| `created_at`              | TIMESTAMPTZ    | NOT NULL                        |
| `updated_at`              | TIMESTAMPTZ    | NOT NULL                        |

### Constraint

```sql
CHECK (price > 0);
CHECK (original_quantity > 0);
CHECK (filled_quantity >= 0);
CHECK (remaining_quantity >= 0);
CHECK (initial_locked_amount > 0);
CHECK (remaining_locked_amount >= 0);
CHECK (remaining_locked_amount <= initial_locked_amount);
CHECK (original_quantity = filled_quantity + remaining_quantity);
CHECK (sequence > 0);
CHECK (opened_at IS NULL OR opened_at >= created_at);
CHECK (closed_at IS NULL OR closed_at >= created_at);
CHECK (
    status IN ('PENDING', 'OPEN', 'PARTIALLY_FILLED', 'CANCEL_PENDING')
    OR remaining_locked_amount = 0
);

UNIQUE (user_id, idempotency_key);
UNIQUE (trading_pair_id, sequence);
```

### Locked Asset

- BUY: `locked_asset_id = quote_asset_id`.
- SELL: `locked_asset_id = base_asset_id`.

### Locked Amount

BUY:

```text
initial_locked_amount =
ROUND_DOWN(limit_price × original_quantity, quote_asset.decimals)

remaining_locked_amount =
ROUND_DOWN(limit_price × remaining_quantity, quote_asset.decimals)
```

SELL:

```text
initial_locked_amount = original_quantity
remaining_locked_amount = remaining_quantity
```

`remaining_locked_amount` giúp:

- Tính số dư cần mở khóa khi cancel.
- Theo dõi số dư đã tiêu và đã refund.
- Reconciliation giữa Order và Wallet.

Khi BUY khớp ở `execution_price` thấp hơn limit price:

```text
spent_quote =
ROUND_DOWN(execution_price × executed_quantity, quote_asset.decimals)

new_remaining_locked =
ROUND_DOWN(limit_price × new_remaining_quantity, quote_asset.decimals)

locked_delta =
old_remaining_locked - new_remaining_locked

price_refund =
locked_delta - spent_quote
```

Trong settlement:

```text
remaining_locked_amount = new_remaining_locked
```

`spent_quote` được chuyển cho Seller, `price_refund` được trả về Available Balance của Buyer.

Cách tính lại `new_remaining_locked` từ `new_remaining_quantity` và tính `price_refund` từ `locked_delta - spent_quote` giúp tránh tích lũy sai số làm tròn qua nhiều lần partial fill.

Khi Order chuyển sang `FILLED`, `CANCELLED` hoặc `REJECTED`, `remaining_locked_amount` phải bằng `0`.

### Sequence

`orders.sequence` là Order Sequence, dùng cho Price-Time Priority trong Order Book.

Không dựa vào `GENERATED AS IDENTITY` trực tiếp trên bảng `orders`, vì sequence global có thể được cấp trong một transaction commit muộn hơn transaction có sequence lớn hơn.

Sử dụng allocator theo Trading Pair:

```text
order_sequences
```

| Cột               | Kiểu        | Ràng buộc                 |
| ----------------- | ----------- | ------------------------- |
| `trading_pair_id` | UUID        | PK, FK → trading_pairs.id |
| `next_sequence`   | BIGINT      | NOT NULL                  |
| `updated_at`      | TIMESTAMPTZ | NOT NULL                  |

```sql
CHECK (next_sequence > 0);
```

Khi tạo Order:

1. Sau khi validate và lock Wallet, backend lock row `order_sequences` của Trading Pair bằng `FOR UPDATE`.
2. Gán `orders.sequence = next_sequence`.
3. Tăng `next_sequence`.
4. Insert Order.
5. Insert Outbox `PlaceOrder` chứa `order_id`, `trading_pair_id`, `orderSequence` và `commandSequence`.
6. Commit.

Row lock của `order_sequences` được giữ đến commit để bảo đảm cùng một Trading Pair không thể cấp trùng hoặc đảo thứ tự Order Sequence.

### Command Sequence

Command gửi đến Matching Engine sử dụng sequence riêng:

```text
engine_command_sequences
```

| Cột                     | Kiểu        | Ràng buộc                 |
| ----------------------- | ----------- | ------------------------- |
| `trading_pair_id`       | UUID        | PK, FK → trading_pairs.id |
| `next_command_sequence` | BIGINT      | NOT NULL                  |
| `updated_at`            | TIMESTAMPTZ | NOT NULL                  |

```sql
CHECK (next_command_sequence > 0);
```

Command Sequence khác Order Sequence:

- `orders.sequence` chỉ dùng để ưu tiên Order trong Order Book.
- `command_sequence` dùng để Engine xử lý tuần tự mọi command của một Trading Pair.
- `PlaceOrder` có cả `order_sequence` và `command_sequence`.
- `CancelOrder`, `CreateSnapshot` và command vận hành khác chỉ cần `command_sequence`, không tạo Order Sequence mới.

Khi tạo Outbox Engine command, backend phải lock row `engine_command_sequences` của Trading Pair bằng `FOR UPDATE`, gán `command_sequence`, tăng `next_command_sequence`, rồi insert Outbox trong cùng transaction.

### Ba loại sequence trong Trading

Không dùng lẫn ba loại sequence này:

| Sequence         | Nơi lưu                          | Owner                  | Mục đích                                                             |
| ---------------- | -------------------------------- | ---------------------- | -------------------------------------------------------------------- |
| Order Sequence   | `orders.sequence`                | Backend DB transaction | Price-Time Priority trong Order Book                                 |
| Command Sequence | `outbox_events.command_sequence` | Backend DB transaction | Thứ tự command đi vào Matching Engine theo Trading Pair              |
| Trade Sequence   | `trades.sequence`                | Matching Engine        | Thứ tự Trade đã khớp để settlement, Recent Trades và Hau Market Data |

`PlaceOrder` có cả Order Sequence và Command Sequence. `CancelOrder` chỉ có Command Sequence. `TradeCreated` có Trade Sequence và không được dùng Order Sequence làm thứ tự Trade.

Snapshot lưu `last_trade_sequence` để Matching Engine tiếp tục cấp Trade Sequence đúng sau restart.

### Index cho User

```sql
CREATE INDEX idx_orders_user_status_created
ON orders (user_id, status, created_at DESC);

CREATE INDEX idx_orders_user_pair_created
ON orders (user_id, trading_pair_id, created_at DESC);
```

### Index phục hồi Order Book

```sql
CREATE INDEX idx_orders_open_bids
ON orders (trading_pair_id, price DESC, sequence ASC)
WHERE side = 'BUY'
  AND status IN ('OPEN', 'PARTIALLY_FILLED');

CREATE INDEX idx_orders_open_asks
ON orders (trading_pair_id, price ASC, sequence ASC)
WHERE side = 'SELL'
  AND status IN ('OPEN', 'PARTIALLY_FILLED');
```

## 6.10. `trades`

Lưu Trade đã settlement thành công.

| Cột                   | Kiểu           | Ràng buộc                       |
| --------------------- | -------------- | ------------------------------- |
| `id`                  | UUID           | PK, do Engine tạo               |
| `engine_message_id`   | UUID           | NOT NULL                        |
| `engine_match_id`     | VARCHAR(200)   | NOT NULL                        |
| `trading_pair_id`     | UUID           | FK → trading_pairs.id, NOT NULL |
| `buy_order_id`        | UUID           | FK → orders.id, NOT NULL        |
| `sell_order_id`       | UUID           | FK → orders.id, NOT NULL        |
| `buyer_id`            | UUID           | FK → users.id, NOT NULL         |
| `seller_id`           | UUID           | FK → users.id, NOT NULL         |
| `maker_order_id`      | UUID           | FK → orders.id, NOT NULL        |
| `taker_order_id`      | UUID           | FK → orders.id, NOT NULL        |
| `price`               | NUMERIC(38,18) | NOT NULL                        |
| `quantity`            | NUMERIC(38,18) | NOT NULL                        |
| `quote_amount`        | NUMERIC(38,18) | NOT NULL                        |
| `buyer_fee_rate`      | NUMERIC(12,10) | NOT NULL                        |
| `seller_fee_rate`     | NUMERIC(12,10) | NOT NULL                        |
| `buyer_fee_amount`    | NUMERIC(38,18) | NOT NULL                        |
| `seller_fee_amount`   | NUMERIC(38,18) | NOT NULL                        |
| `buyer_fee_asset_id`  | UUID           | FK → assets.id, NOT NULL        |
| `seller_fee_asset_id` | UUID           | FK → assets.id, NOT NULL        |
| `sequence`            | BIGINT         | NOT NULL                        |
| `matched_at`          | TIMESTAMPTZ    | NOT NULL                        |
| `settled_at`          | TIMESTAMPTZ    | NOT NULL                        |

### Constraint

```sql
CHECK (buy_order_id <> sell_order_id);
CHECK (maker_order_id <> taker_order_id);
CHECK (price > 0);
CHECK (quantity > 0);
CHECK (quote_amount > 0);
CHECK (buyer_fee_rate >= 0 AND buyer_fee_rate < 1);
CHECK (seller_fee_rate >= 0 AND seller_fee_rate < 1);
CHECK (buyer_fee_amount >= 0);
CHECK (seller_fee_amount >= 0);
CHECK (sequence > 0);
CHECK (settled_at >= matched_at);

UNIQUE (trading_pair_id, sequence);
UNIQUE (engine_message_id);
UNIQUE (engine_match_id);
```

### Quy tắc

- `id` chính là `tradeId` do Matching Engine tạo deterministic từ `engine_match_id`.
- `engine_message_id` là `messageId` của `TradeCreated` đã được settlement.
- `engine_match_id` là khóa nghiệp vụ ổn định do Engine tạo theo công thức `tradingPairId + ":" + commandSequence + ":" + matchIndex`.
- `tradeId = UUIDv5(HAU_CEX_TRADE_NAMESPACE, engine_match_id)`.
- Go và TypeScript phải dùng cùng `HAU_CEX_TRADE_NAMESPACE` và cùng thuật toán UUIDv5 chuẩn để sinh ra cùng `tradeId`.
- Một `TradeCreated` tương ứng đúng một row trong `trades`.
- Payload `TradeCreated` phải chứa `engineMatchId`.
- Nếu một incoming Order khớp với nhiều resting Order, Matching Engine phải phát nhiều `TradeCreated` riêng, mỗi event có `tradeId`, `messageId` và `sequence` riêng.
- Khi replay cùng một command, Engine phải tạo lại cùng `tradeId` và `engine_match_id` cho cùng một match.
- Settlement Consumer phải chống ghi trùng bằng `engine_match_id`, không chỉ dựa vào `tradeId` hoặc `engine_message_id`.
- Nếu nhận `TradeCreated` có `engine_match_id` đã tồn tại, Settlement Consumer phải verify payload khớp Trade đã lưu, ghi `processed_events.result_reference_id = trades.id` cho message hiện tại nếu cần, ACK sau commit và không tạo thêm Trade/Ledger/Wallet mutation.
- Nếu `engine_match_id` đã tồn tại nhưng payload không khớp Trade đã lưu, Consumer phải dừng xử lý và đưa message vào retry/DLQ kèm cảnh báo.
- Chỉ insert trong Trade Settlement transaction.
- Không update hoặc delete sau settlement.
- `quote_amount` được tính trong Settlement bằng Decimal/fixed-point theo precision của Quote Asset.
- Không đặt database CHECK trực tiếp `quote_amount = price * quantity` vì phép nhân và quy tắc làm tròn có thể phụ thuộc precision của Trading Pair/Asset.
- Fee rate được snapshot tại thời điểm Trade.
- Buyer Fee tính bằng Base Asset.
- Seller Fee tính bằng Quote Asset.
- Buyer Fee được credit vào Treasury Wallet của Base Asset.
- Seller Fee được credit vào Treasury Wallet của Quote Asset.
- Fee amount được làm tròn theo precision của Asset thu phí với quy tắc `ROUND_DOWN`.
- Nếu cần cấm self-trade, phải bổ sung Business Rule riêng trước khi thêm constraint `buyer_id <> seller_id`.

### Index

```sql
CREATE INDEX idx_trades_pair_sequence
ON trades (trading_pair_id, sequence DESC);

CREATE INDEX idx_trades_buyer_settled
ON trades (buyer_id, settled_at DESC);

CREATE INDEX idx_trades_seller_settled
ON trades (seller_id, settled_at DESC);

CREATE INDEX idx_trades_buy_order
ON trades (buy_order_id);

CREATE INDEX idx_trades_sell_order
ON trades (sell_order_id);
```

Recent Trades lấy từ:

```sql
SELECT *
FROM trades
WHERE trading_pair_id = $1
ORDER BY sequence DESC
LIMIT $2;
```

---

## 6.11. `deposits`

Lưu Deposit ERC-20 từ Exchange Vault.

| Cột              | Kiểu             | Ràng buộc                |
| ---------------- | ---------------- | ------------------------ |
| `id`             | UUID             | PK                       |
| `user_id`        | UUID             | FK → users.id, NOT NULL  |
| `asset_id`       | UUID             | FK → assets.id, NOT NULL |
| `chain_id`       | BIGINT           | NOT NULL                 |
| `tx_hash`        | VARCHAR(66)      | NOT NULL                 |
| `log_index`      | INTEGER          | NOT NULL                 |
| `block_number`   | BIGINT           | NOT NULL                 |
| `block_hash`     | VARCHAR(66)      | NOT NULL                 |
| `from_address`   | VARCHAR(42)      | NOT NULL                 |
| `vault_address`  | VARCHAR(42)      | NOT NULL                 |
| `token_address`  | VARCHAR(42)      | NOT NULL                 |
| `amount`         | NUMERIC(38,18)   | NOT NULL                 |
| `raw_amount`     | NUMERIC(78,0)    | NOT NULL                 |
| `confirmations`  | INTEGER          | NOT NULL, DEFAULT 0      |
| `status`         | `deposit_status` | NOT NULL                 |
| `failure_reason` | TEXT             | NULL                     |
| `detected_at`    | TIMESTAMPTZ      | NOT NULL                 |
| `credited_at`    | TIMESTAMPTZ      | NULL                     |
| `created_at`     | TIMESTAMPTZ      | NOT NULL                 |
| `updated_at`     | TIMESTAMPTZ      | NOT NULL                 |

### Constraint

```sql
UNIQUE (chain_id, tx_hash, log_index);
CHECK (chain_id > 0);
CHECK (tx_hash ~ '^0x[0-9a-f]{64}$');
CHECK (block_hash ~ '^0x[0-9a-f]{64}$');
CHECK (from_address ~ '^0x[0-9a-f]{40}$');
CHECK (vault_address ~ '^0x[0-9a-f]{40}$');
CHECK (token_address ~ '^0x[0-9a-f]{40}$');
CHECK (log_index >= 0);
CHECK (block_number >= 0);
CHECK (amount > 0);
CHECK (raw_amount > 0);
CHECK (confirmations >= 0);
CHECK (credited_at IS NULL OR credited_at >= detected_at);
CHECK (status <> 'CREDITED' OR credited_at IS NOT NULL);
```

### Vì sao lưu cả `amount` và `raw_amount`

- `raw_amount`: giá trị nguyên từ blockchain.
- `amount`: giá trị đã chuyển theo token decimals để dùng trong PostgreSQL.

### Xử lý blockchain reorganization

Bảng `deposits` đã lưu `block_hash` để Listener phát hiện event bị thay đổi canonical chain.

Reorg trước khi Deposit được `CREDITED`:

- Cập nhật lại `block_hash`, `block_number` và `confirmations` nếu transaction xuất hiện ở block mới.
- Chuyển trạng thái về `DETECTED` hoặc `CONFIRMING` khi cần chờ confirmation lại.
- Chuyển sang `FAILED` nếu transaction không còn hợp lệ hoặc không còn thuộc canonical chain theo policy vận hành.
- Không credit Wallet khi Deposit chưa đủ điều kiện xác nhận.

Reorg sau khi Deposit đã `CREDITED`:

- Không xóa Deposit hoặc Ledger Entry cũ.
- Tạo cảnh báo nghiêm trọng để vận hành kiểm tra.
- Tạm dừng nghiệp vụ liên quan nếu cần để tránh phát sinh thêm rủi ro.
- Thực hiện adjustment hoặc reconciliation bằng nghiệp vụ riêng sau khi xác định nguyên nhân.

### Index

```sql
CREATE INDEX idx_deposits_user_created
ON deposits (user_id, created_at DESC);

CREATE INDEX idx_deposits_status_block
ON deposits (status, block_number);

CREATE INDEX idx_deposits_asset_status
ON deposits (asset_id, status);
```

## 6.12. `withdrawals`

Lưu yêu cầu rút token.

| Cột                   | Kiểu                | Ràng buộc                |
| --------------------- | ------------------- | ------------------------ |
| `id`                  | UUID                | PK                       |
| `user_id`             | UUID                | FK → users.id, NOT NULL  |
| `asset_id`            | UUID                | FK → assets.id, NOT NULL |
| `idempotency_key`     | TEXT                | NOT NULL                 |
| `chain_id`            | BIGINT              | NOT NULL                 |
| `sender_address`      | VARCHAR(42)         | NULL                     |
| `destination_address` | VARCHAR(42)         | NOT NULL                 |
| `amount`              | NUMERIC(38,18)      | NOT NULL                 |
| `fee_amount`          | NUMERIC(38,18)      | NOT NULL                 |
| `received_amount`     | NUMERIC(38,18)      | NOT NULL                 |
| `status`              | `withdrawal_status` | NOT NULL                 |
| `tx_hash`             | VARCHAR(66)         | NULL                     |
| `nonce`               | BIGINT              | NULL                     |
| `block_number`        | BIGINT              | NULL                     |
| `confirmations`       | INTEGER             | NOT NULL, DEFAULT 0      |
| `approved_by`         | UUID                | FK → users.id, NULL      |
| `approved_at`         | TIMESTAMPTZ         | NULL                     |
| `rejected_by`         | UUID                | FK → users.id, NULL      |
| `rejected_at`         | TIMESTAMPTZ         | NULL                     |
| `rejection_reason`    | TEXT                | NULL                     |
| `failure_reason`      | TEXT                | NULL                     |
| `broadcasted_at`      | TIMESTAMPTZ         | NULL                     |
| `completed_at`        | TIMESTAMPTZ         | NULL                     |
| `created_at`          | TIMESTAMPTZ         | NOT NULL                 |
| `updated_at`          | TIMESTAMPTZ         | NOT NULL                 |

### Constraint

```sql
UNIQUE (user_id, idempotency_key);
CHECK (chain_id > 0);
CHECK (sender_address IS NULL OR sender_address ~ '^0x[0-9a-f]{40}$');
CHECK (destination_address ~ '^0x[0-9a-f]{40}$');
CHECK (tx_hash IS NULL OR tx_hash ~ '^0x[0-9a-f]{64}$');
CHECK (amount > 0);
CHECK (fee_amount >= 0);
CHECK (received_amount > 0);
CHECK (received_amount = amount - fee_amount);
CHECK (confirmations >= 0);
CHECK (nonce IS NULL OR nonce >= 0);
CHECK (block_number IS NULL OR block_number >= 0);
CHECK (nonce IS NULL OR sender_address IS NOT NULL);
CHECK (broadcasted_at IS NULL OR sender_address IS NOT NULL);
CHECK (completed_at IS NULL OR broadcasted_at IS NOT NULL);
CHECK (completed_at IS NULL OR completed_at >= broadcasted_at);
```

Unique tx hash khi khác NULL:

```sql
CREATE UNIQUE INDEX uq_withdrawals_chain_tx
ON withdrawals (chain_id, tx_hash)
WHERE tx_hash IS NOT NULL;
```

Unique nonce cho transaction đã gửi:

```sql
CREATE UNIQUE INDEX uq_withdrawals_chain_nonce
ON withdrawals (chain_id, sender_address, nonce)
WHERE nonce IS NOT NULL
  AND sender_address IS NOT NULL;
```

Nonce của EVM là duy nhất theo sender address trên từng chain, không phải duy nhất toàn chain.

### Chuẩn hóa blockchain address/hash

MVP chỉ hỗ trợ EVM, vì vậy các trường blockchain phải được chuẩn hóa trước khi lưu:

- Address lưu lowercase dạng `0x` + 40 ký tự hex.
- Transaction hash và block hash lưu lowercase dạng `0x` + 64 ký tự hex.
- Không lưu checksum address dạng mixed-case trong database nghiệp vụ; nếu frontend cần hiển thị checksum address thì format ở tầng đọc.
- Unique constraint phải chạy trên giá trị đã chuẩn hóa, đặc biệt là `contract_address`, `tx_hash`, `sender_address` và `nonce`.

### Index

```sql
CREATE INDEX idx_withdrawals_user_created
ON withdrawals (user_id, created_at DESC);

CREATE INDEX idx_withdrawals_status_created
ON withdrawals (status, created_at);

CREATE INDEX idx_withdrawals_asset_status
ON withdrawals (asset_id, status);
```

## 6.13. `candlesticks`

Lưu Candlestick cho cả hai nguồn `HAU` và `BINANCE`.

| Cột                   | Kiểu              | Ràng buộc                       |
| --------------------- | ----------------- | ------------------------------- |
| `id`                  | UUID              | PK                              |
| `trading_pair_id`     | UUID              | FK → trading_pairs.id, NOT NULL |
| `source`              | `chart_source`    | NOT NULL                        |
| `interval`            | `candle_interval` | NOT NULL                        |
| `open_time`           | TIMESTAMPTZ       | NOT NULL                        |
| `close_time`          | TIMESTAMPTZ       | NOT NULL                        |
| `open`                | NUMERIC(38,18)    | NOT NULL                        |
| `high`                | NUMERIC(38,18)    | NOT NULL                        |
| `low`                 | NUMERIC(38,18)    | NOT NULL                        |
| `close`               | NUMERIC(38,18)    | NOT NULL                        |
| `volume`              | NUMERIC(38,18)    | NOT NULL                        |
| `quote_volume`        | NUMERIC(38,18)    | NULL                            |
| `trade_count`         | BIGINT            | NOT NULL, DEFAULT 0             |
| `last_trade_sequence` | BIGINT            | NULL                            |
| `external_open_time`  | BIGINT            | NULL                            |
| `is_final`            | BOOLEAN           | NOT NULL, DEFAULT false         |
| `created_at`          | TIMESTAMPTZ       | NOT NULL                        |
| `updated_at`          | TIMESTAMPTZ       | NOT NULL                        |

### Constraint

```sql
UNIQUE (trading_pair_id, source, interval, open_time);

CHECK (open > 0);
CHECK (high > 0);
CHECK (low > 0);
CHECK (close > 0);
CHECK (volume >= 0);
CHECK (high >= open);
CHECK (high >= close);
CHECK (high >= low);
CHECK (low <= open);
CHECK (low <= close);
CHECK (close_time > open_time);
CHECK (quote_volume IS NULL OR quote_volume >= 0);
CHECK (trade_count >= 0);
CHECK (last_trade_sequence IS NULL OR last_trade_sequence > 0);
```

### Quy tắc nguồn HAU

- Chỉ cập nhật từ Trade đã settlement.
- `last_trade_sequence` dùng chống xử lý sai thứ tự.
- Không dùng `TradeCreated` chưa settlement.

### Quy tắc nguồn BINANCE

- Chỉ là cache/reference.
- Không được dùng cho matching hoặc settlement.
- Dữ liệu có thể bị xóa và tải lại.
- `external_open_time` lưu timestamp gốc từ Binance nếu cần.

### Index

```sql
CREATE INDEX idx_candles_query
ON candlesticks (
    trading_pair_id,
    source,
    interval,
    open_time DESC
);
```

---

## 6.14. `market_tickers`

Lưu projection Ticker theo nguồn.

| Cột                        | Kiểu           | Ràng buộc                       |
| -------------------------- | -------------- | ------------------------------- |
| `id`                       | UUID           | PK                              |
| `trading_pair_id`          | UUID           | FK → trading_pairs.id, NOT NULL |
| `source`                   | `chart_source` | NOT NULL                        |
| `last_price`               | NUMERIC(38,18) | NULL                            |
| `high_24h`                 | NUMERIC(38,18) | NULL                            |
| `low_24h`                  | NUMERIC(38,18) | NULL                            |
| `open_24h`                 | NUMERIC(38,18) | NULL                            |
| `price_change_24h`         | NUMERIC(38,18) | NULL                            |
| `price_change_percent_24h` | NUMERIC(18,8)  | NULL                            |
| `base_volume_24h`          | NUMERIC(38,18) | NOT NULL, DEFAULT 0             |
| `quote_volume_24h`         | NUMERIC(38,18) | NOT NULL, DEFAULT 0             |
| `best_bid`                 | NUMERIC(38,18) | NULL                            |
| `best_ask`                 | NUMERIC(38,18) | NULL                            |
| `last_trade_sequence`      | BIGINT         | NULL                            |
| `source_updated_at`        | TIMESTAMPTZ    | NULL                            |
| `updated_at`               | TIMESTAMPTZ    | NOT NULL                        |

### Constraint

```sql
UNIQUE (trading_pair_id, source);
CHECK (base_volume_24h >= 0);
CHECK (quote_volume_24h >= 0);
CHECK (last_price IS NULL OR last_price > 0);
CHECK (high_24h IS NULL OR high_24h > 0);
CHECK (low_24h IS NULL OR low_24h > 0);
CHECK (open_24h IS NULL OR open_24h > 0);
CHECK (best_bid IS NULL OR best_bid > 0);
CHECK (best_ask IS NULL OR best_ask > 0);
CHECK (last_trade_sequence IS NULL OR last_trade_sequence > 0);
```

### Quy tắc

- `HAU`: được xây từ Trade đã settlement và Order Book Hau CEX.
- `BINANCE`: chỉ là Reference Market Data.
- Frontend phải đọc đúng `source`.

Bảng này là projection có thể tái tạo.

---

## 6.15. `outbox_events`

Lưu message cần phát sau khi transaction commit.

| Cột                | Kiểu            | Ràng buộc                   |
| ------------------ | --------------- | --------------------------- |
| `message_id`       | UUID            | PK, UUIDv7                  |
| `message_type`     | VARCHAR(150)    | NOT NULL                    |
| `occurred_at`      | TIMESTAMPTZ     | NOT NULL                    |
| `correlation_id`   | UUID            | NOT NULL                    |
| `version`          | INTEGER         | NOT NULL, DEFAULT 1         |
| `payload`          | JSONB           | NOT NULL                    |
| `aggregate_type`   | VARCHAR(100)    | NOT NULL                    |
| `aggregate_id`     | UUID            | NOT NULL                    |
| `partition_key`    | VARCHAR(150)    | NULL                        |
| `command_sequence` | BIGINT          | NULL                        |
| `status`           | `outbox_status` | NOT NULL, DEFAULT `PENDING` |
| `attempts`         | INTEGER         | NOT NULL, DEFAULT 0         |
| `available_at`     | TIMESTAMPTZ     | NOT NULL                    |
| `published_at`     | TIMESTAMPTZ     | NULL                        |
| `last_error`       | TEXT            | NULL                        |
| `created_at`       | TIMESTAMPTZ     | NOT NULL                    |

### Constraint

```sql
CHECK (version >= 1);
CHECK (attempts >= 0);
CHECK (available_at >= created_at);
CHECK (published_at IS NULL OR published_at >= created_at);
CHECK (command_sequence IS NULL OR command_sequence > 0);
CHECK (
    (partition_key IS NULL AND command_sequence IS NULL)
    OR (partition_key IS NOT NULL AND command_sequence IS NOT NULL)
);
CHECK (
    (status = 'PUBLISHED' AND published_at IS NOT NULL)
    OR (status <> 'PUBLISHED' AND published_at IS NULL)
);
```

### Index

```sql
CREATE INDEX idx_outbox_pending
ON outbox_events (available_at, created_at)
WHERE status = 'PENDING'
  AND partition_key IS NULL;

CREATE INDEX idx_outbox_aggregate
ON outbox_events (aggregate_type, aggregate_id);

CREATE INDEX idx_outbox_partition_order
ON outbox_events (partition_key, command_sequence, occurred_at)
WHERE status <> 'PUBLISHED'
  AND partition_key IS NOT NULL
  AND command_sequence IS NOT NULL;

CREATE UNIQUE INDEX uq_outbox_partition_command_sequence
ON outbox_events (partition_key, command_sequence)
WHERE partition_key IS NOT NULL
  AND command_sequence IS NOT NULL;
```

### Worker query chung

```sql
SELECT *
FROM outbox_events
WHERE status = 'PENDING'
  AND available_at <= NOW()
  AND partition_key IS NULL
ORDER BY created_at
FOR UPDATE SKIP LOCKED
LIMIT 100;
```

Query trên dùng cho message không cần thứ tự theo partition.

Với Engine command, Worker phải xử lý tuần tự theo `partition_key`:

```sql
SELECT *
FROM outbox_events
WHERE partition_key = $1
  AND command_sequence IS NOT NULL
  AND status <> 'PUBLISHED'
ORDER BY command_sequence
FOR UPDATE
LIMIT 1;
```

Trước khi chạy query theo partition, Worker phải giữ per-partition lock, ví dụ advisory lock theo `trading_pair_id`, để không có hai Worker cùng publish command của một Trading Pair.

Worker chỉ publish row lấy được nếu:

```text
status = PENDING
available_at <= now()
```

Nếu row cũ nhất của partition đang chờ retry (`available_at > now`) hoặc đã `FAILED`, Worker không được bỏ qua để publish command phía sau.

### FAILED policy cho Engine command

`FAILED` không được hiểu là bỏ command khỏi hàng đợi Engine.

- Message thường, không có `partition_key`, có thể chuyển `FAILED`/DLQ sau khi vượt retry theo chính sách chung.
- Engine command có `partition_key` là hàng đợi có thứ tự; khi command cũ nhất chuyển `FAILED`, toàn bộ command phía sau cùng Trading Pair bị chặn.
- Khi một Engine command chuyển `FAILED`, hệ thống phải cảnh báo vận hành và chuyển Trading Pair liên quan sang `SUSPENDED` hoặc trạng thái vận hành tương đương để không nhận Order mới.
- Khôi phục bằng thao tác có Audit Log: sửa nguyên nhân lỗi rồi đưa command về `PENDING`, hoặc tạo quy trình bù trừ rõ ràng. Không xóa command và không publish command phía sau để "đi vòng".
- Row `FAILED` của Engine command vẫn thuộc command log và không được xóa bởi retention job.

### Quy tắc

- `message_id` chính là `messageId` theo Business Rule.
- `message_type` chính là `messageType`, ví dụ `PlaceOrder`, `OrderUpdated`, `TradeSettled`.
- `occurred_at` là thời điểm message được tạo về mặt nghiệp vụ; `created_at` là thời điểm row được insert.
- Dữ liệu nghiệp vụ và Outbox Event được insert trong cùng transaction.
- Chỉ chuyển sang `PUBLISHED` sau khi gửi Redis Streams thành công.
- Có thể retry.
- Sau khi vượt giới hạn retry, chuyển `FAILED` và gửi cảnh báo.
- Consumer không hỗ trợ `version` phải từ chối hoặc chuyển message sang DLQ rõ ràng.
- Với Engine command, `partition_key = trading_pair_id`.
- Với Engine command, `command_sequence` là sequence bắt buộc và payload phải chứa `commandSequence`.
- Với `PlaceOrder`, payload phải chứa cả `orderSequence` và `commandSequence`.
- Với `CancelOrder`, payload phải chứa `commandSequence` và `orderId`, không dùng `orders.sequence` làm thứ tự command.
- Outbox Worker không được publish command có cùng `partition_key` theo cách bỏ qua một command `PENDING` cũ hơn. Có thể dùng per-partition worker, advisory lock hoặc stream partition theo Trading Pair.
- Matching Engine xử lý command theo `commandSequence`; riêng `PlaceOrder` dùng `orderSequence` làm thứ tự Price-Time Priority, không tự sinh lại Order Sequence.

### Engine replay source và retention

Redis Streams chỉ là kênh vận chuyển, không phải nguồn replay bền vững.

Trong MVP, các row `outbox_events` có `partition_key IS NOT NULL` và `command_sequence IS NOT NULL` đồng thời đóng vai trò Engine Command Log.

Khi Engine recovery:

1. Tải `engine_snapshots` mới nhất của Trading Pair.
2. Khôi phục Order Book và các counter từ `last_command_sequence`, `last_order_sequence`, `last_trade_sequence`.
3. Đọc Engine command từ `outbox_events` theo `partition_key = trading_pair_id`.
4. Replay các command có `command_sequence > last_command_sequence`.
5. Kiểm tra command sequence liên tục, không được thiếu số.
6. Chỉ chuyển Engine sang `READY` sau khi replay xong.

Recovery đọc command đã commit trong PostgreSQL, không phụ thuộc trạng thái đã publish lên Redis. Vì vậy một command `PENDING` vẫn có thể được replay trong recovery; nếu Outbox Worker gửi lại command đó sau này, Matching Engine phải xử lý idempotent theo `commandId`/`messageId`.

Nếu gặp command `FAILED` hoặc thiếu `command_sequence`, recovery phải dừng và giữ Trading Pair ở trạng thái không sẵn sàng cho đến khi vận hành xử lý.

Retention:

- Không được xóa Engine command có `command_sequence > latest_snapshot.last_command_sequence`.
- Command đã được snapshot bao phủ chỉ được xóa hoặc archive sau khi snapshot được xác minh và qua thời gian giữ tối thiểu cấu hình.
- Nếu cần dọn `outbox_events`, phải archive Engine command sang kho bền vững có cùng khóa `(partition_key, command_sequence)` trước khi xóa.
- Redis stream trimming không ảnh hưởng khả năng recovery vì PostgreSQL/Archive mới là replay source.

---

## 6.16. `processed_events`

Chống xử lý trùng ở từng Consumer.

| Cột                   | Kiểu         | Ràng buộc |
| --------------------- | ------------ | --------- |
| `consumer_name`       | VARCHAR(150) | PK phần 1 |
| `message_id`          | UUID         | PK phần 2 |
| `message_type`        | VARCHAR(150) | NOT NULL  |
| `version`             | INTEGER      | NOT NULL  |
| `payload_hash`        | VARCHAR(64)  | NULL      |
| `result_reference_id` | UUID         | NULL      |
| `processed_at`        | TIMESTAMPTZ  | NOT NULL  |

### Primary Key

```sql
PRIMARY KEY (consumer_name, message_id);
```

### Constraint

```sql
CHECK (version >= 1);
CHECK (
    payload_hash IS NULL
    OR payload_hash ~ '^[0-9a-f]{64}$'
);
```

Không dùng `message_id` làm unique toàn bảng vì cùng một Event có thể được xử lý bởi nhiều Consumer khác nhau.

Ví dụ:

```text
trade-settlement-consumer + messageId
market-data-consumer + messageId
websocket-consumer + messageId
```

### Quy tắc

- Processed Event phải được ghi trong cùng transaction với nghiệp vụ Consumer thực hiện.
- Chỉ ACK message sau khi nghiệp vụ commit thành công hoặc xác định message đã được xử lý trước đó.
- Khi xử lý lỗi, message phải được retry; nếu vượt giới hạn retry thì chuyển DLQ theo chính sách consumer.

---

## 6.17. `engine_snapshots`

Lưu snapshot phục vụ Go Matching Engine recovery.

| Cột                     | Kiểu         | Ràng buộc                           |
| ----------------------- | ------------ | ----------------------------------- |
| `id`                    | UUID         | PK                                  |
| `trading_pair_id`       | UUID         | FK → trading_pairs.id, NOT NULL     |
| `last_command_sequence` | BIGINT       | NOT NULL                            |
| `last_order_sequence`   | BIGINT       | NOT NULL                            |
| `last_trade_sequence`   | BIGINT       | NOT NULL                            |
| `snapshot_version`      | INTEGER      | NOT NULL                            |
| `snapshot_payload`      | JSONB        | NULL                                |
| `storage_url`           | TEXT         | NULL                                |
| `checksum`              | VARCHAR(128) | NOT NULL                            |
| `order_count`           | INTEGER      | NOT NULL                            |
| `owner_service`         | VARCHAR(50)  | NOT NULL, DEFAULT `MATCHING_ENGINE` |
| `owner_instance_id`     | VARCHAR(150) | NULL                                |
| `created_at`            | TIMESTAMPTZ  | NOT NULL                            |

### Constraint

```sql
UNIQUE (trading_pair_id, last_command_sequence);
CHECK (last_command_sequence >= 0);
CHECK (last_order_sequence >= 0);
CHECK (last_trade_sequence >= 0);
CHECK (snapshot_version >= 1);
CHECK (order_count >= 0);
CHECK (owner_service = 'MATCHING_ENGINE');
CHECK (
    snapshot_payload IS NOT NULL
    OR storage_url IS NOT NULL
);
```

### MVP

Lưu `snapshot_payload` dạng JSONB.

### Ownership

- Matching Engine là owner của Order Book Snapshot.
- Backend và Admin không được tự tạo hoặc sửa nội dung snapshot.
- PostgreSQL chỉ là nơi lưu bền vững snapshot/metadata phục vụ recovery.
- Snapshot phải được tạo tại ranh giới sau khi Engine xử lý xong một `command_sequence`.
- `last_command_sequence` là command cuối cùng đã được snapshot.
- `last_order_sequence` là Order Sequence lớn nhất Matching Engine đã xử lý tại thời điểm snapshot, không phải Order Sequence lớn nhất còn xuất hiện trong Order Book.
- `last_trade_sequence` là Trade Sequence cuối cùng Matching Engine đã tạo tại thời điểm snapshot.
- Khi recovery, Engine tải snapshot mới nhất theo `last_command_sequence`, khôi phục bộ đếm Order/Trade từ `last_order_sequence` và `last_trade_sequence`, sau đó replay command có `command_sequence` lớn hơn.

### Snapshot Consumer Flow

Matching Engine sở hữu nội dung snapshot, nhưng Snapshot Consumer có thể là tiến trình ghi snapshot vào PostgreSQL.

Luồng chuẩn:

1. Backend tạo Outbox `CreateSnapshot` với `commandSequence`.
2. Engine xử lý `CreateSnapshot` tại ranh giới command và phát `SnapshotCreated`.
3. Snapshot Consumer kiểm tra `(consumer_name, message_id)` trong `processed_events`.
4. Consumer verify `trading_pair_id`, `last_command_sequence`, `last_order_sequence`, `last_trade_sequence`, `checksum`, `order_count` và schema version.
5. Trong cùng transaction, Consumer insert `engine_snapshots` và ghi `processed_events`.
6. Consumer chỉ ACK sau khi commit.

Snapshot Consumer không được mutate Order, Wallet, Ledger hoặc Trade. Nếu snapshot không hợp lệ, message phải retry/DLQ theo chính sách consumer, không tự viết snapshot thay thế.

### Khi snapshot lớn

- Lưu file nén vào object storage.
- Database chỉ lưu `storage_url`, checksum và metadata.

### Index

```sql
CREATE INDEX idx_engine_snapshot_latest
ON engine_snapshots (trading_pair_id, last_command_sequence DESC);
```

---

## 6.18. `audit_logs`

Lưu hành động quan trọng của Admin.

| Cột              | Kiểu         | Ràng buộc               |
| ---------------- | ------------ | ----------------------- |
| `id`             | UUID         | PK                      |
| `admin_id`       | UUID         | FK → users.id, NOT NULL |
| `action`         | VARCHAR(150) | NOT NULL                |
| `target_type`    | VARCHAR(100) | NOT NULL                |
| `target_id`      | UUID         | NULL                    |
| `reason`         | TEXT         | NULL                    |
| `before_data`    | JSONB        | NULL                    |
| `after_data`     | JSONB        | NULL                    |
| `ip_address`     | INET         | NULL                    |
| `user_agent`     | TEXT         | NULL                    |
| `correlation_id` | UUID         | NULL                    |
| `created_at`     | TIMESTAMPTZ  | NOT NULL                |

### Index

```sql
CREATE INDEX idx_audit_admin_created
ON audit_logs (admin_id, created_at DESC);

CREATE INDEX idx_audit_target_created
ON audit_logs (target_type, target_id, created_at DESC);
```

### Chính sách

- Không update.
- Không delete qua API.
- Không lưu password, token hoặc private key.

---

# 7. Foreign Key và chính sách xóa

## 7.1. Mặc định

Sử dụng:

```text
ON DELETE RESTRICT
```

cho dữ liệu tài chính.

Không sử dụng cascade delete cho:

- Wallet.
- Ledger Entry.
- Order.
- Trade.
- Deposit.
- Withdrawal.

## 7.2. Session và token

Có thể sử dụng:

```text
ON DELETE CASCADE
```

cho:

- Sessions.
- Password Reset Tokens.

Tuy nhiên trong thực tế User không bị xóa vật lý, nên cascade ít khi được kích hoạt.

---

# 8. Transaction quan trọng

## 8.1. Tạo Order

Trong một transaction:

1. Validate User và Trading Pair.
2. Lock Wallet.
3. Kiểm tra Available Balance.
4. Lock row `order_sequences` của Trading Pair.
5. Cấp Order Sequence.
6. Lock row `engine_command_sequences` của Trading Pair.
7. Cấp Command Sequence.
8. Chuyển Available sang Locked.
9. Tạo Ledger Entries.
10. Tạo Order `PENDING` với Order Sequence đã cấp.
11. Tạo Outbox `PlaceOrder` chứa `order_id`, `trading_pair_id`, `orderSequence` và `commandSequence`.
12. Commit.

Nếu một bước thất bại, rollback toàn bộ.

Không tạo Outbox `PlaceOrder` trước khi Order đã có Order Sequence và Command Sequence.

---

## 8.2. Yêu cầu hủy Order

Trong một transaction khi User yêu cầu hủy:

1. Validate User sở hữu Order.
2. Lock Order.
3. Kiểm tra Order đang ở `OPEN` hoặc `PARTIALLY_FILLED`.
4. Lock row `engine_command_sequences` của Trading Pair.
5. Cấp Command Sequence.
6. Chuyển Order sang `CANCEL_PENDING`.
7. Ghi `cancel_requested_at`.
8. Tạo Outbox `CancelOrder` chứa `order_id`, `trading_pair_id` và `commandSequence`.
9. Commit.

Không mở khóa số dư ở bước này vì Engine chưa xác nhận đã loại Order khỏi Order Book.

---

## 8.3. Engine xác nhận hủy Order

Trong một transaction sau `OrderCancelled`:

1. Kiểm tra Processed Event.
2. Lock Order.
3. Lock Wallet.
4. Mở khóa `remaining_locked_amount`.
5. Đặt `remaining_locked_amount = 0`.
6. Chuyển Order sang `CANCELLED`.
7. Tạo Ledger Entries.
8. Ghi Processed Event.
9. Tạo Outbox Event.
10. Commit.

---

## 8.4. Order bị từ chối

Trong một transaction:

1. Kiểm tra Processed Event.
2. Lock Order.
3. Lock Wallet.
4. Chuyển Order sang `REJECTED`.
5. Mở khóa toàn bộ `remaining_locked_amount`.
6. Đặt `remaining_locked_amount = 0`.
7. Tạo Ledger Entries.
8. Ghi Processed Event.
9. Tạo Outbox Event.
10. Commit.

---

## 8.5. Trade Settlement

Trong một transaction:

1. Kiểm tra `(consumer_name, message_id)`.
2. Nếu `engine_match_id` đã tồn tại, verify payload khớp Trade đã lưu, ghi `processed_events.result_reference_id = trades.id` cho message hiện tại, commit, rồi ACK sau commit mà không cập nhật lại Wallet/Ledger/Order.
3. Lock Buy Order và Sell Order theo thứ tự ID.
4. Lock Wallet theo thứ tự `asset_id`, sau đó `user_id`, bao gồm Wallet buyer, seller và Treasury.
5. Insert Trade.
6. Cập nhật Filled và Remaining Quantity.
7. Cập nhật `remaining_locked_amount` theo công thức đã chốt:
   - BUY tính `new_remaining_locked = ROUND_DOWN(limit_price × new_remaining_quantity, quote_asset.decimals)`, `locked_delta = old_remaining_locked - new_remaining_locked`, `spent_quote = ROUND_DOWN(execution_price × executed_quantity, quote_asset.decimals)`, `price_refund = locked_delta - spent_quote`.
   - SELL giảm `executed_quantity`.
   - Nếu Order kết thúc thì đặt `remaining_locked_amount = 0`.
8. Cập nhật trạng thái Order.
   - Nếu trạng thái hiện tại là `CANCEL_PENDING` và `remaining_quantity > 0`, giữ nguyên `CANCEL_PENDING`.
   - Nếu trạng thái hiện tại là `CANCEL_PENDING` và `remaining_quantity = 0`, chuyển sang `FILLED`.
   - Không chuyển `CANCEL_PENDING` về `PARTIALLY_FILLED` khi settlement partial fill đến trước `OrderCancelled`.
9. Cập nhật Wallet buyer, seller và Treasury.
10. Thu phí vào Treasury Wallet:

- Buyer Fee credit vào Treasury Wallet của Base Asset.
- Seller Fee credit vào Treasury Wallet của Quote Asset.

11. Tạo Ledger Entries cho mọi biến động, bao gồm Ledger Entry `TRADING_FEE` âm phía User và dương phía Treasury.
12. Ghi Processed Event.
13. Tạo Outbox `TradeSettled`, `OrderUpdated`, `BalanceUpdated`.
14. Commit.

Không được phát Market Data trước bước commit.

---

## 8.6. Credit Deposit

Trong một transaction:

1. Lock Deposit.
2. Kiểm tra chưa `CREDITED`.
3. Lock Wallet.
4. Tăng Available Balance.
5. Tạo Ledger Entry.
6. Chuyển Deposit sang `CREDITED`.
7. Tạo Outbox Event.
8. Commit.

---

## 8.7. Tạo Withdrawal

Trong một transaction:

1. Kiểm tra Idempotency Key.
2. Kiểm tra Asset đang cho phép Withdrawal.
3. Kiểm tra địa chỉ nhận hợp lệ.
4. Kiểm tra `amount >= minimum_withdrawal`.
5. Kiểm tra `received_amount = amount - fee_amount` và `received_amount > 0`.
6. Lock Wallet.
7. Kiểm tra Available Balance đủ `amount`.
8. Chuyển Available sang Locked với số tiền `amount`.
9. Tạo Ledger Entries.
10. Tạo Withdrawal `PENDING`.
11. Commit.

MVP trừ phí trực tiếp từ số lượng rút:

```text
received_amount = amount - fee_amount
locked_amount = amount
```

---

## 8.8. Từ chối Withdrawal

Trong một transaction trước khi broadcast:

1. Lock Withdrawal.
2. Kiểm tra Withdrawal chưa có `tx_hash`.
3. Kiểm tra trạng thái cho phép từ chối, ví dụ `PENDING`, `REVIEWING` hoặc `APPROVED`.
4. Lock Wallet.
5. Giảm Locked Balance `amount`.
6. Tăng Available Balance `amount`.
7. Tạo Ledger Entry `WITHDRAWAL_REFUND`.
8. Chuyển Withdrawal sang `REJECTED`.
9. Ghi `rejected_by`, `rejected_at`, `rejection_reason`.
10. Tạo Outbox Event.
11. Commit.

---

## 8.9. Phê duyệt và broadcast Withdrawal

Khi Admin phê duyệt:

1. Lock Withdrawal.
2. Kiểm tra trạng thái `PENDING` hoặc `REVIEWING`.
3. Chuyển Withdrawal sang `APPROVED`.
4. Ghi `approved_by` và `approved_at`.
5. Tạo Outbox `WithdrawalApproved`.
6. Commit.

Khi Blockchain Worker xử lý, không được giữ database transaction trong lúc gọi blockchain RPC.

Transaction 1 - reserve Withdrawal để gửi:

1. Lock Withdrawal `APPROVED`.
2. Kiểm tra `tx_hash IS NULL`.
3. Chọn `sender_address` và nonce theo cơ chế an toàn của worker.
4. Lưu `sender_address`, `nonce`.
5. Chuyển Withdrawal sang `PROCESSING`.
6. Commit.

Sau khi Transaction 1 đã commit:

1. Worker gọi blockchain RPC để ký/gửi transaction.
2. Không giữ row lock hoặc database transaction trong thời gian chờ RPC.

Transaction 2 - ghi kết quả broadcast:

1. Lock Withdrawal.
2. Kiểm tra trạng thái `PROCESSING`.
3. Kiểm tra `tx_hash IS NULL`.
4. Kiểm tra `sender_address` và `nonce` khớp với transaction đã gửi.
5. Lưu `tx_hash`, `broadcasted_at`.
6. Chuyển Withdrawal sang `BROADCASTED`.
7. Commit.

Nếu RPC thất bại trước khi transaction được broadcast, Worker có thể chuyển Withdrawal về trạng thái retry phù hợp hoặc giữ `PROCESSING` với `failure_reason` để retry có kiểm soát.

Nếu Worker restart sau khi gửi transaction nhưng trước khi lưu `tx_hash`, hệ thống phải kiểm tra nonce, sender address hoặc transaction đã phát trước khi gửi lại.

---

## 8.10. Hoàn thành Withdrawal

Trong một transaction:

1. Lock Withdrawal.
2. Kiểm tra trạng thái `BROADCASTED`.
3. Kiểm tra Confirmation.
4. Lock Wallet.
5. Giảm Locked Balance.
6. Tạo Ledger Entry.
7. Chuyển Withdrawal sang `COMPLETED`.
8. Tạo Outbox Event.
9. Commit.

---

# 9. Thứ tự khóa dữ liệu

Để hạn chế deadlock, tất cả service dùng cùng thứ tự.

## 9.1. Settlement

```text
1. Order theo ID tăng dần
2. Wallet buyer, seller và Treasury theo Asset ID tăng dần
3. Wallet cùng Asset theo User ID tăng dần
4. Các bảng khác
```

## 9.2. Withdrawal

```text
1. Withdrawal
2. Wallet
3. Ledger
```

## 9.3. Deposit

```text
1. Deposit
2. Wallet
3. Ledger
```

---

# 10. Constraint không thể chỉ kiểm tra bằng database

Một số quy tắc cần xử lý trong application service:

- Price phải là bội số Tick Size.
- Quantity phải là bội số Step Size.
- Notional phải đạt Minimum Notional.
- BUY phải khóa Quote Asset.
- SELL phải khóa Base Asset.
- Trạng thái Order chỉ chuyển theo state machine hợp lệ.
- Withdrawal chỉ broadcast khi `APPROVED`.
- Binance data không được dùng cho settlement.
- Hau Candlestick chỉ dùng Trade đã settlement.
- Asset decimals không được đổi sau khi có dữ liệu.
- Open Order khi market suspended được xử lý theo chính sách.

Database vẫn dùng CHECK và UNIQUE cho các invariant có thể bảo vệ ở tầng dữ liệu.

---

# 11. Reconciliation

## 11.1. Wallet và Ledger

Kiểm tra theo từng Wallet:

```text
Tổng biến động AVAILABLE Ledger = available_balance
Tổng biến động LOCKED Ledger = locked_balance
```

Giả định Wallet bắt đầu bằng 0.

Nếu có dữ liệu khởi tạo, phải tạo Ledger Entry `ADMIN_ADJUSTMENT` hoặc `DEPOSIT`.

## 11.2. Order và Locked Balance

Với mỗi Open Order:

```text
remaining_locked_amount >= 0
```

Tổng `remaining_locked_amount` của các Order và Withdrawal đang giữ tài sản phải giải thích được Locked Balance của Wallet.

## 11.3. Trade và Order

```text
Tổng Trade Quantity của Order = filled_quantity
original_quantity = filled_quantity + remaining_quantity
```

Khi Order chuyển sang `CANCELLED`, `remaining_quantity` vẫn giữ phần chưa khớp tại thời điểm hủy. Chỉ `remaining_locked_amount` phải về `0` và `status` chuyển sang `CANCELLED`.

## 11.4. Hau Market Data

```text
Recent Trades = trades đã settlement
Last Price = Trade sequence lớn nhất
Hau Candle Volume = tổng quantity của Trade trong interval
```

---

# 12. Partitioning và lưu trữ dài hạn

MVP chưa cần partition.

Khi dữ liệu lớn, có thể partition theo thời gian cho:

```text
ledger_entries
trades
login_histories
audit_logs
candlesticks
```

Ví dụ partition theo tháng bằng `created_at` hoặc `settled_at`.

Không nên áp dụng partition trước khi có nhu cầu thực tế.

---

# 13. Prisma Mapping

Các điểm cần lưu ý khi dùng Prisma:

- PostgreSQL `NUMERIC` map sang `Prisma.Decimal`.
- Không chuyển `Prisma.Decimal` sang JavaScript `number`.
- `BIGINT` map sang JavaScript `bigint`.
- Business ID mặc định là UUIDv7. Với Prisma, ưu tiên generate ID ở application service trước khi `create`.
- Ngoại lệ `trades.id` / `tradeId` phải dùng UUIDv5 deterministic từ `engineMatchId`, không dùng `uuidv7()` hoặc `@default(uuid())`.
- Không dùng `@default(uuid())` nếu hàm này sinh UUIDv4.
- Nếu database hỗ trợ `uuidv7()`, có thể dùng migration SQL thủ công để đặt default tương ứng.
- API trả Decimal và BigInt dưới dạng string.
- Row-level lock cần sử dụng raw SQL trong interactive transaction.
- Partial index và một số CHECK constraint cần tạo bằng migration SQL thủ công.
- `CITEXT` dùng `@db.Citext`.
- `INET` có thể map thành String nếu Prisma chưa hỗ trợ trực tiếp theo cấu hình hiện tại.
- Các bảng Ledger và Trade không cung cấp API update/delete.

---

# 14. Thứ tự migration đề xuất

```text
001_extensions_and_uuidv7_support
002_enums
003_users
004_sessions_and_auth_tokens
005_assets
006_trading_pairs
007_wallets
008_order_sequences
009_engine_command_sequences
010_orders
011_trades
012_ledger_entries
013_deposits
014_withdrawals
015_market_data
016_outbox_and_processed_events
017_engine_snapshots
018_audit_logs
019_indexes_and_constraints
020_seed_admin_treasury_assets_pairs
```

---

# 15. Future Scope

Các bảng sau chưa thuộc phạm vi MVP:

- `user_preferences`: lưu cấu hình giao diện, ngôn ngữ, thông báo và các tuỳ chọn cá nhân hoá của người dùng.
- `balance_adjustments`: lưu các điều chỉnh số dư thủ công hoặc nghiệp vụ đối soát có kiểm soát, kèm audit trail đầy đủ.

Khi triển khai các bảng này, cần bổ sung thiết kế chi tiết về cột, ràng buộc, index và luồng ghi nhận audit.
