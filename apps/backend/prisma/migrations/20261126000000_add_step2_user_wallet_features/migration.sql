-- Migration: add_step2_user_wallet_features
-- Step 2: Withdrawals, Internal Transfers, 2FA, User Preferences, Notifications & API Keys

-- Extend LedgerEntryType enum
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'WITHDRAWAL';
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'INTERNAL_TRANSFER_IN';
ALTER TYPE "ledger_entry_type" ADD VALUE IF NOT EXISTS 'INTERNAL_TRANSFER_OUT';

-- New Enums
CREATE TYPE "withdrawal_status" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "notification_type" AS ENUM ('SECURITY', 'WALLET', 'ORDER', 'SYSTEM');
CREATE TYPE "api_key_permission" AS ENUM ('READ', 'TRADE');

-- Extend users table for 2FA (TOTP)
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "two_factor_secret" VARCHAR(128);

-- Withdrawals table
CREATE TABLE "withdrawals" (
  "id"             UUID                NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        UUID                NOT NULL,
  "asset_id"       UUID                NOT NULL,
  "to_address"     VARCHAR(42)         NOT NULL,
  "amount"         DECIMAL(38, 18)     NOT NULL,
  "fee"            DECIMAL(38, 18)     NOT NULL DEFAULT 0,
  "status"         "withdrawal_status" NOT NULL DEFAULT 'PENDING',
  "tx_hash"        VARCHAR(66),
  "failure_reason" TEXT,
  "processed_at"   TIMESTAMPTZ(6),
  "created_at"     TIMESTAMPTZ(6)      NOT NULL DEFAULT now(),
  "updated_at"     TIMESTAMPTZ(6)      NOT NULL DEFAULT now(),

  CONSTRAINT "pk_withdrawals" PRIMARY KEY ("id"),
  CONSTRAINT "fk_withdrawals_user"  FOREIGN KEY ("user_id")  REFERENCES "users"("id")  ON DELETE RESTRICT,
  CONSTRAINT "fk_withdrawals_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_withdrawals_user_created"   ON "withdrawals" ("user_id", "created_at" DESC);
CREATE INDEX "idx_withdrawals_status_created" ON "withdrawals" ("status",  "created_at" DESC);

-- Internal Transfers table
CREATE TABLE "internal_transfers" (
  "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
  "sender_user_id"    UUID            NOT NULL,
  "recipient_user_id" UUID            NOT NULL,
  "asset_id"          UUID            NOT NULL,
  "amount"            DECIMAL(38, 18) NOT NULL,
  "note"              VARCHAR(255),
  "created_at"        TIMESTAMPTZ(6)  NOT NULL DEFAULT now(),

  CONSTRAINT "pk_internal_transfers" PRIMARY KEY ("id"),
  CONSTRAINT "fk_internal_transfers_sender"    FOREIGN KEY ("sender_user_id")    REFERENCES "users"("id")  ON DELETE RESTRICT,
  CONSTRAINT "fk_internal_transfers_recipient" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")  ON DELETE RESTRICT,
  CONSTRAINT "fk_internal_transfers_asset"     FOREIGN KEY ("asset_id")          REFERENCES "assets"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_transfers_sender_created"    ON "internal_transfers" ("sender_user_id",    "created_at" DESC);
CREATE INDEX "idx_transfers_recipient_created" ON "internal_transfers" ("recipient_user_id", "created_at" DESC);

-- User Preferences table
CREATE TABLE "user_preferences" (
  "user_id"          UUID        NOT NULL,
  "notif_login"      BOOLEAN     NOT NULL DEFAULT true,
  "notif_orders"     BOOLEAN     NOT NULL DEFAULT true,
  "notif_security"   BOOLEAN     NOT NULL DEFAULT true,
  "notif_newsletter" BOOLEAN     NOT NULL DEFAULT false,
  "base_currency"    VARCHAR(10) NOT NULL DEFAULT 'USDT',
  "language"         VARCHAR(10) NOT NULL DEFAULT 'en',
  "confirm_order"    BOOLEAN     NOT NULL DEFAULT true,
  "updated_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

  CONSTRAINT "pk_user_preferences" PRIMARY KEY ("user_id"),
  CONSTRAINT "fk_user_preferences_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE "notifications" (
  "id"         UUID                NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID                NOT NULL,
  "type"       "notification_type" NOT NULL DEFAULT 'SYSTEM',
  "title"      VARCHAR(150)        NOT NULL,
  "message"    TEXT                NOT NULL,
  "is_read"    BOOLEAN             NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6)      NOT NULL DEFAULT now(),

  CONSTRAINT "pk_notifications" PRIMARY KEY ("id"),
  CONSTRAINT "fk_notifications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_notifications_user_created" ON "notifications" ("user_id", "created_at" DESC);

-- API Keys table
CREATE TABLE "api_keys" (
  "id"          UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     UUID                 NOT NULL,
  "label"       VARCHAR(80)          NOT NULL,
  "key_prefix"  VARCHAR(24)          NOT NULL,
  "key_hash"    VARCHAR(128)         NOT NULL,
  "permissions" "api_key_permission" NOT NULL DEFAULT 'READ',
  "last_used_at" TIMESTAMPTZ(6),
  "revoked_at"  TIMESTAMPTZ(6),
  "created_at"  TIMESTAMPTZ(6)       NOT NULL DEFAULT now(),

  CONSTRAINT "pk_api_keys" PRIMARY KEY ("id"),
  CONSTRAINT "fk_api_keys_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "uq_api_keys_hash" UNIQUE ("key_hash")
);

CREATE INDEX "idx_api_keys_user_created" ON "api_keys" ("user_id", "created_at" DESC);
