import { z } from "zod";

export const WALK_IN_CUSTOMER_NAME = "Walk-in Customer";

const salesOrderCustomerSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required.").max(120),
  customerEmail: z
    .string()
    .trim()
    .max(160, "Email must be 160 characters or fewer.")
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || z.email().safeParse(value).success, {
      message: "Enter a valid email address.",
    }),
  notes: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  itemsPayload: z.string().trim().min(1, "Add at least one sale item."),
});

const salesOrderLineItemSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  locationId: z.string().uuid("Select a valid location."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative."),
  priceOverridden: z.boolean().optional().default(false),
  locationOverridden: z.boolean().optional().default(false),
});

export type ParsedSalesOrderLineItem = z.infer<typeof salesOrderLineItemSchema>;

export type SalesOrderFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  itemErrors?: Array<string | undefined>;
  values?: Record<string, string>;
};

export const initialSalesOrderFormState: SalesOrderFormState = {
  status: "idle",
};

export function extractSalesOrderFormValues(formData: FormData) {
  return {
    customerName: String(formData.get("customerName") ?? ""),
    customerEmail: String(formData.get("customerEmail") ?? ""),
    notes: String(formData.get("notes") ?? ""),
    itemsPayload: String(formData.get("itemsPayload") ?? ""),
    customerMode: String(formData.get("customerMode") ?? ""),
    defaultLocationId: String(formData.get("defaultLocationId") ?? ""),
  };
}

export function parseSalesOrderCustomer(values: Record<string, string>) {
  return salesOrderCustomerSchema.safeParse(values);
}

export function parseSalesOrderItems(itemsPayload: string) {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(itemsPayload);
  } catch {
    return {
      success: false as const,
      itemErrors: undefined,
      error: {
        flatten: () => ({
          fieldErrors: {
            itemsPayload: ["We could not read the sale items. Please try again."],
          },
        }),
      },
    };
  }

  if (!Array.isArray(parsedJson)) {
    return {
      success: false as const,
      itemErrors: undefined,
      error: {
        flatten: () => ({
          fieldErrors: {
            itemsPayload: ["We could not read the sale items. Please try again."],
          },
        }),
      },
    };
  }

  if (parsedJson.length === 0) {
    return {
      success: false as const,
      itemErrors: undefined,
      error: {
        flatten: () => ({
          fieldErrors: {
            itemsPayload: ["Add at least one item to the sale."],
          },
        }),
      },
    };
  }

  const itemErrors: Array<string | undefined> = new Array(parsedJson.length).fill(undefined);
  const parsedItems: ParsedSalesOrderLineItem[] = [];

  for (const [index, rawItem] of parsedJson.entries()) {
    const result = salesOrderLineItemSchema.safeParse(rawItem);

    if (!result.success) {
      itemErrors[index] = result.error.issues[0]?.message ?? "Fix this sale line.";
      continue;
    }

    parsedItems.push(result.data);
  }

  if (itemErrors.some(Boolean)) {
    return {
      success: false as const,
      itemErrors,
      error: {
        flatten: () => ({
          fieldErrors: {
            itemsPayload: ["Fix the highlighted sale lines before recording."],
          },
        }),
      },
    };
  }

  return {
    success: true as const,
    data: parsedItems,
  };
}

export function normalizeSalesOrderItems(items: ParsedSalesOrderLineItem[]) {
  const merged = new Map<string, ParsedSalesOrderLineItem>();

  for (const item of items) {
    const key = `${item.productId}:${item.locationId}:${item.unitPrice.toFixed(2)}`;
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += item.quantity;
      existing.priceOverridden = existing.priceOverridden || item.priceOverridden;
      existing.locationOverridden =
        existing.locationOverridden || item.locationOverridden;
      continue;
    }

    merged.set(key, { ...item });
  }

  return [...merged.values()];
}
