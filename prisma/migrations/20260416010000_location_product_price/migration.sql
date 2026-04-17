-- Migration: location_product_price
-- Adds per-branch selling price overrides for products.
-- When a row exists for a (locationId, productId) pair, that price overrides
-- the product's global unitPrice for sales recorded at that branch.

CREATE TABLE "LocationProductPrice" (
    "id"         TEXT          NOT NULL DEFAULT gen_random_uuid(),
    "locationId" TEXT          NOT NULL,
    "productId"  TEXT          NOT NULL,
    "price"      DECIMAL(12,2) NOT NULL,
    "createdAt"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3)  NOT NULL,

    CONSTRAINT "LocationProductPrice_pkey" PRIMARY KEY ("id")
);

-- Foreign key: branch
ALTER TABLE "LocationProductPrice"
    ADD CONSTRAINT "LocationProductPrice_locationId_fkey"
    FOREIGN KEY ("locationId")
    REFERENCES "StockLocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key: product
ALTER TABLE "LocationProductPrice"
    ADD CONSTRAINT "LocationProductPrice_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraint: one price row per (location, product) pair
CREATE UNIQUE INDEX "LocationProductPrice_locationId_productId_key"
    ON "LocationProductPrice"("locationId", "productId");

-- Index: fast look-up by product across all branches
CREATE INDEX "LocationProductPrice_productId_idx"
    ON "LocationProductPrice"("productId");
