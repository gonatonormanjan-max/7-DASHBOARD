import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const supplierFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name is required.")
    .max(150, "Name must be 150 characters or fewer."),
  contactName: z
    .string()
    .trim()
    .max(100, "Contact name must be 100 characters or fewer.")
    .optional()
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .max(150, "Email must be 150 characters or fewer.")
    .optional()
    .transform((v) => v || null)
    .refine(
      (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Enter a valid email address."
    ),
  phone: z
    .string()
    .trim()
    .max(30, "Phone must be 30 characters or fewer.")
    .optional()
    .transform((v) => v || null),
  address: z
    .string()
    .trim()
    .max(300, "Address must be 300 characters or fewer.")
    .optional()
    .transform((v) => v || null),
  isActive: z.coerce.boolean().default(true),
});

export const inlineSupplierSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name is required.")
    .max(150, "Name must be 150 characters or fewer."),
  contactName: z
    .string()
    .trim()
    .max(100, "Contact name must be 100 characters or fewer.")
    .optional()
    .transform((v) => v || null),
  email: z
    .string()
    .trim()
    .max(150, "Email must be 150 characters or fewer.")
    .optional()
    .transform((v) => v || null)
    .refine(
      (v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Enter a valid email address."
    ),
});

export const supplierListQuerySchema = z
  .object({
    query: z.string().trim().max(150).optional().default(""),
    status: z
      .enum(["all", "active", "inactive"])
      .optional()
      .catch("all")
      .default("all"),
  })
  .merge(paginationQuerySchema);

export type SupplierFormData = z.output<typeof supplierFormSchema>;
export type InlineSupplierData = z.output<typeof inlineSupplierSchema>;
export type SupplierListFilters = z.output<typeof supplierListQuerySchema>;

export type SupplierFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export type InlineSupplierState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
  createdSupplier?: { id: string; name: string };
};

export const initialSupplierFormState: SupplierFormState = { status: "idle" };
export const initialInlineSupplierState: InlineSupplierState = { status: "idle" };

export function extractSupplierFormValues(
  formData: FormData
): Record<string, string> {
  return {
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    address: String(formData.get("address") ?? ""),
    isActive: String(formData.get("isActive") ?? "false"),
  };
}

export function extractInlineSupplierValues(
  formData: FormData
): Record<string, string> {
  return {
    name: String(formData.get("name") ?? ""),
    contactName: String(formData.get("contactName") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

export function parseSupplierListFilters(
  searchParams: Record<string, string | string[] | undefined>
): SupplierListFilters {
  return supplierListQuerySchema.parse({
    query: firstString(searchParams.query),
    status: firstString(searchParams.status),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}
