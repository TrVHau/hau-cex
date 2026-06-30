# Hau CEX — Business Rules

## 1. Mục đích

Tài liệu này mô tả các quy tắc nghiệp vụ của hệ thống Hau CEX.

Các quy tắc được sử dụng làm cơ sở cho:

- Thiết kế database.
- Thiết kế API.
- Thiết kế Matching Engine.
- Validate dữ liệu.
- Xử lý transaction.
- Xây dựng test case.
- Kiểm tra tính nhất quán của hệ thống.

Mỗi quy tắc có một mã duy nhất theo định dạng:

```text
BR-<MODULE>-<NUMBER>
```

Ví dụ:

```text
BR-ORDER-001
BR-WALLET-001
BR-ENGINE-001
```

---

# 2. Quy tắc về User và Authentication

## BR-AUTH-001 — Email phải duy nhất

Mỗi email chỉ được liên kết với một tài khoản trong hệ thống.

Email phải được chuẩn hóa trước khi lưu và so sánh:

- Loại bỏ khoảng trắng ở đầu và cuối.
- Chuyển phần ký tự phù hợp về chữ thường.
- Kiểm tra đúng định dạng email.

---

## BR-AUTH-002 — Mật khẩu không được lưu trực tiếp

Mật khẩu phải được hash bằng thuật toán bảo mật trước khi lưu vào database.

Hệ thống không được:

- Lưu mật khẩu dạng plain text.
- Ghi mật khẩu vào log.
- Trả password hash qua API.
- Gửi mật khẩu trong event hoặc message broker.

---

## BR-AUTH-003 — Trạng thái tài khoản

Tài khoản có các trạng thái:

| Trạng thái | Ý nghĩa |
|---|---|
| `ACTIVE` | User được phép sử dụng hệ thống. |
| `LOCKED` | User bị khóa và không được thực hiện thao tác riêng tư. |
| `DISABLED` | Tài khoản đã bị vô hiệu hóa. |

Chỉ tài khoản có trạng thái `ACTIVE` mới được:

- Đăng nhập.
- Đặt Order.
- Hủy Order.
- Tạo yêu cầu Withdrawal.
- Thực hiện Deposit mới thông qua giao diện.

---

## BR-AUTH-004 — Phân quyền

Hệ thống có tối thiểu hai role:

| Role | Quyền |
|---|---|
| `USER` | Quản lý tài khoản, ví và giao dịch của chính mình. |
| `ADMIN` | Quản lý User, Asset, Trading Pair và Withdrawal. |

User không được tự thay đổi:

- Role.
- Trạng thái tài khoản.
- Số dư.
- Cấu hình phí.
- Cấu hình Trading Pair.

---

## BR-AUTH-005 — Access Token và Refresh Token

Access Token có thời gian sống ngắn hơn Refresh Token.

Refresh Token phải:

- Có thời hạn.
- Có thể bị thu hồi.
- Được liên kết với một session.
- Không được sử dụng sau khi User đăng xuất hoặc bị khóa.

---

## BR-AUTH-006 — Thu hồi session khi khóa User

Khi User bị khóa:

1. Các Refresh Token của User phải bị thu hồi.
2. User không được tạo request riêng tư mới.
3. Các Open Order được xử lý theo chính sách quản trị đã cấu hình.

Trong MVP, mặc định Open Order của User bị khóa tài khoản vẫn được giữ nguyên cho đến khi Admin hoặc User sau khi được mở khóa thực hiện hủy.

---

# 3. Quy tắc về Asset

## BR-ASSET-001 — Symbol phải duy nhất

Mỗi Asset có một `symbol` duy nhất.

Ví dụ:

```text
ETH
USDT
HAU
```

Symbol phải:

- Được viết hoa.
- Không chứa khoảng trắng.
- Không được thay đổi sau khi Asset đã được sử dụng trong giao dịch.

---

## BR-ASSET-002 — Contract Address phải duy nhất theo blockchain

Một contract address chỉ được liên kết với một Asset trên cùng một blockchain.

Khóa duy nhất:

```text
chainId + contractAddress
```

Địa chỉ contract phải được chuẩn hóa trước khi lưu.

---

## BR-ASSET-003 — Decimals không được thay đổi tùy ý

Thuộc tính `decimals` phải trùng với decimals của token contract.

Sau khi Asset đã phát sinh Deposit, Withdrawal hoặc Trade, Admin không được thay đổi decimals trực tiếp.

---

## BR-ASSET-004 — Trạng thái chức năng của Asset

Mỗi Asset có ba trạng thái chức năng độc lập:

```text
depositEnabled
withdrawalEnabled
tradingEnabled
```

Việc tắt một chức năng không bắt buộc phải tắt các chức năng còn lại.

Ví dụ:

- Có thể tắt Withdrawal nhưng vẫn cho phép Trading.
- Có thể tắt Deposit nhưng vẫn cho phép User giao dịch số dư hiện có.
- Khi `tradingEnabled = false`, không được tạo Order mới liên quan đến Asset.

---

## BR-ASSET-005 — Không xóa Asset đã có dữ liệu

Asset đã phát sinh một trong các dữ liệu sau không được xóa vật lý:

- Wallet.
- Ledger Entry.
- Order.
- Trade.
- Deposit.
- Withdrawal.
- Trading Pair.

Asset chỉ được chuyển sang trạng thái không hoạt động.

---

# 4. Quy tắc về Trading Pair

## BR-MARKET-001 — Cấu trúc Trading Pair

Một Trading Pair gồm:

```text
Base Asset / Quote Asset
```

Ví dụ:

```text
ETH/USDT
```

Trong đó:

- ETH là Base Asset.
- USDT là Quote Asset.
- Quantity được tính theo Base Asset.
- Price được tính theo Quote Asset trên một đơn vị Base Asset.

---

## BR-MARKET-002 — Base Asset và Quote Asset phải khác nhau

Không được tạo Trading Pair có Base Asset trùng Quote Asset.

Không hợp lệ:

```text
ETH/ETH
USDT/USDT
```

---

## BR-MARKET-003 — Trading Pair phải duy nhất

Không được tồn tại hai Trading Pair có cùng:

```text
baseAssetId + quoteAssetId
```

`ETH/USDT` và `USDT/ETH` được xem là hai Trading Pair khác nhau.

---

## BR-MARKET-004 — Trạng thái Trading Pair

Trading Pair có các trạng thái:

| Trạng thái | Ý nghĩa |
|---|---|
| `INACTIVE` | Đã được tạo nhưng chưa giao dịch. |
| `ACTIVE` | Cho phép đặt và khớp Order. |
| `SUSPENDED` | Tạm dừng nhận Order mới. |
| `CLOSED` | Thị trường đã đóng. |

Chỉ Trading Pair có trạng thái `ACTIVE` mới nhận Order mới.

---

## BR-MARKET-005 — Điều kiện kích hoạt Trading Pair

Trading Pair chỉ được chuyển sang `ACTIVE` khi:

1. Base Asset tồn tại.
2. Quote Asset tồn tại.
3. Cả hai Asset cho phép Trading.
4. Tick Size hợp lệ.
5. Step Size hợp lệ.
6. Minimum Quantity hợp lệ.
7. Minimum Notional hợp lệ.
8. Matching Engine sẵn sàng xử lý Trading Pair.

---

## BR-MARKET-006 — Tick Size

Price của Order phải là bội số của Tick Size.

Điều kiện:

```text
price mod tickSize = 0
```

Ví dụ:

```text
Tick Size = 0.01
```

Giá hợp lệ:

```text
2000.00
2000.01
2000.15
```

Giá không hợp lệ:

```text
2000.001
```

---

## BR-MARKET-007 — Step Size

Quantity của Order phải là bội số của Step Size.

Điều kiện:

```text
quantity mod stepSize = 0
```

Ví dụ:

```text
Step Size = 0.001 ETH
```

Quantity hợp lệ:

```text
0.001
0.125
1.500
```

Quantity không hợp lệ:

```text
0.0005
```

---

## BR-MARKET-008 — Minimum Quantity

Quantity của Order phải lớn hơn hoặc bằng `minimumQuantity`.

```text
quantity >= minimumQuantity
```

---

## BR-MARKET-009 — Minimum Notional

Giá trị Order phải lớn hơn hoặc bằng `minimumNotional`.

```text
notional = price × quantity
notional >= minimumNotional
```

Ví dụ:

```text
Minimum Notional = 10 USDT
```

Một Order trị giá 5 USDT không hợp lệ.

---

## BR-MARKET-010 — Tạm dừng thị trường

Khi Trading Pair chuyển sang `SUSPENDED`:

- Không nhận Order mới.
- Không cho phép thay đổi Order.
- Vẫn cho phép xem dữ liệu thị trường.
- Chính sách xử lý Open Order phải được xác định rõ.

Trong MVP, Open Order được giữ nguyên khi market tạm dừng.

Admin có thể thực hiện một thao tác riêng để hủy toàn bộ Open Order nếu cần.

---

# 5. Quy tắc về Wallet

## BR-WALLET-001 — Mỗi User chỉ có một Wallet cho mỗi Asset

Khóa duy nhất:

```text
userId + assetId
```

Không được tồn tại hai Wallet của cùng User cho cùng một Asset.

---

## BR-WALLET-002 — Cấu trúc số dư

Wallet gồm:

```text
availableBalance
lockedBalance
```

Tổng số dư:

```text
totalBalance = availableBalance + lockedBalance
```

`totalBalance` có thể được tính khi truy vấn và không bắt buộc lưu thành cột riêng.

---

## BR-WALLET-003 — Số dư không được âm

Tại mọi thời điểm:

```text
availableBalance >= 0
lockedBalance >= 0
```

Không được commit transaction nếu một trong hai số dư trở thành số âm.

---

## BR-WALLET-004 — Không sử dụng số thực

Price, Quantity, Fee và Balance không được xử lý bằng:

```text
float
double
JavaScript number
```

Hệ thống phải sử dụng:

- PostgreSQL `NUMERIC`.
- Decimal.
- BigInt.
- Fixed-point integer.

---

## BR-WALLET-005 — Mọi thay đổi số dư phải có Ledger Entry

Không được cập nhật Wallet độc lập.

Mỗi thay đổi số dư phải:

1. Xảy ra trong database transaction.
2. Có ít nhất một Ledger Entry tương ứng.
3. Có Reference Type.
4. Có Reference ID.
5. Có Idempotency Key phù hợp.

---

## BR-WALLET-006 — Khóa số dư Buy Order

Khi đặt Limit Buy Order:

```text
lockedQuoteAmount = limitPrice × quantity
```

Hệ thống thực hiện:

```text
availableQuoteBalance -= lockedQuoteAmount
lockedQuoteBalance += lockedQuoteAmount
```

---

## BR-WALLET-007 — Khóa số dư Sell Order

Khi đặt Limit Sell Order:

```text
lockedBaseAmount = quantity
```

Hệ thống thực hiện:

```text
availableBaseBalance -= quantity
lockedBaseBalance += quantity
```

---

## BR-WALLET-008 — Khóa số dư Withdrawal

Khi tạo Withdrawal:

```text
totalLocked = withdrawalAmount + withdrawalFee
```

Hệ thống thực hiện:

```text
availableBalance -= totalLocked
lockedBalance += totalLocked
```

Nếu phí được trừ trực tiếp từ số lượng rút thì phải ghi rõ:

```text
receivedAmount = withdrawalAmount - withdrawalFee
```

MVP sử dụng mô hình:

```text
User nhập withdrawalAmount
receivedAmount = withdrawalAmount - withdrawalFee
```

Do đó số dư bị khóa là `withdrawalAmount`.

---

## BR-WALLET-009 — Khóa bản ghi khi cập nhật số dư

Khi cập nhật Wallet, backend phải khóa bản ghi tương ứng trong database transaction.

Ví dụ:

```sql
SELECT *
FROM wallets
WHERE user_id = ?
  AND asset_id = ?
FOR UPDATE;
```

Mục tiêu là ngăn hai request cùng sử dụng một số dư.

---

## BR-WALLET-010 — Thứ tự khóa Wallet

Khi một transaction cần khóa nhiều Wallet, hệ thống phải khóa theo thứ tự xác định để hạn chế deadlock.

Thứ tự đề xuất:

```text
assetId tăng dần
sau đó userId tăng dần
```

Tất cả module phải sử dụng cùng một thứ tự khóa.

---

# 6. Quy tắc về Ledger

## BR-LEDGER-001 — Ledger là dữ liệu bất biến

Ledger Entry sau khi được tạo không được:

- Cập nhật.
- Xóa.
- Ghi đè.

Nếu cần sửa sai, hệ thống phải tạo một Ledger Entry bù trừ mới.

---

## BR-LEDGER-002 — Ledger Entry phải có nguồn tham chiếu

Mỗi Ledger Entry phải chứa:

```text
referenceType
referenceId
```

Ví dụ:

| Reference Type | Reference ID |
|---|---|
| `ORDER` | Order ID |
| `TRADE` | Trade ID |
| `DEPOSIT` | Deposit ID |
| `WITHDRAWAL` | Withdrawal ID |
| `ADMIN_ADJUSTMENT` | Adjustment ID |

---

## BR-LEDGER-003 — Phân biệt loại số dư

Ledger Entry phải chỉ rõ số dư bị thay đổi:

```text
AVAILABLE
LOCKED
```

Ví dụ khi khóa 100 USDT:

| Balance Type | Amount |
|---|---:|
| `AVAILABLE` | `-100` |
| `LOCKED` | `+100` |

---

## BR-LEDGER-004 — Tổng bút toán của thao tác chuyển nội bộ bằng 0

Đối với thao tác chuyển giữa Available và Locked của cùng Wallet:

```text
sum(ledger amounts) = 0
```

Ví dụ khóa số dư:

```text
AVAILABLE: -100
LOCKED:    +100
Tổng:       0
```

---

## BR-LEDGER-005 — Idempotency của Ledger

Không được tạo nhiều Ledger Entry cho cùng một biến động nghiệp vụ.

Khóa idempotency có thể gồm:

```text
referenceType
referenceId
entryType
assetId
userId
balanceType
```

---

## BR-LEDGER-006 — Đối soát Wallet

Hệ thống phải có khả năng kiểm tra:

```text
initialBalance + tổng biến động Ledger = currentBalance
```

Nếu phát hiện sai lệch:

- Không tự động sửa nếu chưa xác định nguyên nhân.
- Ghi log.
- Tạo cảnh báo.
- Cho phép Admin kiểm tra.

---

# 7. Quy tắc về Order

## BR-ORDER-001 — MVP chỉ hỗ trợ Limit Order

Order trong MVP có:

```text
type = LIMIT
```

Chưa hỗ trợ:

- Market Order.
- Stop Order.
- Stop Limit.
- OCO.
- Iceberg Order.

---

## BR-ORDER-002 — Side của Order

Order có hai phía:

| Side | Ý nghĩa |
|---|---|
| `BUY` | Mua Base Asset bằng Quote Asset. |
| `SELL` | Bán Base Asset để nhận Quote Asset. |

---

## BR-ORDER-003 — Price và Quantity phải dương

Điều kiện:

```text
price > 0
quantity > 0
```

Không chấp nhận:

```text
price = 0
quantity = 0
price < 0
quantity < 0
```

---

## BR-ORDER-004 — Order phải thuộc một User và Trading Pair

Mỗi Order phải tham chiếu đến:

- Một User.
- Một Trading Pair.
- Một Side.
- Một Order Type.

Không được thay đổi User hoặc Trading Pair sau khi Order được tạo.

---

## BR-ORDER-005 — Quantity của Order

Order phải lưu:

```text
originalQuantity
filledQuantity
remainingQuantity
```

Quan hệ:

```text
originalQuantity = filledQuantity + remainingQuantity
```

Tại mọi thời điểm:

```text
filledQuantity >= 0
remainingQuantity >= 0
filledQuantity <= originalQuantity
remainingQuantity <= originalQuantity
```

---

## BR-ORDER-006 — Trạng thái Order

Order có các trạng thái:

| Trạng thái | Ý nghĩa |
|---|---|
| `PENDING` | Đã tạo nhưng chưa được Engine xác nhận. |
| `OPEN` | Đang nằm trong Order Book. |
| `PARTIALLY_FILLED` | Đã khớp một phần. |
| `FILLED` | Đã khớp toàn bộ. |
| `CANCEL_PENDING` | Đang chờ Engine xác nhận hủy. |
| `CANCELLED` | Đã được hủy. |
| `REJECTED` | Không được chấp nhận. |

---

## BR-ORDER-007 — Chuyển trạng thái Order

Các chuyển trạng thái hợp lệ:

```text
PENDING → OPEN
PENDING → PARTIALLY_FILLED
PENDING → FILLED
PENDING → REJECTED

OPEN → PARTIALLY_FILLED
OPEN → FILLED
OPEN → CANCEL_PENDING

PARTIALLY_FILLED → PARTIALLY_FILLED
PARTIALLY_FILLED → FILLED
PARTIALLY_FILLED → CANCEL_PENDING

CANCEL_PENDING → CANCELLED
CANCEL_PENDING → PARTIALLY_FILLED
CANCEL_PENDING → FILLED
```

Không được chuyển từ trạng thái kết thúc sang trạng thái hoạt động:

```text
FILLED → OPEN
CANCELLED → OPEN
REJECTED → OPEN
```

---

## BR-ORDER-008 — Điều kiện hủy Order

Chỉ được gửi yêu cầu hủy khi Order có trạng thái:

```text
OPEN
PARTIALLY_FILLED
```

Không được hủy Order có trạng thái:

```text
PENDING
FILLED
CANCELLED
REJECTED
```

Order ở trạng thái `PENDING` có thể cần cơ chế timeout riêng nếu Engine không phản hồi.

---

## BR-ORDER-009 — Chỉ chủ sở hữu được hủy Order

User chỉ được hủy Order thuộc tài khoản của mình.

Admin không được hủy Order của User thông qua API User thông thường.

Thao tác hủy bởi Admin phải:

- Sử dụng API riêng.
- Có lý do.
- Ghi Audit Log.

---

## BR-ORDER-010 — Sequence của Order

Mỗi Order khi được gửi đến Matching Engine phải có Sequence xác định.

Sequence phải:

- Duy nhất trong phạm vi Trading Pair.
- Tăng dần.
- Không thay đổi.
- Được sử dụng để xác định thứ tự thời gian.

Không sử dụng `createdAt` làm nguồn duy nhất để xác định thứ tự matching.

---

## BR-ORDER-011 — Không chỉnh sửa Order

Sau khi Order được tạo, User không được sửa:

- Price.
- Quantity.
- Side.
- Trading Pair.

Muốn thay đổi Order, User phải:

1. Hủy Order cũ.
2. Tạo Order mới.

---

## BR-ORDER-012 — Order bị Engine từ chối

Nếu Engine từ chối Order sau khi số dư đã được khóa:

1. Order chuyển thành `REJECTED`.
2. Toàn bộ số dư đã khóa cho Order phải được mở khóa.
3. Ledger Entry hoàn số dư phải được tạo.
4. Lý do từ chối phải được lưu.

---

## BR-ORDER-013 — Timeout của Order PENDING

Nếu Order ở trạng thái `PENDING` quá thời gian cấu hình:

1. Hệ thống kiểm tra Outbox Event.
2. Nếu command chưa gửi, hệ thống gửi lại.
3. Nếu command đã gửi nhưng chưa có phản hồi, hệ thống truy vấn trạng thái Engine.
4. Không tự mở khóa số dư khi chưa xác định trạng thái Order trong Engine.

---

# 8. Quy tắc về Matching Engine

## BR-ENGINE-001 — Engine không quản lý số dư

Matching Engine không chịu trách nhiệm:

- Xác thực User.
- Kiểm tra Wallet.
- Khóa số dư.
- Settlement số dư.
- Xử lý Deposit.
- Xử lý Withdrawal.

Engine chỉ xử lý Order đã được Backend xác nhận hợp lệ.

---

## BR-ENGINE-002 — Một Trading Pair được xử lý tuần tự

Các command của cùng một Trading Pair phải được xử lý theo thứ tự bởi một luồng logic duy nhất.

Mô hình đề xuất:

```text
Một Trading Pair
→ Một Pair Engine
→ Một Goroutine
→ Một Command Channel
```

Không được xử lý đồng thời hai command làm thay đổi cùng một Order Book.

---

## BR-ENGINE-003 — Price-Time Priority

Engine sử dụng quy tắc Price-Time Priority.

Thứ tự ưu tiên:

1. Giá tốt hơn.
2. Nếu cùng giá, Sequence nhỏ hơn.

---

## BR-ENGINE-004 — Ưu tiên Buy Order

Đối với Bid Side:

- Price cao hơn được ưu tiên.
- Nếu cùng Price, Order có Sequence nhỏ hơn được ưu tiên.

---

## BR-ENGINE-005 — Ưu tiên Sell Order

Đối với Ask Side:

- Price thấp hơn được ưu tiên.
- Nếu cùng Price, Order có Sequence nhỏ hơn được ưu tiên.

---

## BR-ENGINE-006 — Điều kiện khớp

Buy Order và Sell Order có thể khớp khi:

```text
buyPrice >= sellPrice
```

Nếu:

```text
buyPrice < sellPrice
```

hai Order không thể khớp.

---

## BR-ENGINE-007 — Giá khớp

Execution Price được lấy theo giá của Maker Order.

Ví dụ:

- Sell Order 2.000 USDT đã nằm trong Order Book.
- Buy Order 2.100 USDT đi vào sau.
- Execution Price là 2.000 USDT.

---

## BR-ENGINE-008 — Khối lượng khớp

Executed Quantity được tính:

```text
executedQuantity =
min(incomingOrder.remainingQuantity,
    restingOrder.remainingQuantity)
```

Không được khớp vượt quá Remaining Quantity của bất kỳ Order nào.

---

## BR-ENGINE-009 — Partial Fill

Nếu Order chỉ được khớp một phần:

```text
remainingQuantity > 0
filledQuantity > 0
```

Order chuyển thành:

```text
PARTIALLY_FILLED
```

Nếu không còn Order đối ứng phù hợp, phần Remaining Quantity được giữ trong Order Book.

---

## BR-ENGINE-010 — Full Fill

Order chuyển thành `FILLED` khi:

```text
remainingQuantity = 0
filledQuantity = originalQuantity
```

Order `FILLED` phải được loại khỏi Order Book.

---

## BR-ENGINE-011 — Order Book chỉ chứa Order hoạt động

Order Book chỉ được chứa Order có trạng thái logic:

```text
OPEN
PARTIALLY_FILLED
```

Không được chứa:

```text
PENDING
FILLED
CANCELLED
REJECTED
```

---

## BR-ENGINE-012 — Command phải idempotent

Mỗi command phải có `commandId` duy nhất.

Nếu Engine nhận lại command đã xử lý:

- Không được thêm Order lần thứ hai.
- Không được hủy Order lần thứ hai.
- Phải trả lại hoặc phát lại kết quả tương ứng nếu cần.
- Message phải được ACK an toàn.

---

## BR-ENGINE-013 — Trade Event phải duy nhất

Mỗi lần khớp tạo một `tradeId` duy nhất.

Cùng một Trade Event có thể được gửi lại nhưng không được tạo thêm một Trade nghiệp vụ mới.

---

## BR-ENGINE-014 — Hủy Order và Matching phải tuần tự

Cancel Order và Place Order của cùng Trading Pair phải đi qua cùng Pair Engine.

Nếu một Order được match trước khi Cancel Command đến lượt xử lý:

- Phần đã khớp vẫn hợp lệ.
- Chỉ Remaining Quantity tại thời điểm xử lý Cancel được hủy.
- Nếu Order đã Filled, yêu cầu hủy thất bại.

---

## BR-ENGINE-015 — Snapshot phải nhất quán

Snapshot phải được tạo tại ranh giới giữa hai command.

Snapshot không được lưu trạng thái đang xử lý dở một Trade.

Snapshot cần chứa tối thiểu:

- Trading Pair.
- Bid Side.
- Ask Side.
- Open Orders.
- Remaining Quantity.
- Sequence cuối cùng đã xử lý.
- Thời điểm tạo.

---

## BR-ENGINE-016 — Recovery trước khi nhận Order mới

Sau khi khởi động lại, Engine phải:

1. Tải snapshot.
2. Replay event hoặc command sau snapshot.
3. Kiểm tra Sequence.
4. Khôi phục Order Book.
5. Chuyển sang trạng thái `READY`.

Engine không được nhận Order mới trước khi hoàn tất recovery.

---

# 9. Quy tắc về Trade và Settlement

## BR-TRADE-001 — Mỗi lần khớp tạo một Trade

Một incoming Order có thể khớp với nhiều resting Order.

Mỗi cặp khớp tạo một Trade riêng.

Ví dụ:

```text
Buy 3 ETH
```

khớp với:

```text
Sell 1 ETH
Sell 1 ETH
Sell 1 ETH
```

Kết quả là ba Trade.

---

## BR-TRADE-002 — Trade là bất biến

Trade sau khi được settlement không được:

- Sửa giá.
- Sửa quantity.
- Đổi buyer.
- Đổi seller.
- Xóa.

Nếu phát hiện lỗi nghiêm trọng, hệ thống phải tạo nghiệp vụ điều chỉnh riêng.

---

## BR-TRADE-003 — Trade phải xác định Maker và Taker

Trong mỗi Trade:

- Maker là Order đã nằm trong Order Book.
- Taker là incoming Order tạo ra match.

Một Trade phải lưu:

```text
makerOrderId
takerOrderId
```

---

## BR-TRADE-004 — Settlement phải atomic

Các thao tác sau phải nằm trong cùng một database transaction:

1. Tạo Trade.
2. Cập nhật Buy Order.
3. Cập nhật Sell Order.
4. Cập nhật Wallet buyer.
5. Cập nhật Wallet seller.
6. Thu phí.
7. Tạo Ledger Entry.
8. Đánh dấu Engine Event đã xử lý.
9. Tạo Outbox Event cần thiết.

Nếu một bước thất bại, toàn bộ transaction phải rollback.

---

## BR-TRADE-005 — Settlement chỉ được thực hiện một lần

Mỗi `tradeId` chỉ được settlement một lần.

Database phải có unique constraint đối với `tradeId`.

Consumer phải kiểm tra idempotency trước khi cập nhật số dư.

---

## BR-TRADE-006 — Settlement cho Buyer

Khi Trade được settlement, Buyer:

1. Giảm Locked Quote Asset theo chi phí thực tế.
2. Nhận Base Asset.
3. Trả phí giao dịch theo cấu hình.
4. Được hoàn phần Quote Asset dư nếu Execution Price tốt hơn Limit Price.

---

## BR-TRADE-007 — Settlement cho Seller

Khi Trade được settlement, Seller:

1. Giảm Locked Base Asset bằng Executed Quantity.
2. Nhận Quote Asset.
3. Trả phí giao dịch theo cấu hình.

---

## BR-TRADE-008 — Hoàn chênh lệch giá cho Buy Order

Buy Order khóa tài sản theo Limit Price nhưng có thể khớp ở Execution Price thấp hơn.

Phần hoàn:

```text
refund =
(limitPrice - executionPrice) × executedQuantity
```

Điều kiện:

```text
refund >= 0
```

Phần refund được chuyển:

```text
lockedQuoteBalance → availableQuoteBalance
```

---

## BR-TRADE-009 — Thứ tự khóa dữ liệu Settlement

Settlement phải khóa dữ liệu theo thứ tự cố định:

1. Hai Order theo Order ID.
2. Các Wallet theo Asset ID và User ID.
3. Các bản ghi liên quan khác.

Mục tiêu là giảm nguy cơ deadlock.

---

# 10. Quy tắc về phí giao dịch

## BR-FEE-001 — Phân biệt Maker Fee và Taker Fee

Mỗi Trade có thể sử dụng hai mức phí:

```text
makerFeeRate
takerFeeRate
```

Maker trả Maker Fee.

Taker trả Taker Fee.

---

## BR-FEE-002 — Tỷ lệ phí được snapshot tại thời điểm giao dịch

Fee Rate sử dụng cho Trade phải được lưu vào Trade hoặc Fee Record.

Việc Admin thay đổi Fee Rate sau đó không được ảnh hưởng đến Trade đã hoàn thành.

---

## BR-FEE-003 — Phí không được âm

Điều kiện:

```text
feeRate >= 0
feeAmount >= 0
```

MVP chưa hỗ trợ rebate âm cho Maker.

---

## BR-FEE-004 — Tài sản thu phí

Trong MVP:

- Buyer trả phí bằng Base Asset nhận được.
- Seller trả phí bằng Quote Asset nhận được.

Buyer nhận:

```text
receivedBase =
executedQuantity - buyerFee
```

Seller nhận:

```text
receivedQuote =
executionPrice × executedQuantity - sellerFee
```

---

## BR-FEE-005 — Làm tròn phí

Phí phải được làm tròn theo precision của Asset thu phí.

Hệ thống phải sử dụng cùng một quy tắc làm tròn ở mọi service.

MVP sử dụng:

```text
ROUND_DOWN
```

Phần dư do làm tròn phải được xử lý nhất quán và không được làm số dư User âm.

---

# 11. Quy tắc về Order Book và Market Data

## BR-MARKETDATA-001 — Order Book công khai được tổng hợp theo Price Level

Dữ liệu công khai chỉ hiển thị:

```text
price
totalQuantity
orderCount
```

Không hiển thị:

- User ID.
- Order ID cá nhân.
- Thông tin tài khoản.
- Sequence nội bộ.

---

## BR-MARKETDATA-002 — Best Bid

Best Bid là mức giá cao nhất đang có trên Bid Side.

Nếu Bid Side rỗng:

```text
bestBid = null
```

---

## BR-MARKETDATA-003 — Best Ask

Best Ask là mức giá thấp nhất đang có trên Ask Side.

Nếu Ask Side rỗng:

```text
bestAsk = null
```

---

## BR-MARKETDATA-004 — Recent Trades chỉ dùng Trade đã settlement

Market Data không được công bố Trade chưa được settlement thành công.

Event dùng để cập nhật Market Data phải được phát sau khi transaction settlement commit.

---

## BR-MARKETDATA-005 — Giá cuối

Last Price là Execution Price của Trade được settlement gần nhất theo Sequence.

---

## BR-MARKETDATA-006 — Candlestick

Mỗi Candlestick gồm:

```text
openTime
closeTime
open
high
low
close
volume
```

Trong đó:

- Open là giá Trade đầu tiên.
- High là giá cao nhất.
- Low là giá thấp nhất.
- Close là giá Trade cuối cùng.
- Volume là tổng Executed Quantity.

---

## BR-MARKETDATA-007 — Một candle duy nhất cho mỗi khoảng thời gian

Khóa duy nhất:

```text
tradingPairId + interval + openTime
```

Không được tạo nhiều candle cho cùng một Trading Pair, interval và openTime.

---

## BR-MARKETDATA-008 — Trade Event cập nhật candle phải idempotent

Mỗi Trade chỉ được cộng vào volume của một candle một lần cho mỗi interval.

Worker phải lưu dấu vết Trade Event đã xử lý hoặc sử dụng phép cập nhật idempotent.

---

# 12. Quy tắc về Deposit

## BR-DEPOSIT-001 — MVP chỉ hỗ trợ ERC-20 Deposit qua Exchange Vault

User nạp token bằng cách gọi hàm `deposit` của Exchange Vault.

Matching Engine không tham gia xử lý Deposit.

---

## BR-DEPOSIT-002 — Asset phải cho phép Deposit

Deposit chỉ hợp lệ khi:

```text
asset.depositEnabled = true
```

Event của Asset không được hỗ trợ không được cộng số dư.

---

## BR-DEPOSIT-003 — Xác định User Deposit

Event Deposit phải chứa hoặc cho phép xác định chính xác User trong hệ thống.

Ví dụ contract phát:

```text
Deposited(userAddress, tokenAddress, amount, userId)
```

Không được cộng tiền nếu không xác định được tài khoản nhận.

---

## BR-DEPOSIT-004 — Khóa chống trùng Deposit

Một Deposit được xác định duy nhất bởi:

```text
chainId + txHash + logIndex
```

Database phải có unique constraint trên tổ hợp này.

---

## BR-DEPOSIT-005 — Deposit phải chờ Confirmation

Deposit chỉ được cộng vào Available Balance sau khi đạt số Confirmation cấu hình.

Trước đó Deposit có trạng thái:

```text
DETECTED
CONFIRMING
```

Sau khi cộng số dư:

```text
CREDITED
```

---

## BR-DEPOSIT-006 — Deposit chỉ được cộng một lần

Việc Listener đọc lại cùng một block hoặc event không được làm User được cộng tiền lần thứ hai.

---

## BR-DEPOSIT-007 — Amount Deposit phải dương

Điều kiện:

```text
amount > 0
```

Token address và amount phải khớp với event blockchain.

---

## BR-DEPOSIT-008 — Xử lý blockchain reorganization

Nếu blockchain reorganization xảy ra trước khi Deposit được credit:

- Cập nhật lại trạng thái Deposit.
- Không cộng số dư.

Nếu Deposit đã credit nhưng transaction bị loại khỏi canonical chain:

- Tạo cảnh báo mức nghiêm trọng.
- Tạm khóa nghiệp vụ liên quan nếu cần.
- Thực hiện quy trình điều chỉnh riêng.
- Không xóa Ledger Entry cũ.

---

# 13. Quy tắc về Withdrawal

## BR-WITHDRAW-001 — Asset phải cho phép Withdrawal

Withdrawal chỉ được tạo khi:

```text
asset.withdrawalEnabled = true
```

---

## BR-WITHDRAW-002 — Địa chỉ nhận phải hợp lệ

Địa chỉ nhận phải:

- Đúng định dạng của blockchain.
- Không phải địa chỉ zero.
- Không thuộc danh sách cấm.
- Được chuẩn hóa trước khi lưu.

---

## BR-WITHDRAW-003 — Số lượng rút tối thiểu

Withdrawal Amount phải:

```text
withdrawalAmount >= minimumWithdrawal
```

Sau khi trừ phí:

```text
receivedAmount > 0
```

---

## BR-WITHDRAW-004 — User phải đủ số dư

Điều kiện:

```text
availableBalance >= withdrawalAmount
```

Việc kiểm tra và khóa số dư phải nằm trong cùng một database transaction.

---

## BR-WITHDRAW-005 — Withdrawal phải có Idempotency Key

Frontend phải gửi Idempotency Key khi tạo Withdrawal.

Cùng một User và Idempotency Key chỉ được tạo một Withdrawal.

---

## BR-WITHDRAW-006 — Trạng thái Withdrawal

Withdrawal có các trạng thái:

| Trạng thái | Ý nghĩa |
|---|---|
| `PENDING` | Đã tạo và chờ kiểm tra. |
| `REVIEWING` | Đang được Admin kiểm tra. |
| `APPROVED` | Đã được phê duyệt. |
| `PROCESSING` | Worker đang tạo transaction. |
| `BROADCASTED` | Transaction đã gửi lên blockchain. |
| `COMPLETED` | Transaction đã được xác nhận. |
| `REJECTED` | Bị Admin từ chối. |
| `FAILED` | Xử lý thất bại. |
| `CANCELLED` | Đã được hủy trước khi broadcast. |

---

## BR-WITHDRAW-007 — Chỉ Withdrawal được phê duyệt mới được gửi

Blockchain Worker chỉ xử lý Withdrawal có trạng thái:

```text
APPROVED
```

Worker phải khóa bản ghi Withdrawal trước khi tạo transaction.

---

## BR-WITHDRAW-008 — Không được phát transaction nhiều lần

Trước khi gửi blockchain transaction, Worker phải kiểm tra:

```text
txHash == null
```

Nếu Worker restart sau khi gửi transaction nhưng trước khi lưu txHash, hệ thống phải có cơ chế kiểm tra nonce hoặc transaction đã phát trước khi gửi lại.

---

## BR-WITHDRAW-009 — Hoàn số dư khi bị từ chối

Nếu Withdrawal bị từ chối trước khi broadcast:

```text
lockedBalance -= withdrawalAmount
availableBalance += withdrawalAmount
```

Phải tạo Ledger Entry hoàn tiền.

---

## BR-WITHDRAW-010 — Không hoàn tiền tự động sau khi đã broadcast

Khi Withdrawal đã có trạng thái `BROADCASTED`, hệ thống không được tự động mở khóa số dư chỉ vì chưa thấy confirmation.

Cần xác định trạng thái transaction trước.

---

## BR-WITHDRAW-011 — Hoàn tất Withdrawal

Khi transaction đạt đủ Confirmation:

```text
lockedBalance -= withdrawalAmount
```

Withdrawal chuyển thành:

```text
COMPLETED
```

Không trừ Available Balance lần nữa vì số dư đã được khóa khi tạo yêu cầu.

---

# 14. Quy tắc về Command và Event

## BR-EVENT-001 — Mỗi message phải có ID duy nhất

Mỗi Command và Event phải có:

```text
messageId
messageType
occurredAt
correlationId
payload
version
```

---

## BR-EVENT-002 — Event mô tả sự việc đã xảy ra

Tên Event phải sử dụng dạng quá khứ.

Ví dụ:

```text
OrderAccepted
OrderCancelled
TradeCreated
DepositCredited
WithdrawalCompleted
```

---

## BR-EVENT-003 — Command mô tả hành động cần thực hiện

Tên Command phải sử dụng động từ.

Ví dụ:

```text
PlaceOrder
CancelOrder
OpenMarket
SuspendMarket
```

---

## BR-EVENT-004 — Consumer phải idempotent

Consumer phải có khả năng nhận cùng một message nhiều lần nhưng chỉ tạo ra một kết quả nghiệp vụ.

Không được giả định message broker bảo đảm exactly-once delivery.

---

## BR-EVENT-005 — Chỉ ACK sau khi xử lý thành công

Consumer chỉ ACK message khi:

- Nghiệp vụ đã hoàn thành.
- Database transaction đã commit.
- Hoặc hệ thống xác định message đã được xử lý trước đó.

---

## BR-EVENT-006 — Message lỗi phải retry

Nếu xử lý thất bại:

1. Message không được ACK ngay.
2. Hệ thống ghi log.
3. Message được retry.
4. Nếu vượt giới hạn retry, message được chuyển đến DLQ.

---

## BR-EVENT-007 — Outbox Pattern

Khi một nghiệp vụ vừa cập nhật database vừa cần phát Event:

1. Dữ liệu nghiệp vụ và Outbox Event phải được lưu trong cùng transaction.
2. Outbox Worker gửi Event sau khi transaction commit.
3. Outbox Event chỉ được đánh dấu hoàn thành sau khi gửi thành công.

---

## BR-EVENT-008 — Version của message

Payload message phải có version để hỗ trợ thay đổi schema.

Ví dụ:

```text
eventType = TradeCreated
version = 1
```

Consumer không hỗ trợ version phải từ chối hoặc chuyển message sang DLQ rõ ràng.

---

# 15. Quy tắc về WebSocket

## BR-WS-001 — Public Channel

Guest và User có thể đăng ký nhận:

- Order Book Update.
- Recent Trade.
- Ticker Update.
- Candlestick Update.

---

## BR-WS-002 — Private Channel

Private Event chỉ được gửi đến User sở hữu dữ liệu.

Bao gồm:

- Order Updated.
- Balance Updated.
- Deposit Updated.
- Withdrawal Updated.

---

## BR-WS-003 — Xác thực WebSocket

Connection cần nhận Private Event phải cung cấp Access Token hợp lệ.

Khi token hết hạn, hệ thống có thể:

- Yêu cầu client xác thực lại.
- Hoặc ngắt Private Channel.

---

## BR-WS-004 — Chỉ phát dữ liệu đã commit

Backend chỉ được phát Private Event sau khi transaction nghiệp vụ đã commit thành công.

Không được phát trạng thái thành công trước khi database commit.

---

## BR-WS-005 — Client phải có khả năng đồng bộ lại

WebSocket không được xem là nguồn dữ liệu bền vững.

Sau khi mất kết nối, frontend phải:

1. Gọi REST API lấy snapshot mới.
2. Đăng ký lại WebSocket Room.
3. Tiếp tục nhận update.

---

# 16. Quy tắc về Admin và Audit Log

## BR-ADMIN-001 — Hành động Admin phải được xác thực quyền

Không phải mọi Admin đều mặc định có tất cả quyền nếu hệ thống mở rộng phân quyền sau này.

MVP có thể sử dụng một role `ADMIN`, nhưng code cần tách middleware hoặc guard kiểm tra quyền.

---

## BR-ADMIN-002 — Hành động quan trọng phải có lý do

Các hành động sau phải yêu cầu lý do:

- Khóa User.
- Mở khóa User.
- Từ chối Withdrawal.
- Tạm dừng Trading Pair.
- Điều chỉnh số dư.
- Hủy Order bằng quyền Admin.

---

## BR-ADMIN-003 — Audit Log là bất biến

Audit Log sau khi tạo không được chỉnh sửa hoặc xóa qua giao diện thông thường.

---

## BR-ADMIN-004 — Nội dung Audit Log

Audit Log phải chứa tối thiểu:

```text
adminId
action
targetType
targetId
reason
beforeData
afterData
ipAddress
createdAt
```

Không lưu dữ liệu nhạy cảm như:

- Mật khẩu.
- Refresh Token.
- Private Key.

---

## BR-ADMIN-005 — Admin không được tự khóa chính mình

Admin không được tự khóa hoặc vô hiệu hóa chính tài khoản đang thực hiện request.

---

# 17. Quy tắc về transaction và tính nhất quán

## BR-TX-001 — Các thao tác tài chính phải dùng transaction

Các nghiệp vụ sau bắt buộc dùng database transaction:

- Khóa số dư và tạo Order.
- Mở khóa số dư và hủy Order.
- Settlement Trade.
- Credit Deposit.
- Tạo Withdrawal và khóa số dư.
- Hoàn số dư Withdrawal.
- Hoàn số dư Order bị từ chối.

---

## BR-TX-002 — Không có trạng thái cập nhật một phần

Nếu transaction thất bại:

- Wallet không được thay đổi.
- Ledger Entry không được tạo một phần.
- Order không được cập nhật một phần.
- Trade không được lưu một phần.

---

## BR-TX-003 — Retry transaction phải an toàn

Khi transaction bị retry do deadlock hoặc serialization failure:

- Idempotency Key phải được giữ nguyên.
- Không tạo dữ liệu trùng.
- Không trừ số dư nhiều lần.

---

## BR-TX-004 — Unique Constraint là lớp bảo vệ bắt buộc

Các nghiệp vụ chống trùng không được chỉ dựa vào kiểm tra trong code.

Database cần có unique constraint cho các trường quan trọng như:

```text
User.email
Wallet(userId, assetId)
TradingPair(baseAssetId, quoteAssetId)
Deposit(chainId, txHash, logIndex)
Trade.tradeId
ProcessedEvent.eventId
Withdrawal(userId, idempotencyKey)
```

---

# 18. Quy tắc về dữ liệu và precision

## BR-DATA-001 — Giá trị lưu trong database

Các giá trị tài chính sử dụng kiểu:

```text
NUMERIC(precision, scale)
```

Precision và Scale cụ thể được xác định theo Asset và Trading Pair.

---

## BR-DATA-002 — Go Engine sử dụng fixed-point

Matching Engine nên chuyển Price và Quantity sang số nguyên fixed-point trước khi xử lý.

Ví dụ:

```text
Price 2,000.15 với scale 2
→ 200015
```

Engine không dùng `float64` cho matching.

---

## BR-DATA-003 — Không tự động làm tròn Order không hợp lệ

Nếu Price hoặc Quantity không tuân theo Tick Size hoặc Step Size, hệ thống phải từ chối Order.

Không tự động sửa Order của User bằng cách làm tròn.

---

## BR-DATA-004 — Quy tắc làm tròn chung

Đối với phí và phép chia có phần dư, hệ thống sử dụng:

```text
ROUND_DOWN
```

Các service phải dùng cùng một quy tắc để tránh sai lệch.

---

# 19. Quy tắc về bảo mật và vận hành

## BR-SEC-001 — Không lưu Private Key trong source code

Private Key phải được lưu trong:

- Environment secret.
- Secret manager.
- Hoặc công cụ quản lý bí mật phù hợp.

Không được commit Private Key lên Git.

---

## BR-SEC-002 — Rate Limiting

Các API sau phải có rate limit:

- Login.
- Refresh Token.
- Place Order.
- Cancel Order.
- Create Withdrawal.

---

## BR-SEC-003 — Validate dữ liệu ở Backend

Frontend validation chỉ phục vụ trải nghiệm người dùng.

Backend phải validate lại toàn bộ:

- Price.
- Quantity.
- Address.
- Asset.
- Trading Pair.
- Quyền truy cập.
- Trạng thái tài khoản.
- Trạng thái thị trường.

---

## BR-SEC-004 — Không tin dữ liệu từ Blockchain Event tuyệt đối

Blockchain Listener phải kiểm tra:

- Chain ID.
- Contract Address.
- Event Signature.
- Token Address.
- Amount.
- Block Number.
- Transaction Status.
- Confirmation.

---

## BR-SEC-005 — Logging không chứa dữ liệu nhạy cảm

Log không được chứa:

- Mật khẩu.
- Access Token.
- Refresh Token.
- Private Key.
- Seed Phrase.
- Toàn bộ thông tin bảo mật của User.

---

# 20. Bảng tổng hợp quy tắc quan trọng

| Mã | Quy tắc |
|---|---|
| `BR-WALLET-003` | Available Balance và Locked Balance không được âm. |
| `BR-WALLET-005` | Mọi thay đổi số dư phải có Ledger Entry. |
| `BR-ORDER-005` | Original Quantity bằng Filled Quantity cộng Remaining Quantity. |
| `BR-ORDER-010` | Order phải có Sequence duy nhất theo Trading Pair. |
| `BR-ENGINE-003` | Engine sử dụng Price-Time Priority. |
| `BR-ENGINE-006` | Buy và Sell khớp khi Buy Price lớn hơn hoặc bằng Sell Price. |
| `BR-ENGINE-007` | Execution Price lấy theo Maker Order. |
| `BR-TRADE-004` | Settlement phải atomic. |
| `BR-TRADE-005` | Mỗi Trade chỉ được settlement một lần. |
| `BR-DEPOSIT-004` | Deposit duy nhất theo chainId, txHash và logIndex. |
| `BR-WITHDRAW-005` | Withdrawal phải có Idempotency Key. |
| `BR-EVENT-004` | Mọi Consumer phải idempotent. |
| `BR-EVENT-007` | Sử dụng Outbox Pattern khi phát Event sau transaction. |
| `BR-WS-004` | Chỉ phát WebSocket Event sau khi database commit. |
| `BR-DATA-002` | Go Engine không sử dụng float64 cho giá và khối lượng. |

---

# 21. Quy ước áp dụng Business Rule

1. Mỗi API và scenario phải tham chiếu đến các Business Rule liên quan.
2. Mỗi Business Rule quan trọng phải có test case.
3. Không thay đổi Business Rule tài chính mà không cập nhật tài liệu.
4. Khi một Business Rule thay đổi, cần kiểm tra ảnh hưởng đến:
   - Database.
   - API.
   - Matching Engine.
   - Event schema.
   - Frontend.
   - Test case.
5. Database constraint phải được sử dụng cho các quy tắc có thể bảo vệ ở tầng dữ liệu.
6. Business Rule liên quan đến số dư phải được thực hiện ở Backend, không chỉ ở Frontend.
7. Matching Engine chỉ áp dụng các rule về Order Book và matching.
8. Backend chịu trách nhiệm cuối cùng về Wallet, Ledger và Settlement.
