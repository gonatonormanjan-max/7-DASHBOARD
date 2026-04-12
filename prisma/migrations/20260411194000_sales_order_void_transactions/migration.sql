-- ============================================================
-- Migration: sales_order_void_transactions
-- Date: 2026-04-11
-- Summary:
--   1. Add SalesOrderVoidReason enum
--   2. Add void metadata fields to SalesOrder
-- ============================================================

CREATE TYPE "SalesOrderVoidReason" AS ENUM ('DEFECT', 'RETURNED_REFUND', 'REPLACE', 'OTHERS');

ALTER TABLE "SalesOrder"
    ADD COLUMN "voidReason" "SalesOrderVoidReason",
    ADD COLUMN "voidRemarks" TEXT,
    ADD COLUMN "voidDocumentation" TEXT,
    ADD COLUMN "voidedAt" TIMESTAMP(3),
    ADD COLUMN "voidedById" TEXT;

ALTER TABLE "SalesOrder"
    ADD CONSTRAINT "SalesOrder_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SalesOrder_voidedById_idx" ON "SalesOrder"("voidedById");
CREATE INDEX "SalesOrder_voidReason_idx" ON "SalesOrder"("voidReason");
