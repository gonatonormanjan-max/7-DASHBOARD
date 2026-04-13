import type { ProductStatus } from "@prisma/client";

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
};

export const PRODUCT_MUTABLE_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export type ProductListStatusFilter =
  | "visible"
  | "all"
  | "ACTIVE"
  | "INACTIVE"
  | "ARCHIVED";

export const PRODUCT_SORT_FIELDS = [
  "updatedAt",
  "name",
  "sku",
  "unitPrice",
  "status",
] as const;

export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export function formatCurrency(value: number | string) {
  const numericValue = typeof value === "number" ? value : Number(value);

  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}
