import { z } from "zod";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The known module prefixes that appear in AuditLog.action values.
 * Each action is formatted as "<module>.<verb>", e.g. "inventory.adjust".
 */
export const AUDIT_LOG_MODULES = [
  "all",
  "inventory",
  "sales_order",
  "purchase_order",
  "product",
  "supplier",
  "user",
  "location",
  "category",
  "brand",
] as const;

export type AuditLogModule = (typeof AUDIT_LOG_MODULES)[number];

export const AUDIT_LOG_MODULE_LABELS: Record<AuditLogModule, string> = {
  all: "All modules",
  inventory: "Inventory",
  sales_order: "Sales Orders",
  purchase_order: "Purchase Orders",
  product: "Products",
  supplier: "Suppliers",
  user: "Users",
  location: "Locations",
  category: "Categories",
  brand: "Brands",
};

export const auditLogFiltersSchema = z.object({
  module: z
    .enum(AUDIT_LOG_MODULES)
    .optional()
    .catch("all")
    .default("all"),
  dateFrom: z.coerce.date().optional().catch(undefined),
  dateTo: z.coerce.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(50).default(50),
});

export type AuditLogFilters = z.output<typeof auditLogFiltersSchema>;

export function parseAuditLogFilters(
  searchParams: Record<string, string | string[] | undefined>
): AuditLogFilters {
  return auditLogFiltersSchema.parse({
    module: firstString(searchParams.module),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}
