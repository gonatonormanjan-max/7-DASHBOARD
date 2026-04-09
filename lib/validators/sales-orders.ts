import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

export const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

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
  customerName: z.string().trim().min(1, "Customer name is required.").max(150),
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

export type ExtractedSalesOrderFormValues = {
  locationId: string;
  customerName: string;
  customerEmail: string;
  notes: string;
  itemsPayload: string;
  items: unknown;
  customerMode: string;
  defaultLocationId: string;
};

export const initialSalesOrderFormState: SalesOrderFormState = {
  status: "idle",
};

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
  const locationId = String(
    formData.get("locationId") ?? formData.get("defaultLocationId") ?? ""
  );

  return {
    locationId,
    customerName: String(formData.get("customerName") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    itemsPayload,
    items: parseItemsPayload(itemsPayload),
    customerMode: String(formData.get("customerMode") ?? ""),
    defaultLocationId: locationId,
  };
}