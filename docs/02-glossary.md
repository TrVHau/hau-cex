# Hau CEX Glossary

## 1. Mục đích

Tài liệu này định nghĩa các thuật ngữ được sử dụng trong dự án Hau CEX.
Mục tiêu là bảo đảm frontend, backend, matching engine, smart contract
và tài liệu nghiệp vụ sử dụng thuật ngữ thống nhất.

## 2. Thuật ngữ chung

| STT | Thuật ngữ      | Tên trong hệ thống   | Định nghĩa                                                                                                  |
| --: | -------------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
|   1 | CEX            | Centralized Exchange | Sàn giao dịch tập trung, trong đó hệ thống trung tâm quản lý tài khoản, số dư, lệnh và quá trình khớp lệnh. |
|   2 | Tài sản        | Asset                | Loại tài sản được hỗ trợ trong hệ thống, ví dụ BTC, ETH, USDT hoặc token test.                              |
|   3 | Đồng cơ sở     | Base Asset           | Tài sản được mua hoặc bán trong một cặp giao dịch. Ví dụ BTC trong cặp BTC/USDT.                            |
|   4 | Đồng định giá  | Quote Asset          | Tài sản dùng để định giá Base Asset. Ví dụ USDT trong cặp BTC/USDT.                                         |
|   5 | Cặp giao dịch  | Trading Pair         | Cặp gồm Base Asset và Quote Asset, ví dụ BTC/USDT.                                                          |
|   6 | Thị trường     | Market               | Không gian giao dịch của một Trading Pair.                                                                  |
|   7 | Giao dịch Spot | Spot Trading         | Hình thức mua bán tài sản với việc cập nhật quyền sở hữu và số dư ngay sau khi giao dịch được quyết toán.   |
|   8 | Người dùng     | User                 | Người có tài khoản và được phép sử dụng các chức năng giao dịch của hệ thống.                               |
|   9 | Quản trị viên  | Admin                | Người quản lý tài sản, cặp giao dịch, tài khoản và cấu hình hệ thống.                                       |
|  10 | Khách          | Guest                | Người chưa đăng nhập, chỉ được xem thông tin thị trường công khai.                                          |

## 3. Thuật ngữ về ví và số dư

| STT | Thuật ngữ      | Tên trong hệ thống | Định nghĩa                                                                                     |
| --: | -------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
|   1 | Ví nội bộ      | Wallet             | Bản ghi thể hiện số dư của một User đối với một Asset trong hệ thống.                          |
|   2 | Số dư khả dụng | Available Balance  | Số tài sản người dùng có thể sử dụng để đặt lệnh hoặc rút.                                     |
|   3 | Số dư bị khóa  | Locked Balance     | Số tài sản đang được giữ để phục vụ lệnh đang mở hoặc yêu cầu rút đang xử lý.                  |
|   4 | Tổng số dư     | Total Balance      | Tổng của Available Balance và Locked Balance.                                                  |
|   5 | Sổ cái         | Ledger             | Hệ thống ghi lại toàn bộ biến động số dư của người dùng.                                       |
|   6 | Bút toán       | Ledger Entry       | Một bản ghi thay đổi số dư, bao gồm tài sản, số lượng, loại biến động và đối tượng tham chiếu. |
|   7 | Khóa số dư     | Balance Lock       | Thao tác chuyển một lượng tài sản từ Available Balance sang Locked Balance.                    |
|   8 | Mở khóa số dư  | Balance Unlock     | Thao tác chuyển tài sản từ Locked Balance trở lại Available Balance.                           |
|   9 | Quyết toán     | Settlement         | Quá trình cập nhật số dư, ledger, order và trade sau khi lệnh được khớp.                       |
|  10 | Đối soát       | Reconciliation     | Quá trình kiểm tra tính nhất quán giữa wallet, ledger, order, trade và dữ liệu blockchain.     |

## 4. Thuật ngữ về lệnh

| STT | Thuật ngữ          | Tên trong hệ thống | Định nghĩa                                                             |
| --: | ------------------ | ------------------ | ---------------------------------------------------------------------- |
|   1 | Lệnh               | Order              | Yêu cầu mua hoặc bán một Asset trong một Trading Pair.                 |
|   2 | Lệnh mua           | Buy Order          | Lệnh mua Base Asset bằng Quote Asset.                                  |
|   3 | Lệnh bán           | Sell Order         | Lệnh bán Base Asset để nhận Quote Asset.                               |
|   4 | Lệnh giới hạn      | Limit Order        | Lệnh mua hoặc bán tại một mức giá xác định hoặc tốt hơn.               |
|   5 | Giá lệnh           | Order Price        | Mức giá do người dùng nhập cho một Limit Order.                        |
|   6 | Khối lượng lệnh    | Order Quantity     | Tổng số Base Asset mà người dùng muốn mua hoặc bán.                    |
|   7 | Khối lượng đã khớp | Filled Quantity    | Phần khối lượng của Order đã được giao dịch thành công.                |
|   8 | Khối lượng còn lại | Remaining Quantity | Phần khối lượng chưa được khớp của Order.                              |
|   9 | Lệnh đang mở       | Open Order         | Order còn khối lượng chưa khớp và vẫn đang nằm trong Order Book.       |
|  10 | Hủy lệnh           | Cancel Order       | Thao tác loại Order khỏi Order Book và hoàn lại số dư còn bị khóa.     |
|  11 | Khớp toàn phần     | Full Fill          | Order được khớp hết toàn bộ khối lượng.                                |
|  12 | Khớp một phần      | Partial Fill       | Order chỉ được khớp một phần và vẫn còn Remaining Quantity.            |
|  13 | Maker              | Maker Order        | Order được đưa vào Order Book và tạo thanh khoản trước khi được khớp.  |
|  14 | Taker              | Taker Order        | Order mới đi vào và khớp ngay với Order đang tồn tại trong Order Book. |
|  15 | Thứ tự lệnh        | Sequence           | Giá trị tăng dần dùng để xác định thứ tự tiếp nhận Order.              |

## 5. Trạng thái lệnh

| Trạng thái    | Tên trong code     | Định nghĩa                                                              |
| ------------- | ------------------ | ----------------------------------------------------------------------- |
| Chờ xử lý     | `PENDING`          | Order đã được tạo tại backend nhưng chưa được matching engine xác nhận. |
| Đang mở       | `OPEN`             | Order đã được engine chấp nhận và đang nằm trong Order Book.            |
| Khớp một phần | `PARTIALLY_FILLED` | Order đã được khớp một phần nhưng vẫn còn khối lượng.                   |
| Đã khớp       | `FILLED`           | Order đã được khớp toàn bộ.                                             |
| Đã hủy        | `CANCELLED`        | Order đã được hủy thành công.                                           |
| Bị từ chối    | `REJECTED`         | Order không được engine hoặc backend chấp nhận.                         |
| Đang hủy      | `CANCEL_PENDING`   | Yêu cầu hủy đã được gửi nhưng chưa được engine xử lý xong.              |

## 6. Thuật ngữ về matching engine

| STT | Thuật ngữ             | Tên trong hệ thống  | Định nghĩa                                                                      |
| --: | --------------------- | ------------------- | ------------------------------------------------------------------------------- |
|   1 | Matching Engine       | Matching Engine     | Service viết bằng Go, chịu trách nhiệm quản lý Order Book và khớp lệnh.         |
|   2 | Sổ lệnh               | Order Book          | Tập hợp các Buy Order và Sell Order đang mở của một Trading Pair.               |
|   3 | Bên mua               | Bid Side            | Phần chứa các Buy Order trong Order Book.                                       |
|   4 | Bên bán               | Ask Side            | Phần chứa các Sell Order trong Order Book.                                      |
|   5 | Giá mua tốt nhất      | Best Bid            | Mức giá cao nhất trong các Buy Order đang mở.                                   |
|   6 | Giá bán tốt nhất      | Best Ask            | Mức giá thấp nhất trong các Sell Order đang mở.                                 |
|   7 | Mức giá               | Price Level         | Nhóm các Order có cùng giá trong Order Book.                                    |
|   8 | Ưu tiên giá-thời gian | Price-Time Priority | Quy tắc ưu tiên giá tốt hơn; nếu cùng giá thì Order vào trước được xử lý trước. |
|   9 | Lệnh khớp             | Match               | Kết quả khi một Buy Order và một Sell Order có điều kiện giá phù hợp.           |
|  10 | Giao dịch             | Trade               | Kết quả matching giữa Buy Order và Sell Order; chỉ trở thành Trade bền vững sau settlement. |
|  11 | Snapshot              | Order Book Snapshot | Bản chụp trạng thái Order Book tại một thời điểm để hỗ trợ khôi phục engine.    |
|  12 | Phục hồi              | Recovery            | Quá trình tái tạo trạng thái Order Book sau khi engine khởi động lại.           |

## 7. Thuật ngữ về giao dịch và dữ liệu thị trường

| STT | Thuật ngữ                    | Tên trong hệ thống          | Định nghĩa                                                                           |
| --: | ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
|   1 | Giao dịch đã settlement       | Settled Trade               | Trade đã được ghi nhận thành công sau settlement và transaction PostgreSQL đã commit. |
|   2 | Giá khớp                      | Execution Price             | Giá thực tế được sử dụng khi tạo Trade.                                              |
|   3 | Khối lượng khớp               | Executed Quantity           | Số Base Asset được trao đổi trong một Trade.                                         |
|   4 | Phí giao dịch                 | Trading Fee                 | Khoản phí được tính cho buyer, seller, maker hoặc taker.                             |
|   5 | Giao dịch gần nhất            | Recent Trades               | Danh sách Trade đã settlement mới nhất của một Trading Pair trên Hau CEX.            |
|   6 | Giá cuối nội bộ               | Internal Last Price         | Execution Price của Trade đã settlement gần nhất theo Sequence trên Hau CEX.         |
|   7 | Khối lượng giao dịch          | Trading Volume              | Tổng khối lượng đã giao dịch trong một khoảng thời gian.                             |
|   8 | Nến giá                       | Candlestick                 | Dữ liệu gồm open, high, low, close và volume; với nguồn `HAU` chỉ dùng Trade đã settlement. |
|   9 | Giá mở cửa                    | Open Price                  | Giá đầu tiên trong một cây nến.                                                      |
|  10 | Giá cao nhất                  | High Price                  | Giá cao nhất trong khoảng thời gian của cây nến.                                     |
|  11 | Giá thấp nhất                 | Low Price                   | Giá thấp nhất trong khoảng thời gian của cây nến.                                    |
|  12 | Giá đóng cửa                  | Close Price                 | Giá cuối cùng trong một cây nến.                                                     |
|  13 | Ticker                        | Market Ticker               | Dữ liệu tóm tắt thị trường như last price, volume, high, low và phần trăm biến động. |
|  14 | Nguồn biểu đồ                 | Chart Source                | Nguồn dữ liệu dùng để hiển thị Candlestick, gồm `BINANCE` hoặc `HAU`.                |
|  15 | Biểu đồ Binance Reference     | Binance Reference Chart     | Biểu đồ lấy từ Binance, là Reference Market Data và chỉ dùng để tham khảo.           |
|  16 | Biểu đồ Hau CEX Market        | Hau CEX Market Chart        | Biểu đồ nội bộ được tổng hợp từ Trade đã settlement trên Hau CEX.                    |
|  17 | Giá tham chiếu                | Reference Price             | Giá lấy từ nguồn bên ngoài, không dùng để khớp lệnh hoặc settlement.                 |
|  18 | Dữ liệu thị trường tham chiếu | Reference Market Data       | Dữ liệu thị trường từ nguồn ngoài, tách biệt với Trade và Order Book của Hau CEX.    |
|  19 | Worker dữ liệu tham chiếu     | Reference Market Data Worker | Process lấy và cache Reference Market Data từ nguồn bên ngoài như Binance.           |
|  20 | Nhãn nguồn biểu đồ            | Chart Source Label          | Nhãn frontend hiển thị nguồn chart, ví dụ `BTC/USDT · Binance Reference`.            |

## 8. Thuật ngữ về nạp và rút

| STT | Thuật ngữ            | Tên trong hệ thống  | Định nghĩa                                                             |
| --: | -------------------- | ------------------- | ---------------------------------------------------------------------- |
|   1 | Nạp tài sản          | Deposit             | Chuyển tài sản từ blockchain vào hệ thống CEX.                         |
|   2 | Rút tài sản          | Withdrawal          | Chuyển tài sản từ số dư nội bộ của CEX ra địa chỉ blockchain.          |
|   3 | Địa chỉ nạp          | Deposit Address     | Địa chỉ blockchain hoặc vault dùng để nhận tài sản của người dùng.     |
|   4 | Địa chỉ nhận         | Destination Address | Địa chỉ blockchain nhận tài sản khi thực hiện withdrawal.              |
|   5 | Xác nhận blockchain  | Confirmation        | Số block đã được tạo sau block chứa transaction.                       |
|   6 | Deposit chờ xác nhận | Pending Deposit     | Deposit đã được phát hiện nhưng chưa đủ số confirmation yêu cầu.       |
|   7 | Deposit đã ghi nhận  | Credited Deposit    | Deposit đã đủ điều kiện và số dư đã được cộng vào Wallet.              |
|   8 | Withdrawal chờ xử lý | Pending Withdrawal  | Withdrawal đã được tạo nhưng chưa được gửi lên blockchain.             |
|   9 | Hot Wallet           | Hot Wallet          | Ví kết nối trực tuyến, dùng để xử lý withdrawal.                       |
|  10 | Exchange Vault       | Exchange Vault      | Smart contract hoặc ví lưu ký dùng để tiếp nhận và quản lý token test. |
|  11 | Blockchain Listener  | Blockchain Listener | Service theo dõi transaction hoặc event trên blockchain.               |
|  12 | Blockchain Worker    | Blockchain Worker   | Service xử lý withdrawal đã được phê duyệt và gửi transaction lên blockchain. |
|  13 | Transaction Hash     | `txHash`            | Mã định danh của một transaction trên blockchain.                      |

## 9. Trạng thái nạp tài sản

| Trạng thái   | Tên trong code | Định nghĩa                                            |
| ------------ | -------------- | ----------------------------------------------------- |
| Đã phát hiện | `DETECTED`     | Listener đã phát hiện transaction hoặc event deposit. |
| Chờ xác nhận | `CONFIRMING`   | Deposit đang chờ đủ số confirmation.                  |
| Đã ghi nhận  | `CREDITED`     | Số dư nội bộ đã được cộng cho người dùng.             |
| Thất bại     | `FAILED`       | Deposit không thể được xử lý hợp lệ.                  |

## 10. Trạng thái rút tài sản

| Trạng thái    | Tên trong code | Định nghĩa                                        |
| ------------- | -------------- | ------------------------------------------------- |
| Chờ xử lý     | `PENDING`      | Yêu cầu rút đã được tạo.                          |
| Đang kiểm tra | `REVIEWING`    | Hệ thống hoặc admin đang kiểm tra yêu cầu.        |
| Đã chấp nhận  | `APPROVED`     | Yêu cầu đủ điều kiện để gửi lên blockchain.       |
| Đang gửi      | `PROCESSING`   | Transaction blockchain đang được tạo hoặc gửi.    |
| Đã phát sóng  | `BROADCASTED`  | Transaction đã được gửi lên blockchain.           |
| Hoàn thành    | `COMPLETED`    | Transaction đã được xác nhận thành công.          |
| Bị từ chối    | `REJECTED`     | Yêu cầu rút không được chấp nhận.                 |
| Thất bại      | `FAILED`       | Quá trình gửi hoặc xác nhận transaction thất bại. |
| Đã hủy        | `CANCELLED`    | Yêu cầu được hủy trước khi gửi lên blockchain.    |

## 11. Thuật ngữ về giao tiếp hệ thống

| STT | Thuật ngữ                | Tên trong hệ thống        | Định nghĩa                                                                                                 |
| --: | ------------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------------- |
|   1 | Command                  | Command                   | Thông điệp yêu cầu một service thực hiện hành động. Ví dụ `PlaceOrderCommand`.                             |
|   2 | Event                    | Event                     | Thông điệp thông báo một sự kiện đã xảy ra. Ví dụ `TradeCreatedEvent`.                                     |
|   3 | Message Broker           | Message Broker            | Thành phần trung gian truyền command và event giữa NestJS và Go engine.                                    |
|   4 | Redis Streams            | Redis Streams             | Cơ chế lưu và phân phối message được dùng trong phiên bản đầu.                                             |
|   5 | Consumer                 | Consumer                  | Service đọc và xử lý message từ stream.                                                                    |
|   6 | Producer                 | Producer                  | Service ghi message vào stream.                                                                            |
|   7 | Consumer Group           | Consumer Group            | Nhóm consumer phối hợp xử lý message trong Redis Streams.                                                  |
|   8 | Acknowledge              | ACK                       | Xác nhận một message đã được xử lý thành công.                                                             |
|   9 | Retry                    | Retry                     | Thử xử lý lại một tác vụ hoặc message bị lỗi.                                                              |
|  10 | Dead-letter Queue        | DLQ                       | Nơi lưu các message thất bại nhiều lần để kiểm tra riêng.                                                  |
|  11 | Idempotency              | Idempotency               | Tính chất bảo đảm cùng một request hoặc event được xử lý nhiều lần nhưng chỉ tạo ra một kết quả nghiệp vụ. |
|  12 | Correlation ID           | Correlation ID            | Mã dùng để theo dõi một luồng xử lý xuyên qua nhiều service.                                               |
|  13 | Outbox Event             | Outbox Event              | Event được lưu cùng transaction dữ liệu, sau đó được worker gửi đến message broker.                        |
|  14 | Outbox Worker            | Outbox Worker             | Worker đọc Outbox Event đã commit và gửi đến message broker.                                               |
|  15 | Engine Event Consumer    | Engine Event Consumer     | Consumer xử lý event phát ra từ Matching Engine.                                                          |
|  16 | Order Event Consumer     | Order Event Consumer      | Consumer xử lý event Order không phải settlement Trade, ví dụ OrderAccepted hoặc OrderCancelled.           |
|  17 | Trade Settlement Consumer | Trade Settlement Consumer | Consumer xử lý `TradeCreated` và settlement Trade theo transaction.                                        |

## 12. Thuật ngữ về frontend và realtime

| STT | Thuật ngữ          | Tên trong hệ thống   | Định nghĩa                                                                   |
| --: | ------------------ | -------------------- | ---------------------------------------------------------------------------- |
|   1 | REST API           | REST API             | Giao diện HTTP dùng cho auth, wallet, order, trade và các chức năng quản lý. |
|   2 | WebSocket          | WebSocket            | Kết nối hai chiều dùng để truyền dữ liệu realtime.                           |
|   3 | WebSocket Room     | Room                 | Nhóm kết nối cùng đăng ký nhận dữ liệu của một market hoặc user.             |
|   4 | Order Book Update  | `orderbook.update`   | Event realtime thông báo thay đổi của Order Book.                            |
|   5 | Trade Created      | `trade.created`      | Event realtime công khai cho Trade đã settlement; khác với `TradeCreated` chưa settlement từ Matching Engine. |
|   6 | Ticker Update      | `ticker.update`      | Event realtime thông báo dữ liệu Ticker thay đổi.                            |
|   7 | Candlestick Update | `candlestick.update` | Event realtime thông báo dữ liệu nến giá thay đổi, phải đi kèm hoặc xác định được Chart Source. |
|   8 | Order Updated      | `order.updated`      | Event riêng cho user thông báo trạng thái Order thay đổi.                    |
|   9 | Balance Updated    | `balance.updated`    | Event riêng cho user thông báo số dư thay đổi.                               |
|  10 | Deposit Updated    | `deposit.updated`    | Event riêng cho user thông báo trạng thái Deposit thay đổi.                  |
|  11 | Withdrawal Updated | `withdrawal.updated` | Event riêng cho user thông báo trạng thái Withdrawal thay đổi.               |
|  12 | Market Data        | Market Data          | Dữ liệu công khai của Hau CEX như Order Book, Recent Trades, Ticker và Hau Candlestick. |

## 13. Quy ước số liệu

| Thuật ngữ          | Định nghĩa                                                   |
| ------------------ | ------------------------------------------------------------ |
| Precision          | Số chữ số được phép lưu hoặc tính toán.                      |
| Scale              | Số chữ số nằm sau dấu thập phân.                             |
| Price Precision    | Số chữ số thập phân tối đa của giá.                          |
| Quantity Precision | Số chữ số thập phân tối đa của khối lượng.                   |
| Tick Size          | Bước thay đổi giá nhỏ nhất được phép.                        |
| Step Size          | Bước thay đổi khối lượng nhỏ nhất được phép.                 |
| Minimum Quantity   | Khối lượng nhỏ nhất của một Order.                           |
| Minimum Notional   | Tổng giá trị nhỏ nhất của một Order.                         |
| Notional           | Giá trị của Order, thường được tính bằng `price × quantity`. |

## 14. Quy ước đặt tên

- Tên bảng database sử dụng `snake_case`.
- Tên field TypeScript và Go sử dụng `camelCase`.
- Tên struct, class và enum sử dụng `PascalCase`.
- Tên event sử dụng thì quá khứ, ví dụ `OrderAccepted`, `TradeCreated`.
- Tên command sử dụng động từ, ví dụ `PlaceOrder`, `CancelOrder`.
- Mã Trading Pair dùng dạng `BTC_USDT` trong code.
- Dạng hiển thị trên giao diện là `BTC/USDT`.
