-- prisma-disable-transactions
-- Migration: 20260416000000_manager_role_adjustment_requests
-- Adds MANAGER role to the Role enum and creates the AdjustmentRequest table
-- for the branch-manager approval workflow.
-- NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
-- The prisma-disable-transactions directive above tells prisma migrate deploy
-- to run this migration outside a transaction so it succeeds on Neon.

-- Step 1: Add MANAGER value to the Role enum
ALTER TYPE "Role" ADD VALUE 'MANAGER';

-- Step 2: Add AdjustmentRequestStatus enum
CREATE TYPE "AdjustmentRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Step 3: Create AdjustmentRequest table
CREATE TABLE "AdjustmentRequest" (
    "id"            TEXT NOT NULL,
    "branchId"      TEXT NOT NULL,
    "productId"     TEXT NOT NULL,
    "direction"     TEXT NOT NULL,
    "quantity"      INTEGER NOT NULL,
    "reason"        TEXT NOT NULL,
    "notes"         TEXT,
    "status"        "AdjustmentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById"  TEXT,
    "reviewedAt"    TIMESTAMP(3),
    "reviewNotes"   TEXT,

    CONSTRAINT "AdjustmentRequest_pkey" PRIMARY KEY ("id")
);

-- Step 4: Add foreign key constraints
ALTER TABLE "AdjustmentRequest"
    ADD CONSTRAINT "AdjustmentRequest_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "StockLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdjustmentRequest"
    ADD CONSTRAINT "AdjustmentRequest_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdjustmentRequest"
    ADD CONSTRAINT "AdjustmentRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdjustmentRequest"
    ADD CONSTRAINT "AdjustmentRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Create indexes
CREATE INDEX "AdjustmentRequest_branchId_idx"      ON "AdjustmentRequest"("branchId");
CREATE INDEX "AdjustmentRequest_productId_idx"     ON "AdjustmentRequest"("productId");
CREATE INDEX "AdjustmentRequest_requestedById_idx" ON "AdjustmentRequest"("requestedById");
CREATE INDEX "AdjustmentRequest_status_idx"        ON "AdjustmentRequest"("status");
