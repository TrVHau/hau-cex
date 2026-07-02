# Hau CEX — MVP Scope

## 1. Mục đích tài liệu

Tài liệu này xác định phạm vi của phiên bản MVP cho dự án Hau CEX.

MVP tập trung xây dựng một hệ thống mô phỏng sàn giao dịch tài sản số tập trung, cho phép người dùng quản lý tài sản, nạp/rút token test, đặt lệnh mua bán và theo dõi dữ liệu thị trường theo thời gian thực.

Tài liệu giúp:

- Xác định các chức năng phải hoàn thành.
- Giới hạn phạm vi dự án.
- Tránh bổ sung các chức năng không cần thiết trong giai đoạn đầu.
- Làm cơ sở để thiết kế use case, database, API và kiến trúc hệ thống.

---

## 2. Mục tiêu MVP

Phiên bản MVP cần chứng minh được các khả năng chính sau:

1. Xây dựng hệ thống full stack gồm frontend, backend, matching engine, database và blockchain.
2. Xử lý giao dịch Spot bằng Limit Order.
3. Xây dựng matching engine bằng Go.
4. Áp dụng quy tắc khớp lệnh Price-Time Priority.
5. Quản lý Available Balance và Locked Balance.
6. Ghi nhận mọi thay đổi số dư thông qua Ledger.
7. Cập nhật Order Book, Recent Trades đã settlement và Balance theo thời gian thực.
8. Theo dõi nạp/rút token test trên blockchain.
9. Hỗ trợ chart mặc định từ Binance Reference để học/demo frontend và chart tùy chọn từ Hau CEX Market.
10. Đóng gói và triển khai hệ thống bằng Docker.

---

## 3. Đối tượng sử dụng

MVP có ba nhóm người dùng chính:

| Actor | Mô tả                                                                                 |
| ----- | ------------------------------------------------------------------------------------- |
| Guest | Người chưa đăng nhập, được phép xem dữ liệu thị trường công khai.                     |
| User  | Người dùng đã đăng ký và đăng nhập, được phép quản lý tài sản và thực hiện giao dịch. |
| Admin | Người quản trị hệ thống, quản lý user, asset, trading pair và các hoạt động nạp/rút.  |

---

## 4. Phạm vi chức năng

### 4.1. Authentication

MVP hỗ trợ:

- Đăng ký tài khoản.
- Đăng nhập.
- Đăng xuất.
- Quên mật khẩu.
- Thay đổi mật khẩu.
- Thay đổi thông tin cá nhân.
- Access Token.
- Refresh Token.
- Hash mật khẩu.
- Phân quyền User và Admin.
- Khóa tài khoản người dùng.

MVP chưa hỗ trợ:

- Đăng nhập bằng Google.
- Đăng nhập bằng ví blockchain.
- KYC thật.
- Xác minh danh tính bằng giấy tờ.

---

### 4.2. Quản lý người dùng

User có thể:

- Xem thông tin tài khoản.
- Cập nhật một số thông tin cá nhân cơ bản.
- Xem trạng thái tài khoản.
- Xem lịch sử đăng nhập cơ bản.

Admin có thể:

- Xem danh sách người dùng.
- Xem chi tiết người dùng.
- Khóa tài khoản.
- Mở khóa tài khoản.
- Xem hoạt động giao dịch của người dùng.

---

### 4.3. Quản lý tài sản

Hệ thống hỗ trợ các token test như:

- ETH test.
- USDT test.
- HAU token.

Mỗi Asset có các thông tin:

- Mã tài sản.
- Tên tài sản.
- Link hình ảnh.
- Địa chỉ contract.
- Số chữ số thập phân.
- Trạng thái nạp.
- Trạng thái rút.
- Trạng thái giao dịch.

Admin có thể:

- Thêm Asset.
- Cập nhật Asset.
- Bật hoặc tắt nạp tài sản.
- Bật hoặc tắt rút tài sản.
- Bật hoặc tắt giao dịch tài sản.

MVP chưa hỗ trợ:

- Tự động niêm yết token.
- Multi-chain cho cùng một Asset.
- Bridge tài sản giữa các blockchain.

---

### 4.4. Ví và số dư

Mỗi User có một Wallet nội bộ cho từng Asset.

Wallet bao gồm:

- Available Balance.
- Locked Balance.
- Total Balance.

Hệ thống phải hỗ trợ:

- Khóa số dư khi đặt lệnh.
- Mở khóa số dư khi hủy lệnh.
- Trừ số dư bị khóa khi lệnh được khớp.
- Cộng tài sản nhận được sau giao dịch.
- Khóa số dư khi tạo yêu cầu rút.
- Hoàn số dư nếu yêu cầu rút thất bại hoặc bị từ chối.
- Ghi lại mọi biến động số dư trong Ledger.

MVP không cho phép User tự chỉnh sửa số dư.

---

### 4.5. Ledger

Ledger phải ghi nhận các biến động liên quan đến:

- Deposit.
- Withdrawal.
- Lock balance.
- Unlock balance.
- Trade settlement.
- Trading fee.
- Admin adjustment nếu được cho phép.

Mỗi Ledger Entry cần có:

- User.
- Asset.
- Số lượng thay đổi.
- Loại số dư.
- Loại nghiệp vụ.
- Đối tượng tham chiếu.
- Thời điểm tạo.

Ledger không được sửa hoặc xóa thông qua chức năng thông thường.

---

### 4.6. Trading Pair

MVP hỗ trợ giao dịch Spot.

Các cặp giao dịch dự kiến:

```text
ETH/USDT
HAU/USDT
```

Mỗi Trading Pair có:

- Base Asset.
- Quote Asset.
- Price Precision.
- Quantity Precision.
- Tick Size.
- Step Size.
- Minimum Quantity.
- Minimum Notional.
- Trạng thái hoạt động.

Admin có thể:

- Tạo Trading Pair.
- Cập nhật cấu hình Trading Pair.
- Mở thị trường.
- Tạm dừng thị trường.

### 4.7. Order

MVP chỉ hỗ trợ:

```
Limit Order
```

User có thể:

- Đặt lệnh mua.
- Đặt lệnh bán.
- Xem lệnh đang mở.
- Xem lịch sử lệnh.
- Hủy lệnh đang mở.

Khi đặt lệnh mua, hệ thống khóa Quote Asset:

```
lockedAmount = price × quantity
```

Khi đặt lệnh bán, hệ thống khóa Base Asset:

```
lockedAmount = quantity
```

Hệ thống phải kiểm tra:

- User đã đăng nhập.
- Tài khoản không bị khóa.
- Trading Pair đang hoạt động.
- Giá hợp lệ.
- Khối lượng hợp lệ.
- Giá tuân thủ Tick Size.
- Khối lượng tuân thủ Step Size.
- Order đạt Minimum Quantity.
- Order đạt Minimum Notional.
- User có đủ Available Balance.

### 4.8 Trạng thái lệnh

MVP sử dụng các trạng thái sau:

| Trạng thái         | Ý nghĩa                                                     |
| ------------------ | ----------------------------------------------------------- |
| `PENDING`          | Order đã được tạo nhưng chưa được matching engine xác nhận. |
| `OPEN`             | Order đang nằm trong Order Book.                            |
| `PARTIALLY_FILLED` | Order đã khớp một phần.                                     |
| `FILLED`           | Order đã khớp toàn bộ.                                      |
| `CANCEL_PENDING`   | Yêu cầu hủy đang chờ xử lý.                                 |
| `CANCELLED`        | Order đã được hủy.                                          |
| `REJECTED`         | Order bị từ chối.                                           |

Không được hủy Order có trạng thái:

- PENDING
- FILLED
- CANCELLED
- REJECTED

### 4.9. Matching Engine

Matching Engine được viết bằng Go.

Engine chịu trách nhiệm:

- Nhận lệnh mới.
- Nhận yêu cầu hủy lệnh.
- Quản lý Order Book.
- Quản lý Bid Side.
- Quản lý Ask Side.
- Khớp lệnh.
- Khớp một phần.
- Khớp toàn phần.
- Sinh `TradeCreated` khi khớp lệnh.
- Phát sự kiện cập nhật Order.
- Phát sự kiện cập nhật Order Book.
- Tạo snapshot.
- Khôi phục Order Book khi khởi động lại.

Engine sử dụng quy tắc:

```
Price-Time Priority
```

Quy tắc ưu tiên:

1. Giá tốt hơn được ưu tiên trước.
2. Nếu cùng giá, Order có Sequence nhỏ hơn được ưu tiên trước.

Đối với Buy Order:

- Giá cao hơn được ưu tiên.

Đối với Sell Order:

- Giá thấp hơn được ưu tiên.

### 4.10. Giao dịch đã khớp

Khi hai Order được khớp, Matching Engine phát `TradeCreated`.

`TradeCreated` chưa được xem là Trade công khai của Hau CEX cho đến khi Trade Settlement Consumer
xử lý thành công và transaction PostgreSQL đã commit.

Payload TradeCreated hoặc Trade sau settlement bao gồm:

- Trading Pair.
- Buy Order.
- Sell Order.
- Buyer.
- Seller.
- Execution Price.
- Executed Quantity.
- Buyer Fee.
- Seller Fee.
- Maker Order.
- Taker Order.
- Thời điểm giao dịch.
- Sequence.

Sau khi `TradeCreated` được settlement thành công, hệ thống phải:

1. Cập nhật Filled Quantity của hai Order.
2. Cập nhật Remaining Quantity.
3. Cập nhật trạng thái Order.
4. Trừ Locked Balance.
5. Cộng tài sản nhận được.
6. Thu Trading Fee.
7. Ghi Ledger Entry.
8. Gửi sự kiện realtime sau khi transaction commit.

`TradeCreated` chưa settlement không được dùng để cập nhật Recent Trades, Last Price hoặc Hau Chart.

### 4.11. Phí giao dịch

sử dụng tỉ lệ cố định

```
Maker Fee: 0.10%
Taker Fee: 0.15%
```

Phí giao dịch có thể được cấu hình bởi admin

Trong MVP, phí giao dịch được ghi nhận vào Treasury Wallet:

- Buyer Fee vào Treasury Wallet của Base Asset.
- Seller Fee vào Treasury Wallet của Quote Asset.
- Mỗi khoản phí có Ledger Entry phía User và Treasury.

MVP chưa hỗ trợ:

- VIP Level.
- Giảm phí theo khối lượng giao dịch.
- Giảm phí bằng HAU Token.
- Referral commission.

### 4.12. Order Book

Hệ thống hiển thị:

- Best Bid.
- Best Ask.
- Danh sách mức giá mua.
- Danh sách mức giá bán.
- Tổng khối lượng tại mỗi mức giá.

Order Book công khai chỉ hiển thị dữ liệu đã tổng hợp theo Price Level.

Không hiển thị:

- User sở hữu Order.
- Order ID riêng tư.
- Thông tin tài khoản.

### 4.13. Dữ liệu thị trường

MVP hỗ trợ Market Data nội bộ của Hau CEX:

- Last Price nội bộ.
- Best Bid.
- Best Ask.
- High Price.
- Low Price.
- Trading Volume.
- Recent Trades đã settlement.
- Candlestick nội bộ của Hau CEX.

Order Book luôn lấy từ Order Book runtime của Hau CEX Matching Engine.
Recent Trades và Last Price nội bộ luôn lấy từ Trade đã settlement trên Hau CEX.
High Price, Low Price và Trading Volume nội bộ cũng chỉ được tính từ Trade đã settlement.

MVP hỗ trợ hai nguồn Candlestick:

| Nguồn     | Ý nghĩa                                                                                      |
| --------- | -------------------------------------------------------------------------------------------- |
| `BINANCE` | Dữ liệu thị trường tham chiếu bên ngoài, dùng làm nguồn chart mặc định để học/demo frontend. |
| `HAU`     | Dữ liệu được tổng hợp từ Trade đã settlement trên Hau CEX.                                   |

Frontend có thể lưu lựa chọn Chart Source gần nhất của User.
Tuy nhiên, việc đổi Chart Source không được làm thay đổi:

- Order Book.
- Recent Trades.
- Last Price nội bộ.
- Order destination.
- Nơi xử lý Place Order và Cancel Order.

Frontend phải hiển thị rõ nguồn biểu đồ hiện tại, ví dụ:

```text
BTC/USDT · Binance Reference
BTC/USDT · Hau CEX Market
```

Không được hiển thị dữ liệu Binance dưới nhãn Hau CEX hoặc dữ liệu Hau CEX dưới nhãn Binance.

Dữ liệu Binance không được dùng để khớp Order, xác định Execution Price, settlement Trade,
cập nhật Wallet, ghi Ledger, tạo Recent Trades hoặc tạo Order Book của Hau CEX.

Trong MVP, mục đích chính của nguồn `BINANCE` là giúp frontend có dữ liệu chart đủ đẹp và liên tục
để học cách xây dựng trải nghiệm giao dịch giống sàn thật.

Các khung thời gian dự kiến:

- 1m
- 5m
- 15m
- 1h
- 4h
- 1d

Dữ liệu Candlestick bao gồm:

- Open.
- High.
- Low.
- Close.
- Volume.
- Open Time.
- Close Time.

### 4.14. Realtime

Frontend nhận dữ liệu realtime qua WebSocket.

Các loại dữ liệu công khai:

- Order Book Update.
- Recent Trade đã settlement.
- Ticker Update.
- Candlestick Update theo đúng Chart Source.

Các loại dữ liệu riêng tư:

- Order Updated.
- Balance Updated.
- Deposit Updated.
- Withdrawal Updated.

User chỉ được nhận các event riêng tư thuộc tài khoản của mình.

### 4.15. Nạp tài sản

MVP hỗ trợ nạp token test trên một blockchain EVM testnet.

Luồng nạp:

- User kết nối ví blockchain.
- User gửi token đến Exchange Vault.
- Smart contract phát event Deposit.
- Blockchain Listener phát hiện event.
- Hệ thống lưu Deposit.
- Hệ thống chờ đủ số Confirmation.
- Hệ thống cộng Available Balance.
- Hệ thống tạo Ledger Entry.
- Frontend nhận thông báo realtime.

Hệ thống phải chống ghi nhận trùng bằng:

```
chainId + txHash + logIndex
```

MVP chưa hỗ trợ:

- Nạp native coin vào địa chỉ riêng cho từng User.
- Nhiều blockchain.
- Nhiều Deposit Address cho mỗi User.
- Cross-chain deposit.

### 4.16. Rút tài sản

Luồng rút:

- User nhập Asset, số lượng và địa chỉ nhận.
- Backend kiểm tra Available Balance.
- Backend khóa số dư.
- Hệ thống tạo Withdrawal.
- Admin hoặc hệ thống chấp nhận yêu cầu.
- Blockchain Worker gửi transaction.
- Hệ thống lưu Transaction Hash.
- Hệ thống theo dõi Confirmation.
- Khi thành công, hệ thống trừ Locked Balance.
- Hệ thống tạo Ledger Entry.
- Frontend nhận thông báo realtime.

MVP có thể sử dụng bước Admin phê duyệt để giảm rủi ro.

MVP chưa hỗ trợ:

- Rút tự động theo Risk Score.
- Withdrawal batch.
- Multi-signature workflow đầy đủ.
- Address whitelist nâng cao.
- Travel Rule.

### 4.17. Smart Contract

MVP có các contract sau:

```
MockERC20.sol
ExchangeVault.sol
```

MockERC20 dùng để:

- Tạo token test.
- Mint token phục vụ demo.
- Kiểm thử nạp và rút.

ExchangeVault dùng để:

- Nhận token từ User.
- Phát event Deposit.
- Cho phép Operator thực hiện Withdrawal.
- Quản lý danh sách token được hỗ trợ.
- Pause hoặc Unpause.
- Phân quyền Admin và Operator.

MVP không thực hiện matching on-chain.

### 4.18. Admin

Admin có thể:

- Xem danh sách User.
- Khóa hoặc mở khóa User.
- Quản lý Asset.
- Quản lý Trading Pair.
- Bật hoặc tắt market.
- Bật hoặc tắt deposit.
- Bật hoặc tắt withdrawal.
- Xem danh sách Deposit.
- Xem danh sách Withdrawal.
- Phê duyệt hoặc từ chối Withdrawal.
- Xem Audit Log.
- Xem trạng thái hệ thống.

MVP chưa xây dựng hệ thống phân quyền Admin nhiều cấp.

### 4.19. Audit Log

Hệ thống ghi lại các hành động quan trọng như:

- Admin khóa User.
- Admin mở khóa User.
- Admin thay đổi Asset.
- Admin thay đổi Trading Pair.
- Admin phê duyệt Withdrawal.
- Admin từ chối Withdrawal.
- Admin pause market.
- Điều chỉnh số dư thủ công nếu có.

Audit Log không được chỉnh sửa thông qua giao diện thông thường.

## 5. Phạm vi giao diện

### 5.1. Trang công khai

- Trang đăng nhập.
- Trang đăng ký.
- Danh sách thị trường.
- Trang giao dịch.
- Chart có lựa chọn nguồn và nhãn nguồn dữ liệu.
- Order Book.
- Recent Trades.

### 5.2. Trang người dùng

- Dashboard.
- Danh sách số dư.
- Trang nạp tài sản.
- Trang rút tài sản.
- Open Orders.
- Order History.
- Trade History.
- Deposit History.
- Withdrawal History.
- Thông tin tài khoản.

### 5.3. Trang Admin

- Dashboard Admin.
- Quản lý User.
- Quản lý Asset.
- Quản lý Trading Pair.
- Quản lý Deposit.
- Quản lý Withdrawal.
- Audit Log.

## 6. Phạm vi kỹ thuật

### 6.1. Frontend

- React
- TypeScript
- Vite
- TanStack Query
- Zustand
- Socket.IO Client
- TradingView Lightweight Charts

### 6.2. Backend API

- NestJS
- TypeScript
- REST API
- Swagger
- Socket.IO
- Prisma

### 6.3. Matching Engine

- Go
- In-memory Order Book
- Goroutine theo Trading Pair
- Redis Streams

### 6.4. Dữ liệu

- PostgreSQL
- Redis

### 6.5. Blockchain

- Solidity
- OpenZeppelin
- Hardhat
- EVM Testnet
- viem

### 6.6. Infrastructure

- Docker
- Docker Compose
- GitHub Actions

## 7. Yêu cầu phi chức năng

### 7.1. Tính đúng đắn

- Không cho phép số dư âm.
- Không ghi nhận một Deposit hai lần.
- Không settlement một Trade hai lần.
- Không hủy một Order nhiều lần.
- Không xử lý một Engine Event nhiều lần.
- Không công bố `TradeCreated` chưa settlement vào Recent Trades hoặc Hau Chart.
- Không dùng dữ liệu Binance cho matching, settlement, Wallet hoặc Ledger.
- Không hiển thị sai nhãn nguồn biểu đồ.
- Tổng biến động Ledger phải giải thích được Wallet Balance.

### 7.2. Tính nhất quán

Các thao tác sau phải được xử lý trong database transaction:

- Khóa số dư và tạo Order.
- Settlement Trade.
- Hủy Order và mở khóa số dư.
- Khóa số dư và tạo Withdrawal.
- Ghi nhận Deposit và cộng số dư.

### 7.3. Hiệu năng

MVP không đặt mục tiêu hiệu năng tương đương sàn thực tế.

Mục tiêu ban đầu:

- Engine xử lý tối thiểu 1.000 Order/giây trong kiểm thử local.
- REST API thông thường phản hồi dưới 500 ms trong môi trường local.
- Dữ liệu WebSocket được cập nhật trong thời gian gần realtime.
- Mỗi Trading Pair được xử lý tuần tự để giữ đúng thứ tự.

Các giá trị trên là mục tiêu kỹ thuật, không phải cam kết production.

### 7.4. Bảo mật

- Mật khẩu phải được hash.
- API riêng tư yêu cầu authentication.
- API Admin yêu cầu role Admin.
- Validate toàn bộ request.
- Áp dụng rate limiting cho login và order.
- Không lưu private key trực tiếp trong source code.
- Không commit file .env.
- Contract có cơ chế pause.
- Withdrawal yêu cầu xác nhận rõ ràng.

### 7.5. Khả năng truy vết

Mỗi request hoặc event quan trọng cần có:

- Request ID.
- Correlation ID.
- User ID nếu có.
- Order ID nếu có.
- Trade ID nếu có.
- Transaction Hash nếu có.

### 7.6. Khả năng phục hồi

- Engine có thể khôi phục Open Order sau khi restart.
- Message xử lý lỗi có thể retry.
- Event phải hỗ trợ idempotency.
- Có Dead-letter Queue hoặc cơ chế lưu message lỗi.
- Có health-check cho các service.

## 8. Ngoài phạm vi MVP

Các chức năng sau không thuộc MVP:

### 8.1. Sản phẩm giao dịch

- Market Order.
- Stop Limit.
- Stop Market.
- OCO Order.
- Margin.
- Futures.
- Options.
- P2P.
- Copy Trading.
- Trading Bot.
- OTC.

### 8.2. Tài chính

- Fiat Deposit.
- Fiat Withdrawal.
- Credit Card Payment.
- Lending.
- Borrowing.
- Staking.
- Earn.
- Launchpad.

### 8.3. Người dùng

- KYC thật.
- AML thật.
- Social Login.
- Referral.
- Affiliate.
- VIP Level.
- Sub-account.

### 8.4. Blockchain

- Multi-chain.
- Cross-chain bridge.
- Bitcoin network.
- Solana network.
- Layer 2 aggregation.
- Custodial address riêng cho từng User.
- Hardware Security Module.

### 8.5. Hạ tầng

- Kafka.
- Kubernetes.
- Multi-region deployment.
- Auto-scaling production.
- Disaster recovery đa vùng.
- High-frequency trading infrastructure.

## 9. Giả định và giới hạn

MVP được xây dựng với các giả định:

1. Hệ thống chỉ phục vụ mục đích học tập và demo.
2. Tài sản sử dụng là token test, không có giá trị thật.
3. Hệ thống chạy trên testnet.
4. Số lượng User đồng thời không lớn.
5. Số lượng Trading Pair ban đầu nhỏ.
6. Một Matching Engine instance có thể quản lý các Trading Pair trong MVP.
7. Admin được xem là người vận hành tin cậy.
8. Hệ thống chưa đáp ứng yêu cầu pháp lý của một sàn giao dịch thật.
9. Private key chỉ được sử dụng trong môi trường demo.
10. Không triển khai bằng tiền thật.

## 10. Tiêu chí hoàn thành MVP

MVP được xem là hoàn thành khi đáp ứng được luồng sau:

### 10.1. Luồng giao dịch

- Hai User đăng ký và đăng nhập.
- Hai User có số dư token test.
- User A đặt Sell Order.
- User B đặt Buy Order có giá phù hợp.
- Go Matching Engine khớp hai Order.
- Matching Engine phát `TradeCreated`.
- Trade Settlement Consumer settlement thành công.
- Hệ thống cập nhật trạng thái Order, Wallet và Ledger trong transaction.
- Frontend hiển thị Trade đã settlement mới sau khi transaction commit.
- Order Book được cập nhật realtime.
- Chart mặc định hiển thị Binance Reference để demo frontend nhưng Order Book và Recent Trades vẫn thuộc Hau CEX.

### 10.2. Luồng hủy lệnh

- User đặt Limit Order chưa được khớp.
- Số dư tương ứng bị khóa.
- User gửi yêu cầu hủy.
- Engine loại Order khỏi Order Book.
- Backend mở khóa phần số dư còn lại.
- Trạng thái Order chuyển thành CANCELLED.

### 10.3. Luồng nạp tài sản

- User gửi token test vào Exchange Vault.
- Listener phát hiện event.
- Deposit được lưu.
- Deposit đủ Confirmation.
- Wallet được cộng số dư.
- Ledger Entry được tạo.

### 10.4. Luồng rút tài sản

- User tạo yêu cầu rút.
- Số dư bị khóa.
- Admin phê duyệt.
- Blockchain Worker gửi transaction.
- Transaction được xác nhận.
- Withdrawal chuyển thành COMPLETED.
- Ledger Entry được tạo.

### 11. Phạm vi theo độ ưu tiên

#### Must Have

- Authentication.
- Wallet.
- Ledger.
- Asset.
- Trading Pair.
- Limit Order.
- Cancel Order.
- Go Matching Engine.
- Partial Fill.
- Full Fill.
- Trade Settlement.
- Order Book.
- Recent Trades.
- WebSocket.
- Deposit token test.
- Withdrawal token test.
- Admin cơ bản.
- Docker Compose.

#### Should Have

- Candlestick Chart.
- Chart Source mặc định Binance Reference phục vụ demo frontend và tùy chọn Hau CEX Market.
- Maker/Taker Fee.
- Engine Snapshot.
- Engine Recovery.
- Audit Log.
- Withdrawal Approval.
- Redis Streams retry.
- Health Check.
- Metrics cơ bản.

#### Could Have

- ERC-2612 Permit.
- TOTP 2FA.
- Address Whitelist.
- Dark Mode.
- Prometheus và Grafana.
- HAU Token giảm phí.
- Nhiều Matching Engine instance.

#### Won't Have trong MVP

- Futures.
- Margin.
- Market Order.
- P2P.
- Fiat.
- KYC thật.
- Multi-chain.
- Kubernetes.
- Kafka.
