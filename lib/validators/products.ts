import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";
import { PRODUCT_MUTABLE_STATUSES, PRODUCT_SORT_FIELDS } from "@/lib/products";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const decimalField = z
  .string()
  .trim()
  .min(1, "This field is required.")
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), "Enter a valid number.")
  .refine((value) => value >= 0, "Value cannot be negative.");

const optionalUuid = z
  .string()
  .uuid("Select a valid option.")
  .or(z.literal(""))
  .transform((value) => value || null);

export const productFormSchema = z.object({
  name: z.string().trim().min(1, "Product name is required.").max(120),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required.")
    .max(64)
    .transform((value) => value.toUpperCase()),
  categoryId: z.string().uuid("Category is required."),
  brandId: optionalUuid,
  unitPrice: decimalField,
  costPrice: decimalField,
  reorderLevel: z
    .string()
    .trim()
    .optional()
    .default("0")
    .transform((value) => Math.max(0, parseInt(value || "0", 10)))
    .refine(
      (value) => Number.isInteger(value) && value >= 0,
      "Must be a whole number of 0 or more."
    ),
  imageUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .max(512)
    .optional()
    .or(z.literal(""))
    .transform((value) => value || null),
  description: z
    .string()
    .trim()
    .max(1500, "Description must be 1500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
  status: z.enum(PRODUCT_MUTABLE_STATUSES),
});

export const inlineCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(80),
  description: z
    .string()
    .trim()
    .max(240, "Description must be 240 characters or fewer.")
    .optional()
    .transform((value) => value || null),
});

export const productListQuerySchema = z
  .object({
    query: z.string().trim().max(120).optional().default(""),
    categoryId: z.string().uuid().optional().catch(undefined),
    brandId: z.string().uuid().optional().catch(undefined),
    status: z
      .enum(["visible", "all", "ACTIVE", "INACTIVE", "ARCHIVED"])
      .optional()
      .catch("visible")
      .default("visible"),
    sortBy: z.enum(PRODUCT_SORT_FIELDS).optional().catch("updatedAt").default("updatedAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().catch("desc").default("desc"),
  })
  .merge(paginationQuerySchema);

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;
export type InlineCategoryData = z.output<typeof inlineCategorySchema>;
export type ProductListFilters = z.output<typeof productListQuerySchema>;

export type ProductFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialProductFormState: ProductFormState = {
  status: "idle",
};

export type InlineCategoryState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  createdCategory?: {
    id: string;
    name: string;
  };
};

export const initialInlineCategoryState: InlineCategoryState = {
  status: "idle",
};

export function parseProductListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return productListQuerySchema.parse({
    query: firstString(searchParams.query),
    categoryId: firstString(searchParams.categoryId),
    brandId: firstString(searchParams.brandId),
    status: firstString(searchParams.status),
    sortBy: firstString(searchParams.sortBy),
    sortOrder: firstString(searchParams.sortOrder),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}

export function extractProductFormValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    brandId: String(formData.get("brandId") ?? ""),
    unitPrice: String(formData.get("unitPrice") ?? ""),
    costPrice: String(formData.get("costPrice") ?? ""),
    reorderLevel: String(formData.get("reorderLevel") ?? "0"),
    imageUrl: String(formData.get("imageUrl") ?? ""),
    description: String(formData.get("description") ?? ""),
    status: String(formData.get("status") ?? "ACTIVE"),
  };
}

export function extractInlineCategoryValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}
