import { z } from "zod";
import { INVENTORY_MOVEMENT_TYPES } from "@/lib/inventory";

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

export const inventoryFiltersSchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  locationId: optionalUuidFilter,
  categoryId: optionalUuidFilter,
  supplierId: optionalUuidFilter,
  lowStockOnly: booleanishField,
  movementType: z
    .enum(["all", ...INVENTORY_MOVEMENT_TYPES])
    .optional()
    .catch("all")
    .default("all"),
  dateFrom: optionalDateFilter,
  dateTo: optionalDateFilter,
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  locationId: z.string().uuid("Select a valid location."),
  direction: z.enum(["increase", "decrease"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  reason: z
    .string()
    .trim()
    .min(3, "Reason is required.")
    .max(120, "Reason must be 120 characters or fewer."),
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

export type InventoryPageFilters = z.output<typeof inventoryFiltersSchema>;
export type InventoryAdjustmentValues = z.input<typeof inventoryAdjustmentSchema>;
export type InventoryAdjustmentData = z.output<typeof inventoryAdjustmentSchema>;
export type InventoryTransferValues = z.input<typeof inventoryTransferSchema>;
export type InventoryTransferData = z.output<typeof inventoryTransferSchema>;

type InventoryFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export type InventoryAdjustmentState = InventoryFormState;
export type InventoryTransferState = InventoryFormState;

export const initialInventoryAdjustmentState: InventoryAdjustmentState = {
  status: "idle",
};

export const initialInventoryTransferState: InventoryTransferState = {
  status: "idle",
};

export function parseInventoryFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return inventoryFiltersSchema.parse({
    query: firstString(searchParams.query),
    locationId: firstString(searchParams.locationId),
    categoryId: firstString(searchParams.categoryId),
    supplierId: firstString(searchParams.supplierId),
    lowStockOnly: firstString(searchParams.lowStockOnly),
    movementType: firstString(searchParams.movementType),
    dateFrom: firstString(searchParams.dateFrom),
    dateTo: firstString(searchParams.dateTo),
  });
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
