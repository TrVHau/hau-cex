-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'LOCKED');

-- CreateEnum
CREATE TYPE "asset_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "trading_pair_status" AS ENUM ('RECOVERING', 'READY', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "order_side" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCEL_PENDING', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ledger_balance_type" AS ENUM ('AVAILABLE', 'LOCKED');

-- CreateEnum
CREATE TYPE "ledger_entry_type" AS ENUM ('INITIAL_BALANCE', 'DEPOSIT', 'ORDER_LOCK', 'ORDER_UNLOCK', 'TRADE_SETTLEMENT', 'TRADING_FEE');

-- CreateEnum
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" VARCHAR(150),
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "locked_at" TIMESTAMPTZ(6),
    "locked_reason" TEXT,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_users" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_sessions" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "decimals" INTEGER NOT NULL,
    "contract_address" TEXT,
    "status" "asset_status" NOT NULL,
    "deposit_enabled" BOOLEAN NOT NULL,
    "trading_enabled" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_assets" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_pairs" (
    "id" UUID NOT NULL,
    "symbol" VARCHAR(30) NOT NULL,
    "base_asset_id" UUID NOT NULL,
    "quote_asset_id" UUID NOT NULL,
    "price_precision" INTEGER NOT NULL,
    "quantity_precision" INTEGER NOT NULL,
    "tick_size" DECIMAL(38,18) NOT NULL,
    "step_size" DECIMAL(38,18) NOT NULL,
    "min_quantity" DECIMAL(38,18) NOT NULL,
    "min_notional" DECIMAL(38,18) NOT NULL,
    "maker_fee_rate" DECIMAL(38,18) NOT NULL,
    "taker_fee_rate" DECIMAL(38,18) NOT NULL,
    "status" "trading_pair_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_trading_pairs" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "available_balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "locked_balance" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_wallets" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "entry_type" "ledger_entry_type" NOT NULL,
    "balance_type" "ledger_balance_type" NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "before_balance" DECIMAL(38,18) NOT NULL,
    "after_balance" DECIMAL(38,18) NOT NULL,
    "reference_type" VARCHAR(50) NOT NULL,
    "reference_id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_ledger_entries" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sequences" (
    "trading_pair_id" UUID NOT NULL,
    "last_value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_order_sequences" PRIMARY KEY ("trading_pair_id")
);

-- CreateTable
CREATE TABLE "engine_command_sequences" (
    "trading_pair_id" UUID NOT NULL,
    "last_value" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_engine_command_sequences" PRIMARY KEY ("trading_pair_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "trading_pair_id" UUID NOT NULL,
    "side" "order_side" NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PENDING',
    "price" DECIMAL(38,18) NOT NULL,
    "quantity" DECIMAL(38,18) NOT NULL,
    "filled_quantity" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "remaining_quantity" DECIMAL(38,18) NOT NULL,
    "locked_asset_id" UUID NOT NULL,
    "locked_amount" DECIMAL(38,18) NOT NULL,
    "remaining_locked_amount" DECIMAL(38,18) NOT NULL,
    "order_sequence" BIGINT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "idempotency_payload_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_orders" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "engine_match_id" TEXT NOT NULL,
    "engine_message_id" UUID NOT NULL,
    "trading_pair_id" UUID NOT NULL,
    "buy_order_id" UUID NOT NULL,
    "sell_order_id" UUID NOT NULL,
    "buyer_user_id" UUID NOT NULL,
    "seller_user_id" UUID NOT NULL,
    "maker_order_id" UUID NOT NULL,
    "taker_order_id" UUID NOT NULL,
    "taker_side" "order_side" NOT NULL,
    "execution_price" DECIMAL(38,18) NOT NULL,
    "executed_quantity" DECIMAL(38,18) NOT NULL,
    "quote_amount" DECIMAL(38,18) NOT NULL,
    "maker_fee_rate" DECIMAL(38,18) NOT NULL,
    "taker_fee_rate" DECIMAL(38,18) NOT NULL,
    "buyer_fee_amount" DECIMAL(38,18) NOT NULL,
    "seller_fee_amount" DECIMAL(38,18) NOT NULL,
    "sequence" BIGINT NOT NULL,
    "matched_at" TIMESTAMPTZ(6) NOT NULL,
    "settled_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pk_trades" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "message_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "correlation_id" UUID NOT NULL,
    "stream_name" TEXT NOT NULL,
    "message_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
    "partition_key" TEXT,
    "command_sequence" BIGINT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "pk_outbox_events" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "id" UUID NOT NULL,
    "consumer_name" TEXT NOT NULL,
    "message_id" UUID NOT NULL,
    "message_type" TEXT NOT NULL,
    "payload_hash" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "result_reference_id" UUID,
    "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pk_processed_events" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_sessions_user_id" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_assets_symbol" ON "assets"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "uq_trading_pairs_symbol" ON "trading_pairs"("symbol");

-- CreateIndex
CREATE UNIQUE INDEX "uq_trading_pairs_base_quote" ON "trading_pairs"("base_asset_id", "quote_asset_id");

-- CreateIndex
CREATE INDEX "idx_wallets_asset_id" ON "wallets"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_wallets_user_asset" ON "wallets"("user_id", "asset_id");

-- CreateIndex
CREATE INDEX "idx_ledger_wallet_created" ON "ledger_entries"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_ledger_reference" ON "ledger_entries"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "idx_ledger_operation" ON "ledger_entries"("operation_id");

-- CreateIndex
CREATE INDEX "idx_ledger_user_created" ON "ledger_entries"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_orders_user_created" ON "orders"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_orders_pair_status" ON "orders"("trading_pair_id", "status");

-- CreateIndex
CREATE INDEX "idx_orders_locked_asset_id" ON "orders"("locked_asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_orders_user_idempotency" ON "orders"("user_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_orders_pair_sequence" ON "orders"("trading_pair_id", "order_sequence");

-- CreateIndex
CREATE UNIQUE INDEX "uq_trades_engine_match_id" ON "trades"("engine_match_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_trades_engine_message_id" ON "trades"("engine_message_id");

-- CreateIndex
CREATE INDEX "idx_trades_buy_order_id" ON "trades"("buy_order_id");

-- CreateIndex
CREATE INDEX "idx_trades_sell_order_id" ON "trades"("sell_order_id");

-- CreateIndex
CREATE INDEX "idx_trades_buyer_settled" ON "trades"("buyer_user_id", "settled_at" DESC);

-- CreateIndex
CREATE INDEX "idx_trades_seller_settled" ON "trades"("seller_user_id", "settled_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_trades_pair_sequence" ON "trades"("trading_pair_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "uq_outbox_events_message_id" ON "outbox_events"("message_id");

-- CreateIndex
CREATE INDEX "idx_outbox_status_retry_created" ON "outbox_events"("status", "next_retry_at", "created_at");

-- CreateIndex
CREATE INDEX "idx_outbox_stream_partition" ON "outbox_events"("stream_name", "partition_key");

-- CreateIndex
CREATE INDEX "idx_processed_events_message_id" ON "processed_events"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_processed_events_consumer_message" ON "processed_events"("consumer_name", "message_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "fk_trading_pairs_base_asset" FOREIGN KEY ("base_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "fk_trading_pairs_quote_asset" FOREIGN KEY ("quote_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "fk_wallets_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "fk_wallets_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_ledger_entries_wallet" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_ledger_entries_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "fk_ledger_entries_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_sequences" ADD CONSTRAINT "fk_order_sequences_trading_pair" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_command_sequences" ADD CONSTRAINT "fk_engine_command_sequences_trading_pair" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_trading_pair" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_locked_asset" FOREIGN KEY ("locked_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_trading_pair" FOREIGN KEY ("trading_pair_id") REFERENCES "trading_pairs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_buy_order" FOREIGN KEY ("buy_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_sell_order" FOREIGN KEY ("sell_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_buyer_user" FOREIGN KEY ("buyer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_seller_user" FOREIGN KEY ("seller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_maker_order" FOREIGN KEY ("maker_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "fk_trades_taker_order" FOREIGN KEY ("taker_order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
