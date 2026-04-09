-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SalesOrder_archivedAt_idx" ON "SalesOrder"("archivedAt");
