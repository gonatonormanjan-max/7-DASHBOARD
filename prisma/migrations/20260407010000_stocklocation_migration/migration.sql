-- Migration: Warehouse -> StockLocation, WarehouseStock -> LocationStock
-- Uses RENAME instead of DROP/CREATE to preserve existing data

-- ============================================================
-- Step 1: Create new enum types
-- ============================================================

-- Create LocationType enum (new, did not exist before)
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'BRANCH');

-- Update MovementType enum: remove WAREHOUSE_TRANSFER, add TRANSFER_OUT and TRANSFER_IN
BEGIN;
CREATE TYPE "MovementType_new" AS ENUM ('PURCHASE_RECEIVED', 'SALES_FULFILLED', 'MANUAL_ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN', 'CUSTOMER_RETURN', 'DAMAGED_LOST');
-- Migrate existing WAREHOUSE_TRANSFER rows to TRANSFER_OUT before changing the type
ALTER TABLE "InventoryMovement" ALTER COLUMN "type" DROP DEFAULT;
ALTER TABLE "InventoryMovement" ALTER COLUMN "type" TYPE "MovementType_new"
  USING (
    CASE "type"::text
      WHEN 'WAREHOUSE_TRANSFER' THEN 'TRANSFER_OUT'::"MovementType_new"
      ELSE "type"::text::"MovementType_new"
    END
  );
ALTER TYPE "MovementType" RENAME TO "MovementType_old";
ALTER TYPE "MovementType_new" RENAME TO "MovementType";
DROP TYPE "MovementType_old";
COMMIT;

-- ============================================================
-- Step 2: Rename Warehouse -> StockLocation
-- ============================================================

ALTER TABLE "Warehouse" RENAME TO "StockLocation";

-- Rename column: location -> address
ALTER TABLE "StockLocation" RENAME COLUMN "location" TO "address";

-- Add new columns required by the new schema
ALTER TABLE "StockLocation" ADD COLUMN "type" "LocationType" NOT NULL DEFAULT 'WAREHOUSE';
ALTER TABLE "StockLocation" ADD COLUMN "managerName" TEXT;
ALTER TABLE "StockLocation" ADD COLUMN "contactNumber" TEXT;

-- Rename existing unique indexes to match new table name
ALTER INDEX "Warehouse_name_key" RENAME TO "StockLocation_name_key";
ALTER INDEX "Warehouse_code_key" RENAME TO "StockLocation_code_key";

-- ============================================================
-- Step 3: Rename WarehouseStock -> LocationStock
-- ============================================================

ALTER TABLE "WarehouseStock" RENAME TO "LocationStock";

-- Rename column: warehouseId -> locationId
ALTER TABLE "LocationStock" RENAME COLUMN "warehouseId" TO "locationId";

-- Rename indexes
ALTER INDEX "WarehouseStock_productId_idx" RENAME TO "LocationStock_productId_idx";
ALTER INDEX "WarehouseStock_warehouseId_productId_key" RENAME TO "LocationStock_locationId_productId_key";

-- ============================================================
-- Step 4: Update InventoryMovement table
-- ============================================================

-- Rename column: warehouseId -> locationId
ALTER TABLE "InventoryMovement" RENAME COLUMN "warehouseId" TO "locationId";

-- Rename column: createdById -> performedById
ALTER TABLE "InventoryMovement" RENAME COLUMN "createdById" TO "performedById";

-- Add new transferGroupId column
ALTER TABLE "InventoryMovement" ADD COLUMN "transferGroupId" TEXT;

-- Rename indexes
ALTER INDEX "InventoryMovement_productId_warehouseId_createdAt_idx" RENAME TO "InventoryMovement_productId_locationId_createdAt_idx";
ALTER INDEX "InventoryMovement_createdById_idx" RENAME TO "InventoryMovement_performedById_idx";

-- Create new index for transferGroupId
CREATE INDEX "InventoryMovement_transferGroupId_idx" ON "InventoryMovement"("transferGroupId");

-- ============================================================
-- Step 5: Update SalesOrderItem table
-- ============================================================

-- Rename column: warehouseId -> locationId
ALTER TABLE "SalesOrderItem" RENAME COLUMN "warehouseId" TO "locationId";

-- Rename index
ALTER INDEX "SalesOrderItem_warehouseId_idx" RENAME TO "SalesOrderItem_locationId_idx";

-- ============================================================
-- Step 6: Update User table
-- ============================================================

-- Rename column: assignedWarehouseId -> assignedLocationId
ALTER TABLE "User" RENAME COLUMN "assignedWarehouseId" TO "assignedLocationId";

-- ============================================================
-- Step 7: Rename foreign key constraints (drop old, add new)
-- ============================================================

-- LocationStock foreign keys (renamed from WarehouseStock)
ALTER TABLE "LocationStock" DROP CONSTRAINT "WarehouseStock_warehouseId_fkey";
ALTER TABLE "LocationStock" ADD CONSTRAINT "LocationStock_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LocationStock" DROP CONSTRAINT "WarehouseStock_productId_fkey";
ALTER TABLE "LocationStock" ADD CONSTRAINT "LocationStock_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- InventoryMovement foreign keys
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_warehouseId_fkey";
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_createdById_fkey";
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SalesOrderItem foreign key
ALTER TABLE "SalesOrderItem" DROP CONSTRAINT "SalesOrderItem_warehouseId_fkey";
ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "StockLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- User foreign key
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_assignedWarehouseId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_assignedLocationId_fkey"
  FOREIGN KEY ("assignedLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Step 8: Rename primary key constraints to match new table names
-- ============================================================

ALTER TABLE "StockLocation" RENAME CONSTRAINT "Warehouse_pkey" TO "StockLocation_pkey";
ALTER TABLE "LocationStock" RENAME CONSTRAINT "WarehouseStock_pkey" TO "LocationStock_pkey";

-- Remove the temporary DEFAULT 'WAREHOUSE' added during migration (schema has no default)
ALTER TABLE "StockLocation" ALTER COLUMN "type" DROP DEFAULT;
