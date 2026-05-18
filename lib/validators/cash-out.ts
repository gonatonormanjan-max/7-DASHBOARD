import { CashOutTransactionStatus } from "@prisma/client";
import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeDateFilter(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => normalizeDateFilter(value));

const moneySchema = z.coerce
  .number()
  .finite("Enter a valid amount.")
  .max(9_999_999.99, "Amount is too large.");

export const CASH_OUT_STATUS_OPTIONS = [
  "all",
  CashOutTransactionStatus.COMPLETED,
  CashOutTransactionStatus.VOIDED,
] as const;

export const cashOutCreateFormSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  accountId: z.string().uuid("Select a valid online account."),
  customerName: z
    .string()
    .trim()
    .max(150, "Customer name must be 150 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  customerContact: z
    .string()
    .trim()
    .max(80, "Customer contact must be 80 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  cashOutAmount: moneySchema.positive("Cash-out amount must be greater than 0."),
  feeAmount: moneySchema.min(0, "Fee cannot be negative."),
  onlineReferenceNumber: z
    .string()
    .trim()
    .min(3, "Enter the customer's online transfer reference.")
    .max(150, "Reference must be 150 characters or fewer."),
  notes: z
    .string()
    .trim()
    .max(1000, "Notes must be 1,000 characters or fewer.")
    .optional()
    .transform((value) => value || null),
});

export const cashOutVoidFormSchema = z.object({
  transactionId: z.string().uuid("Invalid cash-out transaction."),
  voidReason: z
    .string()
    .trim()
    .min(5, "Add a void reason with at least 5 characters.")
    .max(500, "Void reason must be 500 characters or fewer."),
});

export const cashOutAccountFormSchema = z.object({
  accountId: z.string().uuid().optional().or(z.literal("")),
  name: z
    .string()
    .trim()
    .min(2, "Account name is required.")
    .max(80, "Account name must be 80 characters or fewer."),
  provider: z
    .string()
    .trim()
    .max(80, "Provider must be 80 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  accountName: z
    .string()
    .trim()
    .max(120, "Account holder must be 120 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  accountNumber: z
    .string()
    .trim()
    .max(120, "Account number must be 120 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  isActive: z.coerce.boolean().optional().default(true),
});

export const cashOutListQuerySchema = z
  .object({
    query: z.string().trim().max(150).optional().default(""),
    branchId: z.string().trim().optional().default("all"),
    accountId: z.string().trim().optional().default("all"),
    status: z.enum(CASH_OUT_STATUS_OPTIONS).optional().catch("all").default("all"),
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
  })
  .merge(paginationQuerySchema);

export type CashOutCreateFormData = z.output<typeof cashOutCreateFormSchema>;
export type CashOutListFilters = z.output<typeof cashOutListQuerySchema>;
export type CashOutStatusFilter = (typeof CASH_OUT_STATUS_OPTIONS)[number];

export type CashOutFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialCashOutFormState: CashOutFormState = {
  status: "idle",
};

function normalizeOrderedDateFilters<T extends { dateFrom?: string; dateTo?: string }>(
  filters: T
) {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    return {
      ...filters,
      dateFrom: filters.dateTo,
      dateTo: filters.dateFrom,
    };
  }

  return filters;
}

export function parseCashOutListFilters(
  searchParams: Record<string, string | string[] | undefined>
): CashOutListFilters {
  const parsed = cashOutListQuerySchema.parse({
    query: firstString(searchParams.query),
    branchId: firstString(searchParams.branchId),
    accountId: firstString(searchParams.accountId),
    status: firstString(searchParams.status),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });

  return normalizeOrderedDateFilters(parsed);
}

export function extractCashOutCreateFormValues(formData: FormData) {
  return {
    branchId: String(formData.get("branchId") ?? ""),
    accountId: String(formData.get("accountId") ?? ""),
    customerName: String(formData.get("customerName") ?? ""),
    customerContact: String(formData.get("customerContact") ?? ""),
    cashOutAmount: String(formData.get("cashOutAmount") ?? ""),
    feeAmount: String(formData.get("feeAmount") ?? ""),
    onlineReferenceNumber: String(formData.get("onlineReferenceNumber") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export function extractCashOutVoidFormValues(formData: FormData) {
  return {
    transactionId: String(formData.get("transactionId") ?? ""),
    voidReason: String(formData.get("voidReason") ?? ""),
  };
}

export function extractCashOutAccountFormValues(formData: FormData) {
  return {
    accountId: String(formData.get("accountId") ?? ""),
    name: String(formData.get("name") ?? ""),
    provider: String(formData.get("provider") ?? ""),
    accountName: String(formData.get("accountName") ?? ""),
    accountNumber: String(formData.get("accountNumber") ?? ""),
    isActive: formData.get("isActive") === "on",
  };
}
