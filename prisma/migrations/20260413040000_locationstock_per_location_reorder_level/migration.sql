-- Add optional per-location reorder level override to LocationStock.
-- When set, this overrides the global Product.reorderLevel for low-stock
-- calculations at that specific location. When NULL, the product-level
-- threshold is used as the fallback.
ALTER TABLE "LocationStock"
  ADD COLUMN "reorderLevel" INTEGER;
