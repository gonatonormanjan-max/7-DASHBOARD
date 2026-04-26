import { z } from "zod";

const branchQuotaMetricSchema = z.enum(["revenue", "units"]);

function parseOptionalNumber(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return null;
    }

    return Number(trimmed);
  }

  return value;
}

const branchQuotaSettingsRowSchema = z.object({
  branchId: z.string().uuid("Select a valid branch."),
  rollingWindowDays: z.coerce
    .number()
    .int("Rolling window must be a whole number.")
    .min(1, "Rolling window must be at least 1 day.")
    .max(365, "Rolling window cannot exceed 365 days."),
  revenueTarget: z.preprocess(
    parseOptionalNumber,
    z
      .number("Revenue target must be a number.")
      .min(0, "Revenue target cannot be negative.")
      .nullable()
  ),
  unitsTarget: z.preprocess(
    parseOptionalNumber,
    z
      .number("Units target must be a number.")
      .int("Units target must be a whole number.")
      .min(0, "Units target cannot be negative.")
      .nullable()
  ),
});

export const branchQuotaSettingsSchema = z.object({
  metric: branchQuotaMetricSchema.default("revenue"),
  rows: z.array(branchQuotaSettingsRowSchema).min(1, "At least one active branch is required."),
});

export type BranchQuotaMetric = z.output<typeof branchQuotaMetricSchema>;
export type BranchQuotaSettingsData = z.output<typeof branchQuotaSettingsSchema>;

export type BranchQuotaSettingsFormValues = {
  metric: string;
  rows: Array<{
    branchId: string;
    rollingWindowDays: string;
    revenueTarget: string;
    unitsTarget: string;
  }>;
};

type ReportsFormState<TValues = Record<string, string>> = {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: TValues;
};

export type BranchQuotaSettingsState = ReportsFormState<BranchQuotaSettingsFormValues>;

export const initialBranchQuotaSettingsState: BranchQuotaSettingsState = {
  status: "idle",
};

export function parseBranchQuotaMetric(value: string | undefined) {
  return branchQuotaMetricSchema.catch("revenue").parse(value);
}

export function buildReportsFieldErrors(error: z.ZodError) {
  const fieldErrors = error.flatten().fieldErrors as Record<string, string[] | undefined>;

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

export function extractBranchQuotaSettingsValues(
  formData: FormData
): BranchQuotaSettingsFormValues {
  const rowIndexes = new Set<number>();

  for (const [key] of formData.entries()) {
    const match = /^rows\[(\d+)\]\.(branchId|rollingWindowDays|revenueTarget|unitsTarget)$/.exec(
      key
    );

    if (match) {
      rowIndexes.add(Number.parseInt(match[1], 10));
    }
  }

  const rows = [...rowIndexes]
    .sort((left, right) => left - right)
    .map((index) => ({
      branchId: String(formData.get(`rows[${index}].branchId`) ?? ""),
      rollingWindowDays: String(formData.get(`rows[${index}].rollingWindowDays`) ?? ""),
      revenueTarget: String(formData.get(`rows[${index}].revenueTarget`) ?? ""),
      unitsTarget: String(formData.get(`rows[${index}].unitsTarget`) ?? ""),
    }));

  return {
    metric: String(formData.get("metric") ?? "revenue"),
    rows,
  };
}
