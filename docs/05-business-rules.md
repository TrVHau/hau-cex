# Hau CEX — Business Rules

## 1. Nguyên Tắc Chung

`05-business-rules.md` là chuẩn nghiệp vụ của MVP.

Nếu tài liệu khác mâu thuẫn với file này, phải sửa tài liệu đó.

MVP chỉ xử lý token test và không dùng cho tài sản thật.

---

## 2. Role và Account

Hệ thống có ba role:

| Role     | Ý nghĩa                        |
| -------- | ------------------------------ |
| `USER`   | Người dùng giao dịch.          |
| `ADMIN`  | Người vận hành hệ thống.       |
| `SYSTEM` | Tài khoản nội bộ cho Treasury. |

Rule:

- User chỉ quản lý dữ liệu của chính mình.
- Admin có thể lock/unlock User.
- Admin không được dùng API User để thao tác thay User.
- `SYSTEM` không đăng nhập, không tạo session.
- Treasury Account thuộc role `SYSTEM`.
- Treasury Wallet chỉ được Settlement Service cập nhật trong transaction nghiệp vụ hợp lệ.

---

## 3. Asset và Market

Asset có thể `ACTIVE` hoặc `INACTIVE`.

Rule:

- Asset `INACTIVE` không được dùng cho Order mới.
- Không được đổi `decimals` sau khi Asset đã phát sinh dữ liệu tài chính.
- Trading Pair phải có Base Asset khác Quote Asset.
- Market phải `READY` thì User mới được đặt Order.
- Khi Market `SUSPENDED`, Engine không xử lý `PlaceOrder`.
- Khi Market `SUSPENDED`, Engine vẫn xử lý `CancelOrder`.
- Open Order được giữ nguyên khi Market suspend.
- User có thể chủ động hủy Order để giải phóng Locked Balance.

Market Open/Suspend:

- Open: PostgreSQL vẫn `SUSPENDED`, tạo Outbox `OpenMarket`, nhận `MarketOpened` rồi mới chuyển DB sang `READY`.
- Suspend: trong một transaction chuyển DB sang `SUSPENDED` và tạo Outbox `SuspendMarket`.
- Khi Admin yêu cầu suspend, `PlaceOrder` bị chặn ngay ở Backend vì DB đã `SUSPENDED`.

---

## 4. Wallet

Wallet gồm:

```text
availableBalance
lockedBalance
```

Invariant:

```text
availableBalance >= 0
lockedBalance >= 0
totalBalance = availableBalance + lockedBalance
```

Mỗi User chỉ có một Wallet cho mỗi Asset:

```text
UNIQUE(userId, assetId)
```

Mọi update Wallet phải:

1. Nằm trong PostgreSQL transaction.
2. Lock row Wallet bằng `SELECT ... FOR UPDATE`.
3. Có Ledger Entry tương ứng.

Không được dùng float cho dữ liệu tài chính.

---

## 5. Ledger

Ledger là append-only.

Không được:

- Update Ledger Entry.
- Delete Ledger Entry.
- Sửa sai bằng cách ghi đè.

Nếu cần sửa sai, tạo Ledger Entry bù trừ.

Mỗi Ledger Entry phải có:

- Wallet.
- User.
- Asset.
- Balance type: `AVAILABLE` hoặc `LOCKED`.
- Amount.
- Entry type.
- Reference type.
- Reference ID.
- Operation ID.

Mỗi nghiệp vụ tài chính phải có `operationId` để gom các Ledger Entry cùng transaction.

Ledger `amount` là signed delta:

- Credit balance -> `amount > 0`.
- Debit balance -> `amount < 0`.

Mỗi cột Wallet thay đổi phải có một Ledger delta tương ứng.
Vì vậy `ORDER_LOCK` và `ORDER_UNLOCK` mỗi nghiệp vụ tạo 2 Ledger Entry,
không phải một.

Ví dụ `ORDER_LOCK` khi khóa `100 USDT`:

```text
AVAILABLE: -100 USDT
LOCKED:    +100 USDT
entryType: ORDER_LOCK
```

Ví dụ `ORDER_UNLOCK` khi mở khóa `100 USDT`:

```text
LOCKED:    -100 USDT
AVAILABLE: +100 USDT
entryType: ORDER_UNLOCK
```

---

## 6. Order

MVP chỉ hỗ trợ:

```text
LIMIT ORDER
```

Order side:

```text
BUY
SELL
```

Order status:

```text
PENDING
OPEN
PARTIALLY_FILLED
FILLED
CANCEL_PENDING
CANCELLED
REJECTED
```

Không được cancel Order ở trạng thái:

```text
PENDING
FILLED
CANCELLED
REJECTED
```

User chỉ được cancel Order của chính mình.

Invariant remaining locked:

```text
BUY remainingLockedAmount = limitPrice * remainingQuantity
SELL remainingLockedAmount = remainingQuantity
```

---

## 7. Lock Balance Khi Đặt Order

Buy Order khóa Quote Asset:

```text
lockedAmount = price * quantity
```

Sell Order khóa Base Asset:

```text
lockedAmount = quantity
```

Trong transaction tạo Order:

1. Lock Wallet.
2. Kiểm tra `availableBalance >= lockedAmount`.
3. `availableBalance -= lockedAmount`.
4. `lockedBalance += lockedAmount`.
5. Tạo 2 Ledger Entry `ORDER_LOCK`: `AVAILABLE -lockedAmount`, `LOCKED +lockedAmount`.
6. Tạo Order `PENDING`.
7. Tạo Outbox `PlaceOrder`.

---

## 8. Order State Machine

Allowed transitions:

```text
PENDING -> OPEN
PENDING -> REJECTED
PENDING -> FILLED
PENDING -> PARTIALLY_FILLED

OPEN -> PARTIALLY_FILLED
OPEN -> FILLED
OPEN -> CANCEL_PENDING

PARTIALLY_FILLED -> PARTIALLY_FILLED
PARTIALLY_FILLED -> FILLED
PARTIALLY_FILLED -> CANCEL_PENDING

CANCEL_PENDING -> CANCEL_PENDING
CANCEL_PENDING -> CANCELLED
CANCEL_PENDING -> FILLED
```

Không được chuyển trạng thái kết thúc về trạng thái hoạt động:

```text
FILLED
CANCELLED
REJECTED
```

---

## 9. Cancel Race

Khi Order đang `CANCEL_PENDING`, Trade vẫn có thể xảy ra trước khi Engine xử lý Cancel Command.

Nếu partial fill xảy ra khi Order đang `CANCEL_PENDING`:

- Cập nhật `filledQuantity`.
- Cập nhật `remainingQuantity`.
- Cập nhật `remainingLockedAmount`.
- Giữ nguyên trạng thái `CANCEL_PENDING`.
- Không chuyển về `PARTIALLY_FILLED`.

Nếu full fill xảy ra trước cancel:

```text
CANCEL_PENDING -> FILLED
```

Nếu Engine cancel thành công remaining quantity:

```text
CANCEL_PENDING -> CANCELLED
```

---

## 10. Matching Engine

Matching Engine:

- Chỉ quản lý Order Book runtime.
- Không kiểm tra Wallet.
- Không ghi PostgreSQL.
- Không settlement Trade.
- Không phát WebSocket trực tiếp.

Matching rule:

- Price-Time Priority.
- Buy giá cao hơn ưu tiên trước.
- Sell giá thấp hơn ưu tiên trước.
- Cùng giá thì `orderSequence` nhỏ hơn ưu tiên trước.
- Execution Price là giá của resting order.

Engine phải dùng fixed-point, không dùng float.

---

## 11. Sequence

Backend cấp:

```text
orderSequence
commandSequence
```

Matching Engine cấp:

```text
tradeSequence
orderBookSequence
```

Command Sequence rule:

```text
commandSequence == expected -> xử lý
commandSequence < expected  -> duplicate, không mutate lại
commandSequence > expected  -> sequence gap
```

Khi sequence gap:

- Không ACK command hiện tại.
- Không mutate Order Book.
- Không phát `OrderRejected`.
- Không phát `CancelOrderRejected`.
- Phát `EngineFailed(COMMAND_SEQUENCE_GAP)`.
- Dừng Pair Engine.

---

## 12. Trade

Mỗi match tạo một `TradeCreated`.

Trade ID:

```text
tradeId = UUIDv7
```

Business idempotency key:

```text
engineMatchId = tradingPairId + ":" + commandSequence + ":" + matchIndex
```

Rule:

- `engineMatchId` phải unique.
- Settlement chống trùng bằng `engineMatchId`.
- Cùng `engineMatchId` không được tạo hai Trade nghiệp vụ.

---

## 13. Trade Settlement

Settlement phải atomic trong một PostgreSQL transaction:

1. Check `processed_events`.
2. Check `engineMatchId`.
3. Lock Buy Order và Sell Order theo `id` tăng dần.
4. Lock Wallet buyer, seller và Treasury theo `id` tăng dần.
5. Insert Trade.
6. Cập nhật Order.
7. Cập nhật Wallet.
8. Tạo Ledger Entries.
9. Tạo Outbox domain events.
10. Insert `processed_events`.
11. Commit.

Nếu bất kỳ bước nào lỗi, transaction rollback toàn bộ.

Backend không tin hoàn toàn dữ liệu từ Engine.

Settlement Backend phải:

- Lấy `userId`, `tradingPairId` và `side` từ Order trong PostgreSQL.
- Chỉ dùng `buyerUserId` và `sellerUserId` từ Engine để verify.
- Kiểm tra `currentRemainingQuantity - executedQuantity == remainingQuantity` tương ứng trong `TradeCreated`.
- Nếu dữ liệu không khớp: rollback, suspend Market và yêu cầu reconciliation.

---

## 14. Buyer Settlement

Buyer:

- Trừ locked Quote theo execution notional.
- Nhận Base Asset.
- Trả buyer fee bằng Base Asset.
- Được hoàn quote chênh lệch nếu execution price thấp hơn limit price.

```text
quoteLockedForFill = limitPrice * executedQuantity
actualQuoteCost = executionPrice * executedQuantity
quoteRefund = quoteLockedForFill - actualQuoteCost
```

---

## 15. Seller Settlement

Seller:

- Trừ locked Base theo executed quantity.
- Nhận Quote Asset.
- Trả seller fee bằng Quote Asset.

---

## 16. Trading Fee

MVP:

- Buyer fee thu bằng Base Asset.
- Seller fee thu bằng Quote Asset.
- Buyer fee credit vào Treasury Wallet của Base Asset.
- Seller fee credit vào Treasury Wallet của Quote Asset.

Nếu Buy Order là Maker:

```text
buyerFeeRate = makerFeeRate
sellerFeeRate = takerFeeRate
```

Nếu Sell Order là Maker:

```text
sellerFeeRate = makerFeeRate
buyerFeeRate = takerFeeRate
```

Công thức:

```text
quoteAmount = executionPrice * executedQuantity
buyerFeeAmount = executedQuantity * buyerFeeRate
sellerFeeAmount = quoteAmount * sellerFeeRate
```

Mọi kết quả tài chính nội bộ được `ROUND_DOWN` tới tối đa 18 chữ số thập phân.

Settlement phải tạo Ledger Entry cho cả User và Treasury.

Không được chỉ giảm số lượng User nhận mà không ghi nhận Treasury Wallet.

Trong Core MVP, Maker Fee và Taker Fee không được thay đổi khi Market đang `READY`.

Muốn thay đổi Fee Rate:

1. Suspend Market.
2. Bảo đảm không còn Open Order.
3. Cập nhật Fee Rate.
4. Open Market lại.

Như vậy không phải snapshot fee trên từng Order.

---

## 17. Cancel Settlement

Khi Backend nhận `OrderCancelled`:

1. Kiểm tra `processed_events`.
2. Chỉ apply nếu Order đang `CANCEL_PENDING`.
3. Lock Order.
4. Lock Wallet.
5. Unlock `remainingLockedAmount`.
6. Tạo 2 Ledger Entry `ORDER_UNLOCK`: `LOCKED -amount`, `AVAILABLE +amount`.
7. Chuyển Order sang `CANCELLED`.
8. Tạo Outbox `OrderUpdated`, `BalanceUpdated`.
9. Insert `processed_events`.
10. Commit.

Khi nhận `CancelOrderRejected`:

- Không tự unlock balance.
- `ORDER_NOT_FOUND` + DB Order `FILLED`: ACK idempotent.
- `ORDER_NOT_FOUND` + DB Order `CANCELLED`: ACK idempotent.
- `ORDER_NOT_FOUND` + DB Order `CANCEL_PENDING`: suspend Market và reconciliation.
- `MARKET_NOT_READY`: giữ `CANCEL_PENDING`, suspend Market và operator xử lý thủ công.

---

## 18. Optional Business Rules — Deposit

Deposit token test chỉ triển khai sau khi Core Trading Flow chạy ổn.

Nếu triển khai Deposit, Deposit token test được credit khi:

- Event từ `ExchangeVault` hợp lệ.
- Đủ confirmation.
- Chưa từng xử lý cùng `chainId + txHash + logIndex`.

Trong transaction credit:

1. Kiểm tra `processed_events`.
2. Lock Deposit bằng `SELECT ... FOR UPDATE`.
3. Kiểm tra Deposit chưa `CREDITED`.
4. Kiểm tra `chainId + txHash + logIndex` không trùng.
5. Lock Wallet.
6. Tăng available balance.
7. Tạo Ledger `DEPOSIT`.
8. Chuyển Deposit sang `CREDITED`.
9. Tạo Outbox `DepositUpdated`, `BalanceUpdated`.
10. Insert `processed_events`.
11. Commit.

---

## 19. Market Data

Public market data của Hau CEX chỉ dùng dữ liệu đã commit.

Recent Trades:

- Chỉ từ Trade đã settlement.

Last Price:

- Execution Price của Trade đã settlement gần nhất.

Order Book:

- Từ Matching Engine runtime aggregate.
- Không chứa User ID hoặc Order ID riêng tư.

Nếu triển khai Candlestick/Chart, dữ liệu phải được tổng hợp từ Trade đã settlement của Hau CEX.
Không dùng nguồn market data bên ngoài cho UI trong MVP.

---

## 20. Realtime

Realtime event tối thiểu:

```text
orderbook.update
trade.created
order.updated
balance.updated
```

Nếu triển khai Deposit, realtime private event có thêm:

```text
deposit.updated
```

Rule:

- Event tài chính chỉ phát sau PostgreSQL commit.
- Private event chỉ gửi cho đúng User.
- WebSocket không phải nguồn dữ liệu bền vững.

---

## 21. Idempotency

Order create:

```text
UNIQUE(userId, idempotencyKey)
```

Backend phải lưu `idempotencyPayloadHash` trên Order.

Hash dùng SHA-256 từ payload đã canonicalize:

```text
symbol|side|type|price|quantity
```

Ví dụ:

```text
SHA-256("HAU_USDT|BUY|LIMIT|1.000000000000000000|100.000000000000000000")
```

Cùng User + cùng Idempotency Key:

- Payload hash giống: trả lại Order cũ.
- Payload hash khác: trả `IDEMPOTENCY_CONFLICT`.

Consumer:

```text
UNIQUE(consumerName, messageId)
```

Consumer phải lưu `payloadHash` trong `processed_events`.

```text
messageId chưa tồn tại -> xử lý -> lưu payloadHash
messageId tồn tại + hash giống -> ACK idempotent
messageId tồn tại + hash khác -> dead-letter
```

Trade settlement:

```text
UNIQUE(engineMatchId)
```

Deposit:

```text
UNIQUE(chainId, txHash, logIndex)
```

Deposit idempotency áp dụng khi triển khai Deposit.

---

## 22. Transaction Rule

Các nghiệp vụ sau phải atomic:

- Create Order và lock balance.
- Reject Order và unlock balance.
- Cancel Order settlement.
- Trade Settlement.
- Deposit credit nếu triển khai Optional Deposit.

Core MVP dùng PostgreSQL `READ COMMITTED` + `SELECT ... FOR UPDATE`.
Không cần Serializable cho toàn hệ thống.

Mọi transaction lock nhiều row phải dùng thứ tự ổn định:

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

Không được tạo trạng thái một phần:

- Wallet đã đổi nhưng Ledger chưa ghi.
- Trade đã tạo nhưng Order chưa cập nhật.
- Ledger đã ghi nhưng transaction nghiệp vụ fail.

---

## 23. Checklist

- [ ] Wallet không âm.
- [ ] Mọi Wallet mutation có Ledger.
- [ ] Order lock đúng asset.
- [ ] Cancel unlock đúng remaining amount.
- [ ] Partial fill khi `CANCEL_PENDING` giữ nguyên `CANCEL_PENDING`.
- [ ] Full fill có thể thắng cancel.
- [ ] `COMMAND_SEQUENCE_GAP` không tạo rejection.
- [ ] `engineMatchId` chống settlement trùng.
- [ ] Fee vào Treasury Wallet.
- [ ] Domain event chỉ phát sau commit.
