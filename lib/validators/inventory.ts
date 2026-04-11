import { z } from "zod";
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/inventory";
import { paginationQuerySchema } from "@/lib/pagination";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const optionalUuidFilter = z.string().uuid().optional().catch(undefined);

const optionalTextArea = z
  .string()
  .trim()
  .max(500, "Notes must be 500 characters or fewer.")
  .optional()
  .transform((value) => value || null);

const booleanishField = z.preprocess((value) => {
  if (value === "true" || value === "on" || value === true) {
    return true;
  }
  if (
    value === "false" ||
    value === false ||
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return false;
  }
  return value;
}, z.boolean().catch(false).default(false));

const optionalDateFilter = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .optional()
  .catch(undefined);

const inventoryAdjustmentReasonValues = [
  "count_correction",
  "damage_loss",
  "expired",
  "other",
] as const;

const inventoryTabValues = ["stock", "movements", "low-stock"] as const;
const inventoryStockSortFieldValues = [
  "name",
  "sku",
  "category",
  "brand",
  "quantity",
  "reservedQty",
  "availableQty",
  "reorderLevel",
] as const;

export const inventoryFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  locationId: optionalUuidFilter,
  categoryId: optionalUuidFilter,
  brandId: optionalUuidFilter,
  lowStockOnly: booleanishField,
  movementType: z
    .enum(["all", ...INVENTORY_MOVEMENT_TYPES])
    .optional()
    .catch("all")
    .default("all"),
  dateFrom: optionalDateFilter,
  dateTo: optionalDateFilter,
  sortBy: z
    .enum(inventoryStockSortFieldValues)
    .optional()
    .catch("name")
    .default("name"),
  sortOrder: z.enum(["asc", "desc"]).optional().catch("asc").default("asc"),
}).merge(paginationQuerySchema);

export const inventoryTabSchema = z
  .enum(inventoryTabValues)
  .optional()
  .catch("stock")
  .default("stock");

export const inventoryAdjustmentReasonSchema = z.enum(inventoryAdjustmentReasonValues);

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  locationId: z.string().uuid("Select a valid location."),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  reason: inventoryAdjustmentReasonSchema,
  notes: optionalTextArea,
});

export const inventoryTransferSchema = z
  .object({
    productId: z.string().uuid("Select a valid product."),
    fromLocationId: z.string().uuid("Select a valid source location."),
    toLocationId: z.string().uuid("Select a valid destination location."),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
    notes: optionalTextArea,
  })
  .refine((value) => value.fromLocationId !== value.toLocationId, {
    message: "Choose different locations for the transfer.",
    path: ["toLocationId"],
  });

const supplierReceiptItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitCost: z.coerce.number().min(0, "Unit cost cannot be negative."),
});

export const supplierReceiptSchema = z.object({
  supplierId: z.string().uuid(),
  locationId: z.string().uuid(),
  referenceNumber: z
    .string()
    .trim()
    .max(50, "Reference number must be 50 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  notes: optionalTextArea,
  items: z.array(supplierReceiptItemSchema).min(1, "Add at least one product line"),
});

export const initialStockSchema = z.object({
  productId: z.string().uuid(),
  locationId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  notes: optionalTextArea,
});

const bulkStockSetupReasonValues = [
  "new_branch_setup",
  "warehouse_migration",
  "system_import",
  "other",
] as const;

const bulkStockSetupItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
});

export const bulkStockSetupSchema = z.object({
  locationId: z.string().uuid("Select a location."),
  reason: z.enum(bulkStockSetupReasonValues, {
    error: "Select a reason.",
  }),
  notes: optionalTextArea,
  items: z
    .array(bulkStockSetupItemSchema)
    .min(1, "At least one product must have a quantity change."),
});

export type InventoryPageFilters = z.output<typeof inventoryFiltersSchema>;
export type InventoryTab = z.output<typeof inventoryTabSchema>;
export type InventoryStockSortField = (typeof inventoryStockSortFieldValues)[number];
export type InventoryAdjustmentValues = z.input<typeof inventoryAdjustmentSchema>;
export type InventoryAdjustmentData = z.output<typeof inventoryAdjustmentSchema>;
export type InventoryTransferValues = z.input<typeof inventoryTransferSchema>;
export type InventoryTransferData = z.output<typeof inventoryTransferSchema>;
export type InventoryAdjustmentReason = z.output<typeof inventoryAdjustmentReasonSchema>;
export type SupplierReceiptData = z.output<typeof supplierReceiptSchema>;
export type InitialStockData = z.output<typeof initialStockSchema>;

export type BulkStockSetupReason = (typeof bulkStockSetupReasonValues)[number];
export type BulkStockSetupData = z.output<typeof bulkStockSetupSchema>;

export type BulkStockSetupFormValues = {
  locationId: string;
  reason: string;
  notes: string;
  items: Array<{
    productId: string;
    quantity: string;
  }>;
};

export type BulkStockSetupState = InventoryFormState<BulkStockSetupFormValues>;

export const initialBulkStockSetupState: BulkStockSetupState = {
  status: "idle",
};

export function extractBulkStockSetupValues(formData: FormData): BulkStockSetupFormValues {
  const itemIndexes = new Set<number>();

  for (const [key] of formData.entries()) {
    const match = /^items\[(\d+)\]\.(productId|quantity)$/.exec(key);

    if (match) {
      itemIndexes.add(Number.parseInt(match[1], 10));
    }
  }

  const items = [...itemIndexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      productId: String(formData.get(`items[${index}].productId`) ?? ""),
      quantity: String(formData.get(`items[${index}].quantity`) ?? ""),
    }));

  return {
    locationId: String(formData.get("locationId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    items,
  };
}

export type SupplierReceiptFormValues = {
  supplierId: string;
  locationId: string;
  referenceNumber: string;
  notes: string;
  items: Array<{
    productId: string;
    quantity: string;
    unitCost: string;
  }>;
};

export type InitialStockFormValues = {
  productId: string;
  locationId: string;
  quantity: string;
  notes: string;
};

type InventoryFormState<TValues = Record<string, string>> = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: TValues;
};

export type InventoryAdjustmentState = InventoryFormState;
export type InventoryTransferState = InventoryFormState;
export type SupplierReceiptState = InventoryFormState<SupplierReceiptFormValues>;
export type InitialStockState = InventoryFormState<InitialStockFormValues>;

export const initialInventoryAdjustmentState: InventoryAdjustmentState = {
  status: "idle",
};

export const initialInventoryTransferState: InventoryTransferState = {
  status: "idle",
};

export const initialSupplierReceiptState: SupplierReceiptState = {
  status: "idle",
};

export const initialInitialStockState: InitialStockState = {
  status: "idle",
};

export function buildInventoryFieldErrors(error: z.ZodError) {
  const fieldErrors = error.flatten()
    .fieldErrors as Record<string, string[] | undefined>;

  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      continue;
    }

    const key = issue.path.join(".");
    const existing = fieldErrors[key] ?? [];

    if (!existing.includes(issue.message)) {
      fieldErrors[key] = [...existing, issue.message];
    }
  }

  return fieldErrors;
}

export function parseInventoryFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return inventoryFiltersSchema.parse({
    query: firstString(searchParams.query),
    locationId: firstString(searchParams.locationId),
    categoryId: firstString(searchParams.categoryId),
    brandId: firstString(searchParams.brandId),
    lowStockOnly: firstString(searchParams.lowStockOnly),
    movementType: firstString(searchParams.movementType),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
    sortBy: firstString(searchParams.sortBy),
    sortOrder: firstString(searchParams.sortOrder),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}

export function parseInventoryTab(
  searchParams: Record<string, string | string[] | undefined>
) {
  return inventoryTabSchema.parse(firstString(searchParams.tab));
}

export function extractInventoryAdjustmentValues(formData: FormData) {
  return {
    productId: String(formData.get("productId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    direction: String(formData.get("direction") ?? "increase"),
    quantity: String(formData.get("quantity") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export function extractInventoryTransferValues(formData: FormData) {
  return {
    productId: String(formData.get("productId") ?? ""),
    fromLocationId: String(formData.get("fromLocationId") ?? ""),
    toLocationId: String(formData.get("toLocationId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export function extractSupplierReceiptValues(formData: FormData): SupplierReceiptFormValues {
  const itemIndexes = new Set<number>();

  for (const [key] of formData.entries()) {
    const match = /^items\[(\d+)\]\.(productId|quantity|unitCost)$/.exec(key);

    if (match) {
      itemIndexes.add(Number.parseInt(match[1], 10));
    }
  }

  const items = [...itemIndexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      productId: String(formData.get(`items[${index}].productId`) ?? ""),
      quantity: String(formData.get(`items[${index}].quantity`) ?? ""),
      unitCost: String(formData.get(`items[${index}].unitCost`) ?? ""),
    }));

  return {
    supplierId: String(formData.get("supplierId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    referenceNumber: String(formData.get("referenceNumber") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    items,
  };
}

export function extractInitialStockValues(formData: FormData): InitialStockFormValues {
  return {
    productId: String(formData.get("productId") ?? ""),
    locationId: String(formData.get("locationId") ?? ""),
    quantity: String(formData.get("quantity") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}
