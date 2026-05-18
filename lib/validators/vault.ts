import { z } from "zod";
import { VaultPaymentMethod, VaultTransactionType } from "@prisma/client";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const VAULT_TRANSACTION_TYPES = [
  "all",
  VaultTransactionType.SALE,
  VaultTransactionType.VOID_REVERSAL,
  VaultTransactionType.CASH_DROP,
  VaultTransactionType.OPENING_FLOAT,
  VaultTransactionType.MANUAL_ADJUSTMENT,
  VaultTransactionType.CASH_OUT_PAYOUT,
  VaultTransactionType.CASH_OUT_VOID_REVERSAL,
] as const;

export const VAULT_TRANSACTION_TYPE_LABELS: Record<
  (typeof VAULT_TRANSACTION_TYPES)[number],
  string
> = {
  all: "All types",
  [VaultTransactionType.SALE]: "Sale",
  [VaultTransactionType.VOID_REVERSAL]: "Void reversal",
  [VaultTransactionType.CASH_DROP]: "Cash drop",
  [VaultTransactionType.OPENING_FLOAT]: "Opening float",
  [VaultTransactionType.MANUAL_ADJUSTMENT]: "Manual adjustment",
  [VaultTransactionType.CASH_OUT_PAYOUT]: "Cash out",
  [VaultTransactionType.CASH_OUT_VOID_REVERSAL]: "Cash-out reversal",
};

export const VAULT_PAYMENT_METHODS = [
  "all",
  VaultPaymentMethod.CASH,
  VaultPaymentMethod.ONLINE,
] as const;

export const VAULT_PAYMENT_METHOD_LABELS: Record<
  (typeof VAULT_PAYMENT_METHODS)[number],
  string
> = {
  all: "All methods",
  [VaultPaymentMethod.CASH]: "Cash",
  [VaultPaymentMethod.ONLINE]: "Online",
};

export const vaultFiltersSchema = z.object({
  branchId: z.string().trim().min(1).optional().catch(undefined),
  type: z.enum(VAULT_TRANSACTION_TYPES).optional().catch("all").default("all"),
  method: z.enum(VAULT_PAYMENT_METHODS).optional().catch("all").default("all"),
  // YYYY-MM-DD strings — converted to business-TZ boundaries in the page.
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  page: z.coerce.number().int().min(1).catch(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).catch(25).default(25),
});

export type VaultFilters = z.output<typeof vaultFiltersSchema>;

export function parseVaultFilters(
  searchParams: Record<string, string | string[] | undefined>
): VaultFilters {
  return vaultFiltersSchema.parse({
    branchId: firstString(searchParams.branchId),
    type: firstString(searchParams.type),
    method: firstString(searchParams.method),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}
