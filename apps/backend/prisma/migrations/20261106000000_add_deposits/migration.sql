-- Migration: add_deposits
-- Phase 12: Deposit Intent + Blockchain flow

-- Enum
CREATE TYPE "deposit_status" AS ENUM (
  'PENDING',
  'DETECTED',
  'CONFIRMING',
  'CREDITED',
  'EXPIRED',
  'FAILED'
);

-- Table
CREATE TABLE "deposits" (
  "id"                 UUID            NOT NULL DEFAULT gen_random_uuid(),
  "user_id"            UUID            NOT NULL,
  "asset_id"           UUID            NOT NULL,
  "account_reference"  VARCHAR(66)     NOT NULL,
  "depositor_address"  VARCHAR(42)     NOT NULL,
  "token_address"      VARCHAR(42)     NOT NULL,
  "chain_id"           BIGINT          NOT NULL,
  "tx_hash"            VARCHAR(66),
  "log_index"          INTEGER,
  "block_number"       BIGINT,
  "block_hash"         VARCHAR(66),
  "amount_raw"         DECIMAL(78, 0),
  "amount"             DECIMAL(38, 18),
  "status"             "deposit_status" NOT NULL DEFAULT 'PENDING',
  "confirmation_count" INTEGER         NOT NULL DEFAULT 0,
  "expires_at"         TIMESTAMPTZ(6)  NOT NULL,
  "detected_at"        TIMESTAMPTZ(6),
  "credited_at"        TIMESTAMPTZ(6),
  "failure_reason"     TEXT,
  "created_at"         TIMESTAMPTZ(6)  NOT NULL DEFAULT now(),
  "updated_at"         TIMESTAMPTZ(6)  NOT NULL DEFAULT now(),

  CONSTRAINT "pk_deposits" PRIMARY KEY ("id"),
  CONSTRAINT "fk_deposits_user"  FOREIGN KEY ("user_id")  REFERENCES "users"("id")  ON DELETE RESTRICT,
  CONSTRAINT "fk_deposits_asset" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT,
  CONSTRAINT "uq_deposits_account_reference" UNIQUE ("account_reference")
);

-- Partial unique index: one on-chain event (chainId, txHash, logIndex) processed only once
CREATE UNIQUE INDEX "uq_deposit_chain_event"
  ON "deposits" ("chain_id", "tx_hash", "log_index")
  WHERE "tx_hash" IS NOT NULL AND "log_index" IS NOT NULL;

-- Query indexes
CREATE INDEX "idx_deposits_user_created"    ON "deposits" ("user_id",  "created_at" DESC);
CREATE INDEX "idx_deposits_status_expires"  ON "deposits" ("status",   "expires_at");
