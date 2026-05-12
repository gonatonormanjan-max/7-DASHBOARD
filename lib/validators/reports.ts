import { z } from "zod";
import { BUSINESS_TIMEZONE } from "@/lib/timezone";

const branchQuotaMetricSchema = z.enum(["revenue", "units"]);
const dateInputSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const BRANCH_SALES_ORDER_STATUS_OPTIONS = [
  "DRAFT",
  "CONFIRMED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
const branchActivityBranchIdSchema = z
  .union([z.literal("all"), z.string().uuid()])
  .optional()
  .catch("all")
  .default("all");

export const DEFAULT_BRANCH_ACTIVITY_WINDOW_DAYS = 7;
export const MAX_BRANCH_ACTIVITY_WINDOW_DAYS = 90;
export const DEFAULT_BRANCH_SALES_ORDERS_PAGE_SIZE = 50;

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

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getBusinessDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateInputToUtcMs(dateInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function addDaysToDateInput(dateInput: string, days: number) {
  const date = new Date(dateInputToUtcMs(dateInput));
  date.setUTCDate(date.getUTCDate() + days);

  return [
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getInclusiveDateSpanDays(dateFrom: string, dateTo: string) {
  return Math.floor((dateInputToUtcMs(dateTo) - dateInputToUtcMs(dateFrom)) / 86_400_000) + 1;
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

export type BranchActivityFilters = {
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  days: number;
};

export type ReportsAnalyticsFilters = {
  analyticsDays: number;
  branchId: string | null;
};

export type BranchSalesOrderStatus = (typeof BRANCH_SALES_ORDER_STATUS_OPTIONS)[number];

export type BranchSalesOrdersFilters = {
  branchId: string | null;
  dateFrom: string;
  dateTo: string;
  days: number;
  status: BranchSalesOrderStatus | null;
  query: string;
  page: number;
  pageSize: number;
};

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

export function parseBranchActivityFilters(
  searchParams: Record<string, string | string[] | undefined>,
  todayInput = getBusinessDateInput()
): BranchActivityFilters {
  const fallbackDateTo = dateInputSchema.catch(getBusinessDateInput()).parse(todayInput);
  const fallbackDateFrom = addDaysToDateInput(
    fallbackDateTo,
    -(DEFAULT_BRANCH_ACTIVITY_WINDOW_DAYS - 1)
  );
  const rawBranchId = branchActivityBranchIdSchema.parse(firstString(searchParams.branchId));
  const parsedDateTo = dateInputSchema
    .catch(fallbackDateTo)
    .parse(firstString(searchParams.dateTo));
  let parsedDateFrom = dateInputSchema
    .catch(fallbackDateFrom)
    .parse(firstString(searchParams.dateFrom));

  if (dateInputToUtcMs(parsedDateFrom) > dateInputToUtcMs(parsedDateTo)) {
    parsedDateFrom = parsedDateTo;
  }

  let days = getInclusiveDateSpanDays(parsedDateFrom, parsedDateTo);
  if (days > MAX_BRANCH_ACTIVITY_WINDOW_DAYS) {
    parsedDateFrom = addDaysToDateInput(parsedDateTo, -(MAX_BRANCH_ACTIVITY_WINDOW_DAYS - 1));
    days = MAX_BRANCH_ACTIVITY_WINDOW_DAYS;
  }

  return {
    branchId: rawBranchId === "all" ? null : rawBranchId,
    dateFrom: parsedDateFrom,
    dateTo: parsedDateTo,
    days,
  };
}

export function parseReportsAnalyticsFilters(
  searchParams: Record<string, string | string[] | undefined>,
  defaultAnalyticsDays = 90,
  maxAnalyticsDays = 365
): ReportsAnalyticsFilters {
  const rawBranchId = branchActivityBranchIdSchema.parse(firstString(searchParams.branchId));
  const parsedAnalyticsDays = z.coerce
    .number()
    .int()
    .min(1)
    .catch(defaultAnalyticsDays)
    .default(defaultAnalyticsDays)
    .parse(firstString(searchParams.analyticsDays));
  const analyticsDays = Math.min(parsedAnalyticsDays, maxAnalyticsDays);

  return {
    analyticsDays,
    branchId: rawBranchId === "all" ? null : rawBranchId,
  };
}

export function parseBranchSalesOrdersFilters(
  searchParams: Record<string, string | string[] | undefined>,
  todayInput = getBusinessDateInput()
): BranchSalesOrdersFilters {
  const branchActivityFilters = parseBranchActivityFilters(searchParams, todayInput);
  const statusSchema = z
    .union([z.literal("all"), z.enum(BRANCH_SALES_ORDER_STATUS_OPTIONS)])
    .optional()
    .catch("all")
    .default("all");
  const parsedStatus = statusSchema.parse(firstString(searchParams.status));
  const query = z
    .string()
    .trim()
    .max(120)
    .optional()
    .catch("")
    .default("")
    .parse(firstString(searchParams.query));
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .catch(1)
    .default(1)
    .parse(firstString(searchParams.page));
  const pageSize = z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .catch(DEFAULT_BRANCH_SALES_ORDERS_PAGE_SIZE)
    .default(DEFAULT_BRANCH_SALES_ORDERS_PAGE_SIZE)
    .parse(firstString(searchParams.pageSize));

  return {
    ...branchActivityFilters,
    status: parsedStatus === "all" ? null : parsedStatus,
    query,
    page,
    pageSize,
  };
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
