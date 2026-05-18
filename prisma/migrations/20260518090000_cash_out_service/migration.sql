-- Migration: cash_out_service
-- Adds a dedicated non-inventory cash-out service ledger.
--
-- Design:
--   * CashOutTransaction records the branch service transaction.
--   * BranchVault is debited for the physical cash paid to the customer.
--   * CashOutServiceVaultBalance tracks the shared online wallet balance per account.
--   * CashOutServiceVaultTransaction is the immutable central wallet ledger.

-- ----------------------------------------------------------------------------
-- Existing branch vault enum additions
-- ----------------------------------------------------------------------------

ALTER TYPE "VaultTransactionType" ADD VALUE IF NOT EXISTS 'CASH_OUT_PAYOUT';
ALTER TYPE "VaultTransactionType" ADD VALUE IF NOT EXISTS 'CASH_OUT_VOID_REVERSAL';

-- ----------------------------------------------------------------------------
-- Cash-out service enums
-- ----------------------------------------------------------------------------

CREATE TYPE "CashOutTransactionStatus" AS ENUM (
    'COMPLETED',
    'VOIDED'
);

CREATE TYPE "CashOutServiceVaultTransactionType" AS ENUM (
    'CASH_OUT_RECEIVED',
    'VOID_REVERSAL'
);

-- ----------------------------------------------------------------------------
-- Configurable wallet accounts
-- ----------------------------------------------------------------------------

CREATE TABLE "CashOutAccount" (
    "id"            TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "name"          TEXT         NOT NULL,
    "provider"      TEXT,
    "accountName"   TEXT,
    "accountNumber" TEXT,
    "isActive"      BOOLEAN      NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashOutAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashOutAccount_name_key"
    ON "CashOutAccount"("name");

CREATE INDEX "CashOutAccount_isActive_name_idx"
    ON "CashOutAccount"("isActive", "name");

INSERT INTO "CashOutAccount" ("name", "provider", "isActive", "updatedAt")
VALUES
    ('GCash', 'GCASH', true, CURRENT_TIMESTAMP),
    ('Maya', 'MAYA', true, CURRENT_TIMESTAMP),
    ('GoTyme', 'GOTYME', true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- ----------------------------------------------------------------------------
-- Branch cash-out transactions
-- ----------------------------------------------------------------------------

CREATE TABLE "CashOutTransaction" (
    "id"                    TEXT                       NOT NULL DEFAULT gen_random_uuid(),
    "transactionNumber"     TEXT                       NOT NULL,
    "branchId"              TEXT                       NOT NULL,
    "accountId"             TEXT                       NOT NULL,
    "customerName"          TEXT,
    "customerContact"       TEXT,
    "cashOutAmount"         DECIMAL(12,2)              NOT NULL,
    "feeAmount"             DECIMAL(12,2)              NOT NULL,
    "onlineReceivedAmount"  DECIMAL(12,2)              NOT NULL,
    "onlineReferenceNumber" TEXT                       NOT NULL,
    "status"                "CashOutTransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "notes"                 TEXT,
    "voidReason"            TEXT,
    "voidedAt"              TIMESTAMP(3),
    "createdById"           TEXT                       NOT NULL,
    "voidedById"            TEXT,
    "createdAt"             TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)               NOT NULL,

    CONSTRAINT "CashOutTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashOutTransaction_transactionNumber_key"
    ON "CashOutTransaction"("transactionNumber");

CREATE INDEX "CashOutTransaction_branchId_createdAt_idx"
    ON "CashOutTransaction"("branchId", "createdAt");

CREATE INDEX "CashOutTransaction_accountId_createdAt_idx"
    ON "CashOutTransaction"("accountId", "createdAt");

CREATE INDEX "CashOutTransaction_status_createdAt_idx"
    ON "CashOutTransaction"("status", "createdAt");

CREATE INDEX "CashOutTransaction_createdById_idx"
    ON "CashOutTransaction"("createdById");

CREATE INDEX "CashOutTransaction_onlineReferenceNumber_idx"
    ON "CashOutTransaction"("onlineReferenceNumber");

ALTER TABLE "CashOutTransaction"
    ADD CONSTRAINT "CashOutTransaction_branchId_fkey"
    FOREIGN KEY ("branchId")
    REFERENCES "StockLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashOutTransaction"
    ADD CONSTRAINT "CashOutTransaction_accountId_fkey"
    FOREIGN KEY ("accountId")
    REFERENCES "CashOutAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashOutTransaction"
    ADD CONSTRAINT "CashOutTransaction_createdById_fkey"
    FOREIGN KEY ("createdById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashOutTransaction"
    ADD CONSTRAINT "CashOutTransaction_voidedById_fkey"
    FOREIGN KEY ("voidedById")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- Shared online cash-out service vault
-- ----------------------------------------------------------------------------

CREATE TABLE "CashOutServiceVaultBalance" (
    "id"            TEXT          NOT NULL DEFAULT gen_random_uuid(),
    "accountId"     TEXT          NOT NULL,
    "balance"       DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "CashOutServiceVaultBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashOutServiceVaultBalance_accountId_key"
    ON "CashOutServiceVaultBalance"("accountId");

ALTER TABLE "CashOutServiceVaultBalance"
    ADD CONSTRAINT "CashOutServiceVaultBalance_accountId_fkey"
    FOREIGN KEY ("accountId")
    REFERENCES "CashOutAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CashOutServiceVaultTransaction" (
    "id"                   TEXT                                  NOT NULL DEFAULT gen_random_uuid(),
    "accountId"            TEXT                                  NOT NULL,
    "cashOutTransactionId" TEXT                                  NOT NULL,
    "type"                 "CashOutServiceVaultTransactionType" NOT NULL,
    "amount"               DECIMAL(12,2)                         NOT NULL,
    "notes"                TEXT,
    "performedById"        TEXT                                  NOT NULL,
    "createdAt"            TIMESTAMP(3)                          NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashOutServiceVaultTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashOutServiceVaultTransaction_cashOutTransactionId_type_key"
    ON "CashOutServiceVaultTransaction"("cashOutTransactionId", "type");

CREATE INDEX "CashOutServiceVaultTransaction_accountId_createdAt_idx"
    ON "CashOutServiceVaultTransaction"("accountId", "createdAt");

CREATE INDEX "CashOutServiceVaultTransaction_type_createdAt_idx"
    ON "CashOutServiceVaultTransaction"("type", "createdAt");

CREATE INDEX "CashOutServiceVaultTransaction_performedById_idx"
    ON "CashOutServiceVaultTransaction"("performedById");

ALTER TABLE "CashOutServiceVaultTransaction"
    ADD CONSTRAINT "CashOutServiceVaultTransaction_accountId_fkey"
    FOREIGN KEY ("accountId")
    REFERENCES "CashOutAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashOutServiceVaultTransaction"
    ADD CONSTRAINT "CashOutServiceVaultTransaction_cashOutTransactionId_fkey"
    FOREIGN KEY ("cashOutTransactionId")
    REFERENCES "CashOutTransaction"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CashOutServiceVaultTransaction"
    ADD CONSTRAINT "CashOutServiceVaultTransaction_performedById_fkey"
    FOREIGN KEY ("performedById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
