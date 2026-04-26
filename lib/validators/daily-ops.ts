import { BUSINESS_TIMEZONE } from "@/lib/timezone";
import { z } from "zod";

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const optionalNotes = z
  .string()
  .trim()
  .max(500, "Notes must be 500 characters or fewer.")
  .optional()
  .transform((value) => value || null);

const optionalUuid = z.string().uuid().optional().catch(undefined);

const businessDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid business date.");

export const stockCountTypeSchema = z.enum(["OPENING", "CLOSING"]);
export const issueReportStatusFilterSchema = z
  .enum(["all", "OPEN", "ACKNOWLEDGED", "RESOLVED"])
  .optional()
  .catch("all")
  .default("all");
export const issueReportStatusSchema = z.enum(["ACKNOWLEDGED", "RESOLVED"]);

export const stockCountLineSchema = z.object({
  productId: z.string().uuid("Select a valid product."),
  countedQty: z.coerce.number().int().min(0, "Counted quantity cannot be negative."),
  notes: optionalNotes,
});

export const saveStockCountSchema = z.object({
  countId: optionalUuid,
  locationId: z.string().uuid("Select a valid branch."),
  type: stockCountTypeSchema,
  countDate: businessDateSchema,
  lines: z.array(stockCountLineSchema).min(1, "Add at least one stock count line."),
});

export const issueReportSchema = z.object({
  branchId: optionalUuid,
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters.")
    .max(120, "Title must be 120 characters or fewer."),
  body: z
    .string()
    .trim()
    .min(10, "Describe the issue in at least 10 characters.")
    .max(2000, "Issue details must be 2000 characters or fewer."),
});

export const changeFundAllocationSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  amount: z.coerce.number().min(0, "Amount cannot be negative."),
  notes: optionalNotes,
});

export type SaveStockCountData = z.output<typeof saveStockCountSchema>;
export type IssueReportData = z.output<typeof issueReportSchema>;
export type ChangeFundAllocationData = z.output<typeof changeFundAllocationSchema>;
export type IssueReportStatusFilter = z.output<typeof issueReportStatusFilterSchema>;

export function parseStockCountLinesPayload(formData: FormData) {
  const rawPayload = String(formData.get("linesPayload") ?? "[]");

  try {
    const parsed = JSON.parse(rawPayload);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getTodayBusinessDateInput() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function parseIssueReportStatusFilter(
  searchParams: Record<string, string | string[] | undefined>
) {
  return issueReportStatusFilterSchema.parse(firstString(searchParams.status));
}
