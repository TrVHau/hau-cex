# Hau CEX — Database Design

## 1. Mục Đích

Database MVP lưu dữ liệu bền vững cho:

- User và session.
- Asset và Trading Pair.
- Wallet.
- Ledger.
- Order.
- Trade đã settlement.
- Outbox message.
- Processed event.

PostgreSQL là nguồn dữ liệu tài chính chính.

---

## 2. Quy Ước

### 2.1. ID

- Business entity dùng UUIDv7.
- `messageId` dùng UUIDv7.
- `correlationId` dùng UUIDv7.
- `tradeId` dùng UUIDv7.
- `engineMatchId` là business key chống settlement trùng.

```text
engineMatchId = tradingPairId + ":" + commandSequence + ":" + matchIndex
```

### 2.2. Decimal

Dữ liệu tài chính dùng:

```text
NUMERIC(38, 18)
```

Không chuyển Decimal sang JavaScript `number`.

### 2.3. Time

Tất cả timestamp dùng:

```text
TIMESTAMPTZ
```

API trả ISO 8601 UTC.

---

## 3. PostgreSQL Extensions

```sql
CREATE EXTENSION IF NOT EXISTS citext;
```

`citext` dùng cho email.

---

## 4. Enum

```text
user_role:
USER
ADMIN
SYSTEM

user_status:
ACTIVE
LOCKED

asset_status:
ACTIVE
INACTIVE

trading_pair_status:
RECOVERING
READY
SUSPENDED

order_side:
BUY
SELL

order_status:
PENDING
OPEN
PARTIALLY_FILLED
FILLED
CANCEL_PENDING
CANCELLED
REJECTED

ledger_balance_type:
AVAILABLE
LOCKED

ledger_entry_type:
INITIAL_BALANCE
DEPOSIT
ORDER_LOCK
ORDER_UNLOCK
TRADE_SETTLEMENT
TRADING_FEE

outbox_status:
PENDING
PUBLISHED
FAILED
```

---

## 5. Tables

Core MVP tables:

```text
users
sessions
assets
trading_pairs
wallets
ledger_entries
order_sequences
engine_command_sequences
orders
trades
outbox_events
processed_events
```

`deposits` là Optional Migration, chỉ thêm khi triển khai Deposit token test.

---

## 6. Users

```text
users
```

| Column        | Type         | Note             |
| ------------- | ------------ | ---------------- |
| id            | UUID         | PK               |
| email         | CITEXT       | UNIQUE, NOT NULL |
| password_hash | TEXT         | NOT NULL         |
| full_name     | VARCHAR(150) | NULL             |
| role          | user_role    | NOT NULL         |
| status        | user_status  | NOT NULL         |
| locked_at     | TIMESTAMPTZ  | NULL             |
| locked_reason | TEXT         | NULL             |
| last_login_at | TIMESTAMPTZ  | NULL             |
| created_at    | TIMESTAMPTZ  | NOT NULL         |
| updated_at    | TIMESTAMPTZ  | NOT NULL         |

Treasury Account dùng role `SYSTEM`.

Rule:

- `SYSTEM` không đăng nhập.
- `SYSTEM` không tạo session.
- Treasury Wallet chỉ được Settlement Service cập nhật.

---

## 7. Sessions

```text
sessions
```

| Column             | Type        | Note        |
| ------------------ | ----------- | ----------- |
| id                 | UUID        | PK          |
| user_id            | UUID        | FK users.id |
| refresh_token_hash | TEXT        | NOT NULL    |
| expires_at         | TIMESTAMPTZ | NOT NULL    |
| revoked_at         | TIMESTAMPTZ | NULL        |
| created_at         | TIMESTAMPTZ | NOT NULL    |

---

## 8. Assets

```text
assets
```

| Column           | Type         | Note     |
| ---------------- | ------------ | -------- |
| id               | UUID         | PK       |
| symbol           | VARCHAR(20)  | UNIQUE   |
| name             | VARCHAR(100) | NOT NULL |
| decimals         | INTEGER      | NOT NULL |
| contract_address | TEXT         | NULL     |
| status           | asset_status | NOT NULL |
| deposit_enabled  | BOOLEAN      | NOT NULL |
| trading_enabled  | BOOLEAN      | NOT NULL |
| created_at       | TIMESTAMPTZ  | NOT NULL |
| updated_at       | TIMESTAMPTZ  | NOT NULL |

---

## 9. Trading Pairs

```text
trading_pairs
```

| Column             | Type                | Note         |
| ------------------ | ------------------- | ------------ |
| id                 | UUID                | PK           |
| symbol             | VARCHAR(30)         | UNIQUE       |
| base_asset_id      | UUID                | FK assets.id |
| quote_asset_id     | UUID                | FK assets.id |
| price_precision    | INTEGER             | NOT NULL     |
| quantity_precision | INTEGER             | NOT NULL     |
| tick_size          | NUMERIC(38,18)      | NOT NULL     |
| step_size          | NUMERIC(38,18)      | NOT NULL     |
| min_quantity       | NUMERIC(38,18)      | NOT NULL     |
| min_notional       | NUMERIC(38,18)      | NOT NULL     |
| maker_fee_rate     | NUMERIC(38,18)      | NOT NULL     |
| taker_fee_rate     | NUMERIC(38,18)      | NOT NULL     |
| status             | trading_pair_status | NOT NULL     |
| created_at         | TIMESTAMPTZ         | NOT NULL     |
| updated_at         | TIMESTAMPTZ         | NOT NULL     |

Constraint:

```text
base_asset_id != quote_asset_id
UNIQUE(base_asset_id, quote_asset_id)
```

---

## 10. Wallets

```text
wallets
```

| Column            | Type           | Note         |
| ----------------- | -------------- | ------------ |
| id                | UUID           | PK           |
| user_id           | UUID           | FK users.id  |
| asset_id          | UUID           | FK assets.id |
| available_balance | NUMERIC(38,18) | NOT NULL     |
| locked_balance    | NUMERIC(38,18) | NOT NULL     |
| created_at        | TIMESTAMPTZ    | NOT NULL     |
| updated_at        | TIMESTAMPTZ    | NOT NULL     |

Constraints:

```text
UNIQUE(user_id, asset_id)
available_balance >= 0
locked_balance >= 0
```

Wallet update phải dùng row-level lock:

```sql
SELECT *
FROM wallets
WHERE id = $1
FOR UPDATE;
```

---

## 11. Ledger Entries

```text
ledger_entries
```

Ledger là append-only.

| Column         | Type                | Note          |
| -------------- | ------------------- | ------------- |
| id             | UUID                | PK            |
| wallet_id      | UUID                | FK wallets.id |
| user_id        | UUID                | FK users.id   |
| asset_id       | UUID                | FK assets.id  |
| entry_type     | ledger_entry_type   | NOT NULL      |
| balance_type   | ledger_balance_type | NOT NULL      |
| amount         | NUMERIC(38,18)      | NOT NULL      |
| reference_type | VARCHAR(50)         | NOT NULL      |
| reference_id   | UUID                | NOT NULL      |
| operation_id   | UUID                | NOT NULL      |
| created_at     | TIMESTAMPTZ         | NOT NULL      |

Ledger `amount` là signed delta:

```text
Credit balance -> amount > 0
Debit balance  -> amount < 0
```

Mỗi thay đổi trên `available_balance` hoặc `locked_balance` phải có một Ledger Entry tương ứng cùng `operation_id`.

Ví dụ `ORDER_LOCK`:

```text
AVAILABLE: -100
LOCKED:    +100
```

Ví dụ `ORDER_UNLOCK`:

```text
LOCKED:    -100
AVAILABLE: +100
```

Indexes:

```sql
CREATE INDEX idx_ledger_wallet_created
ON ledger_entries (wallet_id, created_at DESC);

CREATE INDEX idx_ledger_reference
ON ledger_entries (reference_type, reference_id);

CREATE INDEX idx_ledger_operation
ON ledger_entries (operation_id);
```

---

## 12. Sequences

### 12.1. Order Sequences

```text
order_sequences
```

| Column          | Type        | Note     |
| --------------- | ----------- | -------- |
| trading_pair_id | UUID        | PK       |
| last_value      | BIGINT      | NOT NULL |
| updated_at      | TIMESTAMPTZ | NOT NULL |

### 12.2. Engine Command Sequences

```text
engine_command_sequences
```

| Column          | Type        | Note     |
| --------------- | ----------- | -------- |
| trading_pair_id | UUID        | PK       |
| last_value      | BIGINT      | NOT NULL |
| updated_at      | TIMESTAMPTZ | NOT NULL |

Backend cấp command sequence trong transaction tạo Outbox command.

---

## 13. Orders

```text
orders
```

| Column                   | Type           | Note                |
| ------------------------ | -------------- | ------------------- |
| id                       | UUID           | PK                  |
| user_id                  | UUID           | FK users.id         |
| trading_pair_id          | UUID           | FK trading_pairs.id |
| side                     | order_side     | NOT NULL            |
| status                   | order_status   | NOT NULL            |
| price                    | NUMERIC(38,18) | NOT NULL            |
| quantity                 | NUMERIC(38,18) | NOT NULL            |
| filled_quantity          | NUMERIC(38,18) | NOT NULL            |
| remaining_quantity       | NUMERIC(38,18) | NOT NULL            |
| locked_asset_id          | UUID           | FK assets.id        |
| locked_amount            | NUMERIC(38,18) | NOT NULL            |
| remaining_locked_amount  | NUMERIC(38,18) | NOT NULL            |
| order_sequence           | BIGINT         | NOT NULL            |
| idempotency_key          | TEXT           | NOT NULL            |
| idempotency_payload_hash | TEXT           | NOT NULL            |
| created_at               | TIMESTAMPTZ    | NOT NULL            |
| updated_at               | TIMESTAMPTZ    | NOT NULL            |

Constraints:

```text
UNIQUE(user_id, idempotency_key)
UNIQUE(trading_pair_id, order_sequence)
quantity > 0
price > 0
filled_quantity >= 0
remaining_quantity >= 0
filled_quantity + remaining_quantity = quantity
remaining_locked_amount >= 0
```

Remaining locked invariant:

```text
BUY:  remaining_locked_amount = price * remaining_quantity
SELL: remaining_locked_amount = remaining_quantity
```

`idempotency_payload_hash` là SHA-256 của payload tạo Order đã canonicalize:

```text
symbol|side|type|price|quantity
```

Ví dụ:

```text
SHA-256("HAU_USDT|BUY|LIMIT|1.000000000000000000|100.000000000000000000")
```

Useful indexes:

```sql
CREATE INDEX idx_orders_user_created
ON orders (user_id, created_at DESC);

CREATE INDEX idx_orders_pair_status
ON orders (trading_pair_id, status);
```

---

## 14. Trades

```text
trades
```

Trades chỉ được insert sau settlement commit.

| Column            | Type           | Note                |
| ----------------- | -------------- | ------------------- |
| id                | UUID           | PK, tradeId         |
| engine_match_id   | TEXT           | UNIQUE, NOT NULL    |
| engine_message_id | UUID           | NOT NULL            |
| trading_pair_id   | UUID           | FK trading_pairs.id |
| buy_order_id      | UUID           | FK orders.id        |
| sell_order_id     | UUID           | FK orders.id        |
| buyer_user_id     | UUID           | FK users.id         |
| seller_user_id    | UUID           | FK users.id         |
| maker_order_id    | UUID           | FK orders.id        |
| taker_order_id    | UUID           | FK orders.id        |
| taker_side        | order_side     | NOT NULL            |
| execution_price   | NUMERIC(38,18) | NOT NULL            |
| executed_quantity | NUMERIC(38,18) | NOT NULL            |
| quote_amount      | NUMERIC(38,18) | NOT NULL            |
| maker_fee_rate    | NUMERIC(38,18) | NOT NULL            |
| taker_fee_rate    | NUMERIC(38,18) | NOT NULL            |
| buyer_fee_amount  | NUMERIC(38,18) | NOT NULL            |
| seller_fee_amount | NUMERIC(38,18) | NOT NULL            |
| sequence          | BIGINT         | NOT NULL            |
| matched_at        | TIMESTAMPTZ    | NOT NULL            |
| settled_at        | TIMESTAMPTZ    | NOT NULL            |

Constraints:

```text
UNIQUE(engine_match_id)
UNIQUE(engine_message_id)
UNIQUE(trading_pair_id, sequence)
executed_quantity > 0
execution_price > 0
```

---

## 15. Optional Migration — Deposits

Bảng `deposits` chỉ tạo khi triển khai Optional Deposit token test.

Schema này dùng luồng Deposit Intent trong `11-smart-contract-design.md`.

```text
deposits
```

| Column             | Type           | Note               |
| ------------------ | -------------- | ------------------ |
| id                 | UUID           | PK                 |
| user_id            | UUID           | FK users.id        |
| asset_id           | UUID           | FK assets.id       |
| account_reference  | TEXT           | UNIQUE, NOT NULL   |
| depositor_address  | TEXT           | NOT NULL           |
| token_address      | TEXT           | NOT NULL           |
| chain_id           | BIGINT         | NOT NULL           |
| tx_hash            | TEXT           | NULL               |
| log_index          | INTEGER        | NULL               |
| block_number       | BIGINT         | NULL               |
| block_hash         | TEXT           | NULL               |
| amount_raw         | NUMERIC(78,0)  | NULL               |
| amount             | NUMERIC(38,18) | NULL               |
| status             | deposit_status | NOT NULL           |
| confirmation_count | INTEGER        | NOT NULL DEFAULT 0 |
| expires_at         | TIMESTAMPTZ    | NOT NULL           |
| detected_at        | TIMESTAMPTZ    | NULL               |
| credited_at        | TIMESTAMPTZ    | NULL               |
| failure_reason     | TEXT           | NULL               |
| created_at         | TIMESTAMPTZ    | NOT NULL           |
| updated_at         | TIMESTAMPTZ    | NOT NULL           |

Optional enum:

```text
deposit_status:
PENDING
DETECTED
CONFIRMING
CREDITED
EXPIRED
FAILED
```

Constraint:

```text
UNIQUE(account_reference)
```

Partial unique index:

```sql
CREATE UNIQUE INDEX uq_deposit_chain_event
ON deposits (chain_id, tx_hash, log_index)
WHERE tx_hash IS NOT NULL
  AND log_index IS NOT NULL;
```

Rule:

- Khi tạo Intent: `tx_hash`, `log_index`, `amount_raw`, `amount` đều `NULL`.
- Khi detect event: ghi `tx_hash`, `log_index`, `block_number`, `block_hash`, `amount_raw`, `amount`.
- Chỉ chuyển `CREDITED` sau khi đủ confirmation và transaction credit commit.

---

## 16. Outbox Events

```text
outbox_events
```

| Column           | Type          | Note               |
| ---------------- | ------------- | ------------------ |
| id               | UUID          | PK                 |
| message_id       | UUID          | UNIQUE             |
| version          | INTEGER       | NOT NULL           |
| correlation_id   | UUID          | NOT NULL           |
| stream_name      | TEXT          | NOT NULL           |
| message_type     | TEXT          | NOT NULL           |
| payload          | JSONB         | NOT NULL           |
| status           | outbox_status | NOT NULL           |
| partition_key    | TEXT          | NULL               |
| command_sequence | BIGINT        | NULL               |
| occurred_at      | TIMESTAMPTZ   | NOT NULL           |
| retry_count      | INTEGER       | NOT NULL DEFAULT 0 |
| last_error       | TEXT          | NULL               |
| next_retry_at    | TIMESTAMPTZ   | NULL               |
| created_at       | TIMESTAMPTZ   | NOT NULL           |
| published_at     | TIMESTAMPTZ   | NULL               |

Outbox Worker chỉ publish message sau khi transaction tạo outbox đã commit.

---

## 17. Processed Events

```text
processed_events
```

| Column              | Type        | Note     |
| ------------------- | ----------- | -------- |
| id                  | UUID        | PK       |
| consumer_name       | TEXT        | NOT NULL |
| message_id          | UUID        | NOT NULL |
| message_type        | TEXT        | NOT NULL |
| payload_hash        | TEXT        | NOT NULL |
| result              | TEXT        | NOT NULL |
| result_reference_id | UUID        | NULL     |
| processed_at        | TIMESTAMPTZ | NOT NULL |

Constraint:

```text
UNIQUE(consumer_name, message_id)
```

`payload_hash` là SHA-256 của payload message đã canonicalize.

Flow:

```text
messageId chưa tồn tại -> xử lý -> lưu payload_hash
messageId tồn tại + payload_hash giống -> ACK idempotent
messageId tồn tại + payload_hash khác -> dead-letter
```

---

## 18. Transaction Patterns

### 18.1. Lock Order Chuẩn

Core MVP dùng:

```text
PostgreSQL READ COMMITTED
SELECT ... FOR UPDATE
canonical lock order
```

Mọi transaction lock nhiều row phải lock theo thứ tự ổn định:

1. Lock Order theo `id` tăng dần.
2. Lock Wallet theo `id` tăng dần.
3. Treasury Wallet cũng nằm trong danh sách Wallet được sort.
4. Không lock thêm row theo thứ tự phát sinh trong code.

Ví dụ:

```ts
const orderIds = [buyOrderId, sellOrderId].sort();
const walletIds = [
  buyerBaseWalletId,
  buyerQuoteWalletId,
  sellerBaseWalletId,
  sellerQuoteWalletId,
  treasuryBaseWalletId,
  treasuryQuoteWalletId,
].sort();
```

Không cần Serializable cho toàn hệ thống trong Core MVP.

### 18.2. Place Order

Trong một transaction:

1. Lock Wallet.
2. Kiểm tra balance.
3. Chuyển available sang locked.
4. Tạo 2 Ledger Entry `ORDER_LOCK`: `AVAILABLE -amount`, `LOCKED +amount`.
5. Cấp Order Sequence.
6. Tạo Order `PENDING` cùng `idempotency_payload_hash`.
7. Cấp Command Sequence.
8. Tạo Outbox `PlaceOrder`.
9. Commit.

### 18.3. Trade Settlement

Trong một transaction:

1. Kiểm tra `processed_events`.
2. Kiểm tra `engine_match_id`.
3. Lock Buy Order và Sell Order theo `id` tăng dần.
4. Verify Engine payload với Order trong PostgreSQL.
5. Lock Wallet buyer, seller và Treasury theo `id` tăng dần.
6. Insert Trade.
7. Cập nhật Order.
8. Cập nhật Wallet.
9. Tạo Ledger Entries.
10. Tạo Outbox domain events.
11. Insert `processed_events`.
12. Commit.

Nếu Order đang `CANCEL_PENDING` và vẫn còn remaining sau partial fill, giữ nguyên `CANCEL_PENDING`.

Backend lấy `user_id`, `trading_pair_id` và `side` từ Order trong PostgreSQL.
Các trường `buyerUserId`/`sellerUserId` từ Engine chỉ dùng để verify.

### 18.4. Cancel Settlement

Trong một transaction:

1. Kiểm tra `processed_events`.
2. Lock Order.
3. Kiểm tra Order đang `CANCEL_PENDING`.
4. Lock Wallet.
5. Giảm locked balance.
6. Tạo 2 Ledger Entry `ORDER_UNLOCK`: `LOCKED -amount`, `AVAILABLE +amount`.
7. Chuyển Order sang `CANCELLED`.
8. Tạo Outbox `OrderUpdated`, `BalanceUpdated`.
9. Insert `processed_events`.
10. Commit.

### 18.5. Market Open/Suspend

Open Market:

1. PostgreSQL vẫn giữ Trading Pair `SUSPENDED`.
2. Tạo Outbox `OpenMarket`.
3. Khi nhận `MarketOpened`, chuyển Trading Pair sang `READY`.

Suspend Market:

1. Trong một transaction, chuyển Trading Pair sang `SUSPENDED`.
2. Tạo Outbox `SuspendMarket`.
3. Khi nhận `MarketSuspended`, ghi nhận Engine đã suspend.

Nhờ vậy `PlaceOrder` bị chặn ngay khi Admin yêu cầu suspend.

### 18.6. Deposit Credit

Transaction Deposit Credit áp dụng khi triển khai Deposit.

Trong một transaction:

1. Kiểm tra `processed_events`.
2. Lock Deposit bằng `SELECT ... FOR UPDATE`.
3. Kiểm tra Deposit chưa `CREDITED`.
4. Kiểm tra `chain_id + tx_hash + log_index` không trùng.
5. Lock Wallet.
6. Tăng available balance.
7. Tạo Ledger `DEPOSIT`.
8. Chuyển Deposit sang `CREDITED`.
9. Tạo Outbox `DepositUpdated`, `BalanceUpdated`.
10. Insert `processed_events`.
11. Commit.

### 18.7. Seed Balance

Seed script không được update Wallet trực tiếp.

Số dư demo ban đầu phải được tạo cùng Ledger Entry `INITIAL_BALANCE`.

---

## 19. Reconciliation

Kiểm tra định kỳ:

```text
Wallet.availableBalance == tổng AVAILABLE Ledger
Wallet.lockedBalance == tổng LOCKED Ledger
Trade.engine_match_id unique
Order filled + remaining == quantity
```

Locked balance phải giải thích được bằng:

- Open Order.
- Partially Filled Order.
- Cancel Pending Order.
