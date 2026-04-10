import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

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

const optionalDateSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => normalizeDateFilter(value));

const purchaseOrderItemSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
});

const purchaseOrderReceiveItemSchema = z.object({
  itemId: z.string().uuid("Invalid purchase order item."),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
});

export const purchaseOrderFormSchema = z.object({
  supplierId: z.string().uuid("Select a valid supplier."),
  locationId: z.string().uuid("Select a valid warehouse."),
  expectedDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: "Enter a valid expected date.",
    }),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  items: z.array(purchaseOrderItemSchema).min(1, "Add at least one item."),
});

export const purchaseOrderListQuerySchema = z
  .object({
    query: z.string().trim().max(150).optional().default(""),
    status: z
      .enum(["all", "DRAFT", "APPROVED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"])
      .optional()
      .catch("all")
      .default("all"),
    dateFrom: optionalDateSchema,
    dateTo: optionalDateSchema,
  })
  .merge(paginationQuerySchema);

export const purchaseOrderReceiveSchema = z.object({
  warehouseId: z.string().uuid("Select a valid warehouse."),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  items: z.array(purchaseOrderReceiveItemSchema).min(1, "Add at least one line."),
});

export type PurchaseOrderFormData = z.output<typeof purchaseOrderFormSchema>;
export type PurchaseOrderListFilters = z.output<typeof purchaseOrderListQuerySchema>;
export type PurchaseOrderReceiveData = z.output<typeof purchaseOrderReceiveSchema>;

export type PurchaseOrderFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  itemErrors?: Array<string | undefined>;
  values?: Record<string, string>;
};

export type PurchaseOrderReceiveState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export type ExtractedPurchaseOrderFormValues = {
  supplierId: string;
  locationId: string;
  expectedDate: string;
  notes: string;
  itemsPayload: string;
  items: unknown;
};

export type ExtractedPurchaseOrderReceiveValues = {
  warehouseId: string;
  notes: string;
  items: Array<{
    itemId: string;
    quantity: string;
  }>;
};

export const initialPurchaseOrderFormState: PurchaseOrderFormState = {
  status: "idle",
};

export const initialPurchaseOrderReceiveState: PurchaseOrderReceiveState = {
  status: "idle",
};

export function parsePurchaseOrderListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  const parsed = purchaseOrderListQuerySchema.parse({
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

export function extractPurchaseOrderFormValues(
  formData: FormData
): ExtractedPurchaseOrderFormValues {
  const itemsPayload = String(formData.get("itemsPayload") ?? "");

  return {
    supplierId: String(formData.get("supplierId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    expectedDate: String(formData.get("expectedDate") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    itemsPayload,
    items: parseItemsPayload(itemsPayload),
  };
}

export function extractPurchaseOrderReceiveValues(
  formData: FormData
): ExtractedPurchaseOrderReceiveValues {
  const itemIndexes = new Set<number>();

  for (const [key] of formData.entries()) {
    const match = /^items\[(\d+)\]\.(itemId|quantity)$/.exec(key);

    if (match) {
      itemIndexes.add(Number.parseInt(match[1], 10));
    }
  }

  const items = [...itemIndexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      itemId: String(formData.get(`items[${index}].itemId`) ?? ""),
      quantity: String(formData.get(`items[${index}].quantity`) ?? ""),
    }));

  return {
    warehouseId: String(formData.get("warehouseId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    items,
  };
}
