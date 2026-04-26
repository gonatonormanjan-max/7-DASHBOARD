-- prisma-disable-transactions
-- Migration: 20260423111000_daily_ops
-- Adds stock count, issue reporting, and change fund tracking tables.

CREATE TYPE "StockCountType" AS ENUM ('OPENING', 'CLOSING');
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "IssueReportStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

CREATE TABLE "StockCount" (
    "id"            TEXT              NOT NULL DEFAULT gen_random_uuid(),
    "locationId"    TEXT              NOT NULL,
    "type"          "StockCountType"  NOT NULL,
    "countDate"     DATE              NOT NULL,
    "status"        "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedById" TEXT              NOT NULL,
    "createdAt"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StockCount_locationId_type_countDate_key"
    ON "StockCount"("locationId", "type", "countDate");

CREATE INDEX "StockCount_locationId_idx"
    ON "StockCount"("locationId");

ALTER TABLE "StockCount"
    ADD CONSTRAINT "StockCount_locationId_fkey"
    FOREIGN KEY ("locationId")
    REFERENCES "StockLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StockCount"
    ADD CONSTRAINT "StockCount_submittedById_fkey"
    FOREIGN KEY ("submittedById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "StockCountLine" (
    "id"           TEXT         NOT NULL DEFAULT gen_random_uuid(),
    "stockCountId" TEXT         NOT NULL,
    "productId"    TEXT         NOT NULL,
    "systemQty"    INTEGER      NOT NULL,
    "countedQty"   INTEGER      NOT NULL,
    "notes"        TEXT,

    CONSTRAINT "StockCountLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StockCountLine_systemQty_non_negative" CHECK ("systemQty" >= 0),
    CONSTRAINT "StockCountLine_countedQty_non_negative" CHECK ("countedQty" >= 0)
);

CREATE UNIQUE INDEX "StockCountLine_stockCountId_productId_key"
    ON "StockCountLine"("stockCountId", "productId");

CREATE INDEX "StockCountLine_productId_idx"
    ON "StockCountLine"("productId");

ALTER TABLE "StockCountLine"
    ADD CONSTRAINT "StockCountLine_stockCountId_fkey"
    FOREIGN KEY ("stockCountId")
    REFERENCES "StockCount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockCountLine"
    ADD CONSTRAINT "StockCountLine_productId_fkey"
    FOREIGN KEY ("productId")
    REFERENCES "Product"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "IssueReport" (
    "id"               TEXT                NOT NULL DEFAULT gen_random_uuid(),
    "branchId"         TEXT                NOT NULL,
    "title"            TEXT                NOT NULL,
    "body"             TEXT                NOT NULL,
    "status"           "IssueReportStatus" NOT NULL DEFAULT 'OPEN',
    "submittedById"    TEXT                NOT NULL,
    "acknowledgedById" TEXT,
    "resolvedById"     TEXT,
    "createdAt"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IssueReport_branchId_idx"
    ON "IssueReport"("branchId");

CREATE INDEX "IssueReport_status_idx"
    ON "IssueReport"("status");

ALTER TABLE "IssueReport"
    ADD CONSTRAINT "IssueReport_branchId_fkey"
    FOREIGN KEY ("branchId")
    REFERENCES "StockLocation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssueReport"
    ADD CONSTRAINT "IssueReport_submittedById_fkey"
    FOREIGN KEY ("submittedById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "IssueReport"
    ADD CONSTRAINT "IssueReport_acknowledgedById_fkey"
    FOREIGN KEY ("acknowledgedById")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "IssueReport"
    ADD CONSTRAINT "IssueReport_resolvedById_fkey"
    FOREIGN KEY ("resolvedById")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ChangeFundAllocation" (
    "id"        TEXT          NOT NULL DEFAULT gen_random_uuid(),
    "branchId"  TEXT          NOT NULL,
    "amount"    DECIMAL(12,2) NOT NULL,
    "setById"   TEXT          NOT NULL,
    "notes"     TEXT,
    "updatedAt" TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChangeFundAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChangeFundAllocation_amount_non_negative" CHECK ("amount" >= 0)
);

CREATE UNIQUE INDEX "ChangeFundAllocation_branchId_key"
    ON "ChangeFundAllocation"("branchId");

ALTER TABLE "ChangeFundAllocation"
    ADD CONSTRAINT "ChangeFundAllocation_branchId_fkey"
    FOREIGN KEY ("branchId")
    REFERENCES "StockLocation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChangeFundAllocation"
    ADD CONSTRAINT "ChangeFundAllocation_setById_fkey"
    FOREIGN KEY ("setById")
    REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
