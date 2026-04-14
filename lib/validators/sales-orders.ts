import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";
export const SALES_ORDER_PAYMENT_MODES = ["CASH", "ONLINE", "MIXED"] as const;
export const SALES_ORDER_INTENTS = ["draft", "record", "record_and_new"] as const;
export const SALES_ORDER_VOID_REASONS = [
  "DEFECT",
  "RETURNED_REFUND",
  "REPLACE",
  "OTHERS",
] as const;

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseItemsPayload(itemsPayload: string): unknown {
  if (!itemsPayload.trim()) {
    return [];
  }

  try {
    return JSON.parse(itemsPayload);
  } catch {
    return null;
  }
}

function normalizeDateFilter(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

const salesOrderItemSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  locationId: z.string().uuid("Select a valid branch.").optional(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
});

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => normalizeDateFilter(value));

export const salesOrderFormSchema = z.object({
  locationId: z.string().uuid("Select a valid branch."),
  customerName: z.string().trim().max(150, "Customer name must be 150 characters or fewer."),
  customerEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  items: z.array(salesOrderItemSchema).min(1, "Add at least one item"),
});

export const salesOrderListQuerySchema = z
  .object({
    query: z.string().trim().max(150).optional().default(""),
    status: z
      .enum(["all", "DRAFT", "CONFIRMED", "DELIVERED", "COMPLETED", "CANCELLED"])
      .optional()
      .catch("all")
      .default("all"),
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
  })
  .merge(paginationQuerySchema);

export type SalesOrderFormData = z.output<typeof salesOrderFormSchema>;
export type SalesOrderListFilters = z.output<typeof salesOrderListQuerySchema>;

export type SalesOrderFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  itemErrors?: Array<string | undefined>;
  values?: Record<string, string>;
};

export type SalesOrderVoidFormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export type ExtractedSalesOrderFormValues = {
  locationId: string;
  customerName: string;
  customerEmail: string;
  notes: string;
  itemsPayload: string;
  items: unknown;
  intent: string;
  paymentMode: string;
  cashAmount: string;
  onlineAmount: string;
  customerMode: string;
  defaultLocationId: string;
};

export const initialSalesOrderFormState: SalesOrderFormState = {
  status: "idle",
};

export const initialSalesOrderVoidFormState: SalesOrderVoidFormState = {
  status: "idle",
};

export const salesOrderVoidFormSchema = z.object({
  orderId: z.string().uuid("Invalid sales order."),
  voidReason: z.enum(SALES_ORDER_VOID_REASONS, {
    error: "Select a valid return reason.",
  }),
  voidRemarks: z
    .string()
    .trim()
    .min(5, "Add a remark with at least 5 characters.")
    .max(500, "Remarks must be 500 characters or fewer."),
  voidDocumentation: z
    .string()
    .trim()
    .min(3, "Add documentation or reference details.")
    .max(500, "Documentation must be 500 characters or fewer."),
});

export function parseSalesOrderListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  const parsed = salesOrderListQuerySchema.parse({
    query: firstString(searchParams.query),
    status: firstString(searchParams.status),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });

  if (parsed.dateFrom && parsed.dateTo && parsed.dateFrom > parsed.dateTo) {
    return {
      ...parsed,
      dateFrom: parsed.dateTo,
      dateTo: parsed.dateFrom,
    };
  }

  return parsed;
}

export function extractSalesOrderFormValues(
  formData: FormData
): ExtractedSalesOrderFormValues {
  const itemsPayload = String(formData.get("itemsPayload") ?? "");
  const explicitLocationId = String(formData.get("locationId") ?? "");
  const defaultLocationId = String(formData.get("defaultLocationId") ?? "");
  const locationId = explicitLocationId || defaultLocationId;

  return {
    locationId,
    customerName: String(formData.get("customerName") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    itemsPayload,
    items: parseItemsPayload(itemsPayload),
    intent: String(formData.get("intent") ?? "draft"),
    paymentMode: String(formData.get("paymentMode") ?? ""),
    cashAmount: String(formData.get("cashAmount") ?? ""),
    onlineAmount: String(formData.get("onlineAmount") ?? ""),
    customerMode: String(formData.get("customerMode") ?? ""),
    defaultLocationId,
  };
}

export function extractSalesOrderVoidFormValues(formData: FormData) {
  return {
    orderId: String(formData.get("orderId") ?? "").trim(),
    voidReason: String(formData.get("voidReason") ?? "").trim(),
    voidRemarks: String(formData.get("voidRemarks") ?? "").trim(),
    voidDocumentation: String(formData.get("voidDocumentation") ?? "").trim(),
  };
}
