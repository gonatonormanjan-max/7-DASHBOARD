-- ============================================================
-- Migration: sales_order_payment_fields
-- Date: 2026-04-10
-- Summary:
--   1. Add PaymentMode enum
--   2. Add payment fields to SalesOrder
-- ============================================================

CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'ONLINE', 'MIXED');

ALTER TABLE "SalesOrder"
    ADD COLUMN "paymentMode" "PaymentMode",
    ADD COLUMN "cashAmount" DECIMAL(12,2),
    ADD COLUMN "onlineAmount" DECIMAL(12,2);
