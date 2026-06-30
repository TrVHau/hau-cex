# Hau CEX

## 1. Giới thiệu

Hau CEX là hệ thống mô phỏng một sàn giao dịch tài sản số tập trung.
Hệ thống cho phép người dùng quản lý tài sản, nạp/rút token test,
đặt lệnh mua bán và theo dõi dữ liệu thị trường theo thời gian thực.

Order Book, Recent Trades, Last Price nội bộ và nơi xử lý lệnh luôn thuộc Hau CEX.
Biểu đồ có thể dùng nguồn mặc định `BINANCE` để phục vụ demo UI/frontend giống sàn thật,
hoặc nguồn `HAU` được tổng hợp từ Trade đã settlement trên Hau CEX.

## 2. Mục tiêu

- Xây dựng hệ thống full stack có frontend, backend, matching engine và blockchain.
- Áp dụng Go để xây dựng matching engine.
- Áp dụng xử lý transaction và concurrency.
- Xây dựng hệ thống realtime bằng WebSocket.
- Triển khai hệ thống bằng Docker.

## 3. Đối tượng sử dụng

- Guest
- User
- Admin

## 4. Công nghệ chính

- Frontend: React, TypeScript
- Backend: NestJS, TypeScript
- Matching Engine: Go
- Database: PostgreSQL
- Cache và messaging: Redis
- Blockchain: Solidity, Hardhat
- Infrastructure: Docker

## 5. Chức năng chính

- Đăng ký, đăng nhập
- Quản lý ví
- Nạp và rút token test
- Đặt và hủy lệnh
- Khớp lệnh
- Xem order book
- Xem lịch sử giao dịch
- Xem chart với nguồn mặc định Binance Reference và tùy chọn Hau CEX Market
- Hiển thị rõ nguồn dữ liệu chart
- Quản trị hệ thống

## 6. Phạm vi phiên bản đầu

Phiên bản đầu tập trung vào giao dịch spot với lệnh limit.

Dữ liệu Binance chỉ dùng làm Reference Market Data cho mục tiêu học frontend, demo chart và giá tham chiếu.
Dữ liệu này không được dùng để khớp lệnh, xác định Execution Price, settlement,
cập nhật Wallet, ghi Ledger, tạo Order Book hoặc tạo Recent Trades của Hau CEX.

Không bao gồm:

- Futures
- Margin
- P2P
- Fiat
- KYC thật
- Multi-chain
