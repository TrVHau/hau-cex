# Hau CEX

## 1. Giới thiệu

Hau CEX là hệ thống mô phỏng một sàn giao dịch tài sản số tập trung.

Hệ thống cho phép người dùng quản lý số dư nội bộ, đặt lệnh mua bán,
theo dõi Order Book và các Trade đã settlement theo thời gian thực.

Toàn bộ dữ liệu thị trường sử dụng trong Hau CEX là dữ liệu nội bộ của Hau CEX.
Order Book lấy từ Matching Engine, còn Trade/Last Price lấy từ Trade đã settlement.

Nếu triển khai chart/candlestick, dữ liệu phải được tổng hợp từ Trade đã settlement
của Hau CEX, không lấy từ nguồn thị trường bên ngoài.

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

- Đăng ký và đăng nhập.
- Quản lý Wallet và Ledger.
- Đặt và hủy Limit Order.
- Khớp lệnh bằng Go Matching Engine.
- Xem Order Book và Recent Trades.
- Nhận cập nhật realtime.
- Quản trị User và Market cơ bản.
- Nạp token test nếu hoàn thành phần mở rộng.

## 6. Phạm vi phiên bản đầu

Phiên bản đầu tập trung vào giao dịch spot với lệnh limit.

Dữ liệu thị trường của phiên bản đầu lấy từ nội bộ Hau CEX:
Order Book từ Matching Engine, Recent Trades và Last Price từ Trade đã settlement.
Không dùng nguồn thị trường bên ngoài làm dữ liệu cho giao diện.

Không bao gồm:

- Futures
- Margin
- P2P
- Fiat
- KYC thật
- Multi-chain
