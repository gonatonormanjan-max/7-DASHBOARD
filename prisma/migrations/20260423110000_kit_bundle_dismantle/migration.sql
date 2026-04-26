-- prisma-disable-transactions
-- Migration: 20260423110000_kit_bundle_dismantle
-- Adds kit/bundle composition metadata and dismantle audit storage.
--
-- Notes:
-- - MovementType enum changes require running outside a transaction.
-- - Product exclusivity ("a product cannot be both a kit and a component")
--   is enforced with a trigger because PostgreSQL CHECK constraints cannot
--   query sibling rows in another table.

ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DISMANTLE_OUT';
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'DISMANTLE_IN';

CREATE TABLE "ProductKitComponent" (
    "id"                 TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "kitProductId"       TEXT         NOT NULL,
    "componentProductId" TEXT         NOT NULL,
    "componentQty"       INTEGER      NOT NULL DEFAULT 1,

    CONSTRAINT "ProductKitComponent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductKitComponent_kit_component_distinct"
      CHECK ("kitProductId" <> "componentProductId"),
    CONSTRAINT "ProductKitComponent_componentQty_positive"
      CHECK ("componentQty" > 0)
);

CREATE UNIQUE INDEX "ProductKitComponent_kitProductId_componentProductId_key"
    ON "ProductKitComponent"("kitProductId", "componentProductId");

CREATE INDEX "ProductKitComponent_componentProductId_idx"
    ON "ProductKitComponent"("componentProductId");

ALTER TABLE "ProductKitComponent"
    ADD CONSTRAINT "ProductKitComponent_kitProductId_fkey"
    FOREIGN KEY ("kitProductId")
    REFERENCES "Product"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductKitComponent"
    ADD CONSTRAINT "ProductKitComponent_componentProductId_fkey"
    FOREIGN KEY ("componentProductId")
    REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "enforce_product_kit_component_exclusivity"()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "ProductKitComponent"
        WHERE "componentProductId" = NEW."kitProductId"
          AND "id" <> COALESCE(NEW."id", '')
    ) THEN
        RAISE EXCEPTION 'A product cannot be both a kit and a component.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM "ProductKitComponent"
        WHERE "kitProductId" = NEW."componentProductId"
          AND "id" <> COALESCE(NEW."id", '')
    ) THEN
        RAISE EXCEPTION 'A product cannot be both a kit and a component.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ProductKitComponent_exclusivity_trigger"
BEFORE INSERT OR UPDATE ON "ProductKitComponent"
FOR EACH ROW
EXECUTE FUNCTION "enforce_product_kit_component_exclusivity"();

CREATE TABLE "DismantleRecord" (
    "id"             TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "locationId"     TEXT         NOT NULL,
    "kitProductId"   TEXT         NOT NULL,
    "qty"            INTEGER      NOT NULL,
    "notes"          TEXT,
    "dismantledById" TEXT         NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DismantleRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "DismantleRecord_qty_positive" CHECK ("qty" > 0)
);

CREATE INDEX "DismantleRecord_locationId_idx"
    ON "DismantleRecord"("locationId");

CREATE INDEX "DismantleRecord_kitProductId_idx"
    ON "DismantleRecord"("kitProductId");

ALTER TABLE "DismantleRecord"
    ADD CONSTRAINT "DismantleRecord_locationId_fkey"
    FOREIGN KEY ("locationId")
    REFERENCES "StockLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DismantleRecord"
    ADD CONSTRAINT "DismantleRecord_kitProductId_fkey"
    FOREIGN KEY ("kitProductId")
    REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DismantleRecord"
    ADD CONSTRAINT "DismantleRecord_dismantledById_fkey"
    FOREIGN KEY ("dismantledById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
