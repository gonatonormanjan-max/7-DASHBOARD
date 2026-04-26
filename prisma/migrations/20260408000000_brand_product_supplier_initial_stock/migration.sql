-- ============================================================
-- Migration: brand_product_supplier_initial_stock
-- Date: 2026-04-08
-- Summary:
--   1. Add Brand table
--   2. Add ProductSupplier junction table
--   3. Add brandId (nullable) to Product
--   4. Add INITIAL_STOCK to MovementType enum
--   5. Drop old supplierId FK from Product
--   6. Drop old products[] relation from Supplier (handled by removing FK)
--   7. Migrate existing supplier links to ProductSupplier rows
--   8. Clear all mock data
-- ============================================================

-- Step 1: Add INITIAL_STOCK to MovementType enum
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'INITIAL_STOCK';

-- Step 2: Create Brand table
CREATE TABLE "Brand" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- Step 3: Create ProductSupplier junction table
CREATE TABLE "ProductSupplier" (
    "id"           TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "supplierId"   TEXT NOT NULL,
    "isPrimary"    BOOLEAN NOT NULL DEFAULT false,
    "costPrice"    DECIMAL(12,2) NOT NULL,
    "leadTimeDays" INTEGER,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProductSupplier_productId_supplierId_key" ON "ProductSupplier"("productId", "supplierId");
CREATE INDEX "ProductSupplier_supplierId_idx" ON "ProductSupplier"("supplierId");

-- Foreign keys for ProductSupplier
ALTER TABLE "ProductSupplier"
    ADD CONSTRAINT "ProductSupplier_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductSupplier"
    ADD CONSTRAINT "ProductSupplier_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Add brandId column to Product (nullable for migration safety)
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- Step 5: Migrate existing supplier links into ProductSupplier
-- For every product that has a non-null supplierId, create a ProductSupplier row
INSERT INTO "ProductSupplier" ("id", "productId", "supplierId", "isPrimary", "costPrice", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    p."supplierId",
    true,
    p."costPrice",
    NOW(),
    NOW()
FROM "Product" p
WHERE p."supplierId" IS NOT NULL;

-- Step 6: Drop the old supplierId FK constraint from Product
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_supplierId_fkey";

-- Step 7: Drop the old supplierId column and its index from Product
DROP INDEX IF EXISTS "Product_supplierId_idx";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "supplierId";

-- Step 8: Add FK for brandId on Product
ALTER TABLE "Product"
    ADD CONSTRAINT "Product_brandId_fkey"
    FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 9: Clear all mock data (idempotent — safe to run even if already clean)
-- Delete SalesOrderItems and SalesOrders that reference mock products/locations first
DELETE FROM "SalesOrderItem"
    WHERE "productId" IN (SELECT id FROM "Product" WHERE sku LIKE 'MOCK-%');
DELETE FROM "SalesOrderItem"
    WHERE "locationId" IN (SELECT id FROM "StockLocation" WHERE code LIKE 'MOCK-%');
DELETE FROM "SalesOrder"
    WHERE id NOT IN (SELECT DISTINCT "salesOrderId" FROM "SalesOrderItem")
    AND "orderNumber" LIKE 'SO-%';
-- Delete PurchaseOrderItems that reference mock products/suppliers
DELETE FROM "PurchaseOrderItem"
    WHERE "purchaseOrderId" IN (
        SELECT id FROM "PurchaseOrder"
        WHERE "supplierId" IN (SELECT id FROM "Supplier" WHERE name LIKE 'Mock %')
    );
DELETE FROM "PurchaseOrder"
    WHERE "supplierId" IN (SELECT id FROM "Supplier" WHERE name LIKE 'Mock %');
DELETE FROM "InventoryMovement" WHERE "referenceType" = 'mock.seed';
DELETE FROM "InventoryMovement"
    WHERE "locationId" IN (SELECT id FROM "StockLocation" WHERE code LIKE 'MOCK-%');
DELETE FROM "InventoryMovement"
    WHERE "productId" IN (SELECT id FROM "Product" WHERE sku LIKE 'MOCK-%');
DELETE FROM "LocationStock"
    WHERE "locationId" IN (SELECT id FROM "StockLocation" WHERE code LIKE 'MOCK-%');
DELETE FROM "LocationStock"
    WHERE "productId" IN (SELECT id FROM "Product" WHERE sku LIKE 'MOCK-%');
DELETE FROM "ProductSupplier"
    WHERE "productId" IN (SELECT id FROM "Product" WHERE sku LIKE 'MOCK-%');
DELETE FROM "Product" WHERE sku LIKE 'MOCK-%';
DELETE FROM "Category" WHERE name LIKE 'Mock %';
DELETE FROM "Supplier" WHERE name LIKE 'Mock %';
DELETE FROM "StockLocation" WHERE code LIKE 'MOCK-%';
DELETE FROM "AuditLog" WHERE action IN ('mock_data.seed', 'mock_data.clear');
