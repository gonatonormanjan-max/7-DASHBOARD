-- Persisted quota settings per active branch.
CREATE TABLE "BranchQuotaSetting" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "rollingWindowDays" INTEGER NOT NULL DEFAULT 30,
  "revenueTarget" DECIMAL(12,2),
  "unitsTarget" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BranchQuotaSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BranchQuotaSetting_branchId_key" ON "BranchQuotaSetting"("branchId");
CREATE INDEX "BranchQuotaSetting_branchId_idx" ON "BranchQuotaSetting"("branchId");

ALTER TABLE "BranchQuotaSetting"
  ADD CONSTRAINT "BranchQuotaSetting_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "StockLocation"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BranchQuotaSetting"
  ADD CONSTRAINT "BranchQuotaSetting_rollingWindowDays_check"
  CHECK ("rollingWindowDays" >= 1 AND "rollingWindowDays" <= 365);

ALTER TABLE "BranchQuotaSetting"
  ADD CONSTRAINT "BranchQuotaSetting_revenueTarget_check"
  CHECK ("revenueTarget" IS NULL OR "revenueTarget" >= 0);

ALTER TABLE "BranchQuotaSetting"
  ADD CONSTRAINT "BranchQuotaSetting_unitsTarget_check"
  CHECK ("unitsTarget" IS NULL OR "unitsTarget" >= 0);
