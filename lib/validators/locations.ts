import { z } from "zod";
import { paginationQuerySchema } from "@/lib/pagination";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export const locationFormSchema = z.object({
  name: z.string().trim().min(1, "Required").max(100),
  code: z.string().trim().min(1, "Required").max(20).toUpperCase(),
  type: z.enum(["WAREHOUSE", "BRANCH"]),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((value) => value || null),
  managerName: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((value) => value || null),
  contactNumber: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((value) => value || null),
});

export const locationListQuerySchema = z
  .object({
    query: z.string().trim().max(120).optional().default(""),
    type: z
      .enum(["all", "WAREHOUSE", "BRANCH"])
      .optional()
      .catch("all")
      .default("all"),
    isActive: z
      .enum(["all", "true", "false"])
      .optional()
      .catch("all")
      .default("all"),
    sortBy: z
      .enum(["name", "code", "type", "updatedAt"])
      .optional()
      .catch("updatedAt")
      .default("updatedAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().catch("desc").default("desc"),
  })
  .merge(paginationQuerySchema);

export type LocationFormValues = z.input<typeof locationFormSchema>;
export type LocationFormData = z.output<typeof locationFormSchema>;
export type LocationListFilters = z.output<typeof locationListQuerySchema>;

export type LocationFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Record<string, string>;
};

export const initialLocationFormState: LocationFormState = {
  status: "idle",
};

export function parseLocationListFilters(
  searchParams: Record<string, string | string[] | undefined>
) {
  return locationListQuerySchema.parse({
    query: firstString(searchParams.query),
    type: firstString(searchParams.type),
    isActive: firstString(searchParams.isActive),
    sortBy: firstString(searchParams.sortBy),
    sortOrder: firstString(searchParams.sortOrder),
    page: firstString(searchParams.page),
    pageSize: firstString(searchParams.pageSize),
  });
}

export function extractLocationFormValues(formData: FormData): LocationFormValues {
  return {
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    type: formData.get("type") === "BRANCH" ? "BRANCH" : "WAREHOUSE",
    address: String(formData.get("address") ?? ""),
    managerName: String(formData.get("managerName") ?? ""),
    contactNumber: String(formData.get("contactNumber") ?? ""),
  };
}
