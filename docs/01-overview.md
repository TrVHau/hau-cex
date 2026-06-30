# Hau CEX

## 1. Giới thiệu

Hau CEX là hệ thống mô phỏng một sàn giao dịch tài sản số tập trung.
Hệ thống cho phép người dùng quản lý tài sản, nạp/rút token test,
đặt lệnh mua bán và theo dõi dữ liệu thị trường theo thời gian thực.

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
- Xem chart
- Quản trị hệ thống

## 6. Phạm vi phiên bản đầu

Phiên bản đầu tập trung vào giao dịch spot với lệnh limit.

Không bao gồm:

- Futures
- Margin
- P2P
- Fiat
- KYC thật
- Multi-chain
