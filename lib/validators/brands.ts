import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const brandFormSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required.").max(100),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .transform((value) => value || null),
});

export const brandListQuerySchema = z
  .object({
    query: z.string().trim().optional().default(""),
  })
  .merge(paginationQuerySchema);

export type BrandFormData = z.output<typeof brandFormSchema>;
export type BrandListFilters = z.output<typeof brandListQuerySchema>;

export type BrandFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialBrandFormState: BrandFormState = {
  status: "idle",
};

export function parseBrandListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return brandListQuerySchema.parse({
    query: firstString(searchParams.query),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}

export function extractBrandFormValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}
