-- =====================================================================
-- BỔ SUNG RÀNG BUỘC NGHIỆP VỤ (CHECK CONSTRAINTS)
-- =====================================================================

-- 1. Ràng buộc bảng Trading Pairs
-- Không cho phép tạo cặp giao dịch có Base và Quote giống hệt nhau
ALTER TABLE "trading_pairs" 
ADD CONSTRAINT "chk_trading_pairs_diff_assets" 
CHECK ("base_asset_id" != "quote_asset_id");

-- 2. Ràng buộc bảng Wallets
-- Đảm bảo số dư ví không bao giờ bị âm
ALTER TABLE "wallets" 
ADD CONSTRAINT "chk_wallets_available_positive" 
CHECK ("available_balance" >= 0);

ALTER TABLE "wallets" 
ADD CONSTRAINT "chk_wallets_locked_positive" 
CHECK ("locked_balance" >= 0);

-- 3. Ràng buộc bảng Orders
-- Ràng buộc cơ bản về giá và số lượng khi đặt lệnh
ALTER TABLE "orders" 
ADD CONSTRAINT "chk_orders_quantity_positive" 
CHECK ("quantity" > 0);

ALTER TABLE "orders" 
ADD CONSTRAINT "chk_orders_price_positive" 
CHECK ("price" > 0);

ALTER TABLE "orders" 
ADD CONSTRAINT "chk_orders_filled_positive" 
CHECK ("filled_quantity" >= 0);

ALTER TABLE "orders" 
ADD CONSTRAINT "chk_orders_remaining_positive" 
CHECK ("remaining_quantity" >= 0);

ALTER TABLE "orders" 
ADD CONSTRAINT "chk_orders_remaining_locked_positive" 
CHECK ("remaining_locked_amount" >= 0);

-- Ràng buộc bất biến (Invariant): Tổng số lượng đã khớp + còn lại phải luôn bằng số lượng đặt ban đầu
ALTER TABLE "orders" 
ADD CONSTRAINT "chk_orders_quantity_invariant" 
CHECK ("filled_quantity" + "remaining_quantity" = "quantity");

-- 4. Ràng buộc bảng Trades
-- Đảm bảo giao dịch khớp lệnh luôn có giá trị dương
ALTER TABLE "trades" 
ADD CONSTRAINT "chk_trades_executed_quantity_positive" 
CHECK ("executed_quantity" > 0);

ALTER TABLE "trades" 
ADD CONSTRAINT "chk_trades_execution_price_positive" 
CHECK ("execution_price" > 0);