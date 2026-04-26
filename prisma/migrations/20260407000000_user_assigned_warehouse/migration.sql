-- Add assignedWarehouseId to User for branch-locked cashier access
ALTER TABLE "User" ADD COLUMN "assignedWarehouseId" TEXT;

ALTER TABLE "User" ADD CONSTRAINT "User_assignedWarehouseId_fkey"
  FOREIGN KEY ("assignedWarehouseId") REFERENCES "Warehouse"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
