/**
 * Business timezone utilities for 7Dashboard.
 *
 * All date filtering and "today" calculations use Asia/Manila (UTC+8) so that
 * business-day boundaries align with the Philippines locale regardless of the
 * server's system timezone. Changing BUSINESS_TIMEZONE here is the single point
 * of control if the app is ever deployed in a different region.
 *
 * Design rationale:
 *   - `new Date("YYYY-MMT00:00:00.000Z")` interprets dates as UTC midnight.
 *     In UTC+8 that means "today starts at 8 AM local time" — off by 8 hours.
 *   - `setHours(0, 0, 0, 0)` uses the Node process's local TZ, which may differ
 *     from the business TZ depending on the server/hosting environment.
 *   - Using Intl.DateTimeFormat to calculate the UTC equivalent of
 *     midnight-in-business-TZ is deterministic regardless of where the server runs.
 */

export const BUSINESS_TIMEZONE = "Asia/Manila";
const MISSING_DATE_VALUE = "";
type DateInput = Date | string | null | undefined;

function toValidDate(value: DateInput): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  // Treat YYYY-MM-DD as UTC midnight so labels stay stable across runtimes.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// ---------------------------------------------------------------------------
// Display formatters — always render in the business timezone so that
// timestamps shown to staff match Philippines local time regardless of where
// the Vercel function happens to run.
// ---------------------------------------------------------------------------

/** "Apr 13, 2026" */
export function formatDateMNL(date: DateInput): string {
  const resolvedDate = toValidDate(date);
  if (!resolvedDate) {
    return MISSING_DATE_VALUE;
  }

  return resolvedDate.toLocaleDateString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Apr 13" — no year, used in compact/relative time displays */
export function formatShortDateMNL(date: DateInput): string {
  const resolvedDate = toValidDate(date);
  if (!resolvedDate) {
    return MISSING_DATE_VALUE;
  }

  return resolvedDate.toLocaleDateString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    day: "numeric",
  });
}

/** "7:00 PM" */
export function formatTimeMNL(date: DateInput): string {
  const resolvedDate = toValidDate(date);
  if (!resolvedDate) {
    return MISSING_DATE_VALUE;
  }

  return resolvedDate.toLocaleTimeString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Apr 13, 2026, 7:00 PM" */
export function formatDateTimeMNL(date: DateInput): string {
  const resolvedDate = toValidDate(date);
  if (!resolvedDate) {
    return MISSING_DATE_VALUE;
  }

  return resolvedDate.toLocaleString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** "Apr 26" year, used in month-based chart labels */
export function formatMonthYearMNL(
  date: DateInput,
  year: "2-digit" | "numeric" = "2-digit"
): string {
  const resolvedDate = toValidDate(date);
  if (!resolvedDate) {
    return MISSING_DATE_VALUE;
  }

  return resolvedDate.toLocaleDateString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    month: "short",
    year,
  });
}

// Backward-compatible aliases used across the app.
export function formatDatePH(date: DateInput): string {
  return formatDateMNL(date);
}

export function formatShortDatePH(date: DateInput): string {
  return formatShortDateMNL(date);
}

export function formatTimePH(date: DateInput): string {
  return formatTimeMNL(date);
}

export function formatDateTimePH(date: DateInput): string {
  return formatDateTimeMNL(date);
}

/**
 * Returns a UTC Date object that corresponds to midnight (00:00:00.000) at the
 * start of the given date string (YYYY-MM-DD) in the business timezone.
 *
 * Example (Asia/Manila = UTC+8):
 *   businessDayStart("2026-04-13") → 2026-04-12T16:00:00.000Z  (i.e. April 13, 00:00 MNL)
 */
export function businessDayStart(dateStr: string): Date {
  // Parse the year/month/day components from the YYYY-MM-DD string directly to
  // avoid any implicit UTC vs local interpretation at this step.
  const [year, month, day] = dateStr.split("-").map(Number);

  // Construct an ISO string anchored to noon UTC so we can safely ask
  // Intl.DateTimeFormat what "local date parts" it maps to. This avoids DST
  // edge-cases where midnight UTC maps to the previous calendar day locally.
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  // Get the UTC offset for this timezone at this point in time.
  const offsetMs = getUTCOffsetMs(noonUTC, BUSINESS_TIMEZONE);

  // Midnight in the business TZ = noon UTC - 12h + offset correction.
  // Simpler: midnight local = Date.UTC(y, m, d, 0, 0, 0) - offsetMs
  const midnightUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0) - offsetMs;
  return new Date(midnightUtcMs);
}

/**
 * Returns a UTC Date object that corresponds to the exclusive end of the given
 * date string (i.e. start of the NEXT business day) — suitable for a `lt` filter.
 *
 * Example (Asia/Manila = UTC+8):
 *   businessDayEnd("2026-04-13") → 2026-04-13T16:00:00.000Z  (i.e. April 14, 00:00 MNL)
 */
export function businessDayEnd(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);

  // Advance by one calendar day, then take midnight of that day.
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const nextYear = nextDay.getUTCFullYear();
  const nextMonth = nextDay.getUTCMonth() + 1;
  const nextDayNum = nextDay.getUTCDate();

  const nextDayStr = [
    String(nextYear),
    String(nextMonth).padStart(2, "0"),
    String(nextDayNum).padStart(2, "0"),
  ].join("-");

  return businessDayStart(nextDayStr);
}

/**
 * Returns a UTC Date object corresponding to the start of "today" in the
 * business timezone. Use this wherever a dashboard or filter needs "today".
 */
export function businessStartOfToday(): Date {
  const now = new Date();
  const offsetMs = getUTCOffsetMs(now, BUSINESS_TIMEZONE);

  // Convert now to local business time, floor to midnight, convert back to UTC.
  const localMs = now.getTime() + offsetMs;
  const localMidnightMs = localMs - (localMs % (24 * 60 * 60 * 1000));
  return new Date(localMidnightMs - offsetMs);
}

/**
 * Returns the UTC offset in milliseconds for a given timezone at a given moment.
 * Positive = ahead of UTC (e.g. Asia/Manila UTC+8 → +28_800_000 ms).
 *
 * Implementation: format the date in both UTC and the target timezone, parse the
 * difference. This uses only the built-in Intl API (no external packages).
 */
function getUTCOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localDate = new Date(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  );

  // The difference between the "fake UTC date built from local parts" and the
  // original UTC timestamp is the UTC offset.
  return localDate.getTime() - date.getTime();
}

