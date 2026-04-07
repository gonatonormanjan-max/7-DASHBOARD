import { MovementType, ProductStatus } from "@prisma/client";

export const INVENTORY_MUTABLE_PRODUCT_STATUSES = [
  ProductStatus.ACTIVE,
  ProductStatus.INACTIVE,
] as const;

export const INVENTORY_MOVEMENT_TYPES = [
  MovementType.PURCHASE_RECEIVED,
  MovementType.SALES_FULFILLED,
  MovementType.MANUAL_ADJUSTMENT,
  MovementType.TRANSFER_OUT,
  MovementType.TRANSFER_IN,
  MovementType.CUSTOMER_RETURN,
  MovementType.DAMAGED_LOST,
] as const;

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  PURCHASE_RECEIVED: "Purchase received",
  SALES_FULFILLED: "Sales fulfilled",
  MANUAL_ADJUSTMENT: "Manual adjustment",
  TRANSFER_OUT: "Transfer out",
  TRANSFER_IN: "Transfer in",
  CUSTOMER_RETURN: "Customer return",
  DAMAGED_LOST: "Damaged or lost",
};

export function getMovementTypeLabel(type: MovementType) {
  return MOVEMENT_TYPE_LABELS[type];
}

export function formatSignedQuantity(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;
}

export function getAvailableQuantity(quantity: number, reservedQty: number) {
  return quantity - reservedQty;
}
