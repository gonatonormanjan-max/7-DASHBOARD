-- ============================================================
-- Migration: moving_average_costing_context
-- Date: 2026-04-11
-- Summary:
--   1. Add moving-average cost table per location/product
--   2. Add cost history table for inbound pricing events
--   3. Add immutable cost snapshot fields on SalesOrderItem
-- ============================================================

ALTER TABLE "SalesOrderItem"
    ADD COLUMN "unitCostAtSale" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "lineCogs" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "lineGrossProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN "isEstimatedCost" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "LocationProductCost" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "avgUnitCost" DECIMAL(12,2) NOT NULL,
    "lastInboundUnitCost" DECIMAL(12,2),
    "onHandQtySnapshot" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocationProductCost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductCostHistory" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inboundQty" INTEGER NOT NULL,
    "inboundUnitCost" DECIMAL(12,2) NOT NULL,
    "prevAvgUnitCost" DECIMAL(12,2) NOT NULL,
    "newAvgUnitCost" DECIMAL(12,2) NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "changePct" DECIMAL(7,4),
    "reason" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCostHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LocationProductCost_locationId_productId_key"
    ON "LocationProductCost"("locationId", "productId");

CREATE INDEX "LocationProductCost_productId_idx"
    ON "LocationProductCost"("productId");

CREATE INDEX "ProductCostHistory_locationId_productId_createdAt_idx"
    ON "ProductCostHistory"("locationId", "productId", "createdAt");

CREATE INDEX "ProductCostHistory_productId_createdAt_idx"
    ON "ProductCostHistory"("productId", "createdAt");

CREATE INDEX "ProductCostHistory_changedById_createdAt_idx"
    ON "ProductCostHistory"("changedById", "createdAt");

ALTER TABLE "LocationProductCost"
    ADD CONSTRAINT "LocationProductCost_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationProductCost"
    ADD CONSTRAINT "LocationProductCost_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductCostHistory"
    ADD CONSTRAINT "ProductCostHistory_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductCostHistory"
    ADD CONSTRAINT "ProductCostHistory_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductCostHistory"
    ADD CONSTRAINT "ProductCostHistory_changedById_fkey"
    FOREIGN KEY ("changedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
