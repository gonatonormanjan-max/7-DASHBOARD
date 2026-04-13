-- Migration: Add approvedById + approvedAt to PurchaseOrder
--            Add locationId to SalesOrder for per-branch reporting

-- PurchaseOrder: approval tracking
ALTER TABLE "PurchaseOrder"
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt"   TIMESTAMP(3);

ALTER TABLE "PurchaseOrder"
  ADD CONSTRAINT "PurchaseOrder_approvedById_fkey"
  FOREIGN KEY ("approvedById")
  REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PurchaseOrder_approvedById_idx" ON "PurchaseOrder"("approvedById");

-- SalesOrder: branch location for reporting
ALTER TABLE "SalesOrder"
  ADD COLUMN "locationId" TEXT;

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_locationId_fkey"
  FOREIGN KEY ("locationId")
  REFERENCES "StockLocation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SalesOrder_locationId_idx" ON "SalesOrder"("locationId");

-- Backfill SalesOrder.locationId from each order's first SalesOrderItem
-- so existing records are correctly attributed to their branch
UPDATE "SalesOrder" so
SET "locationId" = (
  SELECT soi."locationId"
  FROM "SalesOrderItem" soi
  WHERE soi."salesOrderId" = so.id
  ORDER BY soi."createdAt" ASC
  LIMIT 1
)
WHERE so."locationId" IS NULL;
