import { z } from "zod";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "Category name is required.").max(80),
  description: z
    .string()
    .trim()
    .max(240, "Description must be 240 characters or fewer.")
    .optional()
    .transform((value) => value || null),
});

export const categoryListQuerySchema = z.object({
  query: z.string().trim().max(120).optional().default(""),
  sortBy: z
    .enum(["updatedAt", "createdAt", "name", "productCount"])
    .optional()
    .catch("updatedAt")
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).optional().catch("desc").default("desc"),
});

export type CategoryFormData = z.output<typeof categoryFormSchema>;
export type CategoryListFilters = z.output<typeof categoryListQuerySchema>;

export type CategoryFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialCategoryFormState: CategoryFormState = {
  status: "idle",
};

export function parseCategoryListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return categoryListQuerySchema.parse({
    query: firstString(searchParams.query),
    sortBy: firstString(searchParams.sortBy),
    sortOrder: firstString(searchParams.sortOrder),
  });
}

export function extractCategoryFormValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}
