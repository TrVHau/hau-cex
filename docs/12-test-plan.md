# Hau CEX — Test Plan

## 1. Mục Đích

Tài liệu này định nghĩa chiến lược kiểm thử cho Hau CEX.

Mục tiêu chính:

- Bảo đảm Wallet không âm.
- Bảo đảm mọi thay đổi Wallet có Ledger tương ứng.
- Bảo đảm Matching Engine khớp đúng Price-Time Priority.
- Bảo đảm Trade Settlement atomic.
- Bảo đảm message redelivery không làm xử lý nghiệp vụ hai lần.
- Bảo đảm Cancel Order và Trade race không làm sai trạng thái.
- Bảo đảm realtime chỉ phát dữ liệu sau PostgreSQL commit.
- Bảo đảm Deposit token test chỉ credit đúng một lần.

Nguồn chuẩn:

- `03-scope.md`
- `05-business-rules.md`
- `06-system-architecture.md`
- `07-database-design.md`
- `08-api-design.md`
- `09-internal-message-contract.md`
- `10-matching-engine-design.md`
- `11-smart-contract-design.md`

Nếu test case mâu thuẫn với Business Rules thì phải sửa test case.

---

## 2. Phạm Vi Kiểm Thử

### 2.1. Core MVP

Bắt buộc kiểm thử:

```text
Authentication
Wallet
Ledger
Limit Order
Cancel Order
Matching Engine
Trade Settlement
Maker/Taker Fee
Treasury Wallet
Outbox
Redis Streams
Idempotent Consumer
Realtime
Admin cơ bản
Docker Compose
```

### 2.2. Deposit Token Test

Kiểm thử sau khi Core Trading Flow đã ổn định:

```text
MockERC20
TokenFaucet
ExchangeVault
Deposit Intent
Blockchain Listener
Confirmation Worker
Deposit Credit
Deposit Realtime
```

### 2.3. Không Thuộc Phạm Vi

Không kiểm thử:

```text
Withdrawal
Market Order
Stop Order
Multi-engine
High Availability
Full Snapshot/Replay
Native ETH Deposit
Multi-chain
Kubernetes
```

---

## 3. Nguyên Tắc Kiểm Thử

### 3.1. Ưu Tiên Tính Đúng Đắn

Thứ tự ưu tiên:

1. Không tạo hoặc mất tiền nội bộ sai.
2. Không settlement trùng.
3. Không match Order sai thứ tự.
4. Không làm Order và Wallet lệch nhau.
5. Không phát dữ liệu chưa commit.
6. Giao diện hiển thị đúng.

### 3.2. Mỗi Invariant Phải Có Test

Các invariant bắt buộc:

```text
availableBalance >= 0
lockedBalance >= 0
filledQuantity + remainingQuantity = quantity
remainingLockedAmount >= 0
Wallet mutation luôn có Ledger
Trade.engineMatchId unique
Deposit event chỉ credit một lần
```

### 3.3. Test Không Phụ Thuộc Thứ Tự

Mỗi test phải:

- Tự chuẩn bị dữ liệu.
- Không phụ thuộc test chạy trước.
- Rollback hoặc reset dữ liệu sau test.
- Dùng ID riêng.
- Không dùng timestamp cố định trừ khi test clock.

### 3.4. Decimal

Không dùng JavaScript `number` hoặc Go `float64` để assert dữ liệu tài chính.

Test phải so sánh bằng:

```text
Decimal string
BigInt
Fixed-point integer
Prisma Decimal
```

---

## 4. Test Pyramid

```text
Nhiều Unit Test
→ Integration Test
→ Ít End-to-End Test
```

Tỷ lệ tham khảo:

```text
Unit Test:        60%
Integration Test: 30%
E2E Test:          10%
```

Không cần đạt đúng tỷ lệ, nhưng logic tài chính và Matching Engine phải có Unit Test mạnh.

---

## 5. Môi Trường Kiểm Thử

### 5.1. Unit Test

Không cần chạy toàn bộ Docker Compose.

Thành phần:

```text
NestJS service test
Go package test
Hardhat contract test
```

### 5.2. Integration Test

Chạy:

```text
PostgreSQL test
Redis test
Backend API/Worker
Matching Engine
```

Blockchain chỉ chạy khi test Deposit.

### 5.3. End-to-End Test

Chạy bằng Docker Compose:

```text
Frontend optional
Backend API
Backend Worker
Matching Engine
PostgreSQL
Redis
Hardhat Node nếu test Deposit
```

### 5.4. Database Test

Dùng database riêng:

```text
hau_cex_test
```

Không chạy test trên database development.

---

## 6. Test Data Cơ Bản

### 6.1. User

```text
User A
User B
Admin
Treasury System Account
```

### 6.2. Asset

```text
ETH test
USDT test
HAU token
```

### 6.3. Trading Pair

```text
ETH_USDT
HAU_USDT
```

### 6.4. Balance Mẫu

```text
User A:
- HAU Available: 1,000
- USDT Available: 10,000

User B:
- HAU Available: 1,000
- USDT Available: 10,000

Treasury:
- HAU Available: 0
- USDT Available: 0
```

Số dư seed phải có Ledger Entry:

```text
INITIAL_BALANCE
```

### 6.5. Fee Mẫu

```text
makerFeeRate = 0.001
takerFeeRate = 0.0015
```

---

## 7. Backend Unit Test

## 7.1. Authentication

| ID      | Test                    | Kết quả mong đợi                  |
| ------- | ----------------------- | --------------------------------- |
| AUTH-01 | Register email mới      | Tạo User `ACTIVE`, role `USER`    |
| AUTH-02 | Register email trùng    | Trả lỗi validation/conflict       |
| AUTH-03 | Login đúng mật khẩu     | Trả access token và refresh token |
| AUTH-04 | Login sai mật khẩu      | Không tạo session                 |
| AUTH-05 | Login User bị `LOCKED`  | Trả `AUTH_ACCOUNT_LOCKED`         |
| AUTH-06 | Refresh hợp lệ          | Cấp access token mới              |
| AUTH-07 | Refresh token đã revoke | Từ chối                           |
| AUTH-08 | Logout                  | Session chuyển revoked            |

## 7.2. Wallet Service

| ID     | Test                         | Kết quả mong đợi                  |
| ------ | ---------------------------- | --------------------------------- |
| WAL-01 | Lấy Wallet của User          | Chỉ trả Wallet của chính User     |
| WAL-02 | Tăng Available               | Balance tăng và có Ledger         |
| WAL-03 | Giảm Available hợp lệ        | Không âm                          |
| WAL-04 | Giảm Available vượt số dư    | Transaction fail                  |
| WAL-05 | Chuyển Available sang Locked | Tổng Balance không đổi            |
| WAL-06 | Chuyển Locked sang Available | Tổng Balance không đổi            |
| WAL-07 | Wallet chưa tồn tại          | Tạo hoặc trả theo rule triển khai |
| WAL-08 | Hai mutation đồng thời       | Row lock ngăn lost update         |

## 7.3. Ledger Service

| ID     | Test                            | Kết quả mong đợi                                        |
| ------ | ------------------------------- | ------------------------------------------------------- |
| LED-01 | Tạo Ledger hợp lệ               | Insert thành công                                       |
| LED-02 | Update Ledger                   | Không có API nghiệp vụ                                  |
| LED-03 | Delete Ledger                   | Không có API nghiệp vụ                                  |
| LED-04 | Nhiều Entry cùng operationId    | Query gom đúng nghiệp vụ                                |
| LED-05 | Wallet mutation không có Ledger | Test transaction phải fail hoặc code path không tồn tại |
| LED-06 | Seed Balance                    | Có `INITIAL_BALANCE` tương ứng                          |

## 7.4. Create Order Service

| ID     | Test                               | Kết quả mong đợi                       |
| ------ | ---------------------------------- | -------------------------------------- |
| ORD-01 | Limit Buy hợp lệ                   | Tạo `PENDING`, khóa Quote              |
| ORD-02 | Limit Sell hợp lệ                  | Tạo `PENDING`, khóa Base               |
| ORD-03 | Buy thiếu balance                  | Không tạo Order, không đổi Wallet      |
| ORD-04 | Sell thiếu balance                 | Không tạo Order, không đổi Wallet      |
| ORD-05 | Market không `READY`               | Từ chối trước transaction lock         |
| ORD-06 | Asset `INACTIVE`                   | Từ chối                                |
| ORD-07 | Price bằng 0                       | Validation fail                        |
| ORD-08 | Quantity bằng 0                    | Validation fail                        |
| ORD-09 | Sai tick size                      | Validation fail                        |
| ORD-10 | Sai step size                      | Validation fail                        |
| ORD-11 | Dưới min quantity                  | Validation fail                        |
| ORD-12 | Dưới min notional                  | Validation fail                        |
| ORD-13 | Cùng idempotency key, cùng payload | Trả Order cũ                           |
| ORD-14 | Cùng idempotency key, payload khác | `IDEMPOTENCY_CONFLICT`                 |
| ORD-15 | Transaction fail sau lock Wallet   | Rollback Wallet, Ledger, Order, Outbox |
| ORD-16 | Cấp orderSequence                  | Tăng đúng theo Trading Pair            |
| ORD-17 | Cấp commandSequence                | Tăng đúng theo Trading Pair            |
| ORD-18 | Outbox PlaceOrder                  | Cùng transaction với Order             |

## 7.5. Cancel Order Service

| ID     | Test                                  | Kết quả mong đợi                        |
| ------ | ------------------------------------- | --------------------------------------- |
| CAN-01 | Cancel `OPEN`                         | Chuyển `CANCEL_PENDING`, tạo Outbox     |
| CAN-02 | Cancel `PARTIALLY_FILLED`             | Chuyển `CANCEL_PENDING`                 |
| CAN-03 | Cancel Order của User khác            | `AUTH_FORBIDDEN` hoặc `ORDER_NOT_FOUND` |
| CAN-04 | Cancel `PENDING`                      | `ORDER_NOT_CANCELLABLE`                 |
| CAN-05 | Cancel `FILLED`                       | `ORDER_NOT_CANCELLABLE`                 |
| CAN-06 | Cancel `CANCELLED`                    | `ORDER_NOT_CANCELLABLE`                 |
| CAN-07 | Cancel khi Market `SUSPENDED`         | Cho phép tạo Cancel Command             |
| CAN-08 | Cancel khi Market `FAILED/RECOVERING` | Backend từ chối trước `CANCEL_PENDING`  |
| CAN-09 | Hai request cancel đồng thời          | Chỉ một command nghiệp vụ hợp lệ        |
| CAN-10 | Transaction tạo Outbox fail           | Order không bị kẹt `CANCEL_PENDING`     |

---

## 8. Matching Engine Unit Test

## 8.1. Fixed-point

| ID     | Test                 | Kết quả mong đợi         |
| ------ | -------------------- | ------------------------ |
| FIX-01 | Parse decimal hợp lệ | Đúng integer scale       |
| FIX-02 | Parse số âm          | Từ chối                  |
| FIX-03 | Quá precision        | Từ chối                  |
| FIX-04 | Scientific notation  | Từ chối                  |
| FIX-05 | Cộng/trừ             | Không mất precision      |
| FIX-06 | Nhân notional        | Kết quả đúng             |
| FIX-07 | Tick size            | Chấp nhận/từ chối đúng   |
| FIX-08 | Step size            | Chấp nhận/từ chối đúng   |
| FIX-09 | Không dùng float     | Static/code review check |

## 8.2. Order Book

| ID      | Test                    | Kết quả mong đợi             |
| ------- | ----------------------- | ---------------------------- |
| BOOK-01 | Add Bid                 | Có đúng Price Level          |
| BOOK-02 | Add Ask                 | Có đúng Price Level          |
| BOOK-03 | Hai Order cùng giá      | FIFO đúng orderSequence      |
| BOOK-04 | Bid giá cao hơn         | Đứng trước                   |
| BOOK-05 | Ask giá thấp hơn        | Đứng trước                   |
| BOOK-06 | Remove Order            | Xóa khỏi level và active map |
| BOOK-07 | Remove Order cuối level | Xóa Price Level              |
| BOOK-08 | Aggregate quantity      | Tổng quantity đúng           |
| BOOK-09 | Cancel lookup           | O(1) qua activeOrders        |
| BOOK-10 | OrderBookChanged        | Không chứa userId/orderId    |

## 8.3. Matching

| ID     | Test                             | Kết quả mong đợi                         |
| ------ | -------------------------------- | ---------------------------------------- |
| MAT-01 | Buy không cross Ask              | Buy vào Book                             |
| MAT-02 | Sell không cross Bid             | Sell vào Book                            |
| MAT-03 | Full Fill                        | Cả hai remaining bằng 0                  |
| MAT-04 | Partial Fill Incoming            | Incoming vào Book với remaining          |
| MAT-05 | Partial Fill Resting             | Resting còn trong Book                   |
| MAT-06 | Một incoming match nhiều resting | Nhiều `TradeCreated` đúng thứ tự         |
| MAT-07 | FIFO cùng giá                    | OrderSequence nhỏ match trước            |
| MAT-08 | Best price                       | Giá tốt hơn match trước                  |
| MAT-09 | Execution Price                  | Bằng giá Resting Order                   |
| MAT-10 | Incoming full fill               | Không phát `OrderOpened`                 |
| MAT-11 | Incoming còn remaining           | Phát `OrderOpened`                       |
| MAT-12 | Book thay đổi                    | Tăng bookSequence đúng một lần cho batch |
| MAT-13 | Trade Sequence                   | Tăng một cho mỗi match                   |
| MAT-14 | engineMatchId                    | `pair:commandSequence:matchIndex`        |
| MAT-15 | matchIndex                       | Bắt đầu từ 0 cho mỗi PlaceOrder          |

## 8.4. Command Sequence

| ID     | Test                      | Kết quả mong đợi                     |
| ------ | ------------------------- | ------------------------------------ |
| SEQ-01 | Sequence đúng expected    | Xử lý                                |
| SEQ-02 | Sequence nhỏ hơn expected | Duplicate, không mutate              |
| SEQ-03 | Sequence lớn hơn expected | `EngineFailed(COMMAND_SEQUENCE_GAP)` |
| SEQ-04 | Gap                       | Không phát OrderRejected             |
| SEQ-05 | Gap                       | Không ACK command                    |
| SEQ-06 | Duplicate PlaceOrder      | Không match lần hai                  |
| SEQ-07 | Duplicate CancelOrder     | Không remove lần hai                 |

## 8.5. Market State

| ID     | Test                    | Kết quả mong đợi                  |
| ------ | ----------------------- | --------------------------------- |
| MKT-01 | READY + PlaceOrder      | Cho phép                          |
| MKT-02 | READY + CancelOrder     | Cho phép                          |
| MKT-03 | SUSPENDED + PlaceOrder  | `OrderRejected(MARKET_SUSPENDED)` |
| MKT-04 | SUSPENDED + CancelOrder | Cho phép                          |
| MKT-05 | FAILED + PlaceOrder     | Từ chối                           |
| MKT-06 | FAILED + CancelOrder    | `MARKET_NOT_READY`                |
| MKT-07 | RECOVERING + command    | Từ chối                           |

## 8.6. Publish Và ACK

| ID     | Test                     | Kết quả mong đợi                    |
| ------ | ------------------------ | ----------------------------------- |
| PUB-01 | Publish batch thành công | Sau đó mới ACK                      |
| PUB-02 | Publish lỗi              | Không ACK                           |
| PUB-03 | Publish lỗi              | Không xử lý command tiếp theo       |
| PUB-04 | Retry batch              | Giữ nguyên messageId/tradeId        |
| PUB-05 | Redelivery sau publish   | Không mutate lần hai                |
| PUB-06 | InFlightBatch            | Chứa đúng commandSequence và events |

---

## 9. Trade Settlement Unit Và Integration Test

## 9.1. Settlement Cơ Bản

| ID     | Test                     | Kết quả mong đợi              |
| ------ | ------------------------ | ----------------------------- |
| SET-01 | Full Fill                | Hai Order `FILLED`            |
| SET-02 | Partial Fill             | Filled/remaining đúng         |
| SET-03 | Một incoming nhiều match | Settlement tuần tự đúng       |
| SET-04 | Trade insert             | Có engineMatchId unique       |
| SET-05 | Trade Sequence           | Unique theo Pair              |
| SET-06 | Buyer nhận Base          | Trừ buyer fee                 |
| SET-07 | Seller nhận Quote        | Trừ seller fee                |
| SET-08 | Treasury nhận fee        | Đúng Asset                    |
| SET-09 | Ledger entries           | Đủ User và Treasury           |
| SET-10 | Domain events            | Tạo trong Outbox sau mutation |

## 9.2. Price Improvement

Ví dụ:

```text
Buy Limit: 10 USDT
Execution Price: 8 USDT
Quantity: 5 HAU
```

Expected:

```text
quoteLockedForFill = 50
actualQuoteCost = 40
quoteRefund = 10
```

| ID     | Test                    | Kết quả mong đợi           |
| ------ | ----------------------- | -------------------------- |
| PRI-01 | Buy khớp thấp hơn limit | Refund Available đúng      |
| PRI-02 | Buy khớp đúng limit     | Refund bằng 0              |
| PRI-03 | Partial fill nhiều giá  | Refund từng fill đúng      |
| PRI-04 | remainingLockedAmount   | Phù hợp remaining quantity |

## 9.3. Fee

Quy tắc test:

```text
Buy Order là Maker:
buyerFeeRate = makerFeeRate
sellerFeeRate = takerFeeRate

Sell Order là Maker:
sellerFeeRate = makerFeeRate
buyerFeeRate = takerFeeRate
```

| ID     | Test                         | Kết quả mong đợi         |
| ------ | ---------------------------- | ------------------------ |
| FEE-01 | Buy Maker                    | Buyer dùng maker rate    |
| FEE-02 | Buy Taker                    | Buyer dùng taker rate    |
| FEE-03 | Sell Maker                   | Seller dùng maker rate   |
| FEE-04 | Sell Taker                   | Seller dùng taker rate   |
| FEE-05 | Buyer fee                    | Thu bằng Base            |
| FEE-06 | Seller fee                   | Thu bằng Quote           |
| FEE-07 | Treasury Base Wallet         | Nhận buyer fee           |
| FEE-08 | Treasury Quote Wallet        | Nhận seller fee          |
| FEE-09 | Rounding                     | Theo rule thống nhất     |
| FEE-10 | Fee rate snapshot trên Trade | Lưu đúng rate đã áp dụng |

## 9.4. Atomicity

Dùng fault injection tại từng bước:

```text
Insert Trade
Update Order
Update Wallet
Insert Ledger
Insert Outbox
Insert processed_events
```

| ID     | Test                             | Kết quả mong đợi |
| ------ | -------------------------------- | ---------------- |
| ATM-01 | Fail sau Insert Trade            | Rollback toàn bộ |
| ATM-02 | Fail sau Update Order            | Rollback toàn bộ |
| ATM-03 | Fail sau Update Wallet           | Rollback toàn bộ |
| ATM-04 | Fail khi Insert Ledger           | Rollback toàn bộ |
| ATM-05 | Fail khi Insert Outbox           | Rollback toàn bộ |
| ATM-06 | Fail khi Insert processed_events | Rollback toàn bộ |

## 9.5. Idempotency

| ID     | Test                               | Kết quả mong đợi               |
| ------ | ---------------------------------- | ------------------------------ |
| IDE-01 | Cùng messageId redelivery          | Không settlement lần hai       |
| IDE-02 | Khác messageId, cùng engineMatchId | Không settlement lần hai       |
| IDE-03 | Cùng engineMatchId, payload giống  | Ghi processed event mới và ACK |
| IDE-04 | Cùng engineMatchId, payload khác   | Conflict, không mutate         |
| IDE-05 | Duplicate OrderOpened              | Không downgrade trạng thái     |
| IDE-06 | Duplicate OrderCancelled           | Không unlock lần hai           |

---

## 10. Cancel Race Test

## 10.1. Cancel Trước Match

```text
Order OPEN
→ Cancel request
→ CANCEL_PENDING
→ Engine xử lý Cancel
→ OrderCancelled
→ CANCELLED
```

Expected:

- Unlock toàn bộ remaining amount.
- Tạo một Ledger `ORDER_UNLOCK`.
- Không tạo Trade.

## 10.2. Partial Fill Trước Cancel

```text
Order OPEN
→ Cancel request
→ CANCEL_PENDING
→ TradeCreated partial fill
→ Order vẫn CANCEL_PENDING
→ OrderCancelled remaining
→ CANCELLED
```

Expected:

- `filledQuantity` tăng.
- `remainingQuantity` giảm.
- Trạng thái vẫn `CANCEL_PENDING` sau partial fill.
- Chỉ unlock `remainingLockedAmount`.

## 10.3. Full Fill Trước Cancel

```text
Order OPEN
→ Cancel request
→ CANCEL_PENDING
→ TradeCreated full fill
→ FILLED
→ CancelOrderRejected(ORDER_NOT_FOUND)
→ Backend đọc DB Order `FILLED`
→ ACK idempotent
```

Expected:

- Không unlock lần hai.
- Order cuối cùng `FILLED`.
- Không chuyển về `CANCELLED`.

## 10.4. Duplicate Cancel Event

Expected:

- Không unlock lần hai.
- Không tạo Ledger trùng.
- Consumer ACK idempotent.

---

## 11. Outbox Và Redis Streams Integration Test

| ID     | Test                             | Kết quả mong đợi              |
| ------ | -------------------------------- | ----------------------------- |
| MSG-01 | Transaction commit               | Outbox Worker publish message |
| MSG-02 | Transaction rollback             | Không có Outbox               |
| MSG-03 | Redis tạm thời lỗi               | retry_count tăng              |
| MSG-04 | Retry thành công                 | status `PUBLISHED`            |
| MSG-05 | Quá retry                        | Vào dead-letter               |
| MSG-06 | Publish lại cùng Outbox          | Cùng messageId                |
| MSG-07 | Consumer commit thành công       | Sau đó ACK                    |
| MSG-08 | Consumer DB timeout              | Không ACK                     |
| MSG-09 | Redelivery                       | processed_events chống trùng  |
| MSG-10 | Payload invalid                  | Dead-letter                   |
| MSG-11 | Version không hỗ trợ             | Dead-letter                   |
| MSG-12 | Một active engine-event consumer | Event cùng Pair xử lý tuần tự |

---

## 12. Realtime Test

| ID    | Test                         | Kết quả mong đợi                                   |
| ----- | ---------------------------- | -------------------------------------------------- |
| RT-01 | TradeCreated chưa settlement | Không phát `trade.created`                         |
| RT-02 | Trade Settlement commit      | Phát `trade.created`                               |
| RT-03 | Settlement rollback          | Không phát event                                   |
| RT-04 | Order update                 | Gửi đúng User room                                 |
| RT-05 | Balance update               | Gửi đúng User room                                 |
| RT-06 | User khác                    | Không nhận private event                           |
| RT-07 | OrderBookChanged             | Phát public `orderbook.update`                     |
| RT-08 | Reconnect                    | Client gọi REST để lấy state hiện tại              |
| RT-09 | Duplicate domain event       | Client xử lý theo event ID/sequence nếu triển khai |

---

## 13. API Integration Test

### 13.1. Public Market

- Guest xem Asset.
- Guest xem Market.
- Guest xem Order Book.
- Guest xem Recent Trades.
- Order Book không chứa User ID hoặc Order ID.
- Recent Trades chỉ chứa Trade đã settlement.

### 13.2. User Authorization

- User chỉ xem Wallet của mình.
- User chỉ xem Ledger của mình.
- User chỉ xem Order của mình.
- User chỉ xem Trade của mình.
- User không gọi Admin API.

### 13.3. Admin

- Admin xem danh sách User.
- Admin lock/unlock User.
- Locked User không login hoặc đặt Order.
- Admin open/suspend Market.
- Admin không cancel Order thay User.

### 13.4. Pagination

- Cursor không tạo bản ghi trùng.
- Cursor giữ thứ tự ổn định.
- Limit vượt max bị giới hạn hoặc từ chối.

---

## 14. Smart Contract Test

## 14.1. MockERC20

| ID        | Test                 | Kết quả mong đợi |
| --------- | -------------------- | ---------------- |
| SC-TOK-01 | Minter mint          | Thành công       |
| SC-TOK-02 | User mint            | Revert           |
| SC-TOK-03 | Decimals             | Đúng cấu hình    |
| SC-TOK-04 | Transfer             | Theo ERC-20      |
| SC-TOK-05 | Approve/transferFrom | Đúng allowance   |

## 14.2. TokenFaucet

| ID        | Test                  | Kết quả mong đợi      |
| --------- | --------------------- | --------------------- |
| SC-FAU-01 | Claim supported token | Mint đúng amount      |
| SC-FAU-02 | Unsupported token     | Revert                |
| SC-FAU-03 | Cooldown              | Revert trước thời hạn |
| SC-FAU-04 | Hết cooldown          | Claim lại được        |
| SC-FAU-05 | Pause                 | Claim bị chặn         |
| SC-FAU-06 | Non-admin config      | Revert                |
| SC-FAU-07 | Nhiều token           | Cấu hình độc lập      |

## 14.3. ExchangeVault

| ID        | Test                           | Kết quả mong đợi                      |
| --------- | ------------------------------ | ------------------------------------- |
| SC-VLT-01 | Deposit sau approve            | Vault nhận token                      |
| SC-VLT-02 | Event                          | Đúng reference/depositor/token/amount |
| SC-VLT-03 | Zero amount                    | Revert                                |
| SC-VLT-04 | Zero reference                 | Revert                                |
| SC-VLT-05 | Unsupported token              | Revert                                |
| SC-VLT-06 | Thiếu allowance                | Revert                                |
| SC-VLT-07 | Reuse reference cùng depositor | Revert                                |
| SC-VLT-08 | Pause                          | Deposit bị chặn                       |
| SC-VLT-09 | Non-admin support token        | Revert                                |

---

## 15. Deposit Integration Test

Theo `11-smart-contract-design.md`.

## 15.1. Deposit Intent

| ID     | Test               | Kết quả mong đợi                 |
| ------ | ------------------ | -------------------------------- |
| DEP-01 | Tạo Intent hợp lệ  | `PENDING`, reference unique      |
| DEP-02 | Asset không hỗ trợ | Từ chối                          |
| DEP-03 | Address sai format | Từ chối                          |
| DEP-04 | Hai Intent         | Reference khác nhau              |
| DEP-05 | Intent hết hạn     | Chuyển `EXPIRED` nếu chưa detect |

## 15.2. Listener

| ID     | Test                    | Kết quả mong đợi               |
| ------ | ----------------------- | ------------------------------ |
| DEP-06 | Event từ đúng Vault     | Được xử lý                     |
| DEP-07 | Event từ contract khác  | Bỏ qua                         |
| DEP-08 | Sai chainId             | Bỏ qua                         |
| DEP-09 | Sai depositor           | Không gắn Intent, không credit |
| DEP-10 | Sai token               | Không gắn Intent, không credit |
| DEP-11 | Event trùng             | Không xử lý lần hai            |
| DEP-12 | Receipt fail            | Không credit                   |
| DEP-13 | Event mine trước expiry | Vẫn xử lý sau confirmation     |

## 15.3. Confirmation Và Credit

| ID     | Test                      | Kết quả mong đợi      |
| ------ | ------------------------- | --------------------- |
| DEP-14 | Chưa đủ confirmation      | `CONFIRMING`          |
| DEP-15 | Đủ confirmation           | Credit Wallet         |
| DEP-16 | Amount raw                | Convert đúng decimals |
| DEP-17 | Credit transaction fail   | Rollback              |
| DEP-18 | Duplicate DepositDetected | Không credit lần hai  |
| DEP-19 | Deposit đã CREDITED       | Không mutate lại      |
| DEP-20 | Ledger                    | Có Entry `DEPOSIT`    |
| DEP-21 | Realtime                  | Phát sau commit       |
| DEP-22 | User khác                 | Không nhận event      |

---

## 16. Concurrency Test

### 16.1. Concurrent Create Order

Chuẩn bị:

```text
User có 100 USDT
Hai request Buy đồng thời, mỗi request cần 80 USDT
```

Expected:

- Chỉ một Order thành công.
- Wallet không âm.
- Không lock tổng 160 USDT.

### 16.2. Concurrent Settlement

Hai Trade cùng chạm một Wallet:

Expected:

- Row lock serialize update.
- Không lost update.
- Ledger tổng khớp Wallet.

### 16.3. Cancel Và Settlement Đồng Thời

Expected:

- Không unlock amount đã được settlement.
- Trạng thái cuối hợp lệ.
- Không Wallet âm.

### 16.4. Duplicate Consumer

Hai Worker cùng nhận redelivery:

Expected:

- Unique `processed_events` hoặc lock ngăn xử lý trùng.
- Chỉ một transaction nghiệp vụ commit.

### 16.5. Deposit Credit Đồng Thời

Hai Worker credit cùng Deposit:

Expected:

- Lock Deposit.
- Chỉ một Worker chuyển `CREDITED`.
- Wallet tăng một lần.

---

## 17. Reconciliation Test

Sau mỗi E2E financial flow, kiểm tra:

```text
Wallet.availableBalance
== tổng Ledger AVAILABLE

Wallet.lockedBalance
== tổng Ledger LOCKED
```

Ngoài ra:

```text
filledQuantity + remainingQuantity == quantity
remainingLockedAmount >= 0
engineMatchId unique
```

Test reconciliation phải chạy cho:

- Create Order.
- Reject Order.
- Full Fill.
- Partial Fill.
- Cancel.
- Cancel Race.
- Deposit.

---

## 18. End-to-End Core Scenario

## E2E-01 — Order Không Khớp

```text
User A đặt Sell HAU giá 10
→ Order PENDING
→ Engine OrderOpened
→ Order OPEN
→ Order Book có Ask 10
```

Kiểm tra:

- HAU Available giảm.
- HAU Locked tăng.
- Ledger `ORDER_LOCK`.
- Không có Trade.

## E2E-02 — Full Fill

```text
User A đặt Sell 100 HAU giá 10
User B đặt Buy 100 HAU giá 10
```

Kiểm tra:

- Hai Order `FILLED`.
- Trade được tạo.
- Buyer nhận HAU trừ fee.
- Seller nhận USDT trừ fee.
- Treasury nhận hai loại fee.
- Order Book xóa level.
- Realtime đúng.

## E2E-03 — Partial Fill

```text
Sell 100 HAU
Buy 40 HAU
```

Kiểm tra:

- Sell `PARTIALLY_FILLED`.
- Sell remaining 60.
- Buy `FILLED`.
- Sell remaining locked đúng.

## E2E-04 — Một Incoming Match Nhiều Resting

```text
Sell A: 30 HAU giá 9
Sell B: 40 HAU giá 10
Buy C: 60 HAU limit 10
```

Kiểm tra:

- Match A trước vì giá tốt hơn.
- Match B sau.
- Buy full fill.
- Sell B còn 10.
- Hai engineMatchId khác nhau.

## E2E-05 — FIFO

```text
Sell A giá 10 orderSequence 1
Sell B giá 10 orderSequence 2
Buy C lấy 50
```

Kiểm tra:

- A được match trước B.

## E2E-06 — Cancel

```text
Order OPEN
→ Cancel
→ CANCEL_PENDING
→ OrderCancelled
→ CANCELLED
```

Kiểm tra:

- Unlock đúng remaining amount.
- Một Ledger `ORDER_UNLOCK`.

## E2E-07 — Duplicate TradeCreated

Gửi cùng event hai lần.

Kiểm tra:

- Một Trade.
- Wallet cập nhật một lần.
- Ledger không trùng.

## E2E-08 — Market Suspend

```text
Admin Suspend Market
```

Kiểm tra:

- PlaceOrder bị từ chối.
- CancelOrder vẫn hoạt động.
- Open Order không tự hủy.

---

## 19. End-to-End Deposit Scenario

```text
User claim Mock USDT
→ Backend tạo Deposit Intent
→ User approve ExchangeVault
→ User deposit với accountReference
→ Listener phát hiện event
→ DepositDetected vào Redis Stream
→ Confirmation Worker chờ đủ block
→ Deposit Credit transaction
→ Wallet Available tăng
→ Ledger DEPOSIT
→ Deposit CREDITED
→ deposit.updated và balance.updated
```

Kiểm tra thêm:

- Event đọc lại không credit lần hai.
- Sai depositor không credit.
- Sai token không credit.
- Private event chỉ đến đúng User.

---

## 20. Performance Smoke Test

Không đặt mục tiêu production.

Mức smoke test tham khảo:

```text
1,000 Order liên tiếp trên một Pair
100 Order cùng Price Level
Một incoming match 100 resting Order
20 Create Order request đồng thời cho một User
```

Kiểm tra:

- Không panic.
- Không deadlock.
- FIFO vẫn đúng.
- Wallet không âm.
- Engine không mất command.
- Thời gian phản hồi hợp lý cho môi trường local.

Không cần tuyên bố TPS production.

---

## 21. Security Test Cơ Bản

- Password không lưu plaintext.
- Refresh token lưu hash.
- User bị LOCKED không đặt Order.
- User không đọc Wallet User khác.
- User không cancel Order User khác.
- User không gọi Admin API.
- WebSocket private room yêu cầu authentication.
- Smart contract admin function có access control.
- User không mint trực tiếp.
- User không cấu hình Faucet/Vault.
- Account Reference không chứa PII.

---

## 22. Test Case Template

```text
ID:
Tên:
Mục tiêu:
Loại test:
Precondition:
Input:
Steps:
Expected result:
Database assertions:
Message assertions:
Ledger assertions:
Cleanup:
```

---

## 23. Definition of Done Cho Test

Một module chỉ hoàn thành khi:

- Unit Test case chính pass.
- Integration Test với dependency thật pass.
- Không còn test financial invariant bị skip.
- Error path quan trọng đã test.
- Idempotency đã test.
- Transaction rollback đã test.
- Test chạy lại độc lập được.

Core MVP hoàn thành khi:

- Toàn bộ Core E2E pass.
- Reconciliation pass.
- Docker Compose test pass.
- Không có Wallet âm.
- Không có duplicate Trade.
- Không có Ledger lệch Wallet.

Deposit hoàn thành khi:

- Contract Test pass.
- Deposit E2E pass.
- Duplicate event không credit lần hai.
- Wallet và Ledger khớp sau Deposit.

---

## 24. Checklist

- [ ] Auth Unit Test.
- [ ] Wallet/Ledger Unit Test.
- [ ] Create/Cancel Order Unit Test.
- [ ] Matching Engine Unit Test.
- [ ] Fixed-point Unit Test.
- [ ] Settlement Integration Test.
- [ ] Fee Test.
- [ ] Price Improvement Test.
- [ ] Cancel Race Test.
- [ ] Outbox/Redis Test.
- [ ] Idempotency Test.
- [ ] Concurrency Test.
- [ ] Realtime Test.
- [ ] Core E2E.
- [ ] Reconciliation Test.
- [ ] Smart Contract Test.
- [ ] Deposit Integration Test.
- [ ] Deposit E2E.
