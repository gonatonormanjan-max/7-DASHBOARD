-- Migration: add_branch_vault
-- Adds the per-branch financial vault: BranchVault (running balance cache)
-- and VaultTransaction (immutable append-only audit ledger).
--
-- Phase 2A of the Branch Vault feature. Schema only — no existing business
-- logic reads from or writes to these tables yet. Safe to deploy independently.
--
-- Design notes:
--   * VaultTransaction is the source of truth; BranchVault is a denormalized
--     cache of the running sum, updated atomically in the same $transaction
--     that inserts each ledger row.
--   * One VaultTransaction row per payment method affected per event
--     (a split-tender sale creates two rows).
--   * Signed `amount`: positive = credit to the branch, negative = debit.
--   * Unique (referenceType, referenceId, type, paymentMethod) prevents
--     duplicate credits caused by retries or replayed transactions.

-- ----------------------------------------------------------------------------
-- Enum types
-- ----------------------------------------------------------------------------

CREATE TYPE "VaultTransactionType" AS ENUM (
    'SALE',
    'VOID_REVERSAL',
    'CASH_DROP',
    'OPENING_FLOAT',
    'MANUAL_ADJUSTMENT'
);

CREATE TYPE "VaultPaymentMethod" AS ENUM (
    'CASH',
    'ONLINE'
);

CREATE TYPE "CashDropDestination" AS ENUM (
    'SAFE',
    'BANK_DEPOSIT',
    'HANDED_TO_ADMIN',
    'OTHERS'
);

-- ----------------------------------------------------------------------------
-- BranchVault — one row per branch, holds current cash / online balances.
-- ----------------------------------------------------------------------------

CREATE TABLE "BranchVault" (
    "id"            TEXT          NOT NULL DEFAULT gen_random_uuid(),
    "branchId"      TEXT          NOT NULL,
    "cashBalance"   DECIMAL(12,2) NOT NULL DEFAULT 0,
    "onlineBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "BranchVault_pkey" PRIMARY KEY ("id")
);

-- One vault per branch.
CREATE UNIQUE INDEX "BranchVault_branchId_key"
    ON "BranchVault"("branchId");

CREATE INDEX "BranchVault_branchId_idx"
    ON "BranchVault"("branchId");

-- Foreign key: branch
ALTER TABLE "BranchVault"
    ADD CONSTRAINT "BranchVault_branchId_fkey"
    FOREIGN KEY ("branchId")
    REFERENCES "StockLocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ----------------------------------------------------------------------------
-- VaultTransaction — immutable ledger. Every change to a BranchVault
-- balance must insert one row here per payment method affected.
-- ----------------------------------------------------------------------------

CREATE TABLE "VaultTransaction" (
    "id"                  TEXT                   NOT NULL DEFAULT gen_random_uuid(),
    "branchId"            TEXT                   NOT NULL,
    "type"                "VaultTransactionType" NOT NULL,
    "paymentMethod"       "VaultPaymentMethod"   NOT NULL,
    "amount"              DECIMAL(12,2)          NOT NULL,
    "referenceType"       TEXT,
    "referenceId"         TEXT,
    "cashDropDestination" "CashDropDestination",
    "destinationNote"     TEXT,
    "notes"               TEXT,
    "performedById"       TEXT                   NOT NULL,
    "createdAt"           TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultTransaction_pkey" PRIMARY KEY ("id")
);

-- Dedup guard: prevents duplicate credits from retries or replayed transactions.
-- Composite unique on (referenceType, referenceId, type, paymentMethod) means
-- e.g. the same sales_order can be credited at most once per (type, method).
CREATE UNIQUE INDEX "VaultTransaction_referenceType_referenceId_type_paymentMethod_key"
    ON "VaultTransaction"("referenceType", "referenceId", "type", "paymentMethod");

-- Hot read path: "show me this branch's activity ordered by time".
CREATE INDEX "VaultTransaction_branchId_createdAt_idx"
    ON "VaultTransaction"("branchId", "createdAt");

-- Reporting path: "show me all cash drops across branches for a date range".
CREATE INDEX "VaultTransaction_type_createdAt_idx"
    ON "VaultTransaction"("type", "createdAt");

-- Audit path: "show me everything this user performed".
CREATE INDEX "VaultTransaction_performedById_idx"
    ON "VaultTransaction"("performedById");

-- Foreign key: branch (cascade — if a branch is hard-deleted, its ledger goes too)
ALTER TABLE "VaultTransaction"
    ADD CONSTRAINT "VaultTransaction_branchId_fkey"
    FOREIGN KEY ("branchId")
    REFERENCES "StockLocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key: performer (restrict — never lose accountability for who did what)
ALTER TABLE "VaultTransaction"
    ADD CONSTRAINT "VaultTransaction_performedById_fkey"
    FOREIGN KEY ("performedById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
