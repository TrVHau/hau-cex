# Hau CEX — Glossary

## 1. Core

| Thuật ngữ           | Ý nghĩa                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| CEX                 | Centralized Exchange, sàn giao dịch tập trung.                                   |
| MVP                 | Phiên bản tối thiểu cần hoàn thành.                                              |
| Spot Trading        | Giao dịch mua/bán tài sản trực tiếp.                                             |
| Base Asset          | Tài sản được mua/bán trong một cặp, ví dụ `HAU` trong `HAU_USDT`.                |
| Quote Asset         | Tài sản dùng để định giá, ví dụ `USDT` trong `HAU_USDT`.                         |
| Trading Pair        | Cặp giao dịch gồm Base Asset và Quote Asset.                                     |
| Market              | Thị trường giao dịch của một Trading Pair.                                       |
| Hau CEX Market Data | Dữ liệu thị trường nội bộ sinh từ Order Book và Trade đã settlement của Hau CEX. |

---

## 2. Account

| Thuật ngữ        | Ý nghĩa                                |
| ---------------- | -------------------------------------- |
| User             | Người dùng giao dịch.                  |
| Admin            | Người vận hành hệ thống.               |
| System Account   | Tài khoản nội bộ, không đăng nhập.     |
| Treasury Account | System Account sở hữu Treasury Wallet. |
| Treasury Wallet  | Wallet nhận trading fee của nền tảng.  |

---

## 3. Wallet và Ledger

| Thuật ngữ         | Ý nghĩa                                           |
| ----------------- | ------------------------------------------------- |
| Wallet            | Số dư nội bộ của User theo từng Asset.            |
| Available Balance | Số dư có thể dùng.                                |
| Locked Balance    | Số dư đang bị khóa cho Order.                     |
| Ledger Entry      | Bản ghi bất biến mô tả biến động số dư.           |
| Operation ID      | ID gom các Ledger Entry thuộc cùng một nghiệp vụ. |

---

## 4. Order

| Thuật ngữ      | Ý nghĩa                                                           |
| -------------- | ----------------------------------------------------------------- |
| Limit Order    | Order mua/bán với giá giới hạn.                                   |
| Buy Order      | Order mua Base Asset bằng Quote Asset.                            |
| Sell Order     | Order bán Base Asset lấy Quote Asset.                             |
| Open Order     | Order còn remaining quantity trong Order Book.                    |
| Partial Fill   | Order được khớp một phần.                                         |
| Full Fill      | Order được khớp toàn bộ.                                          |
| Cancel Order   | Yêu cầu hủy remaining quantity của Order.                         |
| Cancel Pending | Trạng thái Order đã gửi yêu cầu hủy nhưng Engine chưa xử lý xong. |

---

## 5. Matching Engine

| Thuật ngữ           | Ý nghĩa                                                      |
| ------------------- | ------------------------------------------------------------ |
| Matching Engine     | Service Go xử lý Order Book và khớp lệnh.                    |
| Pair Engine         | Goroutine xử lý một Trading Pair.                            |
| Order Book          | Cấu trúc lưu Bid/Ask trong memory.                           |
| Bid                 | Lệnh mua.                                                    |
| Ask                 | Lệnh bán.                                                    |
| Price Level         | Nhóm Order cùng giá.                                         |
| Price-Time Priority | Ưu tiên giá tốt hơn, nếu cùng giá ưu tiên Order đến trước.   |
| Resting Order       | Order đã nằm trong Order Book.                               |
| Incoming Order      | Order mới đang được xử lý.                                   |
| Execution Price     | Giá khớp, lấy từ resting order.                              |
| Fixed-point         | Biểu diễn số tài chính bằng integer scale, không dùng float. |

---

## 6. Sequence

| Thuật ngữ           | Ý nghĩa                                                        |
| ------------------- | -------------------------------------------------------------- |
| Order Sequence      | Thứ tự Order do Backend cấp, dùng FIFO trong cùng Price Level. |
| Command Sequence    | Thứ tự command theo Trading Pair do Backend cấp.               |
| Trade Sequence      | Thứ tự Trade do Matching Engine cấp.                           |
| Order Book Sequence | Thứ tự thay đổi aggregate Order Book.                          |

---

## 7. Trade và Settlement

| Thuật ngữ        | Ý nghĩa                                                          |
| ---------------- | ---------------------------------------------------------------- |
| TradeCreated     | Engine Event báo một match đã xảy ra, chưa phải dữ liệu public.  |
| Trade Settlement | Backend transaction tạo Trade, cập nhật Order, Wallet và Ledger. |
| TradeSettled     | Domain Event sau khi settlement commit.                          |
| engineMatchId    | Business key duy nhất của một match.                             |
| tradeId          | UUIDv7 ID của Trade.                                             |
| Maker            | Order có sẵn trong Order Book.                                   |
| Taker            | Order mới lấy thanh khoản từ Order Book.                         |
| Trading Fee      | Phí giao dịch thu từ buyer/seller.                               |

---

## 8. Messaging

| Thuật ngữ      | Ý nghĩa                                             |
| -------------- | --------------------------------------------------- |
| Redis Streams  | Transport message nội bộ.                           |
| Outbox         | Bảng PostgreSQL lưu message cần publish sau commit. |
| Consumer Group | Nhóm consumer đọc Redis Stream.                     |
| messageId      | UUIDv7 duy nhất của message.                        |
| correlationId  | ID theo dõi toàn bộ luồng nghiệp vụ.                |
| partitionKey   | Key route message, với Engine là `tradingPairId`.   |
| Dead Letter    | Stream chứa message lỗi cần điều tra.               |

---

## 9. Realtime

| Event              | Ý nghĩa                                           |
| ------------------ | ------------------------------------------------- |
| `orderbook.update` | Cập nhật Order Book aggregate.                    |
| `trade.created`    | Trade đã settlement được công bố realtime.        |
| `order.updated`    | Cập nhật Order riêng tư.                          |
| `balance.updated`  | Cập nhật balance riêng tư.                        |
| `deposit.updated`  | Optional event khi triển khai Deposit token test. |

---

## 10. Naming Convention

Message type dùng tên ngắn:

```text
PlaceOrder
TradeCreated
OrderCancelled
```

Tên class/type trong code có thể thêm hậu tố:

```text
PlaceOrderCommand
TradeCreatedEvent
OrderCancelledEvent
```
