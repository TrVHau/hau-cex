# Hau CEX — Implementation Roadmap

## 1. Mục Đích

Tài liệu này chia quá trình triển khai Hau CEX thành các phase nhỏ, có thứ tự phụ thuộc rõ ràng.

Mục tiêu:

- Hoàn thành Core Trading Flow trước.
- Không để Frontend hoặc Blockchain làm chậm phần Backend cốt lõi.
- Mỗi phase đều có Definition of Done.
- Mỗi phase tạo ra kết quả có thể kiểm thử.
- Hạn chế thay đổi scope khi đã bắt đầu code.

Nguồn chuẩn:

- `03-scope.md`
- `05-business-rules.md`
- `06-system-architecture.md`
- `07-database-design.md`
- `08-api-design.md`
- `09-internal-message-contract.md`
- `10-matching-engine-design.md`
- `11-smart-contract-design.md`
- `12-test-plan.md`

---

## 2. Nguyên Tắc Triển Khai

### 2.1. Thứ Tự Ưu Tiên

```text
Correctness
→ Testability
→ Simplicity
→ Performance
→ UI polish
```

### 2.2. Scope Freeze

Sau khi bắt đầu Phase 2, không thêm:

```text
Market Order
Stop Order
Withdrawal
External Market Data/Chart
Multi-engine
Snapshot/Replay
Kubernetes
```

### 2.3. Core Trước Optional

Thứ tự:

```text
Core Trading Flow
→ Realtime
→ Docker/E2E
→ Deposit
→ Hau CEX Internal Candlestick/Chart
```

### 2.4. Mỗi Phase Phải Chạy Độc Lập

Không chuyển phase khi:

- Test chính chưa pass.
- Transaction còn sai.
- Schema còn thay đổi lớn.
- Module trước chưa có Definition of Done.

---

## 3. Tổng Quan Phase

```text
Phase 0  — Repository và Local Infrastructure
Phase 1  — Database Schema và Seed
Phase 2  — Authentication và Authorization
Phase 3  — Wallet và Ledger
Phase 4  — Matching Engine Standalone
Phase 5  — Order API và Outbox
Phase 6  — Engine Messaging
Phase 7  — Trade Settlement
Phase 8  — Cancel Order và Race Handling
Phase 9  — Market Data và Realtime
Phase 10 — Admin API
Phase 11 — Core End-to-End và Hardening
Phase 12 — Smart Contract và Deposit
Phase 13 — Frontend Hoàn Thiện
Phase 14 — Documentation, Demo và Release
```

---

## 4. Phase 0 — Repository Và Local Infrastructure

### Goal

Tạo bộ khung để các thành phần chạy và phát triển độc lập.

### Tasks

```text
- Chốt monorepo structure.
- Tạo pnpm workspace.
- Tạo React app.
- Tạo NestJS backend.
- Tạo hai entrypoint backend-api/backend-worker.
- Tạo Go Matching Engine.
- Tạo Hardhat project.
- Tạo Docker Compose.
- Cấu hình PostgreSQL.
- Cấu hình Redis.
- Tạo .env.example.
- Tạo Makefile hoặc scripts.
- Cấu hình lint/format/test.
```

### Cấu Trúc

```text
hau-cex/
├── apps/
│   ├── web/
│   └── backend/
├── services/
│   └── matching-engine/
├── contracts/
├── packages/
│   └── shared-types/
├── prisma/
├── docs/
├── infrastructure/
├── tests/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── README.md
```

Có thể đặt Prisma tại:

```text
apps/backend/prisma/
```

khi bắt đầu code Backend.

### Tests

- Backend health endpoint.
- Matching Engine process start.
- PostgreSQL connection.
- Redis connection.
- Docker Compose start/stop.

### Definition of Done

- `docker compose up` chạy PostgreSQL và Redis.
- Backend API trả health.
- Backend Worker start được.
- Matching Engine start được.
- Lint và test command chạy được.
- Không commit secret.

### Estimated Time

```text
3–5 ngày
```

---

## 5. Phase 1 — Database Schema Và Seed

### Goal

Chuyển `07-database-design.md` thành Prisma schema và migration.

### Tasks

Tạo các model Core:

```text
User
Session
Asset
TradingPair
Wallet
LedgerEntry
OrderSequence
EngineCommandSequence
Order
Trade
OutboxEvent
ProcessedEvent
```

Tạo:

```text
- Enum.
- Unique constraint.
- Check constraint bằng migration SQL nếu Prisma chưa biểu diễn đủ.
- Index.
- UUIDv7 helper.
- Decimal helper.
- Seed Admin.
- Seed Treasury System Account.
- Seed Asset.
- Seed Trading Pair.
- Seed User A và User B.
- Seed Wallet và INITIAL_BALANCE Ledger.
```

### Quyết Định

- Decimal lưu `NUMERIC(38,18)`.
- API không dùng JavaScript `number`.
- Timestamp dùng UTC.
- Ledger append-only ở tầng application.

### Tests

- Migration lên database rỗng.
- Seed chạy hai lần không tạo duplicate.
- Unique Wallet.
- Unique Pair.
- Balance không âm.
- Order quantity invariant.
- Seed Wallet khớp Ledger.

### Definition of Done

- Database migrate được từ đầu.
- Seed tạo đủ dữ liệu demo.
- Reconciliation seed pass.
- Schema không còn thay đổi lớn cho Core MVP.

### Estimated Time

```text
4–6 ngày
```

---

## 6. Phase 2 — Authentication Và Authorization

### Goal

User đăng ký, đăng nhập và phân quyền được.

### Tasks

```text
- Register.
- Login.
- Access token.
- Refresh token.
- Logout.
- GET /me.
- PATCH /me.
- Password hashing.
- Session persistence.
- Role guard.
- User status guard.
- Admin lock/unlock User.
```

### Không Làm

```text
Forgot Password
Email Verification
OAuth
2FA
Multi-device Session UI
```

### Tests

- Register duplicate email.
- Login sai mật khẩu.
- User LOCKED.
- Refresh revoked.
- Role guard.
- User không gọi Admin API.

### Definition of Done

- Auth API pass integration test.
- Password không lưu plaintext.
- Refresh token lưu hash.
- Locked User không truy cập mutation API.

### Estimated Time

```text
4–6 ngày
```

---

## 7. Phase 3 — Wallet Và Ledger

### Goal

Xây dựng nền tảng tài chính trước khi làm Order.

### Tasks

```text
- Wallet repository.
- Ledger repository.
- Row-level lock helper.
- Wallet query API.
- Ledger history API.
- Balance mutation service.
- Operation ID.
- Reconciliation service/test.
```

Tạo operation dùng chung:

```text
creditAvailable
debitAvailable
moveAvailableToLocked
moveLockedToAvailable
debitLocked
```

Mỗi operation phải tạo Ledger.

### Tests

- Wallet không âm.
- Available ↔ Locked.
- Concurrent debit.
- Wallet mutation rollback.
- Ledger append-only.
- Reconciliation.

### Definition of Done

- Không có public method đổi Wallet mà không ghi Ledger.
- Concurrent request không lost update.
- Reconciliation pass.
- Wallet/Ledger API chạy được.

### Estimated Time

```text
5–7 ngày
```

---

## 8. Phase 4 — Matching Engine Standalone

### Goal

Hoàn thành thuật toán matching độc lập, chưa cần Redis.

### Tasks

```text
- fixed.Decimal.
- Parse decimal.
- Tick/step validation.
- Order data structure.
- Price Level FIFO.
- Bid max-heap.
- Ask min-heap.
- Active Order Map.
- PlaceOrder.
- CancelOrder.
- Pair Engine.
- Market state.
- Command Sequence.
- Trade Sequence.
- Book Sequence.
- Event DTO.
```

### Trình Tự Thực Hiện

```text
1. Fixed-point.
2. Price Level.
3. Side Book.
4. Order Book.
5. Matching loop.
6. Cancel.
7. Sequence.
8. Pair state.
9. Event batch.
```

### Tests

Theo `12-test-plan.md`:

```text
Full Fill
Partial Fill
One-to-many Match
FIFO
Best Price
Cancel
Duplicate Command
Sequence Gap
Suspended Market
```

### Definition of Done

- Không dùng float.
- Unit Test matching pass.
- Một incoming match nhiều resting đúng.
- Duplicate command không mutate.
- Sequence gap không phát rejection.
- Engine benchmark smoke test chạy được.

### Estimated Time

```text
10–14 ngày
```

---

## 9. Phase 5 — Order API Và Outbox

### Goal

Backend tạo Order, lock balance và ghi command vào Outbox atomic.

### Tasks

```text
- Validate Market.
- Validate Asset.
- Validate tick/step/min.
- Create Limit Buy.
- Create Limit Sell.
- Idempotency-Key.
- Idempotency payload hash.
- Order Sequence allocation.
- Command Sequence allocation.
- 2 Ledger Entry `ORDER_LOCK`.
- Order PENDING.
- Outbox PlaceOrder.
- Active Orders API.
- Order History API.
- Order Detail API.
```

### Transaction

```text
Lock Wallet
→ validate balance
→ Available giảm
→ Locked tăng
→ Ledger ORDER_LOCK: AVAILABLE -, LOCKED +
→ cấp sequence
→ Order PENDING
→ Outbox PlaceOrder
→ commit
```

### Tests

- Insufficient balance.
- Concurrent create.
- Idempotency conflict.
- Same Idempotency-Key + same payload returns old Order.
- Same Idempotency-Key + different payload returns IDEMPOTENCY_CONFLICT.
- Transaction rollback.
- Correct locked asset.
- Correct sequence.

### Definition of Done

- Create Order chưa cần Engine vẫn tạo đúng PENDING + Outbox.
- Wallet và Ledger luôn khớp.
- Duplicate request không lock lần hai.
- Order query API pass.

### Estimated Time

```text
6–8 ngày
```

---

## 10. Phase 6 — Engine Messaging

### Goal

Kết nối Backend và Matching Engine qua Redis Streams.

### Tasks

Backend Worker:

```text
- Outbox poller.
- Publish Redis Stream.
- Retry metadata.
- Dead-letter.
```

Matching Engine:

```text
- Consumer group.
- Parse envelope.
- Route theo tradingPairId.
- Publish Engine Event.
- ACK sau publish.
- InFlightBatch.
```

Backend Engine Event Consumer:

```text
- Consume stream:engine:events.
- Một active consumer cho Core MVP.
- Dispatch event handler.
- ACK sau commit.
- processed_events.
- processed_events.payload_hash.
```

### Tests

- Outbox publish.
- Redis unavailable.
- Retry giữ messageId.
- Publish event trước ACK.
- Redelivery không mutate.
- Same messageId + same payloadHash ACK idempotent.
- Same messageId + different payloadHash dead-letter.
- Sequence gap.

### Definition of Done

Luồng sau chạy được:

```text
POST /orders
→ Outbox
→ Redis
→ Matching Engine
→ OrderOpened
→ Backend Order OPEN
```

Chưa cần settlement phức tạp ở bước đầu.

### Estimated Time

```text
7–10 ngày
```

---

## 11. Phase 7 — Trade Settlement

### Goal

Hoàn thành trung tâm tài chính của hệ thống.

### Tasks

```text
- TradeCreated consumer.
- Lock Buy/Sell Order theo id tăng dần.
- Lock Buyer/Seller/Treasury Wallet theo id tăng dần.
- Tính executed notional.
- Tính Buyer/Seller fee.
- Price improvement refund.
- Update filled/remaining.
- Update remainingLockedAmount.
- Insert Trade.
- Insert Ledger.
- Insert Outbox Domain Event.
- Insert processed_events.
```

### Trình Tự Nên Làm

```text
1. Full Fill không fee.
2. Partial Fill không fee.
3. Price Improvement.
4. Buyer/Seller Fee.
5. Treasury Wallet.
6. One incoming many matches.
7. Idempotency.
8. Fault injection rollback.
```

### Fee Rule

```text
Maker dùng makerFeeRate.
Taker dùng takerFeeRate.
Buyer fee thu bằng Base.
Seller fee thu bằng Quote.
```

### Tests

- Full Fill.
- Partial Fill.
- Multiple Match.
- Price Improvement.
- Maker/Taker.
- Treasury.
- Duplicate messageId.
- Duplicate engineMatchId.
- Atomic rollback.

### Definition of Done

- Trade, Order, Wallet, Ledger cập nhật trong một transaction.
- Không settlement trùng.
- Reconciliation pass sau tất cả case.
- Domain Event chỉ có sau commit.

### Estimated Time

```text
10–14 ngày
```

---

## 12. Phase 8 — Cancel Order Và Race Handling

### Goal

Hoàn thành Cancel bất đồng bộ và xử lý race với Trade.

### Tasks

```text
- Cancel API.
- OPEN/PARTIALLY_FILLED → CANCEL_PENDING.
- Outbox CancelOrder.
- Engine remove active Order.
- OrderCancelled consumer.
- 2 Ledger Entry `ORDER_UNLOCK`.
- CancelOrderRejected handler.
- Partial fill khi CANCEL_PENDING.
- Full fill thắng Cancel.
```

### Cases Bắt Buộc

```text
Cancel trước Match.
Partial Fill trước Cancel.
Full Fill trước Cancel.
Duplicate OrderCancelled.
Order not found.
Market SUSPENDED vẫn Cancel được.
```

### Tests

Theo `12-test-plan.md` Cancel Race.

### Definition of Done

- Không unlock quá amount.
- Không Wallet âm.
- Order không quay từ trạng thái kết thúc về active.
- Duplicate event không unlock lần hai.

### Estimated Time

```text
5–7 ngày
```

---

## 13. Phase 9 — Market Data Và Realtime

### Goal

Frontend nhận đúng dữ liệu public và private sau commit.

### Tasks

```text
- Order Book REST endpoint.
- Recent Trades endpoint.
- Market Detail.
- Last Price.
- Best Bid/Best Ask.
- Socket.IO Gateway.
- market.subscribe.
- User private room.
- orderbook.update.
- trade.created.
- order.updated.
- balance.updated.
```

### Rule

```text
TradeCreated != public trade
TradeSettled → public trade.created
```

### Tests

- Trade chưa commit không public.
- Private event đúng User.
- User khác không nhận.
- Order Book không chứa dữ liệu riêng tư.
- Reconnect tải lại state qua REST.

### Definition of Done

- Trading screen có thể lấy đủ dữ liệu.
- WebSocket không là source of truth.
- Event tài chính chỉ phát sau commit.

### Estimated Time

```text
5–7 ngày
```

---

## 14. Phase 10 — Admin API

### Goal

Có đủ thao tác vận hành demo.

### Tasks

```text
- List User.
- Lock User.
- Unlock User.
- List Asset.
- Activate/Deactivate Asset.
- List Market.
- Open Market.
- Suspend Market.
```

### Rule

- Admin không đặt lệnh thay User.
- Admin không cancel Order User.
- Open: DB vẫn `SUSPENDED`, Outbox `OpenMarket`, nhận `MarketOpened` rồi DB `READY`.
- Suspend: DB chuyển `SUSPENDED` và Outbox `SuspendMarket` trong cùng transaction.
- Suspend Market không tự hủy Open Order.
- Cancel vẫn cho phép khi SUSPENDED.

### Tests

- Role guard.
- Locked User behavior.
- PlaceOrder bị chặn khi suspended.
- Cancel vẫn hoạt động.

### Definition of Done

- Admin API đủ vận hành demo.
- Không cần Admin UI hoàn chỉnh.

### Estimated Time

```text
3–5 ngày
```

---

## 15. Phase 11 — Core End-to-End Và Hardening

### Goal

Đóng Core MVP trước khi làm Blockchain.

### Tasks

```text
- Docker Compose đầy đủ.
- Core E2E.
- Concurrency Test.
- Idempotency Test.
- Fault Injection.
- Reconciliation.
- Logging.
- Health endpoint.
- Dead-letter inspection.
- Reset demo script.
```

### Demo Flow

```text
User A Sell
→ User B Buy
→ Engine match
→ Settlement
→ Wallet/Ledger đúng
→ Realtime đúng
```

### Definition of Done

- Core E2E pass.
- Full/Partial/FIFO/Cancel pass.
- Duplicate event pass.
- Wallet reconciliation pass.
- `docker compose up` chạy toàn bộ Core.
- Không còn blocker severity cao.

### Estimated Time

```text
7–10 ngày
```

---

## 16. Phase 12 — Smart Contract Và Deposit

### Goal

Cho User lấy token test từ Faucet, chuyển vào Vault và được credit Wallet.

### 12.1. Contract

Tasks:

```text
- MockERC20.
- TokenFaucet.
- ExchangeVault.
- AccessControl.
- Pausable.
- ReentrancyGuard.
- SafeERC20.
- Hardhat deployment.
```

### 12.2. Backend Deposit

Tasks:

```text
- Update Deposit schema theo docs 11.
- Deposit Config API.
- Create Deposit Intent API.
- accountReference.
- Blockchain Listener.
- DepositDetected message.
- Confirmation Worker.
- Deposit Credit transaction.
- deposit.updated.
```

### 12.3. Frontend Deposit

Tasks:

```text
- Connect Wallet.
- Claim token.
- Create Intent.
- Approve Vault.
- Deposit.
- Theo dõi trạng thái.
```

### Tests

- Contract Unit Test.
- Intent mapping.
- Wrong depositor.
- Wrong token.
- Duplicate event.
- Confirmation.
- Credit atomic.
- Deposit E2E.

### Definition of Done

```text
Claim
→ Approve
→ Deposit
→ Detect
→ Confirm
→ Credit
```

chạy end-to-end và không credit trùng.

### Estimated Time

```text
10–14 ngày
```

---

## 17. Phase 13 — Frontend Hoàn Thiện

### Goal

Hoàn thiện giao diện đủ để demo.

### Pages

```text
Login/Register
Market List
Trading Page
Wallet
Orders
Trades
Admin cơ bản
Deposit nếu đã triển khai
```

### Trading Page

```text
Order Book
Recent Trades
Limit Order Form
Active Orders
Order History
Balance
```

### Optional

```text
Hau CEX Internal Candlestick/Chart
Ticker 24h
Admin UI hoàn chỉnh
```

### Rule

Frontend không tự suy luận số dư tài chính từ WebSocket.

Sau event:

```text
invalidate/refetch
hoặc cập nhật state theo payload đã commit
```

### Definition of Done

- Demo Trading Flow không cần Postman.
- Lỗi API hiển thị rõ.
- Decimal không bị mất precision.
- Realtime reconnect hoạt động cơ bản.

### Estimated Time

```text
7–12 ngày
```

---

## 18. Phase 14 — Documentation, Demo Và Release

### Goal

Chuẩn bị repository cho CV và phỏng vấn.

### Tasks

```text
- README.
- Architecture diagram.
- Sequence diagram.
- Deployment guide.
- Demo guide.
- API Swagger.
- Environment guide.
- Known limitations.
- Screenshots.
- Demo video optional.
```

### README Nên Có

```text
Project overview
Tech stack
Architecture
Core features
How to run
Demo accounts
Test command
Main trade flow
Deposit flow
Known limitations
Future work
```

### Definition of Done

- Người khác clone và chạy được.
- Demo flow có hướng dẫn.
- Docs không mâu thuẫn code.
- CV có link repository và demo.

### Estimated Time

```text
3–5 ngày
```

---

## 19. Lịch 24 Tuần Tham Khảo

| Tuần  | Nội dung |
| ----- | -------- |
| 1     | Phase 0  |
| 2     | Phase 1  |
| 3     | Phase 2  |
| 4–5   | Phase 3  |
| 6–8   | Phase 4  |
| 9–10  | Phase 5  |
| 11–12 | Phase 6  |
| 13–15 | Phase 7  |
| 16    | Phase 8  |
| 17    | Phase 9  |
| 18    | Phase 10 |
| 19–20 | Phase 11 |
| 21–22 | Phase 12 |
| 23    | Phase 13 |
| 24    | Phase 14 |

Đây là lịch tham khảo cho khoảng:

```text
20–25 giờ/tuần
```

Nếu chậm tiến độ:

1. Giữ Core Trading Flow.
2. Giảm UI.
3. Bỏ Hau CEX Internal Candlestick/Chart.
4. Giảm Admin UI.
5. Chuyển Deposit thành stretch goal cuối.

---

## 20. Critical Path

```text
Database
→ Wallet/Ledger
→ Matching Engine
→ Order/Outbox
→ Redis Messaging
→ Trade Settlement
→ Cancel
→ Realtime
→ Core E2E
```

Blockchain không nằm trên Critical Path của Core MVP.

---

## 21. Dependency Map

```text
Auth
└── Order API
    ├── Wallet/Ledger
    ├── Trading Pair
    └── Outbox
        └── Redis
            └── Matching Engine
                └── Engine Event Consumer
                    └── Trade Settlement
                        ├── Wallet/Ledger
                        ├── Trade
                        ├── Order
                        └── Realtime
```

Deposit dependency:

```text
MockERC20
→ Faucet
→ Vault
→ Deposit Intent
→ Listener
→ Confirmation
→ Wallet/Ledger
→ Realtime
```

---

## 22. Milestone

### Milestone 1 — Financial Foundation

Hoàn thành:

```text
Database
Auth
Wallet
Ledger
```

Demo:

```text
Login
→ xem Wallet
→ xem Ledger
```

### Milestone 2 — Engine Standalone

Hoàn thành:

```text
Fixed-point
Order Book
Matching
Cancel
Unit Test
```

Demo:

```text
Go test
```

### Milestone 3 — Trading End-to-End

Hoàn thành:

```text
Create Order
Outbox
Redis
Engine
Settlement
Cancel
```

Demo:

```text
Hai User khớp lệnh
```

### Milestone 4 — Realtime Core MVP

Hoàn thành:

```text
Order Book
Recent Trades
Order Update
Balance Update
Docker Compose
```

### Milestone 5 — Blockchain Deposit

Hoàn thành:

```text
Faucet
Vault
Listener
Credit
```

### Milestone 6 — Portfolio Ready

Hoàn thành:

```text
Frontend
README
Tests
Demo Guide
```

---

## 23. Definition of Core MVP Done

Core MVP hoàn thành khi:

1. Hai User đăng nhập được.
2. Wallet ban đầu có Ledger.
3. User A đặt Sell.
4. User B đặt Buy.
5. Engine match đúng Price-Time Priority.
6. Settlement atomic.
7. Fee vào Treasury.
8. Duplicate event không settlement trùng.
9. Cancel unlock đúng remaining amount.
10. Realtime chỉ phát sau commit.
11. Reconciliation pass.
12. Docker Compose chạy được.
13. Core test pass.

Không cần chờ:

```text
Deposit
Hau CEX Internal Candlestick/Chart
Admin UI hoàn chỉnh
Engine Recovery
```

---

## 24. Definition of Deposit Done

Deposit hoàn thành khi:

1. User claim Mock ERC-20.
2. Backend tạo Deposit Intent.
3. User approve Vault.
4. User deposit với accountReference.
5. Listener ánh xạ đúng User.
6. Đủ confirmation.
7. Wallet và Ledger credit atomic.
8. Event trùng không credit lần hai.
9. `deposit.updated` và `balance.updated` đúng User.
10. Deposit E2E pass.

---

## 25. Rủi Ro Và Cách Giảm

### Rủi Ro 1 — Matching Engine Mất Nhiều Thời Gian

Giảm:

- Làm standalone trước Redis.
- Unit Test từng data structure.
- Không tối ưu sớm.
- Chỉ một Engine instance.

### Rủi Ro 2 — Settlement Sai Balance

Giảm:

- Viết công thức trước.
- Test Ledger assertions.
- Fault injection.
- Reconciliation sau mỗi E2E.

### Rủi Ro 3 — Redis Redelivery Tạo Duplicate

Giảm:

- processed_events + payload_hash.
- engineMatchId.
- ACK sau commit.
- Retry giữ messageId.

### Rủi Ro 4 — Cancel Race

Giảm:

- State machine rõ.
- `CANCEL_PENDING` giữ nguyên khi partial fill.
- Full fill thắng cancel.
- Test concurrency.

### Rủi Ro 5 — Deposit Làm Trễ Core

Giảm:

- Chỉ bắt đầu sau Phase 11.
- Có thể dùng seed balance cho Core demo.
- Deposit là milestone riêng.

### Rủi Ro 6 — Frontend Làm Trễ Backend

Giảm:

- Test bằng API/CLI trước.
- Frontend làm sau khi Core API ổn.
- Không làm UI phức tạp.

---

## 26. Quy Tắc Commit Và Branch

Gợi ý:

```text
main
develop
feature/auth
feature/wallet-ledger
feature/matching-engine
feature/order-outbox
feature/settlement
feature/deposit
```

Commit nên nhỏ:

```text
feat(wallet): add row-locked balance transfer
test(engine): cover FIFO matching
fix(settlement): prevent duplicate engineMatchId
docs(deposit): define account reference flow
```

Không commit:

```text
.env
private key
database dump chứa secret
node_modules
build artifact không cần thiết
```

---

## 27. CI Gợi Ý

Mỗi Pull Request chạy:

```text
Frontend lint/test
Backend lint/unit test
Go test
Hardhat test
Prisma validation
```

Integration/E2E có thể chạy:

```text
main branch
manual workflow
release workflow
```

Không cần CI/CD triển khai production.

---

## 28. Checklist Theo Phase

### Phase 0–3

- [ ] Repository.
- [ ] Docker Postgres/Redis.
- [ ] Prisma schema.
- [ ] Seed.
- [ ] Auth.
- [ ] Wallet.
- [ ] Ledger.

### Phase 4–6

- [ ] Fixed-point.
- [ ] Order Book.
- [ ] Matching.
- [ ] Order API.
- [ ] Outbox.
- [ ] Redis command/event.

### Phase 7–9

- [ ] Settlement.
- [ ] Fee.
- [ ] Treasury.
- [ ] Cancel.
- [ ] Realtime.
- [ ] Market Data.

### Phase 10–11

- [ ] Admin API.
- [ ] Core E2E.
- [ ] Idempotency.
- [ ] Concurrency.
- [ ] Reconciliation.
- [ ] Docker Compose.

### Phase 12–14

- [ ] Mock Token.
- [ ] Faucet.
- [ ] Vault.
- [ ] Deposit Intent.
- [ ] Listener.
- [ ] Deposit Credit.
- [ ] Frontend.
- [ ] README.
- [ ] Demo Guide.
